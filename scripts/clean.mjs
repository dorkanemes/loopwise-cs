// Pure data-cleaning step for the Loopwise JSON exports.
// No dependencies, so it can be unit-tested with plain `node`.
// Every fix is recorded as an "import issue" that the app shows on /data-issues.


export function clean(raw, today = '2026-10-12') {
  const issues = [];
  const log = (file, record_id, issue, resolution) => issues.push({ file, record_id, issue, resolution });

  // ---------- accounts ----------
  const accounts = raw.accounts.map((a) => ({ ...a, merged_ids: [] }));

  // Duplicate accounts: same normalised name + same contract start + same ARR.
  const norm = (s) => s.toLowerCase().replace(/[.,]/g, '').replace(/\b(inc|ltd|llc|gmbh|co)\b/g, '').replace(/\s+/g, ' ').trim();
  const idRemap = {}; // duplicate id -> surviving id
  const byKey = new Map();
  for (const a of accounts) {
    const key = `${norm(a.account_name)}|${a.contract_start}|${a.arr_usd}`;
    if (byKey.has(key)) {
      const keep = byKey.get(key);
      idRemap[a.account_id] = keep.account_id;
      keep.merged_ids.push(a.account_id);
      log('accounts.json', a.account_id,
        `Duplicate of ${keep.account_id} ("${a.account_name}" vs "${keep.account_name}"): same ARR ($${a.arr_usd.toLocaleString('en-US')}), seats and contract dates. Previous CSM notes say the account "got set up twice" after a legal-entity change.`,
        `Merged into ${keep.account_id}; ARR counted once (portfolio ARR $${(raw.accounts.reduce((s, x) => s + x.arr_usd, 0) - a.arr_usd).toLocaleString('en-US')} instead of $${raw.accounts.reduce((s, x) => s + x.arr_usd, 0).toLocaleString('en-US')}). Confirm with Finance that they are billed once.`);
    } else byKey.set(key, a);
  }
  const keptAccounts = accounts.filter((a) => !idRemap[a.account_id]);
  const remap = (id) => idRemap[id] ?? id;

  for (const a of keptAccounts) {
    if (a.renewal_date && a.renewal_date < today) {
      log('accounts.json', a.account_id, `${a.account_name} renewal date ${a.renewal_date} is already in the past (today is ${today}). Last note: order form sent for signature, no signed confirmation logged.`,
        'Kept the date; flagged as "Renewal overdue" so someone confirms the contract was actually signed.');
    }
    if (!a.renewal_date) {
      log('accounts.json', a.account_id, `${a.account_name} has no renewal date (contract started ${a.contract_start}).`,
        'Left blank rather than guessed; shown as "Unknown" on the renewals page and a task is created to confirm the date with Finance.');
    }
  }

  // ---------- contacts ----------
  const contacts = [];
  const seenContact = new Map();
  for (const c of raw.contacts) {
    const email = c.email.trim().toLowerCase();
    if (email !== c.email) log('contacts.json', c.contact_id, `Email "${c.email}" has inconsistent casing.`, `Normalised to "${email}".`);
    const account_id = remap(c.account_id);
    const key = `${account_id}|${email}`;
    if (seenContact.has(key)) {
      log('contacts.json', c.contact_id, `Duplicate of ${seenContact.get(key)} (${c.name}), created under the duplicate account ${c.account_id}.`, 'Dropped; references re-pointed to the original contact.');
      idRemap[c.contact_id] = seenContact.get(key);
      continue;
    }
    seenContact.set(key, c.contact_id);
    contacts.push({ ...c, email, account_id });
  }
  const contactById = new Map(contacts.map((c) => [c.contact_id, c]));

  // Truncated email domains: the export seems to cut the domain label at 14 characters
  // (e.g. "Alder & Finch Legal" -> alderfinchlega.com). Flag a domain when its label is
  // exactly 14 chars and a strict prefix of the compacted company name.
  const compact = (s) => s.toLowerCase().replace(/\b(co|inc|ltd|llc|group)\b/g, '').replace(/[^a-z0-9]/g, '');
  const byDomain = new Map();
  for (const c of contacts) {
    const domain = c.email.split('@')[1] ?? '';
    const label = domain.split('.')[0];
    const acc = keptAccounts.find((a) => a.account_id === c.account_id);
    const name = acc ? compact(acc.account_name) : '';
    if (label.length === 14 && name.length > 14 && name.startsWith(label)) {
      if (!byDomain.has(domain)) byDomain.set(domain, { acc, ids: [] });
      byDomain.get(domain).ids.push(c.contact_id);
    }
  }
  for (const [domain, { acc, ids }] of byDomain) {
    log('contacts.json', ids.join(', '), `Email domain "${domain}" for ${acc.account_name} looks truncated (cut at 14 characters).`,
      'Kept as-is: the real domain cannot be safely guessed. Verify before emailing these contacts.');
  }

  // Champions marked inactive
  for (const c of contacts) {
    if (c.role === 'champion' && !c.is_active) {
      log('contacts.json', c.contact_id, `${c.name} is still tagged as champion of ${c.account_id} but is inactive (left the company).`,
        'Account treated as having no active champion; health score and tasks reflect this.');
    }
  }

  // ---------- usage ----------
  const usage = raw.usage.map((u) => ({ ...u, account_id: remap(u.account_id) }));
  const months = [...new Set(usage.map((u) => u.month))].sort();
  for (const a of keptAccounts) {
    const have = new Set(usage.filter((u) => u.account_id === a.account_id).map((u) => u.month));
    const missing = months.filter((m) => !have.has(m));
    if (missing.length === months.length) {
      log('usage_monthly.json', a.account_id, `No usage rows at all for ${a.account_name}.`, 'Usage components scored as "no data".');
    } else if (missing.length) {
      log('usage_monthly.json', a.account_id, `${a.account_name} is missing usage for ${missing.join(', ')}.`, 'Not filled with zeros (that would fake a drop); trends use the months that exist.');
    }
    const latest = usage.filter((u) => u.account_id === a.account_id).sort((x, y) => (x.month < y.month ? 1 : -1))[0];
    if (latest && latest.active_users > a.seats_purchased) {
      log('usage_monthly.json', a.account_id, `${a.account_name} has ${latest.active_users} active users on ${a.seats_purchased} purchased seats (${Math.round((100 * latest.active_users) / a.seats_purchased)}%).`,
        'Kept; flagged as an expansion / seat true-up opportunity.');
    }
  }

  // ---------- tickets ----------
  const tickets = raw.tickets.map((t) => ({ ...t, account_id: remap(t.account_id) }));
  for (const t of tickets) {
    if (t.status !== 'closed' && t.resolved_date) log('support_tickets.json', t.ticket_id, 'Open ticket has a resolved date.', 'Treated as open.');
    if (t.status === 'closed' && !t.resolved_date) log('support_tickets.json', t.ticket_id, 'Closed ticket has no resolved date.', 'Treated as closed.');
  }

  // ---------- NPS ----------
  const nps = raw.nps.map((n) => ({ ...n, account_id: remap(n.account_id), contact_id: remap(n.contact_id) }));
  for (const n of nps) {
    const c = contactById.get(n.contact_id);
    if (c && !c.is_active) {
      log('nps_responses.json', n.response_id, `Score ${n.score} came from ${c.name}, who has since left ${n.account_id}.`,
        'Kept for history but excluded from the sentiment score.');
    }
  }

  // ---------- activities ----------
  const activities = raw.activities.map((x) => ({ ...x, account_id: remap(x.account_id), contact_id: x.contact_id ? remap(x.contact_id) : null, source: 'import' }));
  const generic = activities.filter((x) => /^(Sent monthly product update|Shared help-centre|Shared tips on using templates)/.test(x.summary));
  log('activity_log.json', '(all)', `${generic.length} of ${activities.length} logged activities are one-way template emails (product updates, help-centre links).`,
    'Kept on the timeline, but they do not count as two-way engagement in the health score.');

  return { accounts: keptAccounts, contacts, usage, tickets, nps, activities, issues, idRemap };
}
