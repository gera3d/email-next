# verify_email

Standalone script for [issue #15](https://github.com/gera3d/email-next/issues/15) — checks a leads CSV for bad email addresses before sending. No paid API, no app, matches the "prove the process manually first" pivot in [docs/lead-os.md](../../docs/lead-os.md).

## Usage

```bash
pip3 install -r requirements.txt
python3 verify_email.py leads.csv --email-col email --out-dir out
```

Writes three files to `--out-dir`:

- `clean.csv` — passed all checks run
- `flagged.csv` — bad syntax, domain doesn't exist, or (with `--smtp-check`) mailbox rejected
- `review.csv` — inconclusive; not proof of a bad address, needs a human look

## What it checks

1. **Syntax** — regex match on the address.
2. **MX / A record** — does the domain have somewhere to route mail. Catches `domain_not_found` and syntax errors, both zero-cost.
3. **SMTP `RCPT TO` probe** (`--smtp-check`, opt-in) — connects to the actual mail server and asks if the mailbox exists, without sending a message. This is what actually catches most real-world bounces.

**Why MX-only isn't enough:** tested against 4 addresses that actually bounced from real "State SB Micro" sends — 3 of 4 had valid domains with working mail servers; only the specific mailbox was wrong. MX-only checking would have called all 3 clean. Only the SMTP probe catches that class of failure.

**`--smtp-check` limitations, by design:**

- Needs outbound port 25 — often blocked on cloud/CI networks and some ISPs. If every result comes back `smtp_unreachable`, that's the network, not the addresses — run it from a network that allows outbound 25.
- Catch-all domains (accept mail to any address) will falsely say every mailbox is fine — no way to detect this from outside.
- Greylisting (temporary 4xx to unknown senders) produces a false negative on first try — results land in `review.csv`, not `flagged.csv`, specifically so this doesn't silently exclude good leads.
- Ambiguous results always go to `review.csv`, never `flagged.csv` — a network hiccup should never be read as "bad address."

## Example

```bash
python3 verify_email.py leads.csv --smtp-check --helo-domain why57.com
```

```
611 rows checked -> 520 clean, 34 flagged, 57 review
Written: out/clean.csv, out/flagged.csv, out/review.csv
  flagged:
    smtp_rejected_550: 22
    domain_not_found: 9
    bad_syntax: 3
  review:
    smtp_unreachable: 41
    smtp_ambiguous_450: 16
```
