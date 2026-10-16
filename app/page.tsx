import { getPortfolio, loadTasks } from '@/lib/data';
import { fmtMoney } from '@/lib/ui';
import PortfolioTable from './PortfolioTable';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const { health } = await getPortfolio();
  const tasks = await loadTasks();
  const arr = health.reduce((s, h) => s + h.account.arr_usd, 0);
  const atRisk = health.filter((h) => h.band === 'At risk');
  const renewing = health.filter((h) => h.metrics.daysToRenewal !== null && h.metrics.daysToRenewal <= 90);
  const renewingRisk = renewing.filter((h) => h.band !== 'Healthy');
  const openTasks = tasks.filter((t) => t.status === 'open');

  return (
    <>
      <h1>Portfolio</h1>
      <p className="sub">{health.length} accounts. Click a column to sort, or use the filters. Open “Why?” on any row to see what drives its health score.</p>
      <div className="kpis">
        <div className="card kpi"><div className="label">Total ARR</div><div className="value">{fmtMoney(arr)}</div><div className="hint">after removing 1 duplicate account</div></div>
        <div className="card kpi"><div className="label">ARR at risk</div><div className="value" style={{ color: 'var(--bad)' }}>{fmtMoney(atRisk.reduce((s, h) => s + h.account.arr_usd, 0))}</div><div className="hint">{atRisk.length} accounts flagged “At risk”</div></div>
        <div className="card kpi"><div className="label">Renewing ≤ 90 days</div><div className="value">{fmtMoney(renewing.reduce((s, h) => s + h.account.arr_usd, 0))}</div><div className="hint">{renewing.length} accounts, {renewingRisk.length} not healthy</div></div>
        <div className="card kpi"><div className="label">Open tasks</div><div className="value">{openTasks.length}</div><div className="hint">{openTasks.filter((t) => t.priority === 'high').length} high priority</div></div>
      </div>
      <PortfolioTable health={health} />
    </>
  );
}
