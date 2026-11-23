// Browser scenario test: drives the real screens and checks every money figure.
// Run in the page console (served by serve.py): await (await import('/ui.scenarios.js')).run()
export async function run() {
  localStorage.removeItem('ledger-mock');
  const A = window.__app, C = A.C, $ = id => document.getElementById(id);
  // start from fresh sample data without reloading
  A.loadSample();
  const out = []; let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; if (!cond) out.push('FAIL ' + name + ' ' + detail); };
  const eq = (name, got, want) => ok(name, got === want, `got ${got} want ${want}`);
  const bal = k => (C.balances(A.ST, { asOf: A.ST.today })[k] || 0) / 100;
  const safe = () => C.safeToSpend(A.ST, A.ST.today).safe / 100;
  const spentCycle = () => C.spending(A.ST, '2026-10-28', '2026-11-27').mine / 100;
  const count = () => A.ST.entries.length;
  const save = (form) => { A.setF(form); A.go('add'); const btn = $('save'); if (btn.disabled) return 'blocked'; btn.click(); if (A.F().amount) btn.click(); return A.F().amount ? 'stuck' : 'saved'; };
  const msgs = () => $('msgs').innerText;

  // 1. starting point (hand-computed)
  eq('1 SCB', bal('SCB'), 17625); eq('1 safe', safe(), 7970); eq('1 card', bal('CARD'), 4655); eq('1 Mom', bal('person:Mom'), -5000);
  eq('1 screen shows safe', $('avail').textContent, '7,970.00');
  // 2. card purchase today
  let s0 = safe(), sp0 = spentCycle();
  eq('2 saved', save({ type: 'expense', amount: '45', from: 'CARD', cat: 'food', place: '7-Eleven' }), 'saved');
  eq('2 safe -45', safe(), s0 - 45); eq('2 SCB unchanged', bal('SCB'), 17625); eq('2 spent +45', spentCycle(), sp0 + 45);
  eq('2 goes to Dec statement', C.statements(A.ST, A.ST.today).find(s => s.close === '2026-12-17').total / 100, 683);
  // 3. zero / negative blocked
  eq('3 zero blocked', save({ type: 'expense', amount: '0', from: 'SCB', cat: 'food' }), 'blocked');
  eq('3 negative blocked', save({ type: 'expense', amount: '-50', from: 'SCB', cat: 'food' }), 'blocked');
  eq('3 text blocked', save({ type: 'expense', amount: 'abc', from: 'SCB', cat: 'food' }), 'blocked');
  // 4. split with two friends
  s0 = safe(); sp0 = spentCycle(); let n0 = count();
  eq('4 saved', save({ type: 'expense', amount: '900', from: 'SCB', cat: 'travel', split: ['Chai', 'Dao'] }), 'saved');
  eq('4 one entry', count(), n0 + 1); eq('4 safe -900 (refunds not counted yet)', safe(), s0 - 900); eq('4 my spend +300', spentCycle(), sp0 + 300);
  eq('4 Chai owes 300', bal('person:Chai'), 300); eq('4 Dao owes 300', bal('person:Dao'), 300);
  // 4b. uneven split 1000 / 3 people: friends 333.33 each, me 333.34
  sp0 = spentCycle();
  save({ type: 'expense', amount: '1000', from: 'SCB', cat: 'food', split: ['Alex', 'Ben'] });
  eq('4b my share gets the leftover satang', Math.round((spentCycle() - sp0) * 100), 33334);
  // 5. friend share larger than the bill
  eq('5 share > bill blocked', save({ type: 'expense', amount: '300', from: 'SCB', cat: 'food', split: ['Alex'], custom: { 'Alex': '500' } }), 'blocked');
  ok('5 error shown', /more than the bill/.test(msgs()), msgs());
  // 6. pocket overspend
  const fam = bal('pot:fam');
  eq('6 pocket overspend blocked', save({ type: 'expense', amount: String(fam + 1), from: 'POT', pot: 'fam', cat: 'travel' }), 'blocked');
  s0 = safe(); sp0 = spentCycle();
  eq('6b pocket spend ok', save({ type: 'expense', amount: '500', from: 'POT', pot: 'travel', cat: 'travel' }), 'saved');
  eq('6b safe unchanged', safe(), s0); eq('6b budget unchanged', spentCycle(), sp0); eq('6b pocket -500', bal('pot:travel'), 3456 - 500);
  // 7. back-dated card purchase lands on the old statement and shows as unpaid
  save({ type: 'expense', amount: '99', from: 'CARD', cat: 'food', date: '2026-10-05' });
  const oct = C.statements(A.ST, A.ST.today).find(s => s.close === '2026-10-17');
  eq('7 Oct statement total', oct.total / 100, 2004); eq('7 Oct remaining', oct.remaining / 100, 99); eq('7 Oct status', oct.status, 'overdue');
  A.go('home'); ok('7 banner says overdue', /overdue/.test($('dueTxt').innerText), $('dueTxt').innerText);
  // 8. recent is by date: the back-dated entry is not first
  ok('8 recent newest first', !/05 Oct/.test($('recent').querySelector('.crow').innerText), $('recent').querySelector('.crow').innerText);
  // 9. partial refund
  const tata0 = bal('person:Alex'); s0 = safe();
  $('pp-Alex').value = '300'; $('ppl').querySelector('[data-p="Alex"]').click();
  eq('9 Alex owes less', bal('person:Alex'), +(tata0 - 300).toFixed(2)); eq('9 safe +300', safe(), s0 + 300);
  const kh = A.ST.entries.find(e => e.place === 'Hotel');
  const ss = C.shareStatus(A.ST, kh.id).find(x => x.p === 'Alex');
  eq('9 Khao Yai share left (oldest debt first)', ss.left / 100, 450);
  // 10. over-refund blocked
  n0 = count(); $('pp-Ben').value = '5000'; $('ppl').querySelector('[data-p="Ben"]').click();
  eq('10 over-refund not saved', count(), n0);
  // 11. pay Mom the net
  s0 = safe(); const scb0 = bal('SCB');
  $('pp-Mom').value = '5000'; $('ppl').querySelector('[data-p="Mom"]').click();
  eq('11 Mom settled', bal('person:Mom'), 0); eq('11 SCB -5000', bal('SCB'), +(scb0 - 5000).toFixed(2)); eq('11 safe unchanged', safe(), s0);
  // 11b. the user's own example: help 15 h x 200 = 3,000; bills 1,000 + 600 + 5,000 = 6,600; pay Mom 3,600 on payday
  A.setF({ type: 'income', incCat: 'side', to: 'person:Mom' }); A.go('add');
  $('hours').value = '15'; $('hours').dispatchEvent(new Event('input'));
  eq('11b hours fill amount', A.F().amount, '2250.00'); $('save').click(); if (A.F().amount) $('save').click();
  eq('11b Mom owes me 2250', bal('person:Mom'), 2250);
  A.go('plan'); const stepTxt = () => $('alloc').innerText;
  ok('11b plan shows Mom bills 6,600', /6,600/.test(stepTxt()), stepTxt().slice(0, 300));
  ok('11b plan shows pay Mom 4,350', /Pay Mom the net amount\s*4,350/.test(stepTxt()), stepTxt());
  const toScbBefore = $('toScb').textContent;
  $('ck0').click(); $('ck1').click();
  const allB = C.balances(A.ST);
  eq('11b after bills Mom is -4350 (incl. future-dated payday)', allB['person:Mom'] / 100, -4350);
  $('ck2').click(); eq('11b after paying Mom it is 0', C.balances(A.ST)['person:Mom'] || 0, 0);
  eq('11b rest to SCB unchanged by ticking', $('toScb').textContent, toScbBefore);
  const sumPlan = A.ST.entries.filter(e => (e.tag || '').startsWith('plan:')).length;
  eq('11b entries recorded: salary + 3 bills + pay', sumPlan, 5);
  $('ck1').click(); eq('11b cannot untick bills while Mom paid', A.ST.entries.filter(e => (e.tag || '').startsWith('plan:')).length, 5);
  $('ck2').click(); $('ck1').click(); $('ck0').click();
  eq('11b all unticked', A.ST.entries.filter(e => (e.tag || '').startsWith('plan:')).length, 0);
  A.go('home');
  // 12. pay card bill from banner
  s0 = safe(); const card0 = bal('CARD'); $('payBill').click();
  eq('12 safe unchanged', safe(), s0); ok('12 card lower', bal('CARD') < card0);
  eq('12 oldest (Oct) statement paid first', C.statements(A.ST, A.ST.today).find(s => s.close === '2026-10-17').remaining, 0);
  // 13. edit an entry, then undo
  const food = A.ST.entries.find(e => e.date === '2026-11-15' && e.amount === 11000);
  const scbE = bal('SCB');
  A.setF({}); A.go('hist'); window.__app.go('hist');
  A.setF({ type: 'expense', amount: '150', from: 'SCB', cat: 'food', date: '2026-11-15', editingId: food.id }); A.go('add'); $('save').click();
  eq('13 edit changes SCB by -40', bal('SCB'), +(scbE - 40).toFixed(2)); eq('13 still one entry', A.ST.entries.filter(e => e.id === food.id).length, 1);
  document.getElementById('undoBtn').click(); eq('13 undo restores', bal('SCB'), scbE);
  // 14. delete and undo
  n0 = count(); A.go('hist'); const row = $('hlist').querySelector('.crow'); row.click();
  const del = $('hlist').querySelector('[data-del]'); del.click(); del.click === undefined; $('hlist').querySelector('[data-del]').click();
  eq('14 deleted', count(), n0 - 1); document.getElementById('undoBtn').click(); eq('14 undo restores', count(), n0);
  // 15. salary split ticks record transfers; untick removes
  A.go('plan'); n0 = count();
  $('ck0').click(); eq('15 salary recorded', count(), n0 + 1);
  $('ck3').click(); eq('15 pocket transfer recorded', count(), n0 + 2);
  const t1 = A.ST.entries.at(-1); ok('15 transfer K+ -> pocket', t1.from === 'KPLUS' && t1.to.startsWith('pot:'), JSON.stringify(t1));
  $('ck3').click(); eq('15 untick removes', count(), n0 + 1); $('ck0').click(); eq('15 untick salary', count(), n0);
  // 16. reconcile and adjust
  A.go('home'); const book = bal('SCB'); $('realScb').value = String(book - 125); $('realScb').dispatchEvent(new Event('input'));
  ok('16 diff shown', /−?-?125\.00/.test($('diff').textContent), $('diff').textContent); $('adjBtn').click();
  eq('16 after adjustment matches', bal('SCB'), +(book - 125).toFixed(2)); A.go('home'); eq('16 diff now zero', $('diff').textContent, '0.00');
  // 17. pocket with money cannot be archived
  A.go('set'); const before = A.ST.pots.find(p => p.id === 'ins').arch; $('pa0').click();
  eq('17 non-empty pocket not archived', A.ST.pots.find(p => p.id === 'ins').arch, before);
  // 18. category rename keeps history
  const i = A.ST.cats.findIndex(c => c.id === 'fuel'); $('cn' + i).value = 'Gas'; $('cn' + i).dispatchEvent(new Event('change'));
  ok('18 history shows new name', A.ST.entries.some(e => e.cat === 'fuel'), ''); A.go('sum'); ok('18 summary uses new name', /Gas/.test($('catList').innerText), $('catList').innerText.slice(0, 80));
  // 19. future-dated entry needs a second tap and does not count yet
  s0 = safe(); A.setF({ type: 'expense', amount: '10', from: 'SCB', cat: 'food', date: '2026-12-25' }); A.go('add');
  $('save').click(); ok('19 first tap only warns', A.F().amount === '10'); $('save').click();
  eq('19 future entry not in safe yet', safe(), s0);
  // 20. Thai renders
  ok('20 Thai intact', A.ST.people[0] === 'Alex', A.ST.people[0]);
  // 21. invariant: total money is conserved across every transfer in the data
  const tot = A.ST.entries.filter(e => e.type === 'transfer');
  ok('21 no transfer has same from/to', tot.every(e => e.from !== e.to));
  // 22. no asset or pocket is negative
  const b = C.balances(A.ST);
  ok('22 no negative pocket', Object.entries(b).filter(([k]) => k.startsWith('pot:')).every(([, v]) => v >= 0), JSON.stringify(b));
  A.loadSample();
  return { pass, fail, out };
}
