/* Ledger core. Every balance is derived from the entry list; nothing is stored twice.
   Money is integer satang (1 baht = 100). Dates are 'YYYY-MM-DD' strings.

   Accounts
     SCB, KPLUS, CASH, DIME     assets (cannot go below zero)
     acct:<id>                  bank accounts the owner added (spendable, like SCB)
     pot:<id>                   MAKE pockets (assets, cannot go below zero)
     CARD, card:<id>            credit cards, liabilities (positive = you owe the bank)
                                state.cards[].sched = [{since, close, due}]: statement days, each
                                applying to purchases from `since` on, so past statements never move
     person:<name>              positive = they owe you, negative = you owe them

   Entry types
     expense  {date, amount, from, cat, place?, note?, shares?:[{p, amount}]}
              from = an asset, a pot, CARD, or person:<name> ("pay later", e.g. rent owed to Mom)
              shares = what friends owe you back; your own spend is amount - shares
              bill = id of the monthly bill (state.bills) this pays
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

  // ---------- budget cycles ----------
  // A cycle runs from one payday to the day before the next. The payday can change over time:
  // `sched` = [{ since, day }] where `since` is the first payday on the new day. Day 1-31; a short month uses its last day.
  const DEFAULT_PAYDAY = [{ since: '0000-01-01', day: BUDGET_START_DAY }];
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const payIn = (y, m, day) => { const t = new Date(Date.UTC(y, m - 1, 1)); const yy = t.getUTCFullYear(), mm = t.getUTCMonth() + 1; return iso(yy, mm, Math.min(day, dim(yy, mm))); };
  const latestPay = (day, date) => { const p = parse(date), here = payIn(p.y, p.m, day); return here <= date ? here : payIn(p.y, p.m - 1, day); };
  const nextPayAfter = (day, date) => { const p = parse(date), here = payIn(p.y, p.m, day); return here > date ? here : payIn(p.y, p.m + 1, day); };
  const ruleOn = (sched, date) => { let r = sched[0]; for (const x of sched) if (x.since <= date) r = x; return r; };
  function cycleOf(date, sched) {
    const S = sched && sched.length ? sched : DEFAULT_PAYDAY;
    const rule = ruleOn(S, date);
    const next = S.find(x => x.since > date);
    if (next && next.prevStart && date >= next.prevStart) return { start: next.prevStart, end: addDays(next.since, -1) }; // the cycle an endOn change cut short
    // an old-day payday less than 14 days before the first new payday starts no cycle of its own: it joins the one before
    const tooClose = d => next && !next.prevStart && daysBetween(d, next.since) < 14;
    let start = latestPay(rule.day, date);
    while (tooClose(start) && start > rule.since) start = latestPay(rule.day, addDays(start, -1));
    if (rule.prevStart && start < rule.since) start = rule.since; // a rule from endOn never reaches back before itself
    let end = addDays(nextPayAfter(rule.day, start), -1);
    if (tooClose(addDays(end, 1))) end = addDays(next.since, -1); // the last cycle on the old day runs up to the new payday
    if (next && end >= next.since) end = addDays(next.since, -1); // a cycle never runs into the new rule
    return { start, end };
  }
  // Move payday to `day` from a future cycle: the cycle open now is never cut. The first new payday is at least
  // 14 days after the next cycle starts, so the one in-between cycle runs about 2 to 6 weeks.
  // With `endOn` (>= today) the open cycle is stretched or shortened to end there, and the new day starts the day after.
  function changePayday(state, today, day, { endOn, startFrom } = {}) {
    if (endOn !== undefined && !(isDate(endOn) && endOn >= today)) throw new Error('endOn must be a date on or after today');
    const S = (state.payday && state.payday.length ? state.payday : DEFAULT_PAYDAY).filter(x => x.since <= today);
    if (endOn && startFrom !== undefined && !(isDate(startFrom) && startFrom <= today)) throw new Error('startFrom must be a date on or before today');
    const cur = cycleOf(today, S), nextStart = addDays(cur.end, 1);
    if (ruleOn(S, today).day === day) { state.payday = S; return null; } // back to the day in force: just drop a pending change
    const since = endOn ? addDays(endOn, 1) : nextPayAfter(day, addDays(nextStart, 13));
    state.payday = [...S, endOn ? { since, day, prevStart: startFrom || cur.start } : { since, day }];
    return since;
  }
  // statement a purchase on `date` belongs to; days are 1-28 so every month has them
  function statementOf(date, { close: cd = CARD_CLOSE_DAY, due: dd = CARD_DUE_DAY } = {}) {
    const p = parse(date);
    const close = p.d <= cd ? iso(p.y, p.m, cd) : iso(p.y, p.m + 1, cd);
    const c = parse(close);
    return { close, due: iso(c.y, dd > cd ? c.m : c.m + 1, dd) }; // due day after the close day = same month
  }
  const DEFAULT_SCHED = [{ since: '0000-01-01', close: CARD_CLOSE_DAY, due: CARD_DUE_DAY }];
  const cardOf = (state, k) => (state.cards || []).find(c => c.k === k);
  function schedOn(state, k, date) {
    const sched = (cardOf(state, k) || {}).sched || DEFAULT_SCHED;
    let cur = sched[0];
    for (const x of sched) if (x.since <= date) cur = x;
    return cur;
  }
  const cardStatementOf = (state, k, date) => statementOf(date, schedOn(state, k, date));
  // New days apply from the day after the statement that is open today closes.
  function changeCardDates(card, today, close, due) {
    if (!card.sched || !card.sched.length) card.sched = DEFAULT_SCHED.map(x => ({ ...x }));
    card.sched = card.sched.filter((x, i) => i === 0 || x.since <= today); // replace a change that has not started yet
    const since = addDays(statementOf(today, card.sched.at(-1)).close, 1);
    card.sched.push({ since, close, due });
    return since;
  }

  // ---------- account helpers ----------
  const isPot = a => typeof a === 'string' && a.startsWith('pot:');
  const isPerson = a => typeof a === 'string' && a.startsWith('person:');
  const isAcct = a => typeof a === 'string' && a.startsWith('acct:');
  const isCard = a => a === 'CARD' || (typeof a === 'string' && a.startsWith('card:'));
  const isAsset = a => ASSETS.includes(a) || isAcct(a) || isPot(a);
  const isLiquid = a => LIQUID.includes(a) || isAcct(a);
  // an investment account (Dime and the like) holds real money but is not money to spend
  const isInvest = (state, a) => a === 'DIME' || (state.accounts || []).some(x => x.k === a && x.inv);
  const isSpendable = (state, a) => isLiquid(a) && !isInvest(state, a);
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
  // A back-dated entry (pre: true) happened before the app's starting balances were taken, so those balances
  // already include it: it moves nothing in accounts, cards or pockets. It still counts for friends' debts,
  // for monthly spending and for bills paid, because no starting balance covers those.
  function applyEntry(e, add0) {
    const add = e.pre ? (k, v) => { if (isPerson(k)) add0(k, v); } : add0;
    if (e.type === 'expense') {
      // CARD is a liability: spending raises what you owe. Everything else goes down.
      add(e.from, isCard(e.from) ? e.amount : -e.amount);
      for (const s of e.shares || []) add('person:' + s.p, s.amount);
    } else if (e.type === 'income') {
      add(e.to, e.amount); // asset up, or person:X owes you more
    } else if (e.type === 'transfer') {
      if (isCard(e.from)) throw new Error('transfer from a card is not supported');
      add(e.from, -e.amount);
      add(e.to, isCard(e.to) ? -e.amount : e.amount);
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
    if (e.pre && state.startDate && e.date > state.startDate) err('pre', 'Only entries up to the day you started the app can be marked as already in the balances');

    // balances without the entry being edited, then with the new version applied
    const before = balances(state, { exclude: editingId });
    const after = { ...before };
    applyEntry(e, (k, v) => { after[k] = (after[k] || 0) + v; });
    const known = a => ASSETS.includes(a) || a === 'CARD' || isPerson(a) || (isPot(a) && (state.pots || []).some(p => 'pot:' + p.id === a)) ||
      (isAcct(a) && (state.accounts || []).some(x => x.k === a)) || (isCard(a) && !!cardOf(state, a));

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
      if (!known(e.from) || isCard(e.from)) err('from', 'Choose where the money came from');
      if (!(known(e.to))) err('to', 'Choose where the money went');
      if (e.from === e.to) err('to', 'From and to are the same');
      if (isCard(e.to) && after[e.to] < 0) err('card', `That is more than you owe on the card (${baht(before[e.to] || 0)})`);
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
  // openingStatements keys: 'YYYY-MM-DD' for CARD, '<card>@YYYY-MM-DD' for other cards
  function statements(state, asOf, card = 'CARD') {
    const map = new Map();
    for (const e of state.entries) {
      if (e.type !== 'expense' || e.from !== card || e.pre) continue; // back-dated: already in the starting card balance
      const st = cardStatementOf(state, card, e.date);
      if (!map.has(st.close)) map.set(st.close, { ...st, card, total: 0, paid: 0, entries: [] });
      const s = map.get(st.close); s.total += e.amount; s.entries.push(e.id);
    }
    for (const [key, v] of Object.entries(state.openingStatements || {})) {
      const [c, k] = key.includes('@') ? key.split('@') : ['CARD', key];
      if (c !== card) continue;
      if (!map.has(k)) map.set(k, { close: k, due: cardStatementOf(state, card, k).due, card, total: 0, paid: 0, entries: [] });
      map.get(k).total += v;
    }
    const list = [...map.values()].sort((a, b) => a.close.localeCompare(b.close));
    // payments settle the oldest statement first
    let pay = state.entries.filter(e => e.type === 'transfer' && e.to === card && !e.pre && (!asOf || e.date <= asOf))
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

  // ---------- a card's balance when you started using the app ----------
  // Split in two: the bill that had already closed (unpaid) and spending on the statement open at the start date.
  const prevMonth = d => { const p = parse(d); return iso(p.y, p.m - 1, p.d); };
  const openKey = (k, d) => (k === 'CARD' ? d : k + '@' + d);
  const openKeys = (state, k) => Object.keys(state.openingStatements || {}).filter(x => (k === 'CARD' ? !x.includes('@') : x.startsWith(k + '@')));
  function cardStart(state, k) {
    const s = (cardOf(state, k) || {}).start || state.startDate; if (s) return s;
    // older data with no start date: the earliest opening statement was the bill already closed at the start
    const ds = openKeys(state, k).map(x => (x.includes('@') ? x.split('@')[1] : x)).sort();
    return ds.length ? addDays(ds[0], 1) : state.today || '2000-01-01';
  }
  function cardOpening(state, k) {
    const start = cardStart(state, k), r = { billed: 0, unbilled: 0 };
    for (const x of openKeys(state, k)) { const d = x.includes('@') ? x.split('@')[1] : x; r[d < start ? 'billed' : 'unbilled'] += state.openingStatements[x]; }
    return r;
  }
  function setCardOpening(state, k, billed, unbilled) {
    state.openingStatements = state.openingStatements || {}; state.opening = state.opening || {};
    const start = cardStart(state, k), c = cardOf(state, k);
    if (c && !c.start) c.start = start; // pin it, so clearing the amounts does not move the start date
    for (const x of openKeys(state, k)) delete state.openingStatements[x];
    const open = cardStatementOf(state, k, start).close;
    if (billed) state.openingStatements[openKey(k, prevMonth(open))] = billed;
    if (unbilled) state.openingStatements[openKey(k, open)] = unbilled;
    if (billed + unbilled) state.opening[k] = billed + unbilled; else delete state.opening[k];
  }

  // every card the owner set up, plus any card that still appears in the data
  function cardList(state) {
    const ks = new Set(['CARD', ...(state.cards || []).map(c => c.k)]);
    for (const k of Object.keys(state.opening || {})) if (isCard(k)) ks.add(k);
    for (const e of state.entries) { if (isCard(e.from)) ks.add(e.from); if (isCard(e.to)) ks.add(e.to); }
    return [...ks];
  }

  // ---------- monthly bills ----------
  // A bill counts as paid by this cycle's expenses that carry its id (or an old payday "bills to Mom" entry of its category).
  function billStatus(state, asOf) {
    const cyc = cycleOf(asOf, state.payday);
    return (state.bills || []).map(bl => {
      let paid = 0;
      for (const e of state.entries) {
        if (e.type !== 'expense' || e.date < cyc.start || e.date > asOf) continue;
        const legacy = !e.bill && /^plan:.*:mom-bills/.test(e.tag || '') && e.cat === bl.cat;
        if (e.bill === bl.id || legacy) paid += e.amount;
      }
      if (bl.paidOut === cyc.start) paid = Math.max(paid, bl.amount); // paid outside the app this cycle; no money moves here
      const left = Math.max(0, bl.amount - paid);
      return { ...bl, paid, left, reserve: isPot(bl.from) ? 0 : left }; // a pocket already holds its own money
    });
  }

  // A bill with a loan (total owed + what was paid before the app) counts down by each payment entry of that bill.
  // endYm assumes one payment per cycle: the first is in this cycle if it is not paid yet, else the next one.
  function loanStatus(state, bill, asOf) {
    const L = bill && bill.loan;
    if (!L || !(L.total > 0) || !(bill.amount > 0)) return null;
    const cyc = cycleOf(asOf, state.payday);
    let paid = L.paidBefore || 0, thisCycle = false;
    for (const e of state.entries) {
      if (e.type !== 'expense' || e.bill !== bill.id || e.pre || e.date > asOf) continue;
      paid += e.amount;
      if (e.date >= cyc.start) thisCycle = true;
    }
    if (bill.paidOut === cyc.start) thisCycle = true; // marked paid outside the app; its amount is already in paidBefore
    const perPay = bill.amount, left = Math.max(0, L.total - paid), nLeft = Math.ceil(left / perPay);
    const first = (thisCycle ? addDays(cyc.end, 1) : cyc.end).slice(0, 7);
    return { total: L.total, paid, left, perPay, nPaid: Math.floor(paid / perPay), nTotal: Math.ceil(L.total / perPay), nLeft, endYm: nLeft ? addMonths(first, nLeft - 1) : null };
  }

  // ---------- safe to spend ----------
  function safeToSpend(state, asOf) {
    const b = balances(state, { asOf });
    let liquid = 0;
    for (const [k, v] of Object.entries(b)) if (isSpendable(state, k)) liquid += v;
    let card = 0, cardBilled = 0;
    for (const k of cardList(state)) {
      card += Math.max(0, b[k] || 0);
      cardBilled += statements(state, asOf, k).filter(s => s.closed).reduce((s, x) => s + x.remaining, 0);
    }
    const cardOpen = card - cardBilled;
    const bills = billStatus(state, asOf), reserved = bills.reduce((s, x) => s + x.reserve, 0);
    let iOwe = 0, owedToMe = 0; const people = {};
    for (const [k, v] of Object.entries(b)) if (isPerson(k)) {
      people[k.slice(7)] = v;
      if (v < 0) iOwe += -v; else owedToMe += v;
    }
    const safe = liquid - card - iOwe - reserved;
    const cyc = cycleOf(asOf, state.payday);
    const daysLeft = daysBetween(asOf, cyc.end) + 1; // today counts
    return { liquid, card, cardBilled, cardOpen, iOwe, owedToMe, people, reserved, bills, safe, perDay: Math.floor(safe / daysLeft), daysLeft, cycle: cyc, balances: b };
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

  // ---------- pocket goals ----------
  // Paydays from `from` (a payday date) up to and including month `by` ('YYYY-MM'); can be 0 or less once `by` has passed.
  const monthsRaw = (by, from) => { const [y, m] = by.split('-').map(Number), [fy, fm] = from.split('-').map(Number); return (y - fy) * 12 + (m - fm) + 1; };
  const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number), t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
  // A pocket's plan for the payday `from`: goal (optional), month to reach it, and the chosen amount per month.
  // need = exact whole-baht amount per month to reach the goal on time; amount = what this payday moves (never past the goal).
  function potPlan(p, have, from) {
    const goal = p.goal || 0, per = p.monthly != null ? p.monthly : (p.fixed || 0);
    let by = p.by || '';
    if (by && p.repeat) while (monthsRaw(by, from) < 1) by = addMonths(by, 12); // yearly goal: once its month passes, aim for next year
    const left = goal ? Math.max(0, goal - have) : 0;
    const n = by ? Math.max(1, monthsRaw(by, from)) : 0;
    const need = goal && by ? Math.ceil(left / n / 100) * 100 : 0;
    const base = per || need;
    const amount = goal ? Math.min(base, left) : base;
    const finish = goal && left && base ? addMonths(from.slice(0, 7), Math.ceil(left / base) - 1) : null;
    const status = !goal ? (base ? 'fixed' : 'none') : !left ? 'done' : !by ? 'open' : base * n >= left ? 'ontime' : 'late';
    const late = status === 'late' ? monthsRaw(finish, by + '-01') - 1 : 0;
    return { goal, by, left, n, need, per: base, amount, finish, status, late };
  }

  // ---------- per-cycle plan ----------
  // Defaults live in state (salary, cats[].b, pots[].monthly); state.cyclePlans[cycleStart] stores only overrides.
  function planFor(state, cycleStart) {
    const ov = (state.cyclePlans || {})[cycleStart] || {}, ovc = ov.cats || {};
    const cats = {}, pots = {};
    for (const c of state.cats || []) if (!c.arch) cats[c.id] = ovc[c.id] != null ? ovc[c.id] : (c.b || 0);
    // same amount the transfer checklist uses: monthly, else legacy fixed, else what the goal needs
    const bal = (state.pots || []).some(p => !p.monthly && (p.fixed || p.goal)) ? balances(state, { asOf: addDays(cycleStart, -1) }) : {};
    for (const p of state.pots || []) if (!p.arch && p.id !== 'cashflow') pots[p.id] = p.monthly || (p.fixed || p.goal ? potPlan(p, bal['pot:' + p.id] || 0, cycleStart).amount : 0);
    const bills = (state.bills || []).reduce((s, b) => s + (isPot(b.from) ? 0 : b.amount), 0);
    return { salary: ov.salary != null ? ov.salary : (state.salary || 0), cats, pots, bills };
  }
  const extraIncome = (state, cycle) => state.entries.reduce((s, e) =>
    s + (e.type === 'income' && !e.pre && e.cat !== 'salary' && e.date >= cycle.start && e.date <= cycle.end ? e.amount : 0), 0);
  function leftToAssign(state, cycleStart) {
    const p = planFor(state, cycleStart), sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    return p.salary + extraIncome(state, cycleOf(cycleStart, state.payday)) - sum(p.pots) - p.bills - sum(p.cats);
  }

  // ---------- where the cycle stands (Home) ----------
  // Bill payments (entries with .bill) are reserved whole by the plan, so category spending leaves them out.
  function catSpend(state, from, to) {
    const by = {};
    for (const e of state.entries) {
      if (e.type !== 'expense' || e.pre || e.bill || /^plan:.*:mom-bills/.test(e.tag || '') || isPot(e.from) || e.date < from || e.date > to) continue;
      by[e.cat] = (by[e.cat] || 0) + myShare(e);
    }
    return by;
  }
  function cycleStatus(state, asOf) {
    const cycle = cycleOf(asOf, state.payday), sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const plan = planFor(state, cycle.start), by = catSpend(state, cycle.start, cycle.end);
    const ids = Object.keys(plan.cats);
    for (const id of Object.keys(by)) if (!ids.includes(id)) ids.push(id);
    const cats = ids.map(id => { const budget = plan.cats[id] || 0, spent = by[id] || 0; return { id, budget, spent, left: budget - spent, over: spent > budget }; });
    const left = plan.salary + extraIncome(state, cycle) - sum(plan.pots) - plan.bills - sum(by);
    const cashflow = balances(state, { asOf })['pot:cashflow'] || 0;
    const drewCashflow = state.entries.reduce((a, e) => a + (e.type === 'transfer' && !e.pre && e.from === 'pot:cashflow' && e.date >= cycle.start && e.date <= asOf ? e.amount : 0), 0);
    const belowFloor = (state.cfFloor || 0) > 0 && cashflow < state.cfFloor;
    const overStreak = {}, alive = new Set(ids);
    let start = cycle.start;
    for (let i = 0; i < 12 && alive.size; i++) {
      const prev = cycleOf(addDays(start, -1), state.payday), pp = planFor(state, prev.start), pb = catSpend(state, prev.start, prev.end);
      for (const id of [...alive]) {
        if ((pb[id] || 0) > (pp.cats[id] || 0)) overStreak[id] = (overStreak[id] || 0) + 1; else alive.delete(id);
      }
      start = prev.start;
    }
    return { cycle, left, cats, drewCashflow, cashflow, belowFloor, overStreak };
  }

  // end-of-cycle sweep: what is really free in the spending account once its cards are paid, vs what the categories still think is left
  function sweep(state, asOf) {
    const from = state.spendTo, bal = balances(state, { asOf }), cards = state.cards || [];
    let owed = 0;
    for (const k of cardList(state)) {
      const card = cards.find(c => c.k === k), payer = (card && card.from) || from;
      if (payer === from) owed += Math.max(0, bal[k] || 0);
    }
    // keep back money for unpaid bills paid from here, and salary that already landed for the next cycle (it lands a few days before the cycle ends)
    const cycle = cycleOf(asOf, state.payday), early = addDays(cycle.end, -4);
    const reserved = billStatus(state, asOf).reduce((a, b) => a + (b.from === from ? b.reserve : 0), 0);
    const nextSalary = state.entries.reduce((a, e) => a + (e.type === 'income' && e.cat === 'salary' && e.to === from && e.date >= early && e.date <= asOf ? e.amount : 0), 0);
    const amount = Math.max(0, (bal[from] || 0) - owed - reserved - nextSalary);
    const fromCats = cycleStatus(state, asOf).cats.reduce((a, c) => a + Math.max(0, c.left), 0);
    return { amount, fromCats, gap: amount - fromCats, from };
  }

  root.LedgerCore = { sweep, cycleStatus, planFor, extraIncome, leftToAssign, changePayday, potPlan, addMonths, toSatang, baht, isDate, addDays, daysBetween, cycleOf, statementOf, cardStatementOf, changeCardDates, cardList, billStatus, loanStatus, cardOpening, setCardOpening, cardStart,
    balances, validate, statements, spending, safeToSpend,
    personHistory, shareStatus, myShare, sharesTotal, isPot, isPerson, isAsset, isAcct, isCard, isLiquid, isInvest, isSpendable, ASSETS, LIQUID };
  if (typeof module !== 'undefined') module.exports = root.LedgerCore;
})(typeof window !== 'undefined' ? window : globalThis);
