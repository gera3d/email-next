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

| Metric | How | Feeds back into |
|---|---|---|
| Delivered | Gmail API send confirmation | Baseline — did it even go out |
| Opened | Tracking pixel per sent email | Which subject lines / send times get attention |
| Replied | Gmail thread watch on sent messages | Which framing/asks actually move the goal forward |
| Goal progress | Replies classified against the goal (e.g. "booked a call," "said no," "no response") | Ranking of what kind of email to send next, and to whom |

Per-goal scoreboard: send count, open rate, reply rate, goal-conversion rate. The AI uses this history as feedback — favoring the phrasing, subject style, and timing that historically get opens/replies for this user, for this kind of goal.

## Decisions (v1)

- **Auto-send: off.** Every draft is reviewed and sent manually. Revisit once draft quality is proven out.
- **Gmail history: one-time import, trailing 12 months.** No ongoing sync in v1.
- **Single-user.** One person, logs in with their own Google account. No teams/multi-user in v1.
- **Multiple goals can run concurrently** (e.g. a sales goal and a customer-success goal active at the same time, each with its own queue).
- **Contact scope is goal-dependent**, not a fixed list — each goal determines which Gmail correspondents are relevant to it.

## Architecture (proposed — easiest path first)

Optimizing for *fastest to a working v1*, not for scale:

- **Frontend + backend**: single Next.js app (App Router) — no separate services to stand up
- **Auth**: Google OAuth (Gmail read/send scopes) via NextAuth — single user, sign in with their own Google account
- **Database**: Supabase (Postgres) — stores contacts, business docs, generated queue items, send history, open/reply events
- **LLM**: Claude API — context assembly + drafting
- **Email send**: Gmail API (send as draft by default; direct send only once trusted)
- **Scheduling**: cron (Vercel Cron or Supabase scheduled functions) for autonomous mode
- **Hosting**: Vercel

This repo starts as **spec only** — no code yet. Once the spec is solid, scaffold the app in a follow-up pass.

## Training the voice/skills

Before this tool drafts anything, it needs:

1. **Voice skill** — trained on the user's own past sent emails (tone, sentence length, sign-offs, how they say no).
2. **Business context skill** — trained on uploaded docs (offerings, pricing, positioning) so drafts are factually grounded, not hallucinated.
3. **Prioritization skill** — the "who's next and why" reasoning, informed by the AI Executive Cookbook's approach to executive judgment calls.

## Open questions

- [ ] How does a reply get classified against a goal automatically (booked call vs. no vs. no-response) — manual tagging, or LLM classification of the reply text?
- [ ] Tracking pixel opens are notoriously unreliable (Gmail image proxy caching, Apple Mail privacy protection) — how much do we lean on open rate vs. reply rate as the real signal?
- [ ] When two concurrent goals both want to email the same contact, who wins — priority order, or does the tool merge into one email?

## Status

Spec-only. No code yet. Next step: answer the open questions above, then scaffold the Next.js app.
