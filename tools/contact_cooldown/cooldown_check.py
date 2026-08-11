#!/usr/bin/env python3
"""Block re-sends to a recipient contacted too recently. See issue #11 — 5 confirmed
duplicate sends found (same recipient, 3-15 days apart, no cooldown) in the #16 audit."""

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path


def parse_date(s: str) -> datetime:
    return datetime.strptime(s.strip(), "%Y-%m-%d")


def load_last_sent(sent_log_path: Path, email_col: str, date_col: str) -> dict:
    last_sent: dict = {}
    skipped = 0
    with sent_log_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = row[email_col].strip().lower()
            if not email or not row.get(date_col, "").strip():
                skipped += 1
                continue
            try:
                date = parse_date(row[date_col])
            except ValueError:
                skipped += 1
                continue
            if email not in last_sent or date > last_sent[email]:
                last_sent[email] = date
    if skipped:
        print(f"Note: {skipped} sent-log row(s) skipped (missing/unparseable email or date) — "
              f"not counted toward cooldown, so a candidate they cover could still be wrongly marked eligible.",
              file=sys.stderr)
    return last_sent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidates_csv", help="Leads CSV to check before sending")
    parser.add_argument("sent_log_csv", help="CSV of prior sends: email,date_sent[,subject,...]")
    parser.add_argument("--candidate-email-col", default="email")
    parser.add_argument("--sent-email-col", default="email")
    parser.add_argument("--sent-date-col", default="date_sent")
    parser.add_argument("--cooldown-days", type=int, default=30,
                         help="Minimum days since last contact before a re-send is eligible (default: 30)")
    parser.add_argument("--as-of", default=None, help="Date to check cooldown against, YYYY-MM-DD (default: today)")
    parser.add_argument("--out-dir", default="out", help="Directory to write eligible.csv / blocked.csv (default: out)")
    args = parser.parse_args()

    as_of = parse_date(args.as_of) if args.as_of else datetime.today()
    last_sent = load_last_sent(Path(args.sent_log_csv), args.sent_email_col, args.sent_date_col)

    with Path(args.candidates_csv).open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if args.candidate_email_col not in reader.fieldnames:
            sys.exit(f"Column '{args.candidate_email_col}' not found. Columns present: {reader.fieldnames}")
        rows = list(reader)
        fieldnames = reader.fieldnames

    eligible_rows, blocked_rows = [], []
    for row in rows:
        email = row[args.candidate_email_col].strip().lower()
        row_out = dict(row)
        if email in last_sent:
            days_since = (as_of - last_sent[email]).days
            row_out["days_since_last_send"] = days_since
            row_out["last_sent"] = last_sent[email].strftime("%Y-%m-%d")
            if days_since < args.cooldown_days:
                blocked_rows.append(row_out)
                continue
        else:
            row_out["days_since_last_send"] = ""
            row_out["last_sent"] = ""
        eligible_rows.append(row_out)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_fieldnames = fieldnames + ["days_since_last_send", "last_sent"]

    for name, out_rows in (("eligible.csv", eligible_rows), ("blocked.csv", blocked_rows)):
        with (out_dir / name).open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=out_fieldnames)
            writer.writeheader()
            writer.writerows(out_rows)

    print(f"{len(rows)} candidates checked -> {len(eligible_rows)} eligible, {len(blocked_rows)} blocked (cooldown: {args.cooldown_days}d, as of {as_of.date()})")
    print(f"Written: {out_dir / 'eligible.csv'}, {out_dir / 'blocked.csv'}")


if __name__ == "__main__":
    main()
