# UI spec

This is effectively a small mail client, not a dashboard with a queue bolted on. Layout borrows from Superhuman/Missive: a fast, three-pane, keyboard-friendly review surface.

## Layout

```
+------------------+---------------------------+-------------------------------+
|  Goals rail      |  Queue (selected goal)     |  Draft detail                |
|                   |                             |                               |
|  ● Sales (12)     |  1. Jane Doe        [92]   |  To: jane@acme.com            |
|    CS (4)         |     "gone quiet 12 days"    |  Subject: Following up on...  |
|    + New goal      |  2. Bob Smith       [78]   |                               |
|                   |     "asked about pricing"   |  [ body, editable ]           |
|  ---------------- |  3. Acme Corp       [65]   |                               |
|  Scoreboard       |     "renewal window"        |  Why now: ...thread context.. |
|  Sent: 34         |  ...                        |                               |
|  Reply rate: 22%  |                             |  [Approve & Send] [Edit]      |
|  Goal wins: 3      |                             |  [Skip] [Snooze]              |
+------------------+---------------------------+-------------------------------+
```

- **Goals rail (left)** — every active goal, queue count per goal, quick-create a new goal. Clicking a goal filters the queue to it.
- **Queue (center)** — ranked list for the selected goal (or "All" to see everything merged). Each row: recipient, one-line "why now," priority score. Click a row to load it into the detail pane.
- **Draft detail (right)** — full editable draft: to/subject/body, the reasoning behind it, and the relevant thread snippet it's responding to (so you don't have to context-switch to Gmail to sanity-check it). Actions: Approve & Send, Edit inline, Skip, Snooze (resurface in N days).
- **Scoreboard (bottom-left, persistent)** — the gamification strip: emails sent, reply rate, "goal wins" (replies classified as positive progress) — this session or this week, per goal and combined.

## Secondary screens

- **Settings → Connect Gmail** — the Google OAuth flow, shows connection status and last-imported-through date.
- **Settings → Business context** — upload/manage the docs the AI drafts from (plans, pricing, FAQs).
- **Settings → Goals** — create/edit/archive goals; each goal has a name, a free-text description of what "done" looks like, and status (active/paused).
- **History** — everything sent, searchable, with delivered/replied/outcome status per email (opens shown here too, labeled as unreliable).

## Interaction principles

- **Review-first, not inbox-zero.** The queue is not a to-do list to clear for its own sake — each item has a visible reason. Skipping is a legitimate, tracked action, not a failure state.
- **Keyboard shortcuts** for the queue (j/k to move, e to edit, y to approve/send, s to skip) — this is used daily, so it should feel like triaging mail, not filling out a form.
- **No new tab to Gmail required** for the review loop — thread context is inlined so approve/edit/send happens without leaving the app.
- **Conflict flag** — if two goals would email the same contact in the same cycle, the queue shows a small warning badge on both items rather than silently merging or silently duplicating (see open question in the main [README](../README.md)).

## Out of scope for v1

- Full inbox view / general email client functionality (reading unrelated mail, folders, search across all mail) — this tool only surfaces mail relevant to active goals.
- Mobile app — responsive web is enough for v1, single user.
