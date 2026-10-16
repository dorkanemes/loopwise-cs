import Link from 'next/link';
import { getPortfolio } from '@/lib/data';
import { Flags, HealthBadge, fmtDate, fmtMoney } from '@/lib/ui';

export const dynamic = 'force-dynamic';

// Written by me (the new CSM) on Monday 12 Oct after reviewing the portfolio.
// The live ranking below is the scoring engine's view and is recomputed on every load.
const MY_CALLS: { id: string; headline: string; why: string[]; who: string; say: string; goal: string }[] = [
  {
    id: 'ACC-001',
    headline: 'Largest account, renewing in 54 days, quietly shrinking',
    why: [
      '$310k, 13% of the book. Renews 5 Dec.',
      'Active users 218 → 124 since April (−43%); only half of the 250 seats are used. A downsell or churn conversation is coming either way.',
      'Champion Ivan mentioned a possible reorg in March, then in June said "all good, busy season" and turned down a QBR. No live conversation in 116 days.',
      'No tickets and an NPS of 8, so it looks fine on the surface. That makes it the most dangerous kind of risk. VP Eng Priya Zimmer (decision maker) has never been engaged.',
    ],
    who: 'Ivan Evans (Ops Manager, champion), then ask him to bring in Priya Zimmer (VP Engineering)',
    say: '"Hi Ivan, I\'m Dorka, I\'ve taken over as your CSM. Before the December renewal I want to make sure Loopwise still fits how your teams work. I noticed active users have come down from about 220 to 125 since spring. Did the reorg you mentioned go ahead? I\'d like 30 minutes with you and Priya next week to go through it together and shape the renewal around what you actually need now."',
    goal: 'Exec session booked within two weeks; understand the reorg; get ahead of the seat conversation (a right-sized renewal beats a lost one).',
  },
  {
    id: 'ACC-002',
    headline: 'Users are hitting failures while the sponsor plans an expansion',
    why: [
      '$185k, renews 20 Jan (100 days). Grace Brooks (VP Eng, exec sponsor) gave NPS 10 and plans a Q4 rollout to Radiology and Outpatient.',
      'Meanwhile: 4 open tickets (1 urgent bug, high-priority EHR integration and performance issues), 7 high/urgent tickets since mid-August, CSAT 1–3. PM Vera Zimmer wrote in frustrated about EHR sync failures on 23 Sep.',
      'Sessions down 38% since April. No live conversation since July.',
      'Users and sponsor see two different products. If the rollout lands on a broken integration, we lose the expansion and put the renewal at risk.',
    ],
    who: 'First get a dated fix plan for TCK-0072/0073/0076 from the Support lead. Then call Dana Xu (Head of Operations, champion).',
    say: '"Dana, I\'m your new CSM. I\'ve read every ticket your team has raised since August, including the EHR scheduling sync failures and the urgent bug from 25 September, and I\'m sorry it\'s dragged on. I\'ve escalated them and I have a fix plan with dates. I want the Radiology and Outpatient rollout to start on solid ground. Can we do a 30-minute working session this week with Vera and one of our engineers?"',
    goal: 'An owner and a date for each open ticket, a weekly check-in until it\'s stable, and Grace briefed before she hears it from her team.',
  },
  {
    id: 'ACC-003',
    headline: 'Renewal in 47 days and nobody on their side owns it',
    why: [
      '$96k, renews 28 Nov.',
      'Champion Dana Whitfield left in August. The renewal kickoff email bounced on 15 Sep, and no replacement has been identified.',
      'In May Dana was "keen to renew" and asked about a multi-year discount. That goodwill left with her.',
      'Elena Okafor (Head of Delivery, decision maker) has never been engaged. Active users are down 21%.',
    ],
    who: 'Elena Okafor (Head of Delivery, decision maker). Ivan Alvarez (PM, active user) is a likely new day-to-day champion; Priya Fischer (Procurement) for paperwork.',
    say: '"Hi Elena, I\'m Dorka, Corvid\'s new CSM at Loopwise. I understand Dana has moved on. Before she left she\'d talked with us about renewing, possibly multi-year. Your renewal is on 28 November and I want it to reflect how your team uses Loopwise today. Who should own this on your side, and could we find 20 minutes this week?"',
    goal: 'A named renewal owner, a recruited day-to-day champion, and the multi-year offer back on the table.',
  },
];

const NOT_THIS_MONDAY = [
  { id: 'ACC-009', text: '($88k). Renewal date passed 30 Sep. There was a verbal yes and the order form went out 22 Sep, but no signature is logged. This needs a same-day email to Umar Hughes / Zane Evans to confirm the paperwork, not a discovery call.' },
  { id: 'ACC-006', text: '($54k, renews in 34 days, first renewal). Usage recovered after the summer break, but there has been no live conversation since March. Book the renewal call this week.' },
  { id: 'ACC-010', text: '($210k, renews in 102 days). Healthy and growing, but no call or meeting has ever been logged. Book a QBR this month so the renewal is a formality.' },
  { id: 'ACC-007', text: '($4.8k). 1 active user out of 10 and NPS 3. Likely churn, but low ARR, so a low-touch offer of training or a right-sized plan by email.' },
];

export default async function CallListPage() {
  const { health } = await getPortfolio();
  const byId = new Map(health.map((h) => [h.account.account_id, h]));
  const top = health.slice(0, 10);

  return (
    <>
      <h1>Monday call list</h1>
      <p className="sub">Three accounts I&apos;d call on Monday 12 Oct, and why. Together they are {fmtMoney(MY_CALLS.reduce((s, c) => s + (byId.get(c.id)?.account.arr_usd ?? 0), 0))}, about a quarter of the book. The live numbers on each card come from the database.</p>
      <div className="grid">
        {MY_CALLS.map((c, i) => {
          const h = byId.get(c.id);
          if (!h) return null;
          return (
            <div className="card callcard" key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <h2><span className="rank">{i + 1}</span><Link href={`/accounts/${c.id}`}>{h.account.account_name}</Link>: {c.headline}</h2>
                <div><HealthBadge h={h} /> <span className="muted small">{fmtMoney(h.account.arr_usd)} · renews {fmtDate(h.account.renewal_date)}</span></div>
              </div>
              <div className="two-col" style={{ marginTop: 6 }}>
                <div>
                  <h3>Why now</h3>
                  <ul className="actions-list">{c.why.map((w, j) => <li key={j}>{w}</li>)}</ul>
                  <div style={{ marginTop: 8 }}><Flags flags={h.flags} /></div>
                </div>
                <div>
                  <h3>Who</h3><p>{c.who}</p>
                  <h3 style={{ marginTop: 10 }}>What I&apos;d say</h3><p className="quote">{c.say}</p>
                  <h3 style={{ marginTop: 10 }}>Goal of the call</h3><p>{c.goal}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section card">
        <h2>Close calls, and why they're not in the top 3</h2>
        <ul className="actions-list">{NOT_THIS_MONDAY.map((n) => <li key={n.id}><Link href={`/accounts/${n.id}`}><b>{byId.get(n.id)?.account.account_name}</b></Link> {n.text}</li>)}</ul>
      </div>

      <div className="section">
        <h2>Live priority ranking (scoring engine)</h2>
        <p className="muted small">Priority = (risk from health score, +15 if “At risk”) × √(ARR share) × renewal-proximity weight. It updates as you log notes and the data changes, so it&apos;s a check on my judgment, not a replacement for it.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Account</th><th className="num">Priority</th><th>Health</th><th className="num">ARR</th><th>Renewal</th><th>Top flags</th></tr></thead>
            <tbody>{top.map((h, i) => (
              <tr key={h.account.account_id}>
                <td>{i + 1}</td>
                <td><Link href={`/accounts/${h.account.account_id}`}><b>{h.account.account_name}</b></Link></td>
                <td className="num"><b>{h.priority}</b></td>
                <td><HealthBadge h={h} /></td>
                <td className="num">{fmtMoney(h.account.arr_usd)}</td>
                <td className="nowrap small">{fmtDate(h.account.renewal_date)}{h.metrics.daysToRenewal !== null && <span className="muted"> ({h.metrics.daysToRenewal}d)</span>}</td>
                <td style={{ maxWidth: 320 }}><Flags flags={h.flags} limit={3} /></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
