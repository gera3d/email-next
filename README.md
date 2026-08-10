# email-next

**One question, answered every time you open it: who do I email next, and what do I say?**

Given your business context (docs, plans, customer data), your contacts, and your Gmail history, this tool outputs a prioritized queue of emails you need to send to move toward a stated goal — subject line, body, and recipient — ready for your review. It then tracks what happens to each send (opened, replied) and feeds that back into how it writes the next one.

## The problem

Knowing who to follow up with and what to say is a research task you redo from scratch every time. You re-read old threads, re-remember what you offered, re-guess who's gone quiet. This tool does that lookup once and keeps a running queue.

## How it works

```
[Goal/prompt] + [Business context] + [Contacts] + [Gmail history]
                            |
                            v
                  Context assembly layer
                            |
                            v
                    Reasoning engine (LLM)
                    "who + what + why now"
                            |
                            v
              Prioritized email queue (drafts)
                            |
                            v
              [Human review] --> [Send]
                            |
                            v
              Delivery/open/reply tracking
                            |
                            v
              Feedback loop --> improves next draft
```

### Inputs

| Input | Source | Purpose |
|---|---|---|
| Goal | User prompt ("close 5 more deals this quarter", "re-engage lapsed customers"). Multiple goals can run at once. | Defines what "next" is optimizing for, and which contacts are in scope |
| Business context | Uploaded docs — plans, pricing, positioning, FAQs | Grounds the *what to say* |
| Customers/contacts | Gmail correspondents, scoped by the active goal(s) — not a fixed CRM list | Defines the *who*, per goal |
| Gmail history | Gmail API, one-time import of the trailing 12 months at connect time. No ongoing sync in v1. | Grounds *what's already been said*, avoids repeating ground, flags who's gone quiet |
| Voice | [AI Executive Cookbook](../executive-cookbook) voice skill, trained on the user's real sent emails | Drafts sound like the user, not generic AI |
| Send outcomes | Delivery/open/reply tracking on emails this tool sent | Tells the AI what's working so it can improve the next draft |

### Output

A ranked queue. Each item:

- Recipient
- Why now (the reasoning: "hasn't replied in 12 days after expressing pricing interest")
- Draft subject + body
- Priority score / goal linkage
- Action: approve & send, edit, skip, snooze

### Modes

1. **On-demand** — open the app, see today's queue, review before sending. **v1: every send goes through this.**
2. **Scheduled/autonomous** — queue drains on a cadence (e.g. daily at 8am) with drafts auto-sent. Deferred — no auto-send until the review-required version proves the drafts are good.

## Analytics & feedback loop

Every email this tool sends is tracked after the fact, and the results feed back into how future drafts get written. This is the gamification hook — sending toward a goal has a visible score, not just a queue you clear.

Ranked by how much the AI should trust the signal:

| Rank | Metric | How | Reliability |
|---|---|---|---|
| 1 | Delivered / bounced | Gmail API send confirmation | Ground truth — real SMTP event |
| 2 | Replied | Gmail thread watch on sent messages | Ground truth — real thread event, no proxy involved |
| 3 | Reply outcome | Reply text classified by LLM (booked call / said no / neutral / no response) | Modeled, not ground truth, but reading real text — trustworthy enough to score |
| 4 | Link clicked (if draft includes a link) | Redirect-wrapper tracking | Noisy — corporate security scanners auto-click links to scan for malware, inflating counts |
| 5 | Opened | Tracking pixel | **Not trustworthy — display only, never fed into scoring.** Apple Mail Privacy Protection (iOS 15+) pre-fetches every pixel on delivery regardless of whether the human opens it, pushing open rate toward ~100% artificially. Gmail's own image proxy adds further distortion. |

**Scoring loop uses ranks 1–3 only** (delivered → replied → reply outcome). Open rate and click rate are shown on the dashboard for visibility but excluded from the "what should I write next" reasoning.

Per-goal scoreboard: send count, reply rate, goal-conversion rate (visible; open/click rate shown as secondary/vanity stats). The AI favors the phrasing, subject style, and timing that have historically gotten *replies* — not opens — for this user, for this kind of goal.

See [docs/features.md](docs/features.md) for the full feature breakdown, [docs/google-auth.md](docs/google-auth.md) for the Gmail access plan, [docs/ui.md](docs/ui.md) for the interface spec, and [docs/journey.md](docs/journey.md) for the end-to-end user journey and the gaps it surfaced (deliverability guardrails, contact resolution, two-track feedback loop, progressive autonomy).

## Decisions (v1)

- **Auto-send: off.** Every draft is reviewed and sent manually. Revisit once draft quality is proven out.
- **Gmail history: one-time import, trailing 12 months.** No full-mailbox ongoing sync — but threads this tool actually sends into are watched going forward, since reply detection requires it. See [docs/journey.md](docs/journey.md#phase-4-outcome-tracking).
- **Single-user.** One person, logs in with their own Google account. No teams/multi-user in v1.
- **Multiple goals can run concurrently** (e.g. a sales goal and a customer-success goal active at the same time, each with its own queue).
- **Contact scope is goal-dependent**, not a fixed list — each goal determines which Gmail correspondents are relevant to it.

## Architecture (proposed — easiest path first)

Optimizing for *fastest to a working v1*, not for scale:

- **Frontend + backend**: single Next.js app (App Router) — no separate services to stand up
- **Auth**: Supabase Auth's Google provider, requesting Gmail scopes as extra OAuth scopes at sign-in — see [docs/google-auth.md](docs/google-auth.md)
- **Database**: self-hosted Supabase (Postgres) at `dashboard.why57.com` — stores contacts, business docs, goals, generated queue items, send history, reply-outcome classifications
- **LLM**: Claude API — context assembly + drafting + reply classification
- **Email send**: Gmail API (draft-first; user reviews and sends from the app, no auto-send in v1)
- **Scheduling**: deferred — not needed until autonomous mode is built
- **Hosting**: Vercel (app) + existing self-hosted Supabase (data/auth)

This repo starts as **spec only** — no code yet. Once the spec is solid, scaffold the app in a follow-up pass.

## Training the voice/skills

Before this tool drafts anything, it needs:

1. **Voice skill** — trained on the user's own past sent emails (tone, sentence length, sign-offs, how they say no).
2. **Business context skill** — trained on uploaded docs (offerings, pricing, positioning) so drafts are factually grounded, not hallucinated.
3. **Prioritization skill** — the "who's next and why" reasoning, informed by the AI Executive Cookbook's approach to executive judgment calls.

## Open questions

- [ ] When two concurrent goals both want to email the same contact, who wins — priority order, or does the tool merge into one email? (Leaning: priority order, flag the conflict in the UI rather than silently merging — see [docs/features.md](docs/features.md).)

## Status

Spec-only. No code yet. Next step: answer the open questions above, then scaffold the Next.js app.
