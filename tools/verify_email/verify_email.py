#!/usr/bin/env python3
"""Verify email addresses in a leads CSV before sending. Syntax + MX/A check only — no SMTP handshake, no paid API. See issue #15."""

import argparse
import csv
import re
import smtplib
import socket
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import dns.resolver
import dns.exception

EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$")

RESOLVER = dns.resolver.Resolver()
RESOLVER.timeout = 5
RESOLVER.lifetime = 5


def _resolve_with_retry(domain: str, rtype: str):
    """One retry on timeout — under load, transient resolver contention is far more common
    than an actually-unreachable authoritative server, and a timeout is not evidence a
    domain is bad (same principle as the SMTP 'review' bucket below)."""
    for attempt in range(2):
        try:
            return RESOLVER.resolve(domain, rtype)
        except dns.exception.Timeout:
            if attempt == 1:
                raise
    raise dns.exception.Timeout()


def domain_has_mail_route(domain: str) -> tuple[str, str]:
    """Returns (status, reason) where status is 'ok' (has a mail route), 'bad' (confirmed
    no route), or 'unknown' (inconclusive — DNS trouble, not evidence of a bad address)."""
    try:
        answers = _resolve_with_retry(domain, "MX")
        if len(answers) > 0:
            return "ok", "mx_found"
    except dns.resolver.NoAnswer:
        pass
    except dns.resolver.NXDOMAIN:
        return "bad", "domain_not_found"
    except dns.exception.Timeout:
        return "unknown", "dns_timeout"
    except Exception as e:
        return "unknown", f"dns_error:{type(e).__name__}"

    # RFC 5321 fallback: no MX record means mail goes to the A/AAAA record directly.
    try:
        _resolve_with_retry(domain, "A")
        return "ok", "a_record_fallback"
    except dns.resolver.NXDOMAIN:
        return "bad", "domain_not_found"
    except dns.resolver.NoAnswer:
        return "bad", "no_mx_no_a"
    except dns.exception.Timeout:
        return "unknown", "dns_timeout"
    except Exception as e:
        return "unknown", f"dns_error:{type(e).__name__}"


def mx_hosts(domain: str) -> list[str]:
    try:
        answers = RESOLVER.resolve(domain, "MX")
        return [str(r.exchange).rstrip(".") for r in sorted(answers, key=lambda r: r.preference)]
    except Exception:
        return [domain]  # A-record fallback case: domain itself is the mail host


def smtp_probe(email: str, hosts: list[str], helo_domain: str, timeout: int) -> tuple[str, str]:
    """Best-effort RCPT TO check, no message sent. Catches mailbox-doesn't-exist bounces
    that a domain-level MX check can't. Inconclusive on greylisting/catch-all — those
    come back as 'review', not 'flag', since a network timeout isn't evidence of a bad address."""
    for host in hosts[:2]:
        try:
            with smtplib.SMTP(timeout=timeout) as smtp:
                smtp.connect(host, 25)
                smtp.helo(helo_domain)
                smtp.mail(f"probe@{helo_domain}")
                code, _ = smtp.rcpt(email)
                if code == 250:
                    return "clean", "smtp_accepted"
                if code in (550, 551, 553):
                    return "flag", f"smtp_rejected_{code}"
                return "review", f"smtp_ambiguous_{code}"
        except (socket.timeout, ConnectionRefusedError, smtplib.SMTPServerDisconnected):
            continue
        except Exception as e:
            return "review", f"smtp_probe_error:{type(e).__name__}"
    return "review", "smtp_unreachable"


def check_email(email: str, domain_cache: dict) -> tuple[str, str]:
    email = (email or "").strip()
    if not email:
        return "flag", "empty"
    if not EMAIL_RE.match(email):
        return "flag", "bad_syntax"

    domain = email.rsplit("@", 1)[1].lower()
    if domain not in domain_cache:
        domain_cache[domain] = domain_has_mail_route(domain)
    status, reason = domain_cache[domain]
    return {"ok": "clean", "bad": "flag", "unknown": "review"}[status], reason


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_csv", help="Leads CSV with an email column")
    parser.add_argument("--email-col", default="email", help="Column name containing the email address (default: email)")
    parser.add_argument("--out-dir", default="out", help="Directory to write clean.csv / flagged.csv / review.csv (default: out)")
    parser.add_argument("--workers", type=int, default=16, help="Parallel DNS lookup workers (default: 16)")
    parser.add_argument("--smtp-check", action="store_true",
                         help="Also RCPT-probe mailboxes that pass MX (catches 'mailbox doesn't exist' bounces MX-only misses). "
                              "Slower, and some mail servers greylist/block probing — ambiguous results go to review.csv, not flagged.csv.")
    parser.add_argument("--helo-domain", default="example.com", help="Domain to identify as in SMTP HELO/MAIL FROM (default: example.com)")
    parser.add_argument("--smtp-timeout", type=int, default=8, help="Per-host SMTP timeout in seconds (default: 8)")
    args = parser.parse_args()

    input_path = Path(args.input_csv)
    with input_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if args.email_col not in reader.fieldnames:
            sys.exit(f"Column '{args.email_col}' not found. Columns present: {reader.fieldnames}")
        rows = list(reader)
        fieldnames = reader.fieldnames

    domain_cache: dict = {}
    unique_domains = {row[args.email_col].strip().rsplit("@", 1)[-1].lower()
                       for row in rows
                       if row.get(args.email_col, "").strip() and "@" in row[args.email_col]}

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(domain_has_mail_route, d): d for d in unique_domains}
        for future in as_completed(futures):
            domain_cache[futures[future]] = future.result()

    clean_rows, flagged_rows, review_rows = [], [], []
    mx_cache: dict = {}
    for row in rows:
        email = row.get(args.email_col, "").strip()
        status, reason = check_email(email, domain_cache)

        if status == "clean" and args.smtp_check:
            domain = email.rsplit("@", 1)[1].lower()
            if domain not in mx_cache:
                mx_cache[domain] = mx_hosts(domain)
            status, reason = smtp_probe(email, mx_cache[domain], args.helo_domain, args.smtp_timeout)

        row_out = dict(row)
        row_out["verify_reason"] = reason
        bucket = {"clean": clean_rows, "flag": flagged_rows, "review": review_rows}[status]
        bucket.append(row_out)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_fieldnames = fieldnames + ["verify_reason"]

    for name, out_rows in (("clean.csv", clean_rows), ("flagged.csv", flagged_rows), ("review.csv", review_rows)):
        with (out_dir / name).open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=out_fieldnames)
            writer.writeheader()
            writer.writerows(out_rows)

    total = len(rows)
    print(f"{total} rows checked -> {len(clean_rows)} clean, {len(flagged_rows)} flagged, {len(review_rows)} review")
    print(f"Written: {out_dir / 'clean.csv'}, {out_dir / 'flagged.csv'}, {out_dir / 'review.csv'}")
    from collections import Counter
    for label, out_rows in (("flagged", flagged_rows), ("review", review_rows)):
        if out_rows:
            reasons = Counter(r["verify_reason"] for r in out_rows)
            print(f"  {label}:")
            for reason, count in reasons.most_common():
                print(f"    {reason}: {count}")


if __name__ == "__main__":
    main()
