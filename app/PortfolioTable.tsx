'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AccountHealth } from '@/lib/health';
import { ComponentBreakdown, Flags, HealthBadge, fmtDate, fmtMoney } from '@/lib/ui';

type SortKey = 'name' | 'plan' | 'arr' | 'renewal' | 'util' | 'contact' | 'health' | 'priority';

const getters: Record<SortKey, (h: AccountHealth) => number | string> = {
  name: (h) => h.account.account_name.toLowerCase(),
  plan: (h) => ['Starter', 'Growth', 'Enterprise'].indexOf(h.account.plan),
  arr: (h) => h.account.arr_usd,
  renewal: (h) => h.metrics.daysToRenewal ?? 99999,
  util: (h) => h.metrics.utilization ?? -1,
  contact: (h) => h.metrics.daysSinceContact ?? 99999,
  health: (h) => h.score,
  priority: (h) => h.priority,
};

export default function PortfolioTable({ health }: { health: AccountHealth[] }) {
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');
  const [band, setBand] = useState('all');
  const [region, setRegion] = useState('all');
  const [within, setWithin] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'priority', dir: -1 });
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const f = health.filter((h) =>
      (!q || h.account.account_name.toLowerCase().includes(q.toLowerCase()) || h.account.industry.toLowerCase().includes(q.toLowerCase())) &&
      (plan === 'all' || h.account.plan === plan) &&
      (band === 'all' || h.band === band) &&
      (region === 'all' || h.account.region === region) &&
      (within === 'all' || (h.metrics.daysToRenewal !== null && h.metrics.daysToRenewal <= Number(within))));
    const g = getters[sort.key];
    return [...f].sort((a, b) => (g(a) < g(b) ? -1 : g(a) > g(b) ? 1 : 0) * sort.dir);
  }, [health, q, plan, band, region, within, sort]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={`sortable ${cls}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' || key === 'renewal' || key === 'contact' ? 1 : -1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const regions = [...new Set(health.map((h) => h.account.region))].sort();

  return (
    <>
      <div className="filters">
        <input type="search" placeholder="Search account or industry…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="all">All plans</option><option>Enterprise</option><option>Growth</option><option>Starter</option></select>
        <select value={band} onChange={(e) => setBand(e.target.value)}><option value="all">All health</option><option>At risk</option><option>Watch</option><option>Healthy</option></select>
        <select value={region} onChange={(e) => setRegion(e.target.value)}><option value="all">All regions</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
        <select value={within} onChange={(e) => setWithin(e.target.value)}><option value="all">Any renewal date</option><option value="30">Renews ≤ 30 days</option><option value="60">Renews ≤ 60 days</option><option value="90">Renews ≤ 90 days</option><option value="180">Renews ≤ 180 days</option></select>
        <span className="muted small">{rows.length} of {health.length} · ARR {fmtMoney(rows.reduce((s, h) => s + h.account.arr_usd, 0))}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {th('name', 'Account')}{th('plan', 'Plan')}{th('arr', 'ARR', 'num')}{th('renewal', 'Renewal')}{th('util', 'Seat utilisation')}{th('contact', 'Last contact')}{th('health', 'Health')}{th('priority', 'Priority', 'num')}<th>Top flags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const m = h.metrics, u = m.utilization;
              return (
                <Fragment key={h.account.account_id}>
                  <tr>
                    <td><Link href={`/accounts/${h.account.account_id}`}><b>{h.account.account_name}</b></Link><div className="muted small">{h.account.industry} · {h.account.region}</div></td>
                    <td>{h.account.plan}</td>
                    <td className="num">{fmtMoney(h.account.arr_usd)}</td>
                    <td className="nowrap">{h.account.renewal_date ? fmtDate(h.account.renewal_date) : <span className="chip warn">Unknown</span>}
                      {m.daysToRenewal !== null && <div className={`small ${m.daysToRenewal < 0 ? '' : 'muted'}`} style={m.daysToRenewal < 0 ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{m.daysToRenewal < 0 ? `${-m.daysToRenewal} days overdue` : `in ${m.daysToRenewal} days`}</div>}</td>
                    <td style={{ minWidth: 150 }}>{u === null ? <span className="muted">no data</span> : (
                      <div className="util"><div className={`bar ${u > 1 ? 'opp' : u >= 0.7 ? 'good' : u >= 0.5 ? 'warn' : 'bad'}`}><div style={{ width: `${Math.min(100, u * 100)}%`, background: u > 1 ? 'var(--opp)' : undefined }} /></div><span className="small num">{Math.round(u * 100)}%</span></div>)}
                      <div className="muted small">{m.activeUsers ?? '–'} / {h.account.seats_purchased} seats</div></td>
                    <td className="nowrap">{m.lastContact ? `${m.daysSinceContact}d ago` : 'never'}<div className="muted small">{m.lastTwoWay ? `last call ${m.daysSinceTwoWay}d` : 'no calls logged'}</div></td>
                    <td><HealthBadge h={h} /></td>
                    <td className="num"><b>{h.priority}</b></td>
                    <td style={{ maxWidth: 280 }}><Flags flags={h.flags} limit={2} /></td>
                    <td><button className="link small" onClick={() => setOpen(open === h.account.account_id ? null : h.account.account_id)}>{open === h.account.account_id ? 'Hide' : 'Why?'}</button></td>
                  </tr>
                  {open === h.account.account_id && (
                    <tr className="expand">
                      <td colSpan={10}>
                        <div className="two-col" style={{ padding: '6px 0' }}>
                          <ComponentBreakdown components={h.components} />
                          <div>
                            <h3>Flags</h3><Flags flags={h.flags} />
                            <h3 style={{ marginTop: 14 }}>Suggested next action</h3>
                            <ol className="actions-list">{h.actions.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}</ol>
                            <Link href={`/accounts/${h.account.account_id}`}>Open account →</Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!rows.length && <tr><td colSpan={10} className="empty">No accounts match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        <b>Health</b> (0–100) = how the customer is doing. <b>Priority</b> = how much it matters to act now: risk × ARR × renewal proximity. See <Link href="/scoring">How scoring works</Link>.
      </p>
    </>
  );
}
