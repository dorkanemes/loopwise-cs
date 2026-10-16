'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { TODAY } from '@/lib/config';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function logActivity(form: FormData) {
  const account_id = str(form, 'account_id');
  const summary = str(form, 'summary');
  const type = ['note', 'call', 'meeting', 'email'].includes(str(form, 'type')) ? str(form, 'type') : 'note';
  const date = isDate(str(form, 'date')) ? str(form, 'date') : TODAY;
  const contact_id = str(form, 'contact_id') || null;
  if (!account_id || !summary) return;
  const activity_id = `APP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await db()`insert into activities (activity_id, account_id, date, type, contact_id, summary, logged_by, source)
    values (${activity_id}, ${account_id}, ${date}, ${type}, ${contact_id}, ${summary}, ${'You (new CSM)'}, ${'app'})`;
  revalidatePath(`/accounts/${account_id}`);
  revalidatePath('/');
}

export async function addNextStep(form: FormData) {
  const account_id = str(form, 'account_id');
  const description = str(form, 'description');
  const due_date = str(form, 'due_date');
  if (!account_id || !description || !isDate(due_date)) return;
  await db()`insert into next_steps (account_id, description, due_date) values (${account_id}, ${description}, ${due_date})`;
  revalidatePath(`/accounts/${account_id}`);
  revalidatePath('/renewals');
}

export async function completeNextStep(form: FormData) {
  const id = Number(str(form, 'id'));
  const account_id = str(form, 'account_id');
  const reopen = str(form, 'reopen') === '1';
  await db()`update next_steps set status = ${reopen ? 'open' : 'done'}, completed_at = ${reopen ? null : new Date()} where id = ${id}`;
  revalidatePath(`/accounts/${account_id}`);
}

export async function setTaskStatus(form: FormData) {
  const id = Number(str(form, 'id'));
  const status = str(form, 'status') === 'done' ? 'done' : 'open';
  await db()`update tasks set status = ${status}, completed_at = ${status === 'done' ? new Date() : null} where id = ${id}`;
  revalidatePath('/tasks');
  const account_id = str(form, 'account_id');
  if (account_id) revalidatePath(`/accounts/${account_id}`);
}
