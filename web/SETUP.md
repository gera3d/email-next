# Setup

## Supabase

Project: `email-next` (`pteqkblqzlnfevmomqln`, us-west-1, free tier). Schema applied — see `docs/architecture.md` for the table shapes.

`.env.local` (not committed) needs:

```
NEXT_PUBLIC_SUPABASE_URL=https://pteqkblqzlnfevmomqln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key from Supabase project settings>
AGENT_API_KEY=<random secret -- see API.md>
```

**Temporary:** RLS policies currently allow the `anon` role on `goals`/`contacts`/`queue_items`/`sent_emails`/`autonomy_state` (migration `temp_allow_anon_pre_oauth`), so the app works before real auth is wired. Drop that policy once Google sign-in lands — see below.

## Agent API

`AGENT_API_KEY` is what Claude/Codex/any agent uses to call the REST API and drive the send loop — see `API.md`. Not the same thing as Google OAuth; agents use their own existing Gmail access to send, this API just reads/writes the queue.

## Gmail OAuth (not needed for the agent-driven workflow -- see API.md)

Only needed if a human wants to send directly from the browser with no agent in the loop. Needs a Google Cloud project + OAuth client — see `docs/google-auth.md` for the exact steps. Once you have a Client ID/Secret, tell me and I'll wire up Supabase Auth's Google provider and drop the temporary anon RLS policy.

## Run it

```bash
cd web
npm install
npm run dev
```

Opens at `http://localhost:3000`.

## What's real right now vs. stubbed

- **Real**: Supabase-backed three-pane UI (goals rail / queue / draft detail); approve/skip/snooze/resolved-elsewhere actions write to the DB live; history view with undo; goal create/edit/archive/reactivate; **cooldown is enforced by the app itself** -- approving/skipping/resolving a contact hides them from every goal's queue for that goal's configured cooldown window, and undo clears it; the agent API (`API.md`) is tested end to end including a real Gmail draft round-trip; an in-app "How to use this" panel.
- **Seeded, not live-generated**: the 40 queue items come from the real GovContracts `next_queue.py` output (real leads, real buying-fact reasoning), inserted directly via SQL — not from a live reasoning engine yet.
- **Not built yet**: Google sign-in for browser-direct sending (not needed for the agent-driven workflow -- see `API.md`), live Claude-drafted queue items (needs an Anthropic API key), reply/bounce tracking, scoreboard, contact resolution from live Gmail import, voice calibration, daily digest.

Every item above marked "Real" has been clicked through in an actual browser and verified against the database directly, not just code-reviewed.
