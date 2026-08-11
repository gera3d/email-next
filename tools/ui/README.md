# Lead OS control panel

Local Streamlit UI over `tools/next_queue`, `tools/verify_email`, and `tools/contact_cooldown`. No new logic — every button runs one of those scripts and shows the CSV it produces.

## Run it

```bash
cd /Users/test/Documents/GovContracts
python3 -m streamlit run tools/ui/app.py
```

Opens at `http://localhost:8501`.

## Tabs

- **Next Queue** — the main one. Set the master CSV, sent-log CSV, and cooldown window, click **Generate queue**. Shows counts (total / flagged / dead / cooldown-blocked / ready) and the ranked table, with an expander to see exactly what got excluded and why.
- **Verify Emails** — upload any leads CSV, check it for dead domains independent of the full queue pipeline.
- **Cooldown Check** — upload a candidates CSV and a sent-log CSV, check for recent contact independent of the full pipeline.

## Stop it

`Ctrl+C` in the terminal it's running in, or:

```bash
pkill -f "streamlit run tools/ui/app.py"
```
