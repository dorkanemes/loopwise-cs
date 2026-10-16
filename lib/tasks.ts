import { db } from './db';
import { TODAY, addDays } from './config';
import type { AccountHealth } from './health';

export type TaskRule = { key: string; label: string; description: string };

// Automatic task rules. Each produces at most one open task per account per
// "episode" (dedupe_key), so marking a task done doesn't make it reappear
// until the underlying situation changes (e.g. a new last-contact date).
export const RULES: TaskRule[] = [
  { key: 'at_risk', label: 'At-risk account', description: 'Health band is "At risk" (score under 50, or a critical flag such as a departed champion, open urgent ticket, 30%+ usage drop or overdue renewal). Creates a risk-review task with the top suggested action.' },
  { key: 'no_contact', label: 'No contact 30+ days', description: 'No logged touch of any kind in 30+ days. Creates a check-in task for the champion (or decision maker if there is no champion). Logging a note resets it.' },
  { key: 'renewal_90', label: 'Renewal in 90 days', description: 'Renewal date is within the next 90 days. Creates a "start renewal" task due within a week.' },
  { key: 'renewal_overdue', label: 'Renewal date passed', description: 'Renewal date is in the past with no signed renewal recorded. Creates an urgent task to confirm the paperwork.' },
  { key: 'no_champion', label: 'No active champion', description: 'Champion has left (or none on file). Creates a task to identify and onboard a new champion.' },
  { key: 'escalation', label: 'Open escalation', description: 'Open urgent/high support tickets. Creates a task to escalate with Support and update the customer.' },
  { key: 'renewal_missing', label: 'Renewal date missing', description: 'No renewal date on the account. Creates a task to confirm the contract term with Finance.' },
];

type Desired = { account_id: string; rule: string; title: string; detail: string; priority: string; due_date: string; dedupe_key: string };

export function desiredTasks(health: AccountHealth[], today = TODAY): Desired[] {
  const out: Desired[] = [];
  for (const h of health) {
    const a = h.account, m = h.metrics, id = a.account_id;
    const who = h.champion ?? h.decisionMaker;
    const big = a.arr_usd >= 100000;
    if (h.band === 'At risk')
      out.push({ account_id: id, rule: 'at_risk', title: `Risk review: ${a.account_name} (health ${h.score})`, detail: h.actions[0], priority: 'high', due_date: addDays(today, 2), dedupe_key: `at_risk|${id}` });
    if (m.daysSinceContact === null || m.daysSinceContact > 30)
      out.push({ account_id: id, rule: 'no_contact', title: `Check in with ${who ? who.name : a.account_name}: no contact for ${m.daysSinceContact ?? 'ever'} days`, detail: m.lastContact ? `Last logged touch ${m.lastContact}.` : 'No logged touch at all.', priority: big ? 'high' : 'normal', due_date: addDays(today, 5), dedupe_key: `no_contact|${id}|${m.lastContact ?? 'never'}` });
    if (m.daysToRenewal !== null && m.daysToRenewal >= 0 && m.daysToRenewal <= 90)
      out.push({ account_id: id, rule: 'renewal_90', title: `Start renewal: ${a.account_name} renews ${a.renewal_date} (${m.daysToRenewal} days)`, detail: h.actions.find((x) => x.startsWith('Renews')) ?? h.actions[0], priority: h.band === 'Healthy' ? 'normal' : 'high', due_date: addDays(today, 7), dedupe_key: `renewal_90|${id}|${a.renewal_date}` });
    if (m.daysToRenewal !== null && m.daysToRenewal < 0)
      out.push({ account_id: id, rule: 'renewal_overdue', title: `Confirm signed renewal: ${a.account_name} (date passed ${a.renewal_date})`, detail: h.actions[0], priority: 'high', due_date: today, dedupe_key: `renewal_overdue|${id}|${a.renewal_date}` });
    if (!h.champion)
      out.push({ account_id: id, rule: 'no_champion', title: `Identify a new champion at ${a.account_name}`, detail: h.decisionMaker ? `Start with ${h.decisionMaker.name} (${h.decisionMaker.title}).` : 'No decision maker on file either.', priority: 'high', due_date: addDays(today, 3), dedupe_key: `no_champion|${id}` });
    const esc = h.flags.some((f) => /urgent|high-priority/i.test(f.text));
    if (esc) {
      const reason = h.components.find((c) => c.key === 'support')?.reasons[0] ?? '';
      out.push({ account_id: id, rule: 'escalation', title: `Escalate open tickets for ${a.account_name}`, detail: reason, priority: 'high', due_date: addDays(today, 1), dedupe_key: `escalation|${id}|${reason}` });
    }
    if (!a.renewal_date)
      out.push({ account_id: id, rule: 'renewal_missing', title: `Confirm renewal date for ${a.account_name} with Finance`, detail: `Contract started ${a.contract_start}; no renewal date in the export.`, priority: 'normal', due_date: addDays(today, 7), dedupe_key: `renewal_missing|${id}` });
  }
  return out;
}

export async function syncTasks(health: AccountHealth[]) {
  const rows = desiredTasks(health);
  if (!rows.length) return;
  const s = db();
  await s`insert into tasks ${s(rows, 'account_id', 'rule', 'title', 'detail', 'priority', 'due_date', 'dedupe_key')} on conflict (dedupe_key) do nothing`;
}
