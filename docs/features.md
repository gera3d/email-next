# Feature list

Every feature needed for a working v1, grouped by build order. Check these off as they land.

## 1. Auth & connection

- [ ] Sign in with Google (Supabase Auth, Google provider)
- [ ] Request Gmail scopes (`gmail.readonly`, `gmail.compose`) at sign-in — see [google-auth.md](google-auth.md)
- [ ] Store encrypted Google refresh token, backend-managed access-token refresh
- [ ] Settings page shows connection status + re-connect flow if the token ever breaks

## 2. Context ingestion

- [ ] One-time Gmail history import: trailing 12 months of threads, on connect
- [ ] Business document upload (plans, pricing, FAQs, positioning) — stored and chunked for retrieval
- [ ] Voice sample ingestion — pull from the user's own sent mail (via [AI Executive Cookbook](https://github.com/) voice skill approach) so drafts sound like them

## 3. Goals

- [ ] Create/edit/archive a goal: name + free-text description of what "done" looks like
- [ ] Multiple goals active concurrently
- [ ] Each goal scopes which Gmail correspondents are relevant to it (not a fixed contact list — derived per goal)
- [ ] Conflict flag when two active goals would both target the same contact in the same cycle

## 4. Queue generation

- [ ] Reasoning engine: given a goal + business context + Gmail history, produce ranked "who to email next" candidates
- [ ] Each queue item includes: recipient, one-line "why now," priority score, draft subject + body
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

## 7. Tracking & analytics

- [ ] Delivery/bounce tracking (Gmail API confirmation)
- [ ] Reply detection (Gmail thread watch on sent messages)
- [ ] Reply-outcome classification via LLM (booked call / said no / neutral / no response)
- [ ] Open tracking (pixel) — display-only, explicitly excluded from the scoring/feedback loop
- [ ] Link-click tracking (if a draft includes a link) — secondary signal, noted as noisy (security-scanner false positives)
- [ ] Per-goal scoreboard: sent count, reply rate, goal-conversion rate (opens/clicks shown as secondary stats)

## 8. Feedback loop (the "gamification" piece)

- [ ] Feed reply/goal-outcome history back into future draft generation — favor phrasing/subject style/timing that historically got replies for this user, this goal
- [ ] Surface the scoreboard prominently in the UI so sending toward a goal feels like a visible score, not just queue-clearing

## 9. History

- [ ] Searchable log of everything sent, with delivered/replied/outcome status per email

## Deferred (not v1)

- Scheduled/autonomous auto-send
- Multi-user / team accounts
- Ongoing Gmail sync (v1 is one-time 12-month import)
- General inbox/email-client functionality beyond goal-relevant mail
- Mobile app
