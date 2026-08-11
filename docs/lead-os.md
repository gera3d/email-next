# Lead OS: prove the process before building the app

Pivot from the original plan: instead of building email-next as an app first, prove the underlying workflow ("Lead OS") manually/operationally across real outreach, then productize once it demonstrably works. This doc captures why, the evidence that drove the pivot, and the current plan.

## The real use case

Reach decision-makers across three verticals with highly personalized outreach aimed at booking a meeting:

1. **Trading card stores** — local/geographic, small-business owners
2. **Government entities needing professional services** (software/web development) — procurement-driven, longer cycle
3. **Private industry — marketing companies** who may need software/web dev subcontractor capacity

## What we found before building anything new

A real outreach pipeline already exists for vertical #2 (government), running for a few weeks. Pulling live data from Gmail — not the tracking spreadsheet, which turned out to be stale — surfaced hard numbers:

| Metric | Value | Read |
|---|---|---|
| Emails sent | 47 | Small sample, but real |
| Bounce rate | ~28-30% | Far above the ~5% threshold where Google starts treating a sending account as a spam risk |
| Reply rate | ~2% (1 real reply, 1 auto-reply, 0 meetings) | Very low even accounting for cold outreach norms |
| Duplicate sends caught | 3 contacts queued for a second near-identical email within ~2 weeks | No cooldown/dedup enforcement |
| Tracking accuracy | Spreadsheet showed 94 "scheduled" rows with zero outcome data; Gmail showed more actually sent, including an untracked reply | The log was disconnected from ground truth |
| List coverage | 102 of 713 qualified leads contacted | Volume was never the bottleneck |

Personalization in the existing system was also thinner than the stated goal: one inserted fact (a specific project/engagement) dropped into an otherwise identical template — not real per-lead customization.

## Red team / blue team on scaling to 3 verticals now

**Red team — reasons to slow down:**

1. A ~30% bounce rate risks the sending account itself being flagged before any new vertical gets a fair test — scaling volume now compounds the damage.
2. Low reply rate might not be a personalization problem at all — could be wrong offer, wrong channel (government procurement often runs through formal RFO/approved-vendor processes, not cold email), or mail silently landing in spam (meaning true engagement is even lower than measured).
3. Three verticals built simultaneously dilutes learning — a local retailer, a state procurement officer, and a marketing agency hiring manager decide completely differently; one unified engine risks being mediocre at all three.
4. New paid lead-source APIs (local business search, B2B data) cost money before the core loop (verify → personalize → track) is proven to work at all.
5. "Highly customized" doesn't scale for free — genuine per-lead research is either costly to automate well or degrades into the same shallow templating already found.
6. Email-first wasn't actually validated as the right channel for card stores (often don't monitor a general inbox) or marketing agencies (the most outreach-jaded audience of the three).

**Blue team — reasons to proceed:**

1. All three defects found (unverified addresses, thin personalization, broken tracking) are fixable engineering problems, not proof the channel is dead.
2. The reusable core — verify → personalize → draft → track truthfully — is genuinely vertical-agnostic; that's the part that was broken and the part worth building once, well.
3. 611 of 713 already-qualified government leads are untouched — a free, zero-marginal-cost test bed for the fixed process before spending on any new API.
4. Trading card stores is a plausible fast, cheap next vertical — short sales cycle, single decision-maker, cheap leads, real fallback channels (call/visit) if email underperforms.
5. Marketing companies is a different pitch if reframed as a partnership/subcontractor ask rather than a vendor pitch — worth testing on its own terms.

## Red team / blue team on the 3-step plan itself

**Red team — where the plan is underspecified or risks failing on its own terms:**

1. Step 1 has no defined method or fallback. "Confirm current reputation status" doesn't say with what tool, or what happens if the result is bad — no warm-up/new-domain contingency is written down.
2. Step 2 bundles three independent fixes (address verification, deeper personalization, real-time tracking) into one re-test. If the reply rate moves, there's no way to tell which fix caused it.
3. Step 2 spends the only untouched, pristine part of the list (611 leads) on a first-pass fix. If personalization needs a second iteration, there's no held-back reserve to test again cheaply.
4. No sample size or stopping rule for step 2. The original 47-email test was already too small to trust; "re-test on the 611" doesn't say how many sends before the number counts as trustworthy.
5. No numeric bar for step 3's gate ("only after a trustworthy number"). Without a target — e.g. bounce rate under some ceiling, reply rate over some floor — the gate is a judgment call that can be rationalized either way.
6. "Verify addresses before send" implies cost (SMTP/email-verification APIs aren't free) that isn't budgeted, in a plan that elsewhere argues for zero marginal spend.
7. Step 3 reads as an open choice ("pick one new vertical to test"), but the blue-team section above already picked trading card stores — the decision isn't actually gated on step 2's outcome, it's pre-made.

**Blue team — why the plan holds up anyway:**

1. Strict sequencing (no parallel work) is correct specifically because step 2's numbers are meaningless if step 1 finds the account already flagged — reputation damage would silently suppress replies no matter what else gets fixed.
2. Bundling the three fixes is a reasonable product call, not a science experiment. Step 2 answers "is the pipeline trustworthy now," not "which fix mattered most" — isolating each variable would cost calendar time this plan doesn't need to spend.
3. The 611 free leads are the cheapest real test available anywhere in this plan — zero marginal cost, real qualified leads, no new vendor spend. Using them first, before paying for anything, is the right order regardless of the holdout question below.
4. Reusing the government vertical avoids a cold start — sourcing trading card store leads before knowing whether the spine even works would repeat the exact mistake (volume before verification) that triggered this pivot.
5. Pre-selecting trading card stores isn't a flaw — its criteria (short cycle, single decision-maker, cheap leads, fallback channel) are legitimate on their own and don't need to wait on step 2. What step 2 actually gates is whether to proceed to *any* new vertical, not which one.

**Open before step 1 starts — needs a decision, not more analysis:**

- [ ] Sender-health method and fallback: which tool checks it, and what happens on a bad result (pause sending, warm a new domain, something else)
- [ ] Numeric gate for step 3: bounce-rate ceiling and reply-rate floor that count as "trustworthy"
- [ ] Sample size or time box for the step-2 re-test, so a second small-N test doesn't repeat the original mistake
- [ ] Address-verification method and its cost, if any
- [ ] Whether to reserve part of the 611 as a holdout for a second iteration, or accept spending the whole list on one pass

## Plan: three next steps, in order

Don't parallelize — each step's output determines whether the next is worth doing.

1. **Check sender health before sending anything else.** Don't pour more volume into a possibly-already-flagged account. Confirm current reputation status before any further sends, new or existing.
   - **Result (2026-08-11, proxy check via Gmail inbox — no Postmaster Tools access):** No evidence of a Google-side suspension, rate limit, or spam flag on gera3d@gmail.com in the last 30 days. All 18 bounce threads found are recipient-side `550 5.1.1 address not found` or delivery-delay, not sender-reputation rejections. This does not rule out reputation damage invisible from the inbox (e.g. quiet inbox-placement suppression) — Google Postmaster Tools is the only source of truth for that and requires a separate domain-verified login. Given no negative signal found, treat as cleared to proceed to step 2, but re-check after the step-2 re-test send.
2. **Fix the spine, then re-test on the free 611 untouched government leads.** Verify addresses before send, deepen personalization beyond one inserted fact, make tracking query Gmail directly (source of truth) instead of trusting a static sheet. This is the cheapest real experiment available — no new vertical, no new API spend.
3. **Only after that produces a trustworthy bounce/reply number, pick one new vertical to test** — trading card stores over marketing companies, since it's cheaper to source and has a real fallback channel. Don't stand up both new verticals at once.

See [github.com/gera3d/email-next/issues](https://github.com/gera3d/email-next/issues) for the tracked breakdown of each step.

## Findings — 2026-08-11

Investigating step 1 (sender health) surfaced three things beyond the original scope, plus fresher numbers than the 47-email sample this whole doc was built on.

**Certification status — checked, resolved, no issue.** The live "YRC Government Opportunity Pipeline" tracker (Google Sheet) states the SB(Micro) certification (ID 2053713) as "not submitted or awarded" / INCOMPLETE, dated 2026-07-16. But outreach citing that number as an active credential ("State SB Micro (#2053713) — ...") started 2026-07-27. Confirmed directly against Cal eProcure (logged-in WorkCenter, 2026-08-11): **Cert. ID 2053713, SB(Micro), Approved 2026-07-18, valid 2026-07-18 to 2028-07-31.** Approval landed 2 days after the tracker's last INCOMPLETE note and 9 days before the first email citing it — the claim was accurate when sent. The tracker itself is just stale.

**Fresher bounce numbers.** This doc's ~30% bounce rate comes from a 47-email sample. Actual current volume is far higher: Gmail shows **~201 "State SB Micro" sends** with **~18 bounce/undeliverable notifications in the last 60 days**, roughly **9%**. Better than 30%, but still well above the 5% threshold this doc's own red-team section flags as the reputation-risk line. Sends are ongoing — the most recent found is dated 2026-08-13.

**Data source mismatch — the "611 untouched leads" figure doesn't correspond to anything findable.** The actual live tracker doesn't hold a flat list of 713 qualified/611 untouched leads at all. It runs a stage-gated model (BID NOW / CAPTURE / WATCH / PARTNER / REJECT) with a hard rule — "OWNER APPROVAL REQUIRED" before any contact, email, registration, or account change — and its current live queue is **0 BID NOW, 0 CAPTURE, 3 WATCH, 0 PARTNER**. That does not match "611 untouched leads" in any form. Two possibilities, unresolved: either the 611/713 figures came from a different, unlocated source, or the ~201 "State SB Micro" sends are happening outside the tracker's own approval-gate process entirely. Worth resolving before trusting any "leads remaining" count.

### Build

- [ ] [#15](https://github.com/gera3d/email-next/issues/15) Verify email address before send — standalone script, syntax + MX check (in progress — chosen as first build target)
- [ ] [#16](https://github.com/gera3d/email-next/issues/16) Tracking reads Gmail directly instead of the stale sheet

### Fix

- [ ] Correct the stale certification status in the "YRC Government Opportunity Pipeline" Google Sheet — it still reads INCOMPLETE/not-submitted; actual status is Approved 2026-07-18–2028-07-31
- [ ] Reconcile or replace the "713 qualified / 611 untouched" figure used throughout this doc — no matching list was found; the real tracker uses a gated-stage model instead of a flat count

### Research

- [ ] Get an exact sent/bounce count (Gmail's thread-count estimates are rounded for large result sets) before step 3's "trustworthy number" gate can mean anything concrete
- [ ] Determine whether the ~201 "State SB Micro" sends are going through the Pipeline Control approval gate at all, given the tracker's own queue shows zero active BID NOW/CAPTURE rows — if they're bypassing it, that's a process gap bigger than the bounce rate
