#!/usr/bin/env python3
"""Build the actual 'who to email next' queue: master leads list, minus manually-flagged
bad contacts, minus dead addresses (verify_email), minus anyone contacted too recently
(cooldown_check). This is the core output the whole project exists to produce."""

import argparse
import csv
import subprocess
import sys
from pathlib import Path

THIS_DIR = Path(__file__).parent


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout, end="")
    if result.returncode != 0:
        sys.exit(f"Command failed: {' '.join(cmd)}\n{result.stderr}")


def normalize_sent_log(paths_and_cols, out_path):
    """Merge N sent-log CSVs (each with its own email/date column names) into one
    common (email,date_sent) file cooldown_check.py can consume."""
    rows = []
    for path, email_col, date_col in paths_and_cols:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                email = row.get(email_col, "").strip()
                date = row.get(date_col, "").strip()
                if email and date:
                    rows.append({"email": email, "date_sent": date})
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["email", "date_sent"])
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


TIER_ORDER = {
    "Tier 1 - Website/CMS/Digital (direct fit)": 0,
    "Tier 2 - Software/IT (broader, relationship-building)": 1,
    "Tier 3 - UNSPSC Internet Services (ISP/email/hosting/app-hosting)": 2,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("master_csv", help="Master leads CSV")
    parser.add_argument("--email-col", default="Buyer Email")
    parser.add_argument("--flag-col", default="review_flag", help="Column holding manual do-not-contact notes (non-empty = excluded)")
    parser.add_argument("--tier-col", default="Tier")
    parser.add_argument("--sent-log", action="append", nargs=3, metavar=("CSV_PATH", "EMAIL_COL", "DATE_COL"),
                         default=[], help="A prior-sends CSV to merge in, repeatable. E.g. --sent-log log.csv \"Buyer Email\" \"Scheduled Date\"")
    parser.add_argument("--cooldown-days", type=int, default=30)
    parser.add_argument("--as-of", default=None)
    parser.add_argument("--smtp-check", action="store_true")
    parser.add_argument("--helo-domain", default="example.com")
    parser.add_argument("--limit", type=int, default=25, help="How many to show in the printed queue (default: 25)")
    parser.add_argument("--out-dir", default="out")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(args.master_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_rows = list(reader)

    unflagged = [r for r in all_rows if not r.get(args.flag_col, "").strip()]
    manually_flagged = [r for r in all_rows if r.get(args.flag_col, "").strip()]
    print(f"{len(all_rows)} total leads -> {len(manually_flagged)} manually flagged (excluded), {len(unflagged)} candidates")

    with (out_dir / "manually_flagged.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manually_flagged)

    candidates_csv = out_dir / "candidates.csv"
    with candidates_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unflagged)

    verify_out = out_dir / "verify_out"
    verify_cmd = [sys.executable, str(THIS_DIR.parent / "verify_email" / "verify_email.py"),
                  str(candidates_csv), "--email-col", args.email_col, "--out-dir", str(verify_out), "--workers", "8"]
    if args.smtp_check:
        verify_cmd += ["--smtp-check", "--helo-domain", args.helo_domain]
    run(verify_cmd)

    verified_clean = verify_out / "clean.csv"

    if args.sent_log:
        merged_log = out_dir / "merged_sent_log.csv"
        n = normalize_sent_log(args.sent_log, merged_log)
        print(f"Merged {len(args.sent_log)} sent-log source(s) -> {n} contact events")

        cooldown_out = out_dir / "cooldown_out"
        cooldown_cmd = [sys.executable, str(THIS_DIR.parent / "contact_cooldown" / "cooldown_check.py"),
                         str(verified_clean), str(merged_log),
                         "--candidate-email-col", args.email_col,
                         "--sent-email-col", "email", "--sent-date-col", "date_sent",
                         "--cooldown-days", str(args.cooldown_days), "--out-dir", str(cooldown_out)]
        if args.as_of:
            cooldown_cmd += ["--as-of", args.as_of]
        run(cooldown_cmd)
        eligible_csv = cooldown_out / "eligible.csv"
    else:
        eligible_csv = verified_clean

    with eligible_csv.open(newline="", encoding="utf-8") as f:
        eligible_rows = list(csv.DictReader(f))

    def sort_key(row):
        tier_rank = TIER_ORDER.get(row.get(args.tier_col, ""), 99)
        try:
            po = -float(str(row.get("Largest PO Amount ($)", "0")).replace(",", "") or 0)
        except ValueError:
            po = 0
        return (tier_rank, po)

    eligible_rows.sort(key=sort_key)

    queue_csv = out_dir / "next_queue.csv"
    with queue_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(eligible_rows[0].keys()) if eligible_rows else fieldnames)
        writer.writeheader()
        writer.writerows(eligible_rows)

    print(f"\n{len(eligible_rows)} eligible for the next queue. Written: {queue_csv}\n")
    print(f"Top {min(args.limit, len(eligible_rows))}:")
    for i, row in enumerate(eligible_rows[:args.limit], 1):
        title = row.get("Representative Purchase Title", "").strip()
        po = row.get("Largest PO Amount ($)", "")
        print(f"{i:3}. {row.get('Buyer Name', ''):25} {row.get(args.email_col, ''):35} {row.get('Department', '')[:30]:30} PO=${po:>10}  {title[:60]}")


if __name__ == "__main__":
    main()
