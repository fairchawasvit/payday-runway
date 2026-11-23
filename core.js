/* Ledger core. Every balance is derived from the entry list; nothing is stored twice.
   Money is integer satang (1 baht = 100). Dates are 'YYYY-MM-DD' strings.

   Accounts
     SCB, KPLUS, CASH, DIME     assets (cannot go below zero)
     pot:<id>                   MAKE pockets (assets, cannot go below zero)
     CARD                       credit card, a liability (positive = you owe the bank)
     person:<name>              positive = they owe you, negative = you owe them

   Entry types
     expense  {date, amount, from, cat, place?, note?, shares?:[{p, amount}]}
              from = an asset, a pot, CARD, or person:<name> ("pay later", e.g. rent owed to Mom)
              shares = what friends owe you back; your own spend is amount - shares
     income   {date, amount, to, cat, note?}           to = an asset or person:<name> (they owe you)
     transfer {date, amount, from, to, tag?, note?}    moves money; to CARD = card payment;
              from person:X = X paid you back; to person:X = you paid X
*/
(function (root) {
  'use strict';
  const ASSETS = ['SCB', 'KPLUS', 'CASH', 'DIME'];
  const LIQUID = ['SCB', 'KPLUS', 'CASH'];
  const BUDGET_START_DAY = 28, CARD_CLOSE_DAY = 17, CARD_DUE_DAY = 2;

  // ---------- money ----------
  const toSatang = v => {
    if (typeof v === 'string') v = v.replace(/[,\s฿]/g, '');
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  };
  const baht = s => s / 100;

  // ---------- dates (no time zones: plain calendar math) ----------
  const parse = d => { const [y, m, dd] = d.split('-').map(Number); return { y, m, d: dd }; };
  const iso = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.toISOString().slice(0, 10); };
  const isDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && iso(...Object.values(parse(d))) === d;
  const addDays = (d, n) => { const p = parse(d); return iso(p.y, p.m, p.d + n); };
  const daysBetween = (a, b) => (Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 864e5;
  const ymd = d => { const p = parse(d); return [p.y, p.m - 1, p.d]; };

  function cycleOf(date) {
    const p = parse(date);
    const start = p.d >= BUDGET_START_DAY ? iso(p.y, p.m, BUDGET_START_DAY) : iso(p.y, p.m - 1, BUDGET_START_DAY);
    const s = parse(start);
    return { start, end: iso(s.y, s.m + 1, BUDGET_START_DAY - 1) };
  }
  function statementOf(date) {
    const p = parse(date);
    const close = p.d <= CARD_CLOSE_DAY ? iso(p.y, p.m, CARD_CLOSE_DAY) : iso(p.y, p.m + 1, CARD_CLOSE_DAY);
    const c = parse(close);
    return { close, due: iso(c.y, c.m + 1, CARD_DUE_DAY) };
  }

  // ---------- account helpers ----------
  const isPot = a => typeof a === 'string' && a.startsWith('pot:');
  const isPerson = a => typeof a === 'string' && a.startsWith('person:');
  const isAsset = a => ASSETS.includes(a) || isPot(a);
  const sharesTotal = e => (e.shares || []).reduce((s, x) => s + x.amount, 0);
  const myShare = e => e.amount - sharesTotal(e);

  // ---------- balances ----------
  function balances(state, { asOf = null, exclude = null } = {}) {
    const b = Object.create(null);
    const add = (k, v) => { b[k] = (b[k] || 0) + v; };
    for (const [k, v] of Object.entries(state.opening || {})) add(k, v);
    for (const e of state.entries) {
      if (e.id === exclude) continue;
      if (asOf && e.date > asOf) continue;
      applyEntry(e, add);
    }
    return b;
  }
  function applyEntry(e, add) {
    if (e.type === 'expense') {
      // CARD is a liability: spending raises what you owe. Everything else goes down.
      add(e.from, e.from === 'CARD' ? e.amount : -e.amount);
      for (const s of e.shares || []) add('person:' + s.p, s.amount);
    } else if (e.type === 'income') {
      add(e.to, e.amount); // asset up, or person:X owes you more
    } else if (e.type === 'transfer') {
      if (e.from === 'CARD') throw new Error('transfer from CARD is not supported');
      add(e.from, -e.amount);
      if (e.to === 'CARD') add('CARD', -e.amount);
      else add(e.to, e.amount);
    }
  }

  // ---------- validation ----------
  function validate(state, e, { editingId = null } = {}) {
    const errors = [], warnings = [];
    const err = (code, msg) => errors.push({ code, msg });
    const warn = (code, msg) => warnings.push({ code, msg });
    if (!['expense', 'income', 'transfer'].includes(e.type)) err('type', 'Unknown entry type');
    if (!isDate(e.date)) err('date', 'Enter a real date');
    if (!Number.isInteger(e.amount) || e.amount <= 0) err('amount', 'Amount must be more than 0');
    if (e.amount > 100000000) err('amount', 'Amount is larger than 1,000,000 baht. Check for an extra zero.');
    if (errors.length) return { ok: false, errors, warnings };

    const today = state.today;
    if (today && e.date > today) warn('future', 'This date is in the future');

    // balances without the entry being edited, then with the new version applied
    const before = balances(state, { exclude: editingId });
    const after = { ...before };
    applyEntry(e, (k, v) => { after[k] = (after[k] || 0) + v; });
    const known = a => ASSETS.includes(a) || a === 'CARD' || isPerson(a) || (isPot(a) && (state.pots || []).some(p => 'pot:' + p.id === a));

    if (e.type === 'expense') {
      if (!known(e.from)) err('from', 'Choose what you paid with');
      if (!e.cat) err('cat', 'Choose a category');
      const seen = new Set();
      for (const s of e.shares || []) {
        if (!s.p) err('share', 'A friend share has no name');
        if (seen.has(s.p)) err('share', `${s.p} is listed twice`);
        seen.add(s.p);
        if (!Number.isInteger(s.amount) || s.amount <= 0) err('share', `${s.p}'s share must be more than 0`);
        if (isPerson(e.from) && e.from === 'person:' + s.p) err('share', `${s.p} cannot both pay and owe on one entry`);
      }
      if (sharesTotal(e) > e.amount) err('share', `Friends' shares (${baht(sharesTotal(e))}) are more than the bill (${baht(e.amount)})`);
    }
    if (e.type === 'income' && !known(e.to)) err('to', 'Choose where the money went');
    if (e.type === 'transfer') {
      if (!known(e.from) || e.from === 'CARD') err('from', 'Choose where the money came from');
      if (!(known(e.to))) err('to', 'Choose where the money went');
      if (e.from === e.to) err('to', 'From and to are the same');
      if (e.to === 'CARD' && after.CARD < 0) err('card', `That is more than you owe on the card (${baht(before.CARD || 0)})`);
      if (isPerson(e.from) && (before[e.from] || 0) - e.amount < 0)
        err('repay', `${e.from.slice(7)} only owes you ${baht(Math.max(0, before[e.from] || 0))}`);
      if (isPerson(e.to) && (before[e.to] || 0) + e.amount > 0)
        warn('overpay', `You only owe ${e.to.slice(7)} ${baht(Math.max(0, -(before[e.to] || 0)))}; the rest becomes money they owe you`);
    }
    // never let an asset go negative
    for (const a of Object.keys(after)) {
      if (!isAsset(a) || (after[a] || 0) >= 0) continue;
      const short = baht(-(after[a]));
      if (isPot(a)) err('pot', `Not enough in this pocket. It would be ${short} short.`);
      else warn('negative', `${a} would go below zero by ${short}. Did you forget to record income or a transfer?`);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  // ---------- card statements ----------
  function statements(state, asOf) {
    const map = new Map();
    for (const e of state.entries) {
      if (e.type !== 'expense' || e.from !== 'CARD') continue;
      const st = statementOf(e.date);
      if (!map.has(st.close)) map.set(st.close, { ...st, total: 0, paid: 0, entries: [] });
      const s = map.get(st.close); s.total += e.amount; s.entries.push(e.id);
    }
    for (const [k, v] of Object.entries(state.openingStatements || {})) {
      if (!map.has(k)) map.set(k, { close: k, due: statementOf(k).due, total: 0, paid: 0, entries: [] });
      map.get(k).total += v;
    }
    const list = [...map.values()].sort((a, b) => a.close.localeCompare(b.close));
    // payments settle the oldest statement first
    let pay = state.entries.filter(e => e.type === 'transfer' && e.to === 'CARD' && (!asOf || e.date <= asOf))
      .reduce((s, e) => s + e.amount, 0);
    for (const s of list) { const p = Math.min(pay, s.total); s.paid = p; pay -= p; }
    for (const s of list) {
      s.remaining = s.total - s.paid;
      s.closed = asOf ? asOf > s.close : true; // purchases on the 17th still belong to that statement
      s.status = s.remaining === 0 ? 'paid' : !s.closed ? 'open' : (asOf && asOf > s.due ? 'overdue' : 'due');
    }
    return list;
  }

  // ---------- spending ----------
  function spending(state, from, to) {
    const byCat = Object.create(null), byPlace = Object.create(null), fromPots = Object.create(null);
    let mine = 0, pots = 0, income = 0;
    for (const e of state.entries) {
      if (e.date < from || e.date > to) continue;
      if (e.type === 'income' && !isPerson(e.to)) income += e.amount;
      if (e.type === 'income' && isPerson(e.to)) income += e.amount; // earned, paid later (e.g. help Mom)
      if (e.type !== 'expense') continue;
      const m = myShare(e);
      if (isPot(e.from)) { pots += m; fromPots[e.cat] = (fromPots[e.cat] || 0) + m; continue; }
      mine += m;
      byCat[e.cat] = (byCat[e.cat] || 0) + m;
      if (e.place) { const k = e.place.trim(); byPlace[k] = byPlace[k] || { amount: 0, count: 0 }; byPlace[k].amount += m; byPlace[k].count++; }
    }
    return { mine, pots, income, byCat, byPlace, fromPots };
  }

  // ---------- safe to spend ----------
  function safeToSpend(state, asOf) {
    const b = balances(state, { asOf });
    const liquid = LIQUID.reduce((s, a) => s + (b[a] || 0), 0);
    const card = Math.max(0, b.CARD || 0);
    const st = statements(state, asOf);
    const cardBilled = st.filter(s => s.closed).reduce((s, x) => s + x.remaining, 0);
    const cardOpen = card - cardBilled;
    let iOwe = 0, owedToMe = 0; const people = {};
    for (const [k, v] of Object.entries(b)) if (isPerson(k)) {
      people[k.slice(7)] = v;
      if (v < 0) iOwe += -v; else owedToMe += v;
    }
    const safe = liquid - card - iOwe;
    const cyc = cycleOf(asOf);
    const daysLeft = daysBetween(asOf, cyc.end) + 1; // today counts
    return { liquid, card, cardBilled, cardOpen, iOwe, owedToMe, people, safe, perDay: Math.floor(safe / daysLeft), daysLeft, cycle: cyc, balances: b };
  }

  // ---------- debts per friend, oldest first, with paid dates ----------
  function personHistory(state, name) {
    const acct = 'person:' + name, rows = [];
    for (const e of [...state.entries].sort((a, b) => a.date.localeCompare(b.date))) {
      if (e.type === 'expense') {
        for (const s of e.shares || []) if (s.p === name) rows.push({ date: e.date, delta: s.amount, kind: 'owes', entry: e.id });
        if (e.from === acct) rows.push({ date: e.date, delta: -e.amount, kind: 'you-owe', entry: e.id });
      } else if (e.type === 'income' && e.to === acct) rows.push({ date: e.date, delta: e.amount, kind: 'owes', entry: e.id });
      else if (e.type === 'transfer' && e.from === acct) rows.push({ date: e.date, delta: -e.amount, kind: 'paid-you', entry: e.id });
      else if (e.type === 'transfer' && e.to === acct) rows.push({ date: e.date, delta: e.amount, kind: 'you-paid', entry: e.id });
    }
    let run = (state.opening || {})[acct] || 0;
    for (const r of rows) { run += r.delta; r.balance = run; }
    return { opening: (state.opening || {})[acct] || 0, rows, balance: run };
  }
  // For one expense: how much of each friend's share is repaid, and when (FIFO across that friend's debts)
  function shareStatus(state, entryId) {
    const e = state.entries.find(x => x.id === entryId);
    if (!e || !e.shares) return [];
    return e.shares.map(s => {
      const h = personHistory(state, s.p);
      // FIFO: repayments pay off the oldest debts first
      const debts = h.rows.filter(r => r.delta > 0).map(r => ({ ...r, left: r.delta, paidOn: null }));
      const pays = h.rows.filter(r => r.delta < 0 && r.kind === 'paid-you');
      // opening debt is oldest
      const queue = [{ left: Math.max(0, h.opening), opening: true }, ...debts];
      for (const p of pays) {
        let amt = -p.delta;
        for (const d of queue) { if (!amt) break; const t = Math.min(amt, d.left); if (t > 0) { d.left -= t; amt -= t; if (d.left === 0) d.paidOn = p.date; } }
      }
      const mine = debts.find(d => d.entry === entryId);
      return { p: s.p, amount: s.amount, left: mine ? mine.left : s.amount, paidOn: mine && mine.left === 0 ? mine.paidOn : null };
    });
  }

  root.LedgerCore = { toSatang, baht, isDate, addDays, daysBetween, cycleOf, statementOf, balances, validate, statements, spending, safeToSpend,
    personHistory, shareStatus, myShare, sharesTotal, isPot, isPerson, isAsset, ASSETS, LIQUID };
  if (typeof module !== 'undefined') module.exports = root.LedgerCore;
})(typeof window !== 'undefined' ? window : globalThis);
