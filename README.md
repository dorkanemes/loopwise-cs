# Loopwise CS: a small customer success tool

A CS workspace for the 29 (not 30) Loopwise accounts I inherited. It answers one question first: **who do I call on Monday, and what do I say?**

**Live app:** _LIVE_URL_ (no login)

| Page | What it's for |
|---|---|
| **Portfolio** | Every account with plan, ARR, renewal, seat utilisation, last contact, health and priority. Sortable and filterable; "Why?" opens the score breakdown inline. |
| **Account page** | Health breakdown with reasons, usage chart, contacts, a merged timeline (notes, tickets, NPS), **log a note**, **set a dated next step**, suggested actions, the account's tasks. |
| **Renewals & risk** | Renewals in the next 90 days (plus overdue and unknown dates), all at-risk accounts with a suggested action, expansion opportunities. |
| **Tasks** | Tasks created automatically by 7 rules. Mark done or reopen; done stays done. |
| **Monday call list** | My 3 calls with why, who, and what I'd say, next to the engine's live ranking. |
| **How scoring works / Data issues** | The formula and every import fix, in the app itself. |

Built with Next.js 15 (App Router, server components and server actions) and Postgres on **Neon** via `postgres.js`, deployed on **Vercel**. No template or starter kit: plain `next` + `react` + `postgres`, about 1,500 lines, hand-rolled CSS. Built with Claude (Anthropic) as the AI pair.

---

## My Monday call list

| # | Account | Why now | Who / opener |
|---|---|---|---|
| 1 | **Harborline Freight**: $310k, renews 5 Dec (54 days) | Biggest account (13% of ARR). Active users **218 → 124 since April (−43%)**, half the seats unused. The champion mentioned a reorg in March, turned down a QBR in June, and nobody has contacted them in 116 days. No tickets and NPS 8, so it looks fine on the surface, which makes it the most dangerous kind of risk. The decision maker (VP Eng) has never been engaged. | Ivan Evans (champion), then Priya Zimmer (VP Eng). "Usage has come down since spring. Did the reorg go ahead? Let's sit down with Priya before the December renewal and shape it around what you need now." |
| 2 | **Brightpath Health**: $185k, renews 20 Jan (100 days) | The exec sponsor gave **NPS 10** and plans a Q4 rollout to two more departments, while users have **4 open tickets (1 urgent bug, EHR integration failures)**, 7 high/urgent tickets since August, CSAT 1–3, sessions −38%. Users and sponsor see two different products. A rollout on a broken integration would cost the expansion and put the renewal at risk. | Get a dated fix plan from Support first, then call Dana Xu (champion): "I've read every ticket since August, here's the fix plan. Let's make sure the rollout starts on solid ground." |
| 3 | **Corvid Analytics**: $96k, renews 28 Nov (47 days) | The champion left in August, the renewal email bounced, and no replacement has been found. She had been "keen to renew, asked about multi-year", and that goodwill left with her. The decision maker has never been engaged; users −21%. | Elena Okafor (Head of Delivery): "Dana had talked about renewing, possibly multi-year. Who owns this on your side now?" Recruit Ivan Alvarez (PM) as day-to-day champion. |

**Close calls, and why not:** *Sable Energy* ($88k): the renewal date passed on 30 Sep with an order form sent but no signature logged. That's a same-day email to confirm paperwork, not a call. *Pinegrove* ($54k, first renewal in 34 days, no live contact since March): book the renewal call this week. *Alder & Finch* ($210k, 102 days, healthy but no call has ever been logged): book a QBR. *Mapleton* ($4.8k, 1 of 10 users): likely churn, so handle it low-touch.

The scoring engine ranks the same three on top (priority 75 / 40 / 37; the next is 17).

---

## How the health score works

Two numbers, kept separate on purpose:

- **Health (0–100):** how the customer is doing.
- **Priority:** how much it matters to act *now*. Risk × revenue × time to renewal.

### Health: six signals, 100 points

| Signal | Pts | Scoring |
|---|---|---|
| **Usage trend** | 25 | Active users, Apr–Jun avg vs Aug–Sep avg. Full marks if flat or up, 0 at −30%, linear in between. |
| **Seat utilisation** | 15 | Active ÷ purchased seats. Full at ≥80%, 0 at ≤30%. Over 100% → expansion flag. |
| **Engagement recency** | 15 | Days since the last **call or meeting**. Full ≤30 days, 0 at ≥120. One-way template emails (47% of the old log) don't count. |
| **Relationship** | 15 | Active champion (8) + decision maker engaged in 6 months (4) + 2 or more contacts engaged (3), minus 4 per red flag found in recent notes (reorg, declined meeting, contact left, email bounced, frustration, "hard to use", no response, failures). |
| **Support** | 20 | 20 minus 8/5/2/1 per open urgent/high/normal/low ticket; −5 if 90-day CSAT < 3; −3 if 3+ high/urgent bug, performance or integration tickets in 90 days. |
| **Sentiment** | 10 | Latest NPS **from a contact still at the company**: 9–10 → 10, 7–8 → 6, ≤6 → 0–3. No response = neutral 5. |

**Bands:** Healthy ≥70 · Watch 50–69 · At risk <50. Two overrides:

- **Any critical flag → At risk**: champion left, open urgent ticket, users down 30%+, renewal date passed unsigned. An average hides single points of failure: Corvid scores 48, but the real story is that the only person who wanted to renew is gone.
- **Renewing within 120 days with no live conversation for 60+ days → never Healthy** (capped at Watch). The renewal motion hasn't started, whatever usage says.

Every score shows its reasons (portfolio "Why?" or the account page), e.g. *"Active users 201 → 133 (−34%) comparing 04–06 with 08–09"*, *"Ignored NPS 9 from Dana Whitfield (no longer at company)"*.

### Priority

```
priority = 100 × risk × √(ARR / largest ARR) × (0.5 + 0.5 × urgency)
risk     = (100 − health)/100, +0.15 if At risk
urgency  = 1.0 if overdue or ≤60 days · 0.85 ≤90 · 0.7 ≤120 · 0.45 ≤180 · 0.2 later · 0.5 unknown
```
The square root keeps the largest account from always winning.

### Design choices I'd defend

- **Missing data is neutral, not negative.** No NPS response, or a missing usage month, is shown but not punished.
- **Don't trust one happy exec.** Brightpath's NPS 10 doesn't cancel an open urgent bug; the support signal catches it.
- **Newsletters aren't a relationship.** Only calls and meetings reset engagement. Logging a call in the app does.
- **Weights are judgment, not fitted.** There's no churn history to fit against yet. First thing I'd do with real data is back-test.

### Automatic tasks (7 rules)

At-risk account · no contact 30+ days · renewal in ≤90 days · renewal date passed · no active champion · open urgent/high tickets · missing renewal date. Each task has a dedupe key tied to the triggering situation (e.g. `no_contact|ACC-001|2026-06-18`), so marking it done is permanent until the situation changes again. Tasks are synced on every page load.

---

## Data issues found (and what the import did)

The import (`scripts/clean.mjs` → `scripts/seed.mjs`) fixes or flags these, and lists them on the **Data issues** page:

1. **Duplicate account**: *Northwind Logistics* (ACC-017) and *Northwind Logistics Inc.* (ACC-029) have the same ARR, seats and dates; the CSM's notes say the account "got set up twice" after a legal-entity change. **Merged**; ARR counted once (**$2.40M, not $2.45M**). Its two duplicate contacts (CON-105/106, with capitalised emails) were dropped. *Action: confirm with Finance they aren't billed twice.*
2. **Renewal date already passed**: *Sable Energy*, 30 Sep 2026. Verbal yes, order form sent 22 Sep, no signature logged. Kept and flagged *Renewal overdue*.
3. **Missing renewal date**: *Quillfeather Media*. Not guessed; shown as Unknown, with a task to confirm with Finance.
4. **Departed champion still tagged champion**: Dana Whitfield (Corvid), `is_active: false`. Treated as no champion. Her **NPS 9 is excluded** from sentiment.
5. **Truncated email domains** (cut at 14 chars) for 9 accounts, e.g. `alderfinchlega.com`, `graniteconstru.com`, `meridianinsura.com`. Detected by comparing with the company name; not auto-repaired. *Verify before emailing.*
6. **Missing usage month**: *Ember Studios* has no July row. Not zero-filled (that would fake a drop).
7. **Usage over seat count**: *Tessellate* has 69 active users on 60 seats (115%). Kept and flagged as an expansion / true-up opportunity.
8. **Inconsistent email casing** (`Liam.nakamura@…`). Lowercased.
9. **Low-signal activity log**: 47 of 100 entries are template emails (product updates, help-centre links), and many are copy-pasted ("Quick sync on onboarding two new team leads" appears at 12 accounts). Kept on the timeline but excluded from engagement.

Re-running the import is safe: imported tables are replaced, while notes, next steps and tasks created in the app are never touched.

---

## What I'd build next

1. **Live data sync** (product analytics, Zendesk, CRM, billing) instead of JSON exports, with usage refreshed weekly.
2. **Back-test and tune the score** against real renewals and churn; add seat contraction and login-breadth (how many departments) signals.
3. **Renewal workflow**: stages (not started → proposal → verbal → signed) so "verbal yes, form sent" can't silently lapse like Sable.
4. **Contact hygiene alerts**: bounced emails, LinkedIn job changes and champion departures as automatic tasks the day they happen.
5. **AI drafting**: check-in emails and QBR one-pagers from the account page, grounded in the score reasons.
6. **Multi-CSM support**: owners, a team view, Slack digest of new high-priority tasks, and authentication.

---

## Run locally

```bash
cp .env.example .env.local     # set DATABASE_URL (any Postgres)
npm install
npm run seed                   # create tables + import /data/*.json
npm run dev
npm run test:score             # print the ranking straight from the JSON, no DB needed
```
`npm run build` runs the import first, so every Vercel deploy re-syncs the exports. "Today" is pinned to Monday 12 Oct 2026 (the brief's scenario date); override with `APP_TODAY`.
