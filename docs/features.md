# Feature list

Every feature needed for a working v1, grouped by build order. Check these off as they land.

## 1. Auth & connection

- [ ] Sign in with Google (Supabase Auth, Google provider)
- [ ] Request Gmail scopes (`gmail.readonly`, `gmail.compose`) at sign-in — see [google-auth.md](google-auth.md)
- [ ] Store encrypted Google refresh token, backend-managed access-token refresh
- [ ] Settings page shows connection status + re-connect flow if the token ever breaks

## 2. Context ingestion

- [ ] One-time Gmail history import: trailing 12 months of threads, on connect
- [ ] **Contact resolution pass** (runs once, before goal logic touches anything): dedupe addresses to people, classify human vs. automated senders, drop automated senders from the contact pool, capture company/domain per contact — see [journey.md](journey.md#phase-0-connect--import)
- [ ] Business document upload (plans, pricing, FAQs, positioning) — stored and chunked for retrieval
- [ ] **Guided context intake** for cold start: a handful of direct questions (what you sell, who it's for, pricing model, top objection) so drafts are grounded even before any docs are uploaded
- [ ] Voice sample ingestion — pull from the user's own sent mail if there's enough of it (20+ messages); otherwise run a short voice-calibration flow instead of drafting in a generic voice

## 3. Goals

- [ ] Create/edit/archive a goal: name + structured fields (target segment, cadence limit, tone) + free-text description of what "done" looks like
- [ ] Goal templates to start from (re-engage cold leads, follow up on open proposals, renewal outreach, custom)
- [ ] Multiple goals active concurrently
- [ ] Each goal scopes which Gmail correspondents are relevant to it (not a fixed contact list — derived per goal, from the resolved contact pool)
- [ ] Conflict flag when two active goals would both target the same contact in the same cycle
- [ ] **Cooldown after skip/send** — don't re-suggest the same contact for N days (configurable)
- [ ] **"Mark resolved — handled elsewhere"** action on any contact/queue item, for things closed outside email (call, in-person, Slack)

## 4. Queue generation

- [ ] Reasoning engine: given a goal + business context + Gmail history, produce ranked "who to email next" candidates
- [ ] Each queue item includes: recipient, one-line "why now," priority score, draft subject + body
- [ ] **"Why now" cites its source** — a literal quoted line/snippet from the thread it's reasoning from, not just a generated summary, so it's checkable at a glance
- [ ] Drafts written in the user's voice (voice skill) and grounded in business context (no hallucinated facts/pricing)
- [ ] Regenerate a single queue item on demand (if the first draft misses)

## 5. Review UI

- [ ] Three-pane layout: goals rail, queue, draft detail — see [ui.md](ui.md)
- [ ] Inline thread context in the draft detail pane (no Gmail tab-switching needed to sanity-check)
- [ ] Actions per item: Approve & Send, Edit inline, Skip, Snooze (resurface after N days)
- [ ] Keyboard shortcuts for triage (j/k navigate, e edit, y send, s skip)

## 6. Sending

- [ ] Create Gmail draft via API on generation
- [ ] Send via Gmail API on approval (from in-app, not required to leave to Gmail)
- [ ] No auto-send in v1 — every send is a manual approval (see [README decisions](../README.md#decisions-v1))
- [ ] **Deliverability guardrails**: configurable daily send cap (well under Gmail's own ~500/day limit), sends paced out over the day rather than fired all at once
- [ ] **Bounce/complaint monitoring**: track bounce rate via the Gmail API signal available; pause sending and surface a warning if it spikes — see [journey.md](journey.md#phase-3-review--send)

## 7. Tracking & analytics

- [ ] Delivery/bounce tracking (Gmail API confirmation)
- [ ] **Targeted reply watch**: not a full mailbox resync, but ongoing watch on the specific threads this tool sent into, so replies are actually detectable — refines the "no ongoing sync" decision, see [journey.md](journey.md#phase-4-outcome-tracking)
- [ ] Reply-outcome classification via LLM (booked call / said no / neutral / no response)
- [ ] **Draft-edit tracking**: edit distance between generated draft and what was actually sent, or "approved as-is" flag — fast, immediate feedback on draft quality, independent of recipient behavior
- [ ] Open tracking (pixel) — display-only, explicitly excluded from the scoring/feedback loop
- [ ] Link-click tracking (if a draft includes a link) — secondary signal, noted as noisy (security-scanner false positives)
- [ ] Per-goal scoreboard: sent count, reply rate, goal-conversion rate, approve-as-is rate (opens/clicks shown as secondary stats)

## 8. Feedback loop (the "gamification" piece)

Two tracks, not one — they teach different things:

- [ ] **Draft-quality track** (fast): edit-distance/approve-as-is history feeds back into writing/voice/fact-accuracy quality
- [ ] **Goal-outcome track** (slow): reply/goal-outcome history feeds back into targeting/strategy — who to email and when
- [ ] Surface the scoreboard prominently in the UI so sending toward a goal feels like a visible score, not just queue-clearing
- [ ] **Progressive autonomy**: when a specific goal/draft-type hits a long streak of approve-as-is (e.g. 20 consecutive), *suggest* enabling auto-send for that pattern — never auto-enable. Scoped per goal-type, not global. This is the actual unlock the scoreboard earns.

## 9. History

- [ ] Searchable log of everything sent, with delivered/replied/outcome status per email

## 10. Retention

- [ ] Daily digest (email or push) summarizing what's ready to review + current scoreboard — the habit-loop trigger, since nothing else brings the user back to the queue

## Deferred (not v1)

- Scheduled/**global** autonomous auto-send (per-goal-type suggested autonomy from approval streaks is v1 — see section 8; a global always-on scheduler is not)
- Multi-user / team accounts
- Full-mailbox ongoing sync (v1 is one-time 12-month import + targeted reply-watch on tool-sent threads only, see section 7)
- General inbox/email-client functionality beyond goal-relevant mail
- Mobile app
