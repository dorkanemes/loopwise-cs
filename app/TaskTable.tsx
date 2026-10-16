import Link from 'next/link';
import type { Task } from '@/lib/data';
import { RULES } from '@/lib/tasks';
import { TODAY } from '@/lib/config';
import { fmtDate } from '@/lib/ui';
import { setTaskStatus } from './actions';

const ruleLabel = (k: string) => RULES.find((r) => r.key === k)?.label ?? k;

export default function TaskTable({ tasks, names, showAccount = true }: { tasks: Task[]; names?: Record<string, string>; showAccount?: boolean }) {
  if (!tasks.length) return <p className="empty">No tasks here.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Task</th>{showAccount && <th>Account</th>}<th>Rule</th><th>Priority</th><th>Due</th><th></th></tr></thead>
        <tbody>
          {tasks.map((t) => {
            const overdue = t.status === 'open' && t.due_date && t.due_date < TODAY;
            return (
              <tr key={t.id} className={t.status === 'done' ? 'done' : ''}>
                <td><div className="title"><b>{t.title}</b></div>{t.detail && <div className="muted small" style={{ maxWidth: 560 }}>{t.detail}</div>}</td>
                {showAccount && <td className="nowrap"><Link href={`/accounts/${t.account_id}`}>{names?.[t.account_id] ?? t.account_id}</Link></td>}
                <td><span className="chip neutral">{ruleLabel(t.rule)}</span></td>
                <td><span className={`chip ${t.priority === 'high' ? 'bad' : 'neutral'}`}>{t.priority}</span></td>
                <td className="nowrap" style={overdue ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{fmtDate(t.due_date)}</td>
                <td className="nowrap">
                  <form action={setTaskStatus}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="account_id" value={t.account_id} />
                    <input type="hidden" name="status" value={t.status === 'done' ? 'open' : 'done'} />
                    {t.status === 'done'
                      ? <button className="secondary small" type="submit">Reopen</button>
                      : <button className="small" type="submit">Mark done</button>}
                  </form>
                  {t.status === 'done' && t.completed_at && <div className="muted small">done {t.completed_at.slice(0, 10)}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
