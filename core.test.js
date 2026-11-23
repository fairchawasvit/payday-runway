// Run: node mockup/core.test.js   (expected values are worked out by hand, in satang)
const C = require('./core.js');
const assert = require('node:assert/strict');
let n = 0, failed = 0;
function t(name, fn) { n++; try { fn(); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); } }
const B = x => Math.round(x * 100);
let seq = 0;
const ex = (date, amount, from, cat, extra = {}) => ({ id: ++seq, type: 'expense', date, amount: B(amount), from, cat, ...extra });
const inc = (date, amount, to, cat = 'salary') => ({ id: ++seq, type: 'income', date, amount: B(amount), to, cat });
const tr = (date, amount, from, to, extra = {}) => ({ id: ++seq, type: 'transfer', date, amount: B(amount), from, to, ...extra });
const base = () => ({ today: '2026-11-23', opening: { SCB: B(10000), 'pot:trip': B(500) }, pots: [{ id: 'trip' }, { id: 'cash' }], entries: [] });

// ---- money parsing ----
t('toSatang rounds to the satang and strips commas', () => {
  assert.equal(C.toSatang('1,234.56'), 123456);
  assert.equal(C.toSatang('0.1'), 10);
  assert.equal(C.toSatang(0.1 + 0.2), 30); // float noise does not leak
  assert.ok(Number.isNaN(C.toSatang('abc')));
});

// ---- calendar rules ----
t('budget cycle runs 28th to 27th', () => {
  assert.deepEqual(C.cycleOf('2026-11-23'), { start: '2026-10-28', end: '2026-11-27' });
  assert.deepEqual(C.cycleOf('2026-11-28'), { start: '2026-11-28', end: '2026-12-27' });
  assert.deepEqual(C.cycleOf('2026-11-27'), { start: '2026-10-28', end: '2026-11-27' });
  assert.deepEqual(C.cycleOf('2027-01-05'), { start: '2026-12-28', end: '2027-01-27' });
  assert.deepEqual(C.cycleOf('2027-02-28'), { start: '2027-02-28', end: '2027-03-27' });
});
t('card statement closes 17th, due 2nd of next month', () => {
  assert.deepEqual(C.statementOf('2026-11-17'), { close: '2026-11-17', due: '2026-12-02' });
  assert.deepEqual(C.statementOf('2026-11-18'), { close: '2026-12-17', due: '2027-01-02' });
  assert.deepEqual(C.statementOf('2026-12-20'), { close: '2027-01-17', due: '2027-02-02' });
  assert.deepEqual(C.statementOf('2026-10-05'), { close: '2026-10-17', due: '2026-11-02' });
});
t('date validation rejects impossible dates', () => {
  assert.ok(C.isDate('2026-02-28')); assert.ok(!C.isDate('2026-02-30')); assert.ok(!C.isDate('2026-2-3'));
});

// ---- balances ----
t('SCB expense lowers SCB', () => {
  const s = base(); s.entries.push(ex('2026-11-20', 120, 'SCB', 'food'));
  assert.equal(C.balances(s).SCB, B(9880));
});
t('card expense raises card debt, not SCB', () => {
  const s = base(); s.entries.push(ex('2026-11-20', 45, 'CARD', 'food'));
  const b = C.balances(s); assert.equal(b.SCB, B(10000)); assert.equal(b.CARD, B(45));
});
t('card payment moves SCB to the card', () => {
  const s = base(); s.entries.push(ex('2026-11-10', 600, 'CARD', 'food'), tr('2026-12-01', 600, 'SCB', 'CARD'));
  const b = C.balances(s); assert.equal(b.SCB, B(9400)); assert.equal(b.CARD, 0);
});
t('split bill: friends owe their shares, my spend is the rest', () => {
  const s = base(); const e = ex('2026-11-14', 1650, 'SCB', 'travel', { shares: [{ p: 'Alex', amount: B(750) }, { p: 'Ben', amount: B(400) }] });
  s.entries.push(e);
  const b = C.balances(s);
  assert.equal(b.SCB, B(8350)); assert.equal(b['person:Alex'], B(750)); assert.equal(b['person:Ben'], B(400));
  assert.equal(C.myShare(e), B(500));
  assert.equal(C.spending(s, '2026-10-28', '2026-11-27').mine, B(500));
});
t('partial repayment keeps the rest owed', () => {
  const s = base(); s.entries.push(ex('2026-11-14', 900, 'SCB', 'travel', { shares: [{ p: 'Chai', amount: B(300) }] }), tr('2026-11-20', 100, 'person:Chai', 'SCB'));
  const b = C.balances(s); assert.equal(b['person:Chai'], B(200)); assert.equal(b.SCB, B(9200));
});
t('pocket spend lowers the pocket, not SCB, and not the cycle budget', () => {
  const s = base(); s.entries.push(ex('2026-11-10', 300, 'pot:trip', 'travel'));
  const b = C.balances(s); assert.equal(b['pot:trip'], B(200)); assert.equal(b.SCB, B(10000));
  const sp = C.spending(s, '2026-10-28', '2026-11-27'); assert.equal(sp.mine, 0); assert.equal(sp.pots, B(300));
});
t('Mom: rent owed + help income net out, then one transfer settles', () => {
  const s = base();
  s.entries.push(ex('2026-11-01', 1000, 'person:Mom', 'rent'), ex('2026-11-01', 400, 'person:Mom', 'power'),
    inc('2026-11-15', 1600, 'person:Mom', 'side'));
  assert.equal(C.balances(s)['person:Mom'], B(200)); // Mom owes me 200 net
  s.entries.push(tr('2026-11-20', 200, 'person:Mom', 'SCB'));
  const b = C.balances(s); assert.equal(b['person:Mom'], 0); assert.equal(b.SCB, B(10200));
  assert.equal(C.spending(s, '2026-10-28', '2026-11-27').mine, B(1400));
});
t('Mom: when I owe more, I pay the net', () => {
  const s = base(); s.entries.push(ex('2026-11-01', 6000, 'person:Mom', 'car'), inc('2026-11-15', 1500, 'person:Mom', 'side'), tr('2026-11-28', 4500, 'SCB', 'person:Mom'));
  const b = C.balances(s); assert.equal(b['person:Mom'], 0); assert.equal(b.SCB, B(5500));
});
t('salary split: transfers move money, total unchanged', () => {
  const s = base(); s.entries.push(inc('2026-11-28', 30000, 'KPLUS'), tr('2026-11-28', 12000, 'KPLUS', 'pot:trip'), tr('2026-11-28', 18000, 'KPLUS', 'SCB'));
  const b = C.balances(s); assert.equal(b.KPLUS, 0); assert.equal(b['pot:trip'], B(12500)); assert.equal(b.SCB, B(28000));
});
t('editing excludes the old version', () => {
  const s = base(); const e = ex('2026-11-20', 9000, 'SCB', 'food'); s.entries.push(e);
  const v = C.validate(s, { ...e, amount: B(9500) }, { editingId: e.id });
  assert.ok(v.ok); assert.equal(v.warnings.length, 0); // 10000 - 9500 still >= 0
});

// ---- statements ----
t('statements split by close date and payments settle oldest first', () => {
  const s = base();
  s.entries.push(ex('2026-10-05', 99, 'CARD', 'food'), ex('2026-11-02', 600, 'CARD', 'food'), ex('2026-11-20', 45, 'CARD', 'food'),
    tr('2026-11-02', 99, 'SCB', 'CARD'));
  const st = C.statements(s, '2026-11-23');
  assert.deepEqual(st.map(x => [x.close, x.total, x.remaining, x.status]), [
    ['2026-10-17', B(99), 0, 'paid'], ['2026-11-17', B(600), B(600), 'due'], ['2026-12-17', B(45), B(45), 'open']]);
});
t('on the 17th itself the statement is still open (closes at end of day)', () => {
  const s = base(); s.entries.push(ex('2026-11-17', 50, 'CARD', 'food'));
  assert.equal(C.statements(s, '2026-11-17')[0].status, 'open');
  assert.equal(C.statements(s, '2026-11-18')[0].status, 'due');
  assert.equal(C.safeToSpend(s, '2026-11-17').cardBilled, 0);
});
t('overdue when past the due date', () => {
  const s = base(); s.entries.push(ex('2026-10-05', 99, 'CARD', 'food'));
  assert.equal(C.statements(s, '2026-11-03')[0].status, 'overdue');
});

// ---- safe to spend ----
t('safe to spend = liquid - all card debt - what I owe; refunds not counted', () => {
  const s = base();
  s.entries.push(ex('2026-11-02', 600, 'CARD', 'food'), ex('2026-11-20', 45, 'CARD', 'food'),
    ex('2026-11-14', 900, 'SCB', 'travel', { shares: [{ p: 'Chai', amount: B(300) }] }), ex('2026-11-01', 1000, 'person:Mom', 'rent'));
  const r = C.safeToSpend(s, '2026-11-23');
  // SCB 10000-900 = 9100; card 645; I owe Mom 1000; Chai owes me 300 (ignored)
  assert.equal(r.liquid, B(9100)); assert.equal(r.card, B(645)); assert.equal(r.cardBilled, B(600)); assert.equal(r.cardOpen, B(45));
  assert.equal(r.iOwe, B(1000)); assert.equal(r.owedToMe, B(300)); assert.equal(r.safe, B(7455));
  assert.equal(r.daysLeft, 5); assert.equal(r.perDay, B(1491));
});
t('paying the card does not change safe to spend', () => {
  const s = base(); s.entries.push(ex('2026-11-02', 600, 'CARD', 'food'));
  const a = C.safeToSpend(s, '2026-11-23').safe; s.entries.push(tr('2026-11-23', 600, 'SCB', 'CARD'));
  assert.equal(C.safeToSpend(s, '2026-11-23').safe, a);
});
t('pocket money is not safe to spend', () => {
  const s = base(); assert.equal(C.safeToSpend(s, '2026-11-23').safe, B(10000));
});
t('future-dated entries do not count yet', () => {
  const s = base(); s.entries.push(ex('2026-11-25', 500, 'SCB', 'food'));
  assert.equal(C.safeToSpend(s, '2026-11-23').safe, B(10000));
});

// ---- validation ----
const errs = v => v.errors.map(e => e.code);
t('rejects zero, negative, NaN amounts', () => {
  const s = base();
  for (const a of [0, -5000, NaN, 12.5]) assert.ok(!C.validate(s, { type: 'expense', date: '2026-11-20', amount: a, from: 'SCB', cat: 'food' }).ok, String(a));
});
t('rejects friend shares larger than the bill', () => {
  const s = base(); const v = C.validate(s, { type: 'expense', date: '2026-11-20', amount: B(300), from: 'SCB', cat: 'food', shares: [{ p: 'Alex', amount: B(500) }] });
  assert.deepEqual(errs(v), ['share']);
});
t('allows paying entirely for a friend (my share 0)', () => {
  const s = base(); assert.ok(C.validate(s, { type: 'expense', date: '2026-11-20', amount: B(300), from: 'SCB', cat: 'food', shares: [{ p: 'Alex', amount: B(300) }] }).ok);
});
t('rejects the same friend twice', () => {
  const s = base(); const v = C.validate(s, { type: 'expense', date: '2026-11-20', amount: B(300), from: 'SCB', cat: 'food', shares: [{ p: 'Chai', amount: B(50) }, { p: 'Chai', amount: B(50) }] });
  assert.ok(errs(v).includes('share'));
});
t('blocks overspending a pocket', () => {
  const s = base(); const v = C.validate(s, { type: 'expense', date: '2026-11-20', amount: B(1000), from: 'pot:trip', cat: 'travel' });
  assert.deepEqual(errs(v), ['pot']);
});
t('warns (does not block) when SCB would go negative', () => {
  const s = base(); const v = C.validate(s, { type: 'expense', date: '2026-11-20', amount: B(12000), from: 'SCB', cat: 'food' });
  assert.ok(v.ok); assert.deepEqual(v.warnings.map(w => w.code), ['negative']);
});
t('blocks paying the card more than owed', () => {
  const s = base(); s.entries.push(ex('2026-11-02', 600, 'CARD', 'food'));
  assert.deepEqual(errs(C.validate(s, { type: 'transfer', date: '2026-11-23', amount: B(700), from: 'SCB', to: 'CARD' })), ['card']);
});
t('blocks a refund larger than what the friend owes', () => {
  const s = base(); s.entries.push(ex('2026-11-14', 900, 'SCB', 'travel', { shares: [{ p: 'Chai', amount: B(300) }] }));
  assert.deepEqual(errs(C.validate(s, { type: 'transfer', date: '2026-11-20', amount: B(400), from: 'person:Chai', to: 'SCB' })), ['repay']);
});
t('rejects transfer to the same account', () => {
  const s = base(); assert.ok(errs(C.validate(s, { type: 'transfer', date: '2026-11-20', amount: B(1), from: 'SCB', to: 'SCB' })).includes('to'));
});
t('rejects unknown pocket', () => {
  const s = base(); assert.ok(errs(C.validate(s, { type: 'expense', date: '2026-11-20', amount: B(1), from: 'pot:nope', cat: 'x' })).includes('from'));
});
t('warns on future date', () => {
  const s = base(); assert.deepEqual(C.validate(s, { type: 'expense', date: '2026-12-25', amount: B(1), from: 'SCB', cat: 'food' }).warnings.map(w => w.code), ['future']);
});
t('rejects impossible date', () => {
  const s = base(); assert.ok(errs(C.validate(s, { type: 'expense', date: '2026-02-30', amount: B(1), from: 'SCB', cat: 'food' })).includes('date'));
});

// ---- refund tracking per bill ----
t('repayments clear oldest debts first and record the date', () => {
  const s = base();
  const a = ex('2026-11-02', 600, 'SCB', 'food', { shares: [{ p: 'Chai', amount: B(300) }] });
  const b = ex('2026-11-14', 900, 'SCB', 'travel', { shares: [{ p: 'Chai', amount: B(300) }] });
  s.entries.push(a, b, tr('2026-11-05', 300, 'person:Chai', 'SCB'), tr('2026-11-20', 100, 'person:Chai', 'SCB'));
  assert.deepEqual(C.shareStatus(s, a.id), [{ p: 'Chai', amount: B(300), left: 0, paidOn: '2026-11-05' }]);
  assert.deepEqual(C.shareStatus(s, b.id), [{ p: 'Chai', amount: B(300), left: B(200), paidOn: null }]);
});
t('deleting an entry removes all its effects', () => {
  const s = base(); const e = ex('2026-11-14', 900, 'SCB', 'travel', { shares: [{ p: 'Chai', amount: B(300) }] });
  s.entries.push(e); s.entries = s.entries.filter(x => x.id !== e.id);
  const b = C.balances(s); assert.equal(b.SCB, B(10000)); assert.equal(b['person:Chai'] || 0, 0);
});

console.log(`${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
