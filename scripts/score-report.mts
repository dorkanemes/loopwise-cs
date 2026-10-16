// Prints the health/priority ranking straight from the JSON exports (no DB needed):
//   node --experimental-strip-types scripts/score-report.mts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clean } from './clean.mjs';
import { scoreAll } from '../lib/health.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const r = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'));
const ds = clean({ accounts: r('accounts'), contacts: r('contacts'), usage: r('usage_monthly'), tickets: r('support_tickets'), nps: r('nps_responses'), activities: r('activity_log') });
console.log(`${ds.issues.length} data issues\n`);
console.log('prio  health  band      account                       renews  ARR      flags');
for (const h of scoreAll(ds)) {
  console.log(`${String(h.priority).padStart(4)}  ${String(h.score).padStart(6)}  ${h.band.padEnd(8)}  ${h.account.account_name.padEnd(28)}  ${String(h.metrics.daysToRenewal ?? '?').padStart(6)}  ${String(h.account.arr_usd).padStart(7)}  ${h.flags.map((f) => f.text).join('; ')}`);
}
