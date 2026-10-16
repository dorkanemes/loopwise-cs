export default function ScoringPage() {
  const rows: [string, number, string, string][] = [
    ['Usage trend', 25, 'Active users, Apr–Jun average vs Aug–Sep average', 'Full marks if flat or growing; zero at a 30% drop; linear in between. A drop of 30% or more is a critical flag. Sessions trend is shown as context.'],
    ['Seat utilisation', 15, 'Active users ÷ seats purchased (latest month)', 'Full marks at 80%+, zero at 30% or below. Under 50% means shelfware risk at renewal; over 100% is flagged as an expansion opportunity.'],
    ['Engagement recency', 15, 'Days since the last call or meeting', 'Full marks within 30 days, zero after 120. Template emails (product updates, help-centre links) don\'t count: 47% of the old log is one-way email.'],
    ['Relationship', 15, 'Active champion (8) + decision maker engaged in 6 months (4) + 2 or more contacts engaged (3)', 'Minus 4 for each red flag in the last 6 months of notes: reorg, declined meeting, contact left, email bounced, frustration, "hard to use", no response, failures. A departed champion is a critical flag.'],
    ['Support', 20, 'Open tickets and recent CSAT', 'Start at 20; minus 8 per open urgent, 5 per high, 2 per normal, 1 per low; minus 5 if 90-day CSAT is under 3 (2 if under 3.5); minus 3 if there were 3+ high/urgent bug, performance or integration tickets in 90 days. An open urgent ticket is a critical flag.'],
    ['Sentiment', 10, 'Latest NPS from someone still at the company', '9–10 = 10, 7–8 = 6, 0–6 scaled 0–3. No response = 5 (neutral, not punished). Scores from contacts who have left are ignored.'],
  ];
  return (
    <>
      <h1>How scoring works</h1>
      <p className="sub">Two separate numbers: <b>Health</b> (how the customer is doing) and <b>Priority</b> (how much it matters to act now). A healthy $300k account renewing next month can matter more than an unhappy $5k one.</p>

      <div className="card">
        <h2>Health score: 100 points across six signals</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Component</th><th className="num">Points</th><th>Measures</th><th>How it scores</th></tr></thead>
            <tbody>{rows.map(([c, p, m, h]) => <tr key={c}><td><b>{c}</b></td><td className="num">{p}</td><td>{m}</td><td className="muted">{h}</td></tr>)}</tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 16 }}>Bands</h3>
        <ul className="actions-list">
          <li><span className="chip good">Healthy</span> 70+</li>
          <li><span className="chip warn">Watch</span> 50–69, or a Healthy score that <b>renews within 120 days with no live conversation for 60+ days</b>. The renewal motion hasn&apos;t started, whatever usage says.</li>
          <li><span className="chip bad">At risk</span> under 50, or <b>any critical flag</b>: champion left, open urgent ticket, active users down 30%+, renewal date passed without a signature.</li>
        </ul>
        <p className="muted small">Why critical flags override the number: averaging hides single points of failure. Corvid scores 48, but the real story is that the only person who wanted to renew has left. Harborline has no tickets and NPS 8, but has lost 43% of its users.</p>
      </div>

      <div className="card section">
        <h2>Priority: who to call first</h2>
        <p><code>priority = 100 × risk × √(ARR ÷ largest ARR) × (0.5 + 0.5 × urgency)</code></p>
        <ul className="actions-list">
          <li><b>risk</b> = (100 − health) ÷ 100, plus 0.15 if the account is At risk.</li>
          <li><b>√ARR</b>: revenue matters, but the square root stops the biggest account always winning.</li>
          <li><b>urgency</b> by days to renewal: overdue or ≤60 = 1.0, ≤90 = 0.85, ≤120 = 0.7, ≤180 = 0.45, later = 0.2, unknown = 0.5.</li>
        </ul>
      </div>

      <div className="card section">
        <h2>What the score deliberately doesn&apos;t do</h2>
        <ul className="actions-list">
          <li>It doesn&apos;t treat missing data as bad. No NPS response or a missing usage month is scored neutral and shown, not punished.</li>
          <li>It doesn&apos;t trust a single happy exec. Brightpath&apos;s sponsor gave NPS 10 while users logged urgent tickets; the support component catches what the NPS hides.</li>
          <li>It doesn&apos;t count newsletters as relationship. Only calls and meetings reset engagement; logging a call in the app does.</li>
          <li>Weights are a reasoned starting point, not fitted to churn outcomes (we have none yet). Next step: back-test against real renewals.</li>
        </ul>
      </div>
    </>
  );
}
