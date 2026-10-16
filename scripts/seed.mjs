// Import step: loads the raw JSON exports, cleans them (scripts/clean.mjs),
// and writes them to Postgres. Safe to re-run: imported tables are replaced,
// anything created in the app (notes, next steps, tasks) is never touched.
//
//   DATABASE_URL=postgres://... node scripts/seed.mjs
//
// It also runs as part of `npm run build`, so every Vercel deploy re-syncs the exports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { clean } from './clean.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('[seed] DATABASE_URL not set: skipping import.');
  process.exit(0);
}
const TODAY = process.env.APP_TODAY || '2026-10-12';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const raw = {
  accounts: read('accounts.json'), contacts: read('contacts.json'), usage: read('usage_monthly.json'),
  tickets: read('support_tickets.json'), nps: read('nps_responses.json'), activities: read('activity_log.json'),
};
const ds = clean(raw, TODAY);

const u = new URL(url);
const local = ['localhost', '127.0.0.1'].includes(u.hostname);
u.searchParams.delete('sslmode');
u.searchParams.delete('channel_binding');
const sql = postgres(u.toString(), { ssl: local ? false : 'require', prepare: false, max: 1, onnotice: () => {} });

const SCHEMA = `
create table if not exists accounts (
  account_id text primary key, account_name text not null, industry text, region text, plan text,
  arr_usd integer not null, seats_purchased integer not null, contract_start date, renewal_date date,
  merged_ids text[] not null default '{}'
);
create table if not exists contacts (
  contact_id text primary key, account_id text not null references accounts(account_id) on delete cascade,
  name text, title text, email text, role text, is_active boolean not null default true
);
create table if not exists usage_monthly (
  account_id text not null references accounts(account_id) on delete cascade, month text not null,
  active_users integer, sessions integer, projects_created integer, primary key (account_id, month)
);
create table if not exists support_tickets (
  ticket_id text primary key, account_id text not null references accounts(account_id) on delete cascade,
  opened_date date, priority text, category text, status text, resolved_date date, csat integer
);
create table if not exists nps_responses (
  response_id text primary key, account_id text not null references accounts(account_id) on delete cascade,
  contact_id text, response_date date, score integer, comment text
);
create table if not exists activities (
  activity_id text primary key, account_id text not null references accounts(account_id) on delete cascade,
  date date not null, type text not null, contact_id text, summary text not null, logged_by text,
  source text not null default 'app', created_at timestamptz not null default now()
);
create table if not exists next_steps (
  id serial primary key, account_id text not null references accounts(account_id) on delete cascade,
  description text not null, due_date date not null, status text not null default 'open',
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists tasks (
  id serial primary key, account_id text not null references accounts(account_id) on delete cascade,
  rule text not null, title text not null, detail text, priority text not null default 'normal',
  due_date date, status text not null default 'open', dedupe_key text unique,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists import_issues (
  id serial primary key, file text, record_id text, issue text, resolution text, imported_at timestamptz not null default now()
);
`;

try {
  await sql.unsafe(SCHEMA);
  await sql.begin(async (tx) => {
    // Upsert accounts (never delete: app tables reference them).
    for (const a of ds.accounts) {
      await tx`insert into accounts ${tx(a, 'account_id', 'account_name', 'industry', 'region', 'plan', 'arr_usd', 'seats_purchased', 'contract_start', 'renewal_date', 'merged_ids')}
        on conflict (account_id) do update set account_name = excluded.account_name, industry = excluded.industry, region = excluded.region,
        plan = excluded.plan, arr_usd = excluded.arr_usd, seats_purchased = excluded.seats_purchased, contract_start = excluded.contract_start,
        renewal_date = excluded.renewal_date, merged_ids = excluded.merged_ids`;
    }
    // Merged duplicates: move any app data, then remove the duplicate account.
    for (const [dup, keep] of Object.entries(ds.idRemap).filter(([k]) => k.startsWith('ACC-'))) {
      for (const t of ['activities', 'next_steps', 'tasks']) await tx.unsafe(`update ${t} set account_id = $1 where account_id = $2`, [keep, dup]);
      await tx`delete from accounts where account_id = ${dup}`;
    }
    await tx`delete from contacts`;
    await tx`delete from usage_monthly`;
    await tx`delete from support_tickets`;
    await tx`delete from nps_responses`;
    await tx`delete from activities where source = 'import'`;
    await tx`delete from import_issues`;
    const ins = async (table, rows, cols) => { for (let i = 0; i < rows.length; i += 200) await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 200), ...cols)}`; };
    await ins('contacts', ds.contacts, ['contact_id', 'account_id', 'name', 'title', 'email', 'role', 'is_active']);
    await ins('usage_monthly', ds.usage, ['account_id', 'month', 'active_users', 'sessions', 'projects_created']);
    await ins('support_tickets', ds.tickets, ['ticket_id', 'account_id', 'opened_date', 'priority', 'category', 'status', 'resolved_date', 'csat']);
    await ins('nps_responses', ds.nps, ['response_id', 'account_id', 'contact_id', 'response_date', 'score', 'comment']);
    await ins('activities', ds.activities, ['activity_id', 'account_id', 'date', 'type', 'contact_id', 'summary', 'logged_by', 'source']);
    await ins('import_issues', ds.issues, ['file', 'record_id', 'issue', 'resolution']);
  });
  const [{ n }] = await sql`select count(*)::int as n from accounts`;
  console.log(`[seed] imported ${n} accounts, ${ds.contacts.length} contacts, ${ds.activities.length} activities; ${ds.issues.length} data issues logged.`);
} catch (e) {
  console.error('[seed] failed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
