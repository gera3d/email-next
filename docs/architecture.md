# Architecture

How the pieces fit together, what data lives where, and the order to build it in.

## Data ownership split

Three stores, each owning what it's actually good at — not one database holding everything:

| Store | Owns | Why |
|---|---|---|
| **Gmail** (via API, live) | Email content — all thread/message bodies | Source of truth stays where it already lives. Never duplicated into our DB — fetched on demand when a thread needs to be displayed. Avoids maintaining a second, staler copy of the user's mailbox, and limits what a DB breach could expose. |
| **Google Drive** (via `drive.file` scope, in the user's own Drive) | Uploaded business-context documents (plans, pricing, FAQs) | Literal user ownership of their own docs — the app can only see files it created/opened, not their whole Drive. If the user deletes the app tomorrow, their docs stay theirs, untouched. |
| **Self-hosted Supabase** (Postgres, `dashboard.why57.com`) | App-generated structured state: contacts (resolved), goals, queue items, send history, tracking events, scores | This is the one part that's genuinely a database's job — the reasoning engine needs to filter/rank/join across goals, contacts, and outcomes fast. Small data volume for a single user; Postgres is already running. |

This resolves [issue #7](https://github.com/gera3d/email-next/issues/7) — see the issue for the Sheets-vs-Supabase reasoning.

## System components

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js app (Vercel)                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  UI (App      │  │  API routes   │  │  Background jobs    │  │
│  │  Router)      │  │  / server     │  │  (import, queue-gen, │  │
│  │  see ui.md    │  │  actions      │  │  reply-watch, digest)│  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘  │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
   ┌─────────────┐   ┌─────────────┐        ┌──────────────┐
   │  Supabase    │   │  Gmail API   │        │  Claude API   │
   │  (Postgres + │   │  (read live, │        │  (draft gen,  │
   │  Auth)       │   │  draft, send,│        │  reply class- │
   │              │   │  watch)      │        │  ification)   │
   └─────────────┘   └─────────────┘        └──────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │  Drive API   │
                      │  (drive.file │
                      │  — business  │
                      │  docs)       │
                      └─────────────┘
```

- **UI**: three-pane review surface (goals rail / queue / draft detail) — see [ui.md](ui.md)
- **API routes / server actions**: goal CRUD, queue actions (approve/edit/skip/snooze/resolve), settings
- **Background jobs**:
  - *Import job* — one-time, on connect: pulls 12 months of Gmail history, runs contact resolution
  - *Queue-generation job* — on demand or scheduled: runs the reasoning engine per active goal
  - *Reply-watch job* — polls (or push-notifies via Gmail API watch) threads the tool sent into, for replies
  - *Digest job* — daily, builds and sends the retention nudge

## Data model (Supabase / Postgres)

Rough schema — refine at implementation time, but this is the shape:

```sql
-- One row per connected Google account (single-user, but keep it a table not a singleton)
google_tokens (
  id, refresh_token_encrypted, scopes_granted[], connected_at
)

-- Resolved from Gmail history import — real people, not raw addresses
contacts (
  id, canonical_email, other_emails[], display_name, company_domain,
  is_human boolean,               -- false = filtered out (newsletters, no-reply, etc.)
  sent_reciprocity_score,         -- weight from Sent-folder correspondence, see issue #1
  last_contacted_at,
  cooldown_until                  -- suppresses re-queueing until this date
)

-- Suppression / do-not-contact, independent of any single goal
suppressed_contacts (
  contact_id, reason, created_at
)

goals (
  id, name, description, target_segment, cadence_limit_days, tone,
  status,                          -- active | paused | archived
  created_at
)

-- One row per business-context doc; content lives in Drive, this is just the pointer
business_context_docs (
  id, drive_file_id, title, doc_type, last_synced_at
)

queue_items (
  id, goal_id, contact_id,
  reasoning_text, source_snippet,  -- the literal quoted citation, see issue #2
  priority_score,
  draft_subject, draft_body,
  gmail_draft_id,
  status,                          -- pending | approved | sent | skipped | snoozed | resolved_elsewhere
  skip_reason,                     -- optional, one-click
  created_at, resolved_at
)

sent_emails (
  id, queue_item_id, gmail_message_id, gmail_thread_id,
  sent_at, delivered boolean, bounced boolean,
  replied_at, reply_classification,      -- booked_call | said_no | neutral | no_response
  approved_as_is boolean, edit_distance, -- draft-quality signal, see issue #4
  opened boolean, open_count,            -- display-only, never scored
  link_clicked boolean
)

-- Per goal + draft "pattern," tracks the approval streak that can unlock autonomy
autonomy_state (
  id, goal_id, pattern_label,
  consecutive_approved_as_is,
  suggested_at, enabled boolean default false   -- always starts false; app suggests, never auto-flips
)
```

## Build order

Matches [features.md](features.md), sequenced into milestones — each one should produce something you can actually use, not just infrastructure:

1. **M0 — Connect**: Google sign-in, Gmail + Drive scopes, token storage/refresh. (features.md §1)
2. **M1 — Ingest**: one-time Gmail import, contact resolution pass, cold-start voice calibration, guided business-context intake. (features.md §2)
3. **M2 — Goals**: create/edit goals (templates + structured fields), cooldown, "mark resolved elsewhere." (features.md §3)
4. **M3 — Queue**: reasoning engine producing cited, ranked queue items per goal. (features.md §4)
5. **M4 — Review**: three-pane UI, approve/edit/skip/snooze, drafts created in Gmail. (features.md §5–6)
6. **M5 — Tracking**: delivery/bounce, targeted reply-watch, reply classification, draft-edit tracking. (features.md §7)
7. **M6 — Feedback loop**: two-track learning (draft-quality + goal-outcome) feeding back into generation; scoreboard. (features.md §8)
8. **M7 — Retention & autonomy**: daily digest, history log, progressive autonomy suggestions. (features.md §9–10)

Each milestone should be independently demoable — M3 with a hand-rolled fake queue is fine to validate the UI before the reasoning engine is real, for example. Don't block later milestones on earlier ones being "finished," just usable.
