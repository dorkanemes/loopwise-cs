// Health score + prioritisation. Pure functions, no imports, so it can be
// tested with `node --experimental-strip-types` and reused by every page.

export type Account = {
  account_id: string; account_name: string; industry: string; region: string; plan: string;
  arr_usd: number; seats_purchased: number; contract_start: string; renewal_date: string | null; merged_ids: string[];
};
export type Contact = { contact_id: string; account_id: string; name: string; title: string; email: string; role: string; is_active: boolean };
export type Usage = { account_id: string; month: string; active_users: number; sessions: number; projects_created: number };
export type Ticket = { ticket_id: string; account_id: string; opened_date: string; priority: string; category: string; status: string; resolved_date: string | null; csat: number | null };
export type Nps = { response_id: string; account_id: string; contact_id: string; response_date: string; score: number; comment: string | null };
export type Activity = { activity_id: string; account_id: string; date: string; type: string; contact_id: string | null; summary: string; logged_by: string; source: string };
export type Dataset = { accounts: Account[]; contacts: Contact[]; usage: Usage[]; tickets: Ticket[]; nps: Nps[]; activities: Activity[] };

export type Component = { key: string; label: string; points: number; max: number; reasons: string[] };
export type Flag = { level: 'critical' | 'warning' | 'opportunity'; text: string };
export type Band = 'Healthy' | 'Watch' | 'At risk';

export type AccountHealth = {
  account: Account;
  score: number;
  band: Band;
  components: Component[];
  flags: Flag[];
  metrics: {
    activeUsers: number | null; utilization: number | null; usageTrend: number | null; sessionsTrend: number | null;
    lastContact: string | null; lastTwoWay: string | null; daysSinceContact: number | null; daysSinceTwoWay: number | null;
    daysToRenewal: number | null; openTickets: number; latestNps: number | null;
  };
  champion: Contact | null;
  decisionMaker: Contact | null;
  priority: number;
  actions: string[];
  expansion: string[];
};

export const DEFAULT_TODAY = '2026-10-12';

const TWO_WAY = new Set(['call', 'meeting']);
// Phrases in the previous CSM's notes that signal relationship risk.
const RISK_PHRASES: [RegExp, string][] = [
  [/reorg/i, 'reorg mentioned'],
  [/declined/i, 'declined a meeting'],
  [/\bleft\b/i, 'key contact left'],
  [/bounced/i, 'email bounced'],
  [/frustrat/i, 'frustration expressed'],
  [/hard to use|too complicated/i, 'finds product hard to use'],
  [/no response/i, 'no response to outreach'],
  [/sync failures|failures/i, 'reported failures'],
];
const EXPANSION_PHRASES: [RegExp, string][] = [
  [/seats?/i, 'asked about / short of seats'],
  [/\bSSO\b/i, 'asked about SSO (Enterprise feature)'],
  [/roll(ing)? ?out|more departments|two more/i, 'planning a wider rollout'],
  [/Enterprise plan/i, 'Enterprise upgrade in discussion'],
];

export function days(from: string, to: string): number {
  const [a, b] = [from, to].map((d) => { const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, dd); });
  return Math.round((b - a) / 86400000);
}
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const money = (n: number) => `$${Math.round(n / 1000)}k`;

export function scoreAccount(a: Account, ds: Dataset, today = DEFAULT_TODAY): AccountHealth {
  const contacts = ds.contacts.filter((c) => c.account_id === a.account_id);
  const contactById = new Map(contacts.map((c) => [c.contact_id, c]));
  const usage = ds.usage.filter((u) => u.account_id === a.account_id).sort((x, y) => x.month.localeCompare(y.month));
  const tickets = ds.tickets.filter((t) => t.account_id === a.account_id);
  const nps = ds.nps.filter((n) => n.account_id === a.account_id).sort((x, y) => x.response_date.localeCompare(y.response_date));
  const acts = ds.activities.filter((x) => x.account_id === a.account_id && x.date <= today).sort((x, y) => x.date.localeCompare(y.date));

  const champion = contacts.find((c) => c.role === 'champion' && c.is_active) ?? null;
  const formerChampion = contacts.find((c) => c.role === 'champion' && !c.is_active) ?? null;
  const decisionMaker = contacts.find((c) => c.role === 'decision_maker' && c.is_active) ?? null;
  const components: Component[] = [];
  const flags: Flag[] = [];
  const expansion: string[] = [];

  // 1. Usage trend (25) — active users, Apr–Jun baseline vs last two months.
  let usageTrend: number | null = null, sessionsTrend: number | null = null;
  {
    const r: string[] = []; let pts = 12.5;
    if (usage.length >= 3) {
      const base = usage.slice(0, 3), recent = usage.slice(-2);
      const b = avg(base.map((u) => u.active_users))!, n = avg(recent.map((u) => u.active_users))!;
      const bs = avg(base.map((u) => u.sessions))!, ns = avg(recent.map((u) => u.sessions))!;
      usageTrend = n / b - 1; sessionsTrend = ns / bs - 1;
      pts = 25 * clamp((usageTrend + 0.3) / 0.3);
      r.push(`Active users ${Math.round(b)} → ${Math.round(n)} (${pct(usageTrend)}) comparing ${base[0].month.slice(5)}–${base[2].month.slice(5)} with ${recent[0].month.slice(5)}–${recent[1].month.slice(5)}`);
      r.push(`Sessions ${pct(sessionsTrend)} over the same period`);
      if (usageTrend <= -0.3) flags.push({ level: 'critical', text: `Active users down ${Math.abs(Math.round(usageTrend * 100))}% since spring` });
      else if (usageTrend <= -0.15 || sessionsTrend <= -0.3) flags.push({ level: 'warning', text: `Usage declining (users ${pct(usageTrend)}, sessions ${pct(sessionsTrend)})` });
    } else r.push('Not enough usage history: scored neutral');
    components.push({ key: 'usage', label: 'Usage trend', points: pts, max: 25, reasons: r });
  }

  // 2. Seat utilisation (15)
  const latest = usage[usage.length - 1];
  const utilization = latest ? latest.active_users / a.seats_purchased : null;
  {
    const r: string[] = []; let pts = 7.5;
    if (utilization !== null) {
      pts = 15 * clamp((utilization - 0.3) / 0.5);
      r.push(`${latest.active_users} of ${a.seats_purchased} seats active in ${latest.month} (${Math.round(utilization * 100)}%)`);
      if (utilization > 1) { r.push('Over the purchased seat count'); expansion.push(`Using ${Math.round(utilization * 100)}% of seats: true-up / add seats`); flags.push({ level: 'opportunity', text: `Over seat limit (${Math.round(utilization * 100)}%)` }); }
      else if (utilization >= 0.9) expansion.push(`${Math.round(utilization * 100)}% of seats in use: close to the limit`);
      if (utilization < 0.5) r.push('Under half the seats in use: shelfware risk at renewal');
    } else r.push('No usage data: scored neutral');
    components.push({ key: 'utilization', label: 'Seat utilisation', points: pts, max: 15, reasons: r });
  }

  // 3. Engagement (15) — recency of two-way contact (calls/meetings), not template emails.
  const lastAny = acts[acts.length - 1] ?? null;
  const lastTwo = [...acts].reverse().find((x) => TWO_WAY.has(x.type)) ?? null;
  const daysSinceContact = lastAny ? days(lastAny.date, today) : null;
  const daysSinceTwoWay = lastTwo ? days(lastTwo.date, today) : null;
  {
    const r: string[] = [];
    const pts = daysSinceTwoWay === null ? 0 : 15 * clamp(1 - (daysSinceTwoWay - 30) / 90);
    r.push(lastTwo ? `Last call/meeting ${daysSinceTwoWay} days ago (${lastTwo.date})` : 'No call or meeting on record');
    if (lastAny && lastAny !== lastTwo) r.push(`Last touch of any kind: ${lastAny.type} ${daysSinceContact} days ago`);
    if (daysSinceTwoWay === null) flags.push({ level: 'warning', text: 'No call or meeting on record' });
    else if (daysSinceTwoWay > 90) flags.push({ level: 'warning', text: `No live conversation in ${daysSinceTwoWay} days` });
    components.push({ key: 'engagement', label: 'Engagement recency', points: pts, max: 15, reasons: r });
  }

  // 4. Relationship (15) — champion, decision-maker access, breadth, red-flag notes.
  {
    const r: string[] = []; let pts = 0;
    const since = (d: string) => days(d, today) <= 180;
    if (champion) { pts += 8; r.push(`Active champion: ${champion.name} (${champion.title})`); }
    else {
      r.push(formerChampion ? `Champion ${formerChampion.name} has left; no replacement identified` : 'No champion on record');
      flags.push({ level: 'critical', text: formerChampion ? `Champion ${formerChampion.name} left` : 'No champion' });
    }
    const engagedIds = new Set([...acts.filter((x) => since(x.date) && x.contact_id).map((x) => x.contact_id!), ...nps.filter((n) => since(n.response_date)).map((n) => n.contact_id)]);
    const dmEngaged = decisionMaker && engagedIds.has(decisionMaker.contact_id);
    if (dmEngaged) { pts += 4; r.push(`Decision maker ${decisionMaker!.name} engaged in last 6 months`); }
    else r.push(decisionMaker ? `Decision maker ${decisionMaker.name} (${decisionMaker.title}) not engaged in 6 months` : 'No decision maker on record');
    const activeEngaged = [...engagedIds].filter((id) => contactById.get(id)?.is_active).length;
    if (activeEngaged >= 2) { pts += 3; r.push(`${activeEngaged} active contacts engaged (multi-threaded)`); }
    else r.push(`Only ${activeEngaged} active contact engaged: single-threaded`);
    const signals = new Set<string>();
    for (const x of acts.filter((x) => since(x.date))) for (const [re, label] of RISK_PHRASES) if (re.test(x.summary)) signals.add(label);
    for (const x of acts) for (const [re, label] of EXPANSION_PHRASES) if (days(x.date, today) <= 120 && re.test(x.summary)) expansion.push(`Notes ${x.date}: ${label}`);
    for (const n of nps) if (n.comment) for (const [re, label] of EXPANSION_PHRASES) if (re.test(n.comment)) expansion.push(`NPS comment: “${n.comment}” (${label})`);
    if (signals.size) { pts -= 4 * signals.size; r.push(`Red flags in notes: ${[...signals].join(', ')} (−${4 * signals.size})`); }
    components.push({ key: 'relationship', label: 'Relationship', points: Math.max(0, pts), max: 15, reasons: r });
  }

  // 5. Support (20) — open escalations and recent CSAT.
  const open = tickets.filter((t) => t.status !== 'closed');
  {
    const r: string[] = []; let pts = 20;
    const w: Record<string, number> = { urgent: 8, high: 5, normal: 2, low: 1 };
    for (const t of open) pts -= w[t.priority] ?? 2;
    if (open.length) r.push(`${open.length} open ticket(s): ${open.map((t) => `${t.ticket_id} ${t.priority} ${t.category}`).join('; ')}`);
    else r.push('No open tickets');
    const recent = tickets.filter((t) => t.csat !== null && t.resolved_date && days(t.resolved_date, today) <= 90);
    const csat = avg(recent.map((t) => t.csat!));
    if (csat !== null) {
      r.push(`Avg CSAT last 90 days: ${csat.toFixed(1)}/5 across ${recent.length} ticket(s)`);
      if (csat < 3) pts -= 5; else if (csat < 3.5) pts -= 2;
    }
    const last90 = tickets.filter((t) => days(t.opened_date, today) <= 90);
    const severe = last90.filter((t) => ['urgent', 'high'].includes(t.priority) && ['bug', 'performance', 'integration'].includes(t.category));
    if (severe.length >= 3) { pts -= 3; r.push(`${severe.length} high/urgent bug, performance or integration tickets in 90 days`); }
    if (open.some((t) => t.priority === 'urgent')) flags.push({ level: 'critical', text: 'Open urgent ticket' });
    else if (open.some((t) => t.priority === 'high')) flags.push({ level: 'warning', text: 'Open high-priority ticket' });
    components.push({ key: 'support', label: 'Support', points: Math.max(0, pts), max: 20, reasons: r });
  }

  // 6. Sentiment (10) — latest NPS from someone still at the company.
  let latestNps: number | null = null;
  {
    const r: string[] = []; let pts = 5;
    const valid = nps.filter((n) => contactById.get(n.contact_id)?.is_active !== false);
    const ignored = nps.filter((n) => contactById.get(n.contact_id)?.is_active === false);
    const last = valid[valid.length - 1];
    if (last) {
      latestNps = last.score;
      const who = contactById.get(last.contact_id);
      pts = last.score >= 9 ? 10 : last.score >= 7 ? 6 : (last.score / 6) * 3;
      r.push(`Latest NPS ${last.score} from ${who?.name ?? last.contact_id} (${who?.role ?? '?'}) on ${last.response_date}${last.comment ? `: “${last.comment}”` : ''}`);
      if (who?.role === 'decision_maker' && open.length >= 2) r.push('Score is from the exec sponsor; users raising tickets may feel differently');
      if (last.comment && /pricey|expensive/i.test(last.comment)) flags.push({ level: 'warning', text: 'Price sensitivity mentioned in NPS' });
    } else r.push('No NPS response from a current contact: scored neutral');
    for (const n of ignored) r.push(`Ignored NPS ${n.score} from ${contactById.get(n.contact_id)?.name} (no longer at company)`);
    components.push({ key: 'sentiment', label: 'Sentiment (NPS)', points: pts, max: 10, reasons: r });
  }

  // Renewal
  const daysToRenewal = a.renewal_date ? days(today, a.renewal_date) : null;
  if (daysToRenewal !== null && daysToRenewal < 0) flags.push({ level: 'critical', text: `Renewal date passed ${-daysToRenewal} days ago: confirm signature` });
  if (!a.renewal_date) flags.push({ level: 'warning', text: 'Renewal date missing' });

  const score = Math.round(components.reduce((s, c) => s + c.points, 0));
  let band: Band = score >= 70 ? 'Healthy' : score >= 50 ? 'Watch' : 'At risk';
  // A renewal inside 120 days with no recent live conversation is never "Healthy":
  // the renewal motion hasn't started, whatever the usage says.
  const renewalGap = daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal <= 120 && (daysSinceTwoWay === null || daysSinceTwoWay > 60);
  if (renewalGap) flags.push({ level: 'warning', text: `Renews in ${daysToRenewal} days with ${daysSinceTwoWay === null ? 'no call or meeting on record' : `no live conversation for ${daysSinceTwoWay} days`}` });
  if (band === 'Healthy' && renewalGap) band = 'Watch';
  if (days(a.contract_start, a.renewal_date ?? a.contract_start) <= 366 && renewalGap) flags.push({ level: 'warning', text: 'First renewal for this customer' });
  if (flags.some((f) => f.level === 'critical')) band = 'At risk';

  // Priority = how much it matters to act *now*: risk × revenue × time pressure.
  const risk = (100 - score) / 100 + (band === 'At risk' ? 0.15 : 0);
  const value = Math.sqrt(a.arr_usd / 310000);
  const urgency = daysToRenewal === null ? 0.5 : daysToRenewal <= 60 ? 1 : daysToRenewal <= 90 ? 0.85 : daysToRenewal <= 120 ? 0.7 : daysToRenewal <= 180 ? 0.45 : 0.2;
  const priority = Math.round(100 * risk * value * (0.5 + 0.5 * urgency));

  const actions = suggestActions({ a, score, band, flags, champion, formerChampion, decisionMaker, open, usageTrend, daysSinceTwoWay, daysToRenewal, utilization, expansion, contacts });

  return {
    account: a, score, band, components, flags, champion, decisionMaker, priority, actions, expansion: [...new Set(expansion)],
    metrics: {
      activeUsers: latest?.active_users ?? null, utilization, usageTrend, sessionsTrend,
      lastContact: lastAny?.date ?? null, lastTwoWay: lastTwo?.date ?? null, daysSinceContact, daysSinceTwoWay,
      daysToRenewal, openTickets: open.length, latestNps,
    },
  };
}

function suggestActions(x: {
  a: Account; score: number; band: Band; flags: Flag[]; champion: Contact | null; formerChampion: Contact | null; decisionMaker: Contact | null;
  open: Ticket[]; usageTrend: number | null; daysSinceTwoWay: number | null; daysToRenewal: number | null; utilization: number | null; expansion: string[]; contacts: Contact[];
}): string[] {
  const out: string[] = [];
  const dm = x.decisionMaker ? `${x.decisionMaker.name} (${x.decisionMaker.title})` : 'the economic buyer';
  const ch = x.champion ? x.champion.name : dm;
  const billing = x.contacts.find((c) => c.role === 'billing' && c.is_active);
  if (x.daysToRenewal !== null && x.daysToRenewal < 0)
    out.push(`Renewal date has passed. Confirm today that the order form was signed (chase ${billing ? billing.name + ', ' + billing.title : ch}); if not, agree a short extension so service isn't interrupted.`);
  if (!x.champion && x.formerChampion)
    out.push(`Champion ${x.formerChampion.name} has left. Call ${dm} this week: introduce yourself as the new CSM, confirm who owns the renewal, and ask who should replace ${x.formerChampion.name.split(' ')[0]} day to day.`);
  if (x.open.some((t) => ['urgent', 'high'].includes(t.priority)))
    out.push(`Escalate ${x.open.filter((t) => ['urgent', 'high'].includes(t.priority)).map((t) => t.ticket_id).join(', ')} with the Support lead, then call ${ch} with a dated fix plan before the issue reaches ${dm}.`);
  if (x.usageTrend !== null && x.usageTrend <= -0.3)
    out.push(`Usage is down ${Math.abs(Math.round(x.usageTrend * 100))}%. Book an exec check-in with ${dm}: find out what changed (reorg, team cuts, tool switch) and agree a re-adoption plan before renewal sizing.`);
  if (!x.daysSinceTwoWay || x.daysSinceTwoWay > 60)
    out.push(`No live conversation in ${x.daysSinceTwoWay ?? 'ever'} days. Call ${ch} to reset the cadence and book a QBR.`);
  if (x.daysToRenewal !== null && x.daysToRenewal >= 0 && x.daysToRenewal <= 90)
    out.push(x.band === 'Healthy'
      ? `Renews in ${x.daysToRenewal} days and healthy. Send the renewal proposal to ${dm} now, and offer multi-year or an expansion bundle.`
      : `Renews in ${x.daysToRenewal} days. Fix the risks above first, then put renewal terms in front of ${dm} at least 30 days out.`);
  if (!x.a.renewal_date) out.push('No renewal date on file. Confirm the contract term with Finance.');
  if (x.flags.some((f) => /Price sensitivity/.test(f.text))) out.push('Price was raised in feedback. Prepare a value recap (usage, outcomes) before renewal.');
  if (x.expansion.length && x.band !== 'At risk') out.push(`Expansion signal: ${x.expansion[0]}. Propose a seat / plan upgrade.`);
  if (!out.length) out.push(`Healthy. Keep the regular cadence with ${ch} and look for case-study or referral opportunities.`);
  return out;
}

export function scoreAll(ds: Dataset, today = DEFAULT_TODAY): AccountHealth[] {
  return ds.accounts.map((a) => scoreAccount(a, ds, today)).sort((x, y) => y.priority - x.priority);
}

export { money };
