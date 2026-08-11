#!/usr/bin/env python3
"""Lead OS control panel — buttons over the existing next_queue / verify_email / cooldown_check
scripts. No new logic here; this only runs them and shows the results."""

import subprocess
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import streamlit as st

REPO_ROOT = Path(__file__).resolve().parents[2]
TOOLS = REPO_ROOT / "tools"
RUNS_DIR = Path(__file__).parent / "runs"

st.set_page_config(page_title="Lead OS", layout="wide")
st.title("Lead OS control panel")
st.caption("Runs the real scripts in tools/. Every button here is one of those scripts, nothing more.")


def read_csv_safe(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def run_script(cmd: list[str]) -> tuple[int, str]:
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode, result.stdout + result.stderr


tab_queue, tab_verify, tab_cooldown = st.tabs(["Next Queue", "Verify Emails", "Cooldown Check"])

with tab_queue:
    st.subheader("Who to email next")
    col1, col2 = st.columns(2)
    with col1:
        master_csv = st.text_input("Master leads CSV", str(REPO_ROOT / "YRC_Master_Buyer_List_Polished.csv"))
        outreach_log = st.text_input("Sent-log CSV", str(REPO_ROOT / "YRC_Outreach_Log.csv"))
    with col2:
        cooldown_days = st.number_input("Cooldown days", min_value=1, value=30)
        limit = st.number_input("Rows to preview", min_value=5, value=25)

    if st.button("Generate queue", type="primary"):
        run_id = date.today().isoformat()
        out_dir = RUNS_DIR / f"queue_{run_id}"
        cmd = [sys.executable, str(TOOLS / "next_queue" / "build_queue.py"), master_csv,
               "--sent-log", outreach_log, "Buyer Email", "Scheduled Date",
               "--cooldown-days", str(cooldown_days), "--as-of", run_id,
               "--limit", str(limit), "--out-dir", str(out_dir)]
        with st.spinner("Running verify_email + cooldown_check + ranking..."):
            code, log = run_script(cmd)

        if code != 0:
            st.error("Failed — see log below")
            st.code(log)
        else:
            total = len(read_csv_safe(Path(master_csv)))
            flagged = len(read_csv_safe(out_dir / "manually_flagged.csv"))
            dead = len(read_csv_safe(out_dir / "verify_out" / "flagged.csv"))
            blocked = len(read_csv_safe(out_dir / "cooldown_out" / "blocked.csv"))
            queue = read_csv_safe(out_dir / "next_queue.csv")

            m1, m2, m3, m4, m5 = st.columns(5)
            m1.metric("Total leads", total)
            m2.metric("Manually flagged", flagged)
            m3.metric("Dead domains", dead)
            m4.metric("Cooldown-blocked", blocked)
            m5.metric("Ready to draft", len(queue))

            st.dataframe(queue, use_container_width=True, height=500)
            st.download_button("Download full queue CSV", queue.to_csv(index=False), "next_queue.csv")

            with st.expander("See what got excluded and why"):
                st.write("Manually flagged (review_flag set on the master list):")
                st.dataframe(read_csv_safe(out_dir / "manually_flagged.csv"), use_container_width=True)
                st.write("Dead-domain (verify_email flagged.csv):")
                st.dataframe(read_csv_safe(out_dir / "verify_out" / "flagged.csv"), use_container_width=True)
                st.write("Cooldown-blocked (contacted too recently):")
                st.dataframe(read_csv_safe(out_dir / "cooldown_out" / "blocked.csv"), use_container_width=True)

            with st.expander("Full run log"):
                st.code(log)

with tab_verify:
    st.subheader("Check a CSV's addresses for dead domains")
    uploaded = st.file_uploader("Leads CSV", type="csv", key="verify_upload")
    email_col = st.text_input("Email column name", "email", key="verify_email_col")
    smtp_check = st.checkbox("Also SMTP-probe mailboxes (slower, needs outbound port 25)")
    helo_domain = st.text_input("HELO domain for SMTP probe", "example.com", disabled=not smtp_check)

    if uploaded and st.button("Verify"):
        run_id = date.today().isoformat() + "_verify"
        out_dir = RUNS_DIR / run_id
        out_dir.mkdir(parents=True, exist_ok=True)
        input_path = out_dir / "input.csv"
        input_path.write_bytes(uploaded.getvalue())

        cmd = [sys.executable, str(TOOLS / "verify_email" / "verify_email.py"),
               str(input_path), "--email-col", email_col, "--out-dir", str(out_dir)]
        if smtp_check:
            cmd += ["--smtp-check", "--helo-domain", helo_domain]

        with st.spinner("Checking..."):
            code, log = run_script(cmd)

        if code != 0:
            st.error("Failed — see log below")
            st.code(log)
        else:
            clean = read_csv_safe(out_dir / "clean.csv")
            flagged = read_csv_safe(out_dir / "flagged.csv")
            review = read_csv_safe(out_dir / "review.csv")
            c1, c2, c3 = st.columns(3)
            c1.metric("Clean", len(clean))
            c2.metric("Flagged", len(flagged))
            c3.metric("Review", len(review))
            st.write("Flagged:")
            st.dataframe(flagged, use_container_width=True)
            st.write("Review (inconclusive, not proof of a bad address):")
            st.dataframe(review, use_container_width=True)
            with st.expander("Full run log"):
                st.code(log)

with tab_cooldown:
    st.subheader("Check candidates against a sent-log for recent contact")
    candidates_file = st.file_uploader("Candidates CSV", type="csv", key="cooldown_candidates")
    sent_log_file = st.file_uploader("Sent-log CSV", type="csv", key="cooldown_sentlog")
    cand_col = st.text_input("Candidate email column", "email", key="cand_col")
    sent_email_col = st.text_input("Sent-log email column", "email", key="sent_email_col")
    sent_date_col = st.text_input("Sent-log date column", "date_sent", key="sent_date_col")
    cd_days = st.number_input("Cooldown days", min_value=1, value=30, key="cd_days")

    if candidates_file and sent_log_file and st.button("Check cooldown"):
        run_id = date.today().isoformat() + "_cooldown"
        out_dir = RUNS_DIR / run_id
        out_dir.mkdir(parents=True, exist_ok=True)
        cand_path = out_dir / "candidates.csv"
        sent_path = out_dir / "sent_log.csv"
        cand_path.write_bytes(candidates_file.getvalue())
        sent_path.write_bytes(sent_log_file.getvalue())

        cmd = [sys.executable, str(TOOLS / "contact_cooldown" / "cooldown_check.py"),
               str(cand_path), str(sent_path),
               "--candidate-email-col", cand_col,
               "--sent-email-col", sent_email_col, "--sent-date-col", sent_date_col,
               "--cooldown-days", str(cd_days), "--out-dir", str(out_dir)]

        with st.spinner("Checking..."):
            code, log = run_script(cmd)

        if code != 0:
            st.error("Failed — see log below")
            st.code(log)
        else:
            eligible = read_csv_safe(out_dir / "eligible.csv")
            blocked = read_csv_safe(out_dir / "blocked.csv")
            c1, c2 = st.columns(2)
            c1.metric("Eligible", len(eligible))
            c2.metric("Blocked", len(blocked))
            st.dataframe(eligible, use_container_width=True)
            st.write("Blocked:")
            st.dataframe(blocked, use_container_width=True)
            with st.expander("Full run log"):
                st.code(log)
