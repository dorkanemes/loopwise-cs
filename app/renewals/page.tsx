import Link from 'next/link';
import { getPortfolio, loadNextSteps } from '@/lib/data';
import { Flags, HealthBadge, fmtDate, fmtMoney } from '@/lib/ui';
import type { AccountHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export default async function RenewalsPage() {
  const { health } = await getPortfolio();
  const steps = await loadNextSteps();
  const nextStep = (id: string) => steps.find((s) => s.account_id === id);

  const renewals = health
    .filter((h) => h.metrics.daysToRenewal === null || h.metrics.daysToRenewal <= 90)
    .sort((x, y) => (x.metrics.daysToRenewal ?? -999) - (y.metrics.daysToRenewal ?? -999));
  const atRisk = health.filter((h) => h.band === 'At risk').sort((x, y) => y.priority - x.priority);
  const expansion = health.filter((h) => h.expansion.length).sort((x, y) => y.expansion.length - x.expansion.length);

  const renewalAction = (h: AccountHealth) => h.actions[0];
  const sum = (xs: AccountHealth[]) => fmtMoney(xs.reduce((s, h) => s + h.account.arr_usd, 0));

  return (
    <>
      <h1>Renewals &amp; risk</h1>
      <p className="sub">Renewals in the next 90 days (plus overdue and unknown dates), every account flagged at risk, and where to grow.</p>

      <h2>Renewals in the next 90 days · {renewals.length} accounts · {sum(renewals)}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Account</th><th>Renewal</th><th className="num">ARR</th><th>Health</th><th>Risks</th><th>Suggested action</th><th>Next step</th></tr></thead>
          <tbody>
            {renewals.map((h) => {
              const d = h.metrics.daysToRenewal, ns = nextStep(h.account.account_id);
              return (
                <tr key={h.account.account_id}>
                  <td><Link href={`/accounts/${h.account.account_id}`}><b>{h.account.account_name}</b></Link><div className="muted small">{h.account.plan}</div></td>
                  <td className="nowrap">{h.account.renewal_date ? fmtDate(h.account.renewal_date) : <span className="chip warn">Unknown</span>}
                    <div className="small" style={d !== null && d < 0 ? { color: 'var(--bad)', fontWeight: 600 } : { color: 'var(--muted)' }}>{d === null ? 'confirm with Finance' : d < 0 ? `${-d} days overdue` : `in ${d} days`}</div></td>
                  <td className="num">{fmtMoney(h.account.arr_usd)}</td>
                  <td><HealthBadge h={h} /></td>
                  <td style={{ maxWidth: 240 }}><Flags flags={h.flags.filter((f) => f.level !== 'opportunity')} limit={3} /></td>
                  <td style={{ maxWidth: 380 }} className="small">{renewalAction(h)}</td>
                  <td className="small" style={{ maxWidth: 200 }}>{ns ? <>{ns.description}<div className="muted">due {fmtDate(ns.due_date)}</div></> : <span className="muted">none set</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>At-risk accounts · {atRisk.length} accounts · {sum(atRisk)} ARR</h2>
        <p className="muted small">Ordered by priority (risk × ARR × renewal proximity). An account is “At risk” if its score is under 50 or it has a critical flag.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Account</th><th className="num">ARR</th><th>Renewal</th><th>Health</th><th>Why flagged</th><th>Suggested action</th></tr></thead>
            <tbody>
              {atRisk.map((h) => (
                <tr key={h.account.account_id}>
                  <td><Link href={`/accounts/${h.account.account_id}`}><b>{h.account.account_name}</b></Link><div className="muted small">priority {h.priority}</div></td>
                  <td className="num">{fmtMoney(h.account.arr_usd)}</td>
                  <td className="nowrap small">{fmtDate(h.account.renewal_date)}{h.metrics.daysToRenewal !== null && <div className="muted">{h.metrics.daysToRenewal < 0 ? `${-h.metrics.daysToRenewal}d overdue` : `${h.metrics.daysToRenewal}d`}</div>}</td>
                  <td><HealthBadge h={h} /></td>
                  <td style={{ maxWidth: 260 }}><Flags flags={h.flags.filter((f) => f.level !== 'opportunity')} /></td>
                  <td className="small" style={{ maxWidth: 420 }}><ol className="actions-list">{h.actions.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ol></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2>Expansion opportunities</h2>
        <p className="muted small">Seat pressure, upgrade questions and rollout plans found in usage, notes and NPS comments. Fix health first where the account is at risk.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Account</th><th className="num">ARR</th><th>Health</th><th>Signals</th></tr></thead>
            <tbody>
              {expansion.map((h) => (
                <tr key={h.account.account_id}>
                  <td><Link href={`/accounts/${h.account.account_id}`}><b>{h.account.account_name}</b></Link><div className="muted small">{h.account.plan} · {h.metrics.activeUsers}/{h.account.seats_purchased} seats</div></td>
                  <td className="num">{fmtMoney(h.account.arr_usd)}</td>
                  <td><HealthBadge h={h} /></td>
                  <td className="small"><ul className="actions-list">{h.expansion.map((x, i) => <li key={i}>{x}</li>)}</ul></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
