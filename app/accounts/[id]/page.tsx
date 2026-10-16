import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPortfolio, loadNextSteps, loadTasks } from '@/lib/data';
import { TODAY, addDays } from '@/lib/config';
import { ComponentBreakdown, Flags, HealthBadge, UsageChart, fmtDate, fmtMoney } from '@/lib/ui';
import { addNextStep, completeNextStep, logActivity } from '../../actions';
import TaskTable from '../../TaskTable';

export const dynamic = 'force-dynamic';

const SIGNAL = /reorg|declined|left|bounced|frustrat|hard to use|no response|failures|keen to renew|seats|SSO|roll ?out|Enterprise plan|verbal yes/i;

type Event = { date: string; kind: string; text: string; who?: string; app?: boolean; signal?: boolean };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ds, health } = await getPortfolio();
  const h = health.find((x) => x.account.account_id === id);
  if (!h) notFound();
  const a = h.account, m = h.metrics;
  const [steps, tasks] = await Promise.all([loadNextSteps(id), loadTasks(id)]);
  const contacts = ds.contacts.filter((c) => c.account_id === id);
  const cName = (cid: string | null) => contacts.find((c) => c.contact_id === cid)?.name;
  const usage = ds.usage.filter((u) => u.account_id === id);
  const tickets = ds.tickets.filter((t) => t.account_id === id).sort((x, y) => y.opened_date.localeCompare(x.opened_date));

  const events: Event[] = [
    ...ds.activities.filter((x) => x.account_id === id).map((x) => ({ date: x.date, kind: x.type, text: x.summary, who: [cName(x.contact_id), x.logged_by].filter(Boolean).join(' · '), app: x.source === 'app', signal: SIGNAL.test(x.summary) })),
    ...ds.nps.filter((n) => n.account_id === id).map((n) => ({ date: n.response_date, kind: 'NPS', text: `Scored ${n.score}${n.comment ? `: “${n.comment}”` : ''}`, who: cName(n.contact_id) })),
    ...tickets.map((t) => ({ date: t.opened_date, kind: 'ticket', text: `${t.ticket_id} opened: ${t.priority} ${t.category.replace('_', ' ')} (${t.status}${t.csat ? `, CSAT ${t.csat}` : ''})` })),
  ].sort((x, y) => y.date.localeCompare(x.date));
  const openSteps = steps.filter((s) => s.status === 'open');

  return (
    <>
      <p className="small"><Link href="/">← Portfolio</Link></p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{a.account_name}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>{a.plan} · {a.industry} · {a.region} · {a.account_id}{a.merged_ids.length ? ` (merged with duplicate ${a.merged_ids.join(', ')})` : ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}><HealthBadge h={h} /><div className="muted small" style={{ marginTop: 4 }}>Priority {h.priority}</div></div>
      </div>

      <div className="kpis" style={{ marginTop: 16 }}>
        <div className="card kpi"><div className="label">ARR</div><div className="value">{fmtMoney(a.arr_usd)}</div><div className="hint">contract since {fmtDate(a.contract_start)}</div></div>
        <div className="card kpi"><div className="label">Renewal</div><div className="value" style={m.daysToRenewal !== null && m.daysToRenewal < 0 ? { color: 'var(--bad)' } : undefined}>{a.renewal_date ? fmtDate(a.renewal_date) : 'Unknown'}</div><div className="hint">{m.daysToRenewal === null ? 'not in export' : m.daysToRenewal < 0 ? `${-m.daysToRenewal} days overdue` : `in ${m.daysToRenewal} days`}</div></div>
        <div className="card kpi"><div className="label">Seat utilisation</div><div className="value">{m.utilization === null ? '—' : `${Math.round(m.utilization * 100)}%`}</div><div className="hint">{m.activeUsers ?? '–'} active / {a.seats_purchased} seats</div></div>
        <div className="card kpi"><div className="label">Last contact</div><div className="value">{m.daysSinceContact === null ? 'Never' : `${m.daysSinceContact}d`}</div><div className="hint">{m.lastTwoWay ? `last call/meeting ${m.daysSinceTwoWay}d ago` : 'no call or meeting logged'}</div></div>
      </div>

      <div className="two-col">
        <div className="grid">
          <div className="card">
            <h2>Why the health score is {h.score}</h2>
            <ComponentBreakdown components={h.components} />
            <h3>Flags</h3><Flags flags={h.flags} />
          </div>
          <div className="card">
            <h2>Active users vs seats</h2>
            <UsageChart usage={usage} seats={a.seats_purchased} />
          </div>
          <div className="card">
            <h2>Activity timeline</h2>
            <form action={logActivity} className="stack" style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              <input type="hidden" name="account_id" value={id} />
              <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <select name="type" defaultValue="call"><option value="call">Call</option><option value="meeting">Meeting</option><option value="email">Email</option><option value="note">Note</option></select>
                <select name="contact_id" defaultValue=""><option value="">No specific contact</option>{contacts.filter((c) => c.is_active).map((c) => <option key={c.contact_id} value={c.contact_id}>{c.name} ({c.role.replace('_', ' ')})</option>)}</select>
                <input type="date" name="date" defaultValue={TODAY} />
              </div>
              <textarea name="summary" placeholder="What happened? e.g. Spoke with Ivan: reorg merged two depots, wants a usage review before renewal…" required />
              <div><button type="submit">Log note</button> <span className="muted small">Calls and meetings count as live contact in the health score.</span></div>
            </form>
            <ul className="timeline">
              {events.map((e, i) => (
                <li key={i}>
                  <span className="date">{fmtDate(e.date)}</span>
                  <div>
                    <span className={`tag ${e.app ? 'app' : ''}`}>{e.app ? `you · ${e.kind}` : e.kind}</span>
                    {e.signal && <span className="tag signal">signal</span>}
                    <span>{e.text}</span>
                    {e.who && <div className="muted small">{e.who}</div>}
                  </div>
                </li>
              ))}
              {!events.length && <li className="empty">Nothing logged yet.</li>}
            </ul>
          </div>
        </div>

        <div className="grid">
          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <h2>Next step</h2>
            {openSteps.length ? (
              <ul className="timeline" style={{ marginBottom: 10 }}>
                {openSteps.map((s) => (
                  <li key={s.id}>
                    <span className="date" style={s.due_date < TODAY ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{fmtDate(s.due_date)}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{s.description}</span>
                      <form action={completeNextStep}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="account_id" value={id} /><button className="small secondary" type="submit">Done</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No next step set.</p>}
            <form action={addNextStep} className="stack">
              <input type="hidden" name="account_id" value={id} />
              <input type="text" name="description" placeholder="e.g. Exec check-in with Priya on usage drop" required />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" name="due_date" defaultValue={addDays(TODAY, 7)} required />
                <button type="submit">Set next step</button>
              </div>
            </form>
            {steps.some((s) => s.status === 'done') && (
              <details style={{ marginTop: 10 }}><summary className="muted small">Completed steps</summary>
                <ul className="small">{steps.filter((s) => s.status === 'done').map((s) => <li key={s.id}>{fmtDate(s.due_date)}: {s.description}</li>)}</ul>
              </details>
            )}
          </div>

          <div className="card">
            <h2>Suggested actions</h2>
            <ol className="actions-list">{h.actions.map((x, i) => <li key={i}>{x}</li>)}</ol>
            {h.expansion.length > 0 && (<><h3 style={{ marginTop: 12 }}>Expansion signals</h3><ul className="actions-list">{h.expansion.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
          </div>

          <div className="card">
            <h2>Tasks</h2>
            <TaskTable tasks={tasks} showAccount={false} />
          </div>

          <div className="card">
            <h2>Contacts</h2>
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Email</th></tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.contact_id} style={c.is_active ? undefined : { opacity: 0.55 }}>
                    <td><b>{c.name}</b><div className="muted small">{c.title}</div></td>
                    <td><span className={`chip ${c.role === 'champion' ? (c.is_active ? 'good' : 'bad') : c.role === 'decision_maker' ? 'opp' : 'neutral'}`}>{c.role.replace('_', ' ')}</span>{!c.is_active && <div className="small" style={{ color: 'var(--bad)' }}>left company</div>}</td>
                    <td className="small">{c.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Support tickets</h2>
            {tickets.length ? (
              <table>
                <thead><tr><th>Ticket</th><th>Opened</th><th>Priority</th><th>Status</th><th className="num">CSAT</th></tr></thead>
                <tbody>{tickets.map((t) => (
                  <tr key={t.ticket_id}>
                    <td>{t.ticket_id}<div className="muted small">{t.category.replace('_', ' ')}</div></td>
                    <td className="nowrap small">{fmtDate(t.opened_date)}</td>
                    <td><span className={`chip ${t.priority === 'urgent' ? 'bad' : t.priority === 'high' ? 'warn' : 'neutral'}`}>{t.priority}</span></td>
                    <td><span className={`chip ${t.status === 'closed' ? 'neutral' : 'bad'}`}>{t.status}</span></td>
                    <td className="num">{t.csat ?? '—'}</td>
                  </tr>))}
                </tbody>
              </table>
            ) : <p className="muted">No tickets.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
