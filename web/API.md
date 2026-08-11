# Agent API

For AI agents (Claude Code, Codex, or anything else) driving the outreach loop. No Google Cloud OAuth needed — the agent uses **its own** existing Gmail access to actually send/draft, and calls this API to read what's ready and report back what happened. See the architecture note at the bottom for why.

Base URL: `http://localhost:3000/api` (while running locally via `npm run dev`).

All requests need:
```
Authorization: Bearer <AGENT_API_KEY>
```
The key lives in `web/.env.local` as `AGENT_API_KEY`. Restart the dev server after changing it.

## Endpoints

### `GET /api/goals`
List all goals.
```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" http://localhost:3000/api/goals
```

### `POST /api/goals`
Create a goal. Body: `{ name, description?, target_segment?, cadence_limit_days?, tone?, status? }`. Only `name` is required.

### `GET /api/queue?goal_id=...&status=...`
List queue items. `status` defaults to `approved` — i.e. reviewed by a human, ready to actually send. Pass `status=pending` to see what's still awaiting review.
```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" \
  "http://localhost:3000/api/queue?goal_id=$GOAL_ID&status=approved"
```
Each item includes `contacts` (recipient) and `goals.name`.

### `GET /api/queue/:id`
One queue item by id.

### `PATCH /api/queue/:id`
Update status and/or draft content. Body fields, all optional:
```json
{
  "status": "sent",
  "draft_subject": "...",
  "draft_body": "...",
  "gmail_message_id": "...",
  "gmail_thread_id": "..."
}
```
`status` must be one of `pending | approved | sent | skipped | snoozed | resolved_elsewhere`.

**Reporting a real send:** when `status: "sent"` is set along with `gmail_message_id`, a row is also written to `sent_emails` — that's what future tracking/reply-watch reads from.

## The agent workflow

1. Poll `GET /api/queue?status=approved` for work a human has already reviewed and approved in the app UI.
2. For each item, send it using **your own Gmail access** (whatever MCP/tool connection you already have) — the `draft_subject`/`draft_body`/recipient email are right there in the response.
3. Report back: `PATCH /api/queue/:id` with `status: "sent"`, `gmail_message_id`, `gmail_thread_id`.

Tested end to end (2026-08-11): approved a real seeded item via curl, simulated an agent picking it up, marked it sent, confirmed the row landed in `sent_emails`, then reset it back to `pending` for the demo data.

## Why no Google Cloud OAuth for the app itself

`docs/google-auth.md` describes giving the *app's own backend* long-lived Gmail access — that requires a Google Cloud project + OAuth client, which only a human can create (Google requires it; no API or CLI shortcut exists, confirmed no `gcloud` available here either).

That setup is only needed if a human wants to click "send" in the browser with **no AI agent in the loop at all**. Since the actual workflow is agent-driven and agents already have their own Gmail access, that OAuth setup isn't a blocker for v1 — this API is the bridge instead. It's still worth doing eventually (see `docs/google-auth.md`) for a fully standalone, agent-independent app, but it's no longer gating anything right now.
