# User journey (expert pass)

Walking the full lifecycle end to end, the way a sales-engagement tool (Outreach/Salesloft/Apollo-class) or CRM would be designed, applied to a single-user personal tool. Each phase notes the gap in the original spec and the fix.

## Phase 0: Connect & import

**Gap:** "Contacts = Gmail correspondents" undersells the problem. 12 months of Gmail is mostly noise — newsletters, receipts, calendar notifications, no-reply senders. Feeding that raw into goal-matching produces garbage suggestions on day one, which kills trust immediately.

**Fix — contact resolution pass**, run once at import, before any goal logic touches the data:
- Dedupe email addresses to people (same person, multiple addresses)
- Classify sender type: human vs. automated (no-reply patterns, list-unsubscribe headers, bulk-sender heuristics)
- Drop automated senders from the contact pool entirely
- Capture company/domain per contact for context grounding

## Phase 1: Onboarding (cold start)

**Gap:** Voice skill needs real sent mail to learn from — thin or absent for a new user of the tool. Business-context "upload your docs" is a blank slate; most users upload nothing and the AI has nothing to ground drafts in.

**Fix:**
- Voice: use the imported sent mail if there's enough of it (say 20+ sent messages); otherwise run a short calibration (a few sample scenarios, user picks/edits the response) instead of silently drafting in a generic voice.
- Business context: guided intake — a handful of direct questions (what do you sell, who's it for, pricing model, the #1 objection you hear) before "upload more docs later." Gets the AI grounded in minutes instead of waiting on a document upload that may never happen.
- Goals: offer templates ("re-engage cold leads," "follow up on open proposals," "renewal outreach") with structured fields (target segment, cadence limit, tone) rather than pure free text — free text alone makes it hard for the AI to know who's in scope or what "success" means.

## Phase 2: First queue

**Gap:** The plan already has "why now" reasoning, but a generated sentence can misstate or hallucinate what happened. The first week is the trust-or-abandon window — every claim needs to be checkable in one glance.

**Fix:** Every queue item cites its source — a literal quoted line/snippet from the thread it's reasoning from, not just a generated summary. Click to see the full thread inline (already planned in the UI).

## Phase 3: Review & send

**Gap:** None structurally — draft-first, human-approves is the right default. But sending needs guardrails the spec doesn't have yet.

**Fix — deliverability guardrails**, since this sends from a personal Gmail account, not a dedicated ESP with reputation management:
- Daily send cap (configurable, conservative default — well under Gmail's own ~500/day limit)
- Space sends out over the day rather than firing a whole approved queue at once
- Track bounce rate and any spam-complaint signal available via the Gmail API; pause sending and surface a warning if it spikes
- This matters more, not less, because it's a personal account — there's no shared sender-reputation infrastructure behind it like a real ESP has

## Phase 4: Outcome tracking

**Gap:** "No ongoing sync" (decided) technically conflicts with reply detection — you can't know a thread got a reply without watching it.

**Fix — narrow scope, not full resync:** watch only the specific threads this tool sent into, for replies. That's a small, targeted watch, not a rebuild of the "one-time 12-month import" decision — the historical mailbox is still a one-time pull, but anything the tool itself sends stays watched going forward.

**Gap:** Reply/goal-outcome is the only feedback signal currently planned. It's real, but slow (waiting on the recipient) and coarse (one bit of feedback per email).

**Fix — two feedback tracks, not one:**
1. **Draft-quality feedback** (fast, immediate): how much you edit a draft before sending, or whether you approve it as-is. Teaches writing/voice/fact-accuracy quality independent of what the recipient does.
2. **Goal-outcome feedback** (slow, real-world): reply + reply classification. Teaches targeting/strategy quality — who to email and when.

These should be tracked and weighted separately, not blended into one score — they're teaching different things.

## Phase 5: Ongoing use (retention)

**Gap:** Nothing currently pulls the user back to review the queue. Queue-based tools die quietly from disuse without a trigger.

**Fix:** a daily digest (email or push) summarizing what's ready to review and the current scoreboard — the nudge that makes this a habit instead of a tool you forget exists.

**Gap:** No way to say "this is already handled" outside of an email reply (closed on a call, handled in person, resolved in Slack).

**Fix:** manual "mark resolved — handled elsewhere" action on any queue item or contact, so the queue stops nagging about something that's actually done.

**Gap:** A skipped contact can be re-queued next cycle with no memory of the skip.

**Fix:** cooldown after skip/send — don't re-suggest the same contact for N days (configurable), and optionally capture a one-click skip reason (wrong person / bad timing / already handled) to sharpen future ranking.

## Phase 6: Earning autonomy

**Gap:** Auto-send is currently a flat off/on switch, deferred indefinitely. That wastes the scoreboard the analytics section already built — the score should mean something beyond a vanity number.

**Fix — progressive autonomy, not a flat switch:** once a specific goal/draft-type has a long streak of approve-as-is (say 20 consecutive unedited approvals), the app *suggests* — never auto-enables — turning on auto-send for that specific pattern. Trust is earned and scoped per goal-type, not granted globally. This is the actual payoff of the gamification idea: the score unlocks capability, not just bragging rights.

## Summary of new decisions to fold into the main spec

- Contact resolution (dedupe + human/automated classification) runs at import, before goal-matching.
- Reply tracking requires watching threads-we-sent going forward — refine "no ongoing sync" to mean "no full resync, targeted reply-watch only."
- Feedback loop splits into draft-quality (edit distance/approve-as-is) and goal-outcome (reply classification) tracks.
- Deliverability guardrails (send caps, pacing, bounce monitoring) are a v1 requirement, not a later hardening pass — the account has no protection without them.
- "Mark resolved — handled elsewhere" and per-contact cooldown are v1 features, not deferred.
- Auto-send becomes a per-goal-type suggestion earned by approval streaks, not a global flag revisited later.
