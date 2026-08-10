# email-next

**One question, answered every time you open it: who do I email next, and what do I say?**

Given your business context (docs, plans, customer data), your contacts, and your Gmail history, this tool outputs a prioritized queue of emails you need to send to move toward a stated goal — subject line, body, and recipient — ready to send or auto-send.

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
        [Human review] --or-- [Auto-send on schedule]
```

### Inputs

| Input | Source | Purpose |
|---|---|---|
| Goal | User prompt ("close 5 more deals this quarter", "re-engage lapsed customers") | Defines what "next" is optimizing for |
| Business context | Uploaded docs — plans, pricing, positioning, FAQs | Grounds the *what to say* |
| Customers/contacts | CRM export or manual list | Defines the *who* |
| Gmail history | Gmail API (OAuth, read-only to start) | Grounds *what's already been said*, avoids repeating ground, flags who's gone quiet |
| Voice | [AI Executive Cookbook](../executive-cookbook) voice skill, trained on the user's real sent emails | Drafts sound like the user, not generic AI |

### Output

A ranked queue. Each item:

- Recipient
- Why now (the reasoning: "hasn't replied in 12 days after expressing pricing interest")
- Draft subject + body
- Priority score / goal linkage
- Action: approve & send, edit, skip, snooze

### Modes

1. **On-demand** — open the app, see today's queue, review before sending.
2. **Scheduled/autonomous** — queue drains on a cadence (e.g. daily at 8am) with drafts auto-sent, or auto-sent only below a confidence threshold and escalated to review above it.

## Architecture (proposed — easiest path first)

Optimizing for *fastest to a working v1*, not for scale:

- **Frontend + backend**: single Next.js app (App Router) — no separate services to stand up
- **Auth**: Google OAuth (Gmail read/send scopes) via NextAuth
- **Database**: Supabase (Postgres) — stores contacts, business docs, generated queue items, send history
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

- [ ] Confidence threshold for auto-send vs. review-required — where's the line?
- [ ] How far back does Gmail history get ingested, and how is it kept fresh (one-time import vs. ongoing sync)?
- [ ] Single-user tool or does it need multi-user/team accounts?
- [ ] Does "goal" get set once per session, or can multiple goals run concurrently (e.g. sales goal + customer-success goal)?
- [ ] What counts as a contact worth queuing — any Gmail correspondent, or only ones in a maintained contact/CRM list?

## Status

Spec-only. No code yet. Next step: answer the open questions above, then scaffold the Next.js app.
