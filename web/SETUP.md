# Setup

## Supabase

Project: `email-next` (`pteqkblqzlnfevmomqln`, us-west-1, free tier). Schema applied — see `docs/architecture.md` for the table shapes.

`.env.local` (not committed) needs:

```
NEXT_PUBLIC_SUPABASE_URL=https://pteqkblqzlnfevmomqln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key from Supabase project settings>
```

**Temporary:** RLS policies currently allow the `anon` role on `goals`/`contacts`/`queue_items`/`sent_emails`/`autonomy_state` (migration `temp_allow_anon_pre_oauth`), so the app works before real auth is wired. Drop that policy once Google sign-in lands — see below.

## Gmail OAuth (not wired yet)

Needs a Google Cloud project + OAuth client — see `docs/google-auth.md` for the exact steps. Once you have a Client ID/Secret, tell me and I'll wire up Supabase Auth's Google provider and drop the temporary anon RLS policy.

## Run it

```bash
cd web
npm install
npm run dev
```

Opens at `http://localhost:3000`.

## What's real right now vs. stubbed

- **Real**: Supabase-backed three-pane UI (goals rail / queue / draft detail), approve/skip/snooze/resolved-elsewhere actions write to the DB live.
- **Seeded, not live-generated**: the 40 queue items come from the real GovContracts `next_queue.py` output (real leads, real buying-fact reasoning), inserted directly via SQL — not from a live reasoning engine yet.
- **Not built yet**: Google sign-in, live Claude-drafted queue items, actual Gmail draft/send (Approve & Send currently only updates status in the DB), tracking/analytics, goal create/edit UI.
