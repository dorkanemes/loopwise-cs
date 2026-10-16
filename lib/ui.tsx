import type { AccountHealth, Band, Component, Flag, Usage } from './health';

export const fmtMoney = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
export const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
export const tone = (band: Band) => (band === 'Healthy' ? 'good' : band === 'Watch' ? 'warn' : 'bad');
export const flagTone = (f: Flag) => (f.level === 'critical' ? 'bad' : f.level === 'warning' ? 'warn' : 'opp');

export function HealthBadge({ h }: { h: Pick<AccountHealth, 'score' | 'band'> }) {
  return (
    <span className="nowrap">
      <span className={`score ${tone(h.band)}`}>{h.score}</span> <span className={`chip ${tone(h.band)}`}>{h.band}</span>
    </span>
  );
}

export function Flags({ flags, limit }: { flags: Flag[]; limit?: number }) {
  const shown = limit ? flags.slice(0, limit) : flags;
  if (!flags.length) return <span className="muted small">No flags</span>;
  return (
    <div className="flags">
      {shown.map((f, i) => <span key={i} className={`chip ${flagTone(f)}`}>{f.text}</span>)}
      {limit && flags.length > limit ? <span className="chip neutral">+{flags.length - limit}</span> : null}
    </div>
  );
}

export function ComponentBreakdown({ components }: { components: Component[] }) {
  return (
    <div>
      {components.map((c) => {
        const r = c.points / c.max;
        return (
          <div className="component" key={c.key}>
            <div className="head"><span>{c.label}</span><span className="num">{Math.round(c.points)} / {c.max}</span></div>
            <div className={`bar ${r >= 0.7 ? 'good' : r >= 0.4 ? 'warn' : 'bad'}`}><div style={{ width: `${Math.round(r * 100)}%` }} /></div>
            <ul>{c.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        );
      })}
    </div>
  );
}

export function UsageChart({ usage, seats }: { usage: Usage[]; seats: number }) {
  if (!usage.length) return <p className="muted">No usage data.</p>;
  const W = 520, H = 160, P = 28;
  const max = Math.max(seats, ...usage.map((u) => u.active_users)) * 1.1;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, usage.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const pts = usage.map((u, i) => `${x(i)},${y(u.active_users)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Active users by month">
      <line x1={P} x2={W - P} y1={y(seats)} y2={y(seats)} stroke="#c0362c" strokeDasharray="4 4" strokeWidth="1" />
      <text x={W - P} y={y(seats) - 5} textAnchor="end" fontSize="11" fill="#c0362c">{seats} seats purchased</text>
      <polyline points={pts} fill="none" stroke="#3355d1" strokeWidth="2.5" strokeLinejoin="round" />
      {usage.map((u, i) => (
        <g key={u.month}>
          <circle cx={x(i)} cy={y(u.active_users)} r="3.5" fill="#3355d1" />
          <text x={x(i)} y={y(u.active_users) - 8} textAnchor="middle" fontSize="11" fill="#1b1f24">{u.active_users}</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#5f6b7a">{new Date(u.month + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</text>
        </g>
      ))}
    </svg>
  );
}
