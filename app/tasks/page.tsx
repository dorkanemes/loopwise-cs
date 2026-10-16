import Link from 'next/link';
import { getPortfolio, loadTasks } from '@/lib/data';
import { RULES } from '@/lib/tasks';
import TaskTable from '../TaskTable';

export const dynamic = 'force-dynamic';

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string; rule?: string }> }) {
  const sp = await searchParams;
  const show = sp.show === 'done' || sp.show === 'all' ? sp.show : 'open';
  const { health } = await getPortfolio(); // also creates any newly-triggered tasks
  const all = await loadTasks();
  const names = Object.fromEntries(health.map((h) => [h.account.account_id, h.account.account_name]));
  const prio = Object.fromEntries(health.map((h) => [h.account.account_id, h.priority]));
  const tasks = all
    .filter((t) => show === 'all' || t.status === show)
    .filter((t) => !sp.rule || t.rule === sp.rule)
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1) || (prio[b.account_id] ?? 0) - (prio[a.account_id] ?? 0) || (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  const count = (s: string) => all.filter((t) => s === 'all' || t.status === s).length;
  const q = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ show, rule: sp.rule, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <h1>Tasks</h1>
      <p className="sub">Created automatically by the rules below every time the portfolio is loaded. Marking a task done is saved; it only comes back if the situation changes again (e.g. contact lapses again after you log a call).</p>
      <div className="tabs">
        {(['open', 'done', 'all'] as const).map((s) => <Link key={s} href={q({ show: s })} className={show === s ? 'on' : ''}>{s[0].toUpperCase() + s.slice(1)} ({count(s)})</Link>)}
      </div>
      <div className="filters">
        <span className="muted small">Rule:</span>
        <Link href={q({ rule: undefined })} className={`chip ${!sp.rule ? 'opp' : 'neutral'}`}>All</Link>
        {RULES.map((r) => <Link key={r.key} href={q({ rule: r.key })} className={`chip ${sp.rule === r.key ? 'opp' : 'neutral'}`} title={r.description}>{r.label} ({all.filter((t) => t.rule === r.key && (show === 'all' || t.status === show)).length})</Link>)}
      </div>
      <TaskTable tasks={tasks} names={names} />
      <div className="section card">
        <h2>Task rules</h2>
        <ul className="actions-list">{RULES.map((r) => <li key={r.key}><b>{r.label}.</b> {r.description}</li>)}</ul>
      </div>
    </>
  );
}
