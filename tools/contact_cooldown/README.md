# contact_cooldown

Standalone script for [issue #11](https://github.com/gera3d/email-next/issues/11) — blocks a re-send to anyone contacted too recently. Built after the [#16 audit](../../docs/lead-os.md) found 5 confirmed duplicate sends (same recipient, 3-15 days apart, no cooldown enforced).

## Usage

```bash
python3 cooldown_check.py candidates.csv sent_log.csv --cooldown-days 30
```

- `candidates.csv` — leads you're about to send to (needs an `email` column)
- `sent_log.csv` — prior sends: `email,date_sent[,subject,...]`

Writes `eligible.csv` (safe to send) and `blocked.csv` (contacted too recently, with `days_since_last_send` and `last_sent`) to `--out-dir` (default `out`).

## Where `sent_log.csv` comes from

`sample_data/sent_log_2026-08-11.csv` is a real snapshot — 63 "State SB Micro" sends, pulled directly from Gmail during the [#16 audit](../../docs/lead-os.md#findings--2026-08-11-contd-exact-sendbouncereply-audit-issue-16). It's a point-in-time export, not a live feed — regenerate it (or wire up #16's standing version) before relying on it for a real send pass.

## Example: it catches the known duplicates

```bash
python3 cooldown_check.py sample_data/sent_log_2026-08-11.csv sample_data/sent_log_2026-08-11.csv --as-of 2026-08-13
```

Every one of the 5 known duplicate pairs from the #16 audit shows up correctly attributed to its *most recent* send date, not just the row being checked — e.g. `jennifer.kline@tahoe.ca.gov`'s 2026-07-29 row reports `last_sent: 2026-08-13`, the later of its two sends.
