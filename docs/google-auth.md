# Google auth & Gmail access

This is the trickiest part of the build, mainly because of Google's verification rules — not the OAuth code itself. Here's the plan for the single-user case.

## Why it's tricky

Gmail scopes are classified by Google as **sensitive** or **restricted**. Apps requesting them normally need to go through Google's app verification, and restricted scopes need an annual third-party security audit (CASA) — built for companies with thousands of users, not a solo tool for one person's inbox.

**We skip all of that** by keeping the OAuth consent screen unverified and used by exactly one account (yours).

## Scopes needed

| Scope | Why |
|---|---|
| `gmail.readonly` | Import the trailing 12 months of history for context |
| `gmail.compose` | Create drafts (covers create/read/update/delete of drafts, and sending) |

Don't request `https://mail.google.com/` (full mailbox access) or `gmail.modify` — broader than needed, and makes the unverified-app warning scarier than it needs to be.

## Setup path (single-user, no verification)

1. Create a Google Cloud project (free).
2. Enable the Gmail API for it.
3. Configure the OAuth consent screen:
   - User type: **External**
   - Publishing status: **In production** (not "Testing" — see why below)
   - Scopes: `gmail.readonly`, `gmail.compose`
   - No verification submitted — Google will show an **"unverified app"** warning at login.
4. Log in once: click through the warning (**Advanced → Go to email-next (unsafe)**) — this is expected and safe, it's your own app and your own data.

### Why "In production" and not "Testing"

Testing-mode apps issue refresh tokens that expire after 7 days — meaning a full re-login every week. Publishing status "In production" without verification removes that 7-day expiry; you still get the one-time scary warning screen, but the token then behaves like a normal long-lived refresh token. For a single user, click through the warning once and move on.

## Token handling

- Supabase Auth's Google provider handles the OAuth redirect/callback for login itself.
- Request the extra Gmail scopes on top of the standard login scopes at sign-in (`scopes` param), and pass `access_type=offline&prompt=consent` so Google actually returns a `refresh_token` (it only does this on first consent, or when `prompt=consent` forces it).
- Supabase returns `provider_token` / `provider_refresh_token` in the session **once**, at sign-in — it does not refresh third-party provider tokens on its own. Capture `provider_refresh_token` on first login and store it (encrypted) in our own `google_tokens` table.
- Our backend refreshes the Gmail access token itself via Google's token endpoint whenever it calls the Gmail API, using the stored refresh token.

## Data handling notes for the eventual privacy policy

Even unverified, single-user apps that touch Gmail should still follow Google's API Services User Data Policy in practice:
- Only request the two scopes above.
- Don't log full email bodies anywhere outside the app's own database.
- Store the refresh token encrypted at rest, not in plaintext.

## Open items

- [ ] Confirm current Google policy at build time — Google adjusts the testing/production token-expiry rules periodically, so re-verify the 7-day claim above right before implementing.
