import { db } from './db';
import { TODAY } from './config';
import { scoreAll, type Dataset, type Account, type Contact, type Usage, type Ticket, type Nps, type Activity, type AccountHealth } from './health';
import { syncTasks } from './tasks';

export async function loadDataset(): Promise<Dataset> {
  const s = db();
  const [accounts, contacts, usage, tickets, nps, activities] = await Promise.all([
    s`select account_id, account_name, industry, region, plan, arr_usd, seats_purchased, contract_start, renewal_date, merged_ids from accounts order by account_name`,
    s`select contact_id, account_id, name, title, email, role, is_active from contacts order by contact_id`,
    s`select account_id, month, active_users, sessions, projects_created from usage_monthly order by month`,
    s`select ticket_id, account_id, opened_date, priority, category, status, resolved_date, csat from support_tickets order by opened_date`,
    s`select response_id, account_id, contact_id, response_date, score, comment from nps_responses order by response_date`,
    s`select activity_id, account_id, date, type, contact_id, summary, logged_by, source from activities order by date, created_at`,
  ]);
  return {
    accounts: [...accounts] as unknown as Account[],
    contacts: [...contacts] as unknown as Contact[],
    usage: [...usage] as unknown as Usage[],
    tickets: [...tickets] as unknown as Ticket[],
    nps: [...nps] as unknown as Nps[],
    activities: [...activities] as unknown as Activity[],
  };
}

export type NextStep = { id: number; account_id: string; description: string; due_date: string; status: string; created_at: string };
export type Task = { id: number; account_id: string; rule: string; title: string; detail: string | null; priority: string; due_date: string | null; status: string; created_at: string; completed_at: string | null };

export async function loadNextSteps(accountId?: string): Promise<NextStep[]> {
  const s = db();
  const rows = accountId
    ? await s`select id, account_id, description, due_date, status, created_at::text as created_at from next_steps where account_id = ${accountId} order by status desc, due_date`
    : await s`select id, account_id, description, due_date, status, created_at::text as created_at from next_steps where status = 'open' order by due_date`;
  return [...rows] as unknown as NextStep[];
}

export async function loadTasks(accountId?: string): Promise<Task[]> {
  const s = db();
  const rows = accountId
    ? await s`select id, account_id, rule, title, detail, priority, due_date, status, created_at::text as created_at, completed_at::text as completed_at from tasks where account_id = ${accountId} order by status desc, due_date`
    : await s`select id, account_id, rule, title, detail, priority, due_date, status, created_at::text as created_at, completed_at::text as completed_at from tasks order by status desc, due_date, id`;
  return [...rows] as unknown as Task[];
}

/** Load everything, score every account and make sure rule-based tasks exist. */
export async function getPortfolio(): Promise<{ ds: Dataset; health: AccountHealth[] }> {
  const ds = await loadDataset();
  const health = scoreAll(ds, TODAY);
  await syncTasks(health);
  return { ds, health };
}
