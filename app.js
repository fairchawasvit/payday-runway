/* Payday Runway app UI. All money logic lives in core.js; this file only renders and records entries. */
(function () {
'use strict';
const C = window.LedgerCore;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- language & formatting ----------
let L = 'en'; try { L = localStorage.getItem('lang') || 'en'; } catch (e) {}
const tl = (en, th) => (L === 'th' ? th : en);
const MEN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const DEN = ['Su','Mo','Tu','We','Th','Fr','Sa'], DTH = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const MN = () => (L === 'th' ? MTH : MEN);
const fm = s => (s / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fm0 = s => Math.round(s / 100).toLocaleString('en-US');
const dl = d => { const [, m, dd] = d.split('-').map(Number); return `${dd} ${MN()[m - 1]}`; };
const dly = d => `${dl(d)} ${d.slice(0, 4)}`;
const dow = d => { const [y, m, dd] = d.split('-').map(Number); return (L === 'th' ? DTH : DEN)[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]; };
const B = x => Math.round(x * 100);

// ---------- sample state (made-up names and amounts, clearly labelled in the UI) ----------
function sampleState() {
  const pots = [
    { id: 'ins', n: 'Insurance', th: 'ประกัน', goal: B(30000), by: '2027-08' },
    { id: 'car', n: 'Car', th: 'รถ', goal: B(20000), by: '2027-11' },
    { id: 'big', n: 'Big trip', th: 'ทริปใหญ่', goal: B(40000), by: '2027-10' },
    { id: 'mid', n: 'Mid trip', th: 'ทริปกลาง', goal: B(15000), by: '2027-06' },
    { id: 'fam', n: 'Family trip', th: 'ทริปครอบครัว', goal: B(10000), by: '2027-04' },
    { id: 'travel', n: 'Travel', th: 'เที่ยว', fixed: B(2000) },
    { id: 'personal', n: 'Personal', th: 'ส่วนตัว', fixed: B(1500) },
    { id: 'goods', n: 'Personal goods', th: 'ของใช้', fixed: B(900) },
    { id: 'emerg', n: 'Emergency fund', th: 'เงินฉุกเฉิน', goal: B(60000) },
    { id: 'cashflow', n: 'Cash flow', th: 'Cash flow' },
    { id: 'invest', n: 'Investing prep', th: 'เตรียมลงทุน' },
  ];
  const cats = [
    { id: 'food', en: 'Food', th: 'กิน', b: B(3300) }, { id: 'fuel', en: 'Fuel', th: 'น้ำมัน', b: B(2000) },
    { id: 'goods', en: 'Goods', th: 'ของใช้', b: B(600) }, { id: 'travel', en: 'Travel', th: 'เที่ยว', b: B(5000) },
    { id: 'personal', en: 'Personal', th: 'ส่วนตัว', b: B(10000) }, { id: 'rent', en: 'Rent', th: 'ค่าหอ', b: B(1200) },
    { id: 'power', en: 'Power', th: 'ค่าไฟ', b: 0 }, { id: 'net', en: 'Internet', th: 'เน็ต', b: B(500) }, { id: 'car', en: 'Car', th: 'ค่ารถ', b: B(4900) },
    { id: 'other', en: 'Other', th: 'อื่นๆ', b: 0 }, { id: 'laundry', en: 'Laundry', th: 'ซักผ้า', b: 0, arch: true },
  ];
  let id = 0; const E = [];
  const ex = (date, a, from, cat, x = {}) => E.push({ id: ++id, type: 'expense', date, amount: B(a), from, cat, ...x });
  const inc = (date, a, to, cat) => E.push({ id: ++id, type: 'income', date, amount: B(a), to, cat });
  const tr = (date, a, from, to, x = {}) => E.push({ id: ++id, type: 'transfer', date, amount: B(a), from, to, ...x });
  const split = d => { tr(d, 16900, 'KPLUS', 'SCB'); [['ins', 2500], ['car', 1700], ['big', 2500], ['mid', 1000], ['fam', 1000], ['travel', 2000], ['personal', 1500], ['goods', 900]].forEach(([p, a]) => tr(d, a, 'KPLUS', 'pot:' + p)); };
  // previous cycle (28 Sep – 27 Oct), condensed
  inc('2026-09-29', 30000, 'KPLUS', 'salary'); split('2026-09-29');
  ex('2026-09-29', 1200, 'person:Mom', 'rent'); ex('2026-09-29', 4900, 'person:Mom', 'car'); ex('2026-09-29', 500, 'person:Mom', 'net');
  inc('2026-10-15', 1600, 'person:Mom', 'side'); tr('2026-10-15', 5000, 'SCB', 'person:Mom');
  const prev = [['10-01', '7-Eleven', 62, 'CARD', 'food'], ['10-03', 'Shell', 1000, 'CARD', 'fuel'], ['10-05', 'Lotus', 99, 'CARD', 'food'], ['10-08', 'Café Amazon', 65, 'SCB', 'food'],
    ['10-11', 'Shopee', 699, 'CARD', 'personal'], ['10-12', '7-Eleven', 45, 'CARD', 'food'], ['10-14', 'Big C', 320, 'SCB', 'travel'], ['10-18', 'BBQ', 250, 'SCB', 'food'],
    ['10-20', 'Shell', 1200, 'CARD', 'fuel'], ['10-22', 'Lotus', 108, 'CARD', 'goods'], ['10-25', '7-Eleven', 51, 'CARD', 'food'], ['10-26', '7-Eleven', 20, 'SCB', 'food']];
  prev.forEach(([d, p, a, f, c]) => ex('2026-' + d, a, f, c, { place: p }));
  tr('2026-10-02', 2800, 'SCB', 'CARD'); // pays the 17 Sep statement (opening)
  tr('2026-11-02', 1905, 'SCB', 'CARD'); // pays the 17 Oct statement
  // this cycle (28 Oct – 27 Nov)
  inc('2026-10-29', 30000, 'KPLUS', 'salary'); split('2026-10-29');
  ex('2026-10-29', 1200, 'person:Mom', 'rent'); ex('2026-10-29', 4900, 'person:Mom', 'car'); ex('2026-10-29', 500, 'person:Mom', 'net');
  inc('2026-11-15', 1600, 'person:Mom', 'side');
  ex('2026-10-29', 8500, 'SCB', 'personal', { note: 'Trip deposit' });
  ex('2026-10-30', 234, 'CARD', 'food', { place: 'Lotus' });
  ex('2026-11-02', 600, 'CARD', 'food', { place: 'BBQ', shares: [{ p: 'Chai', amount: B(300) }] });
  tr('2026-11-05', 300, 'person:Chai', 'SCB');
  ex('2026-11-03', 1000, 'CARD', 'fuel', { place: 'Shell' });
  ex('2026-11-08', 125, 'CARD', 'food', { place: 'Lotus' });
  ex('2026-11-09', 699, 'CARD', 'personal', { place: 'Streaming' });
  ex('2026-11-11', 55, 'SCB', 'food', { place: 'Café Amazon' });
  ex('2026-11-13', 544, 'pot:travel', 'travel', { place: 'Train tickets' });
  ex('2026-11-14', 1650, 'SCB', 'travel', { place: 'Hotel', shares: [{ p: 'Alex', amount: B(750) }, { p: 'Ben', amount: B(400) }] });
  ex('2026-11-15', 110, 'SCB', 'food');
  ex('2026-11-20', 45, 'CARD', 'food', { place: '7-Eleven' });
  ex('2026-11-21', 555, 'CARD', 'fuel', { place: 'Shell' });
  ex('2026-11-22', 38, 'CARD', 'food', { place: '7-Eleven' });
  return {
    ...emptyState(), sample: true, setupDone: true, nextId: id + 1, salary: B(30000),
    opening: { SCB: B(4200), CARD: B(2800), 'pot:ins': B(2500), 'pot:car': B(3400), 'pot:goods': B(450), 'pot:emerg': B(25000), 'pot:cashflow': B(1800), 'pot:invest': B(2000) },
    openingStatements: { '2026-09-17': B(2800) },
    pots, cats, people: ['Alex', 'Ben', 'Chai', 'Dao'],
    momBills: [{ cat: 'rent', amount: B(1200) }, { cat: 'net', amount: B(500) }, { cat: 'car', amount: B(4900) }], helpRate: B(150),
    places: [{ n: '7-Eleven', c: 'food', s: 'CARD' }, { n: 'Lotus', c: 'food', s: 'CARD' }, { n: 'Shell', c: 'fuel', s: 'CARD' }, { n: 'Café Amazon', c: 'food', s: 'SCB' }],
    entries: E,
  };
}
const SCHEMA = 1;
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// A fresh install carries no personal data: the owner types it in during setup.
function emptyState() {
  return {
    schema: SCHEMA, setupDone: false, nextId: 1, salary: 0, opening: {}, openingStatements: {},
    pots: [{ id: 'cashflow', n: 'Cash flow', th: 'Cash flow' }, { id: 'emerg', n: 'Emergency fund', th: 'เงินฉุกเฉิน' }],
    cats: [{ id: 'food', en: 'Food', th: 'กิน', b: 0 }, { id: 'fuel', en: 'Fuel', th: 'น้ำมัน', b: 0 }, { id: 'goods', en: 'Goods', th: 'ของใช้', b: 0 },
      { id: 'travel', en: 'Travel', th: 'เที่ยว', b: 0 }, { id: 'personal', en: 'Personal', th: 'ส่วนตัว', b: 0 }, { id: 'rent', en: 'Rent', th: 'ค่าหอ', b: 0 },
      { id: 'net', en: 'Internet', th: 'เน็ต', b: 0 }, { id: 'car', en: 'Car', th: 'ค่ารถ', b: 0 }, { id: 'subs', en: 'Subscriptions', th: 'สมาชิกรายเดือน', b: 0 },
      { id: 'power', en: 'Power', th: 'ค่าไฟ', b: 0 }, { id: 'haircut', en: 'Haircut', th: 'ตัดผม', b: 0 }, { id: 'laundry', en: 'Laundry', th: 'ซักผ้า', b: 0 },
      { id: 'splurge', en: 'Splurge', th: 'ฟุ่มเฟือย', b: 0 }, { id: 'other', en: 'Other', th: 'อื่นๆ', b: 0 }],
    incCats: [{ id: 'salary', en: 'Salary', th: 'เงินเดือน' }, { id: 'side', en: 'Helping Mom', th: 'ช่วยแม่' }, { id: 'other-in', en: 'Other income', th: 'รายรับอื่น' }],
    people: [], places: [], momBills: [], helpRate: 0,
    entries: [], lastBackup: null,
  };
}
function migrate(st) {
  if (!st || typeof st !== 'object' || !Array.isArray(st.entries)) return null;
  if (!st.schema) st.schema = 1; // future migrations go here, one step per version
  if (!Array.isArray(st.momBills)) st.momBills = [];
  if (!Number.isInteger(st.helpRate)) st.helpRate = 0;
  if (!Number.isInteger(st.salary)) st.salary = 0;
  if (!Array.isArray(st.people)) st.people = [];
  return st;
}
let ST = migrate(window.__initialState) || emptyState();
ST.today = localToday();
let saveFailed = false;
const persist = () => { const copy = { ...ST }; delete copy.today; window.Store.save(copy).then(ok => { if (!ok && !saveFailed) { saveFailed = true; toast(tl('Could not save on this device. Export a backup now.', 'บันทึกในเครื่องไม่ได้ ควรสำรองข้อมูลทันที')); } }); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && localToday() !== ST.today) { ST.today = localToday(); render(); } });

// ---------- names ----------
const potOf = id => ST.pots.find(p => p.id === id);
const pn = p => (L === 'th' ? p.th : p.n);
const catOf = id => ST.cats.find(c => c.id === id) || ST.incCats.find(c => c.id === id);
const cn = id => { const c = catOf(id); return c ? (L === 'th' ? c.th : c.en) : id; };
const person = n => (n === 'Mom' ? tl('Mom', 'แม่') : n);
function acct(a) {
  if (a === 'SCB') return 'SCB'; if (a === 'KPLUS') return 'K+'; if (a === 'DIME') return 'Dime';
  if (a === 'CASH') return tl('Cash', 'เงินสด'); if (a === 'CARD') return tl('Card', 'บัตร');
  if (C.isPot(a)) { const p = potOf(a.slice(4)); return p ? pn(p) : a; }
  if (C.isPerson(a)) return person(a.slice(7));
  return a;
}
const catIcon = { food: 'i-food', fuel: 'i-fuel', power: 'i-bolt', rent: 'i-home', car: 'i-route' };
const icon = e => e.type === 'income' ? 'i-plus' : e.type === 'transfer' ? 'i-split' : (catIcon[e.cat] || 'i-dot');
function label(e) {
  if (e.type === 'expense') return e.place || e.note || cn(e.cat);
  if (e.type === 'income') return `${cn(e.cat)}${e.note ? ' · ' + e.note : ''}`;
  if (e.to === 'CARD') return tl('Card bill payment', 'จ่ายบิลบัตร');
  if (C.isPerson(e.from)) return tl(`${person(e.from.slice(7))} paid you back`, `${person(e.from.slice(7))} คืนเงิน`);
  if (C.isPerson(e.to)) return tl(`Paid ${person(e.to.slice(7))}`, `โอนให้${person(e.to.slice(7))}`);
  return `${acct(e.from)} → ${acct(e.to)}`;
}
// signed effect on "your money" for list display
function shown(e) {
  if (e.type === 'expense') return { s: -C.myShare(e), cls: '' };
  if (e.type === 'income') return { s: e.amount, cls: 'pos' };
  if (C.isPerson(e.from)) return { s: e.amount, cls: 'pos' };
  return { s: e.amount, cls: 'move' };
}
const money = (e) => { const v = shown(e); return v.cls === 'move' ? `<span class="num mv">⇄ ${fm(v.s)}</span>` : `<span class="num ${v.cls}">${v.s > 0 ? '+' : '−'}${fm(Math.abs(v.s))}</span>`; };
const sorted = () => [...ST.entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

// ---------- commit with undo ----------
let undoStack = null;
function commit(entry, { editingId = null, quiet = false, msg } = {}) {
  if (editingId) {
    const i = ST.entries.findIndex(x => x.id === editingId); const old = ST.entries[i];
    ST.entries[i] = { ...entry, id: editingId }; undoStack = () => { ST.entries[i] = old; };
  } else {
    const e = { ...entry, id: ST.nextId++ }; ST.entries.push(e); undoStack = () => { ST.entries = ST.entries.filter(x => x.id !== e.id); };
  }
  persist(); if (!quiet) toast(msg || (editingId ? tl('Entry updated', 'แก้ไขแล้ว') : tl('Saved', 'บันทึกแล้ว')), true);
}
function removeEntry(id) {
  const i = ST.entries.findIndex(x => x.id === id); const old = ST.entries[i];
  // keep friends' repayment history coherent: block deleting a bill whose shares were already repaid past what remains
  ST.entries.splice(i, 1);
  undoStack = () => { ST.entries.splice(i, 0, old); };
  persist(); toast(tl('Entry deleted', 'ลบแล้ว'), true);
}
// try an entry; returns true when saved
function attempt(entry, opts = {}) {
  const v = C.validate(ST, entry, { editingId: opts.editingId || null });
  if (!v.ok) { toast(v.errors[0].msg); return false; }
  commit(entry, opts); return true;
}

// ---------- HOME ----------
function home() {
  const r = C.safeToSpend(ST, ST.today), cyc = r.cycle;
  $('sampleNote').hidden = !ST.sample;
  const needBackup = !ST.sample && ST.entries.length >= 10 && (!ST.lastBackup || C.daysBetween(ST.lastBackup, ST.today) > 30);
  $('backupNag').hidden = !needBackup;
  $('cycleLbl').textContent = `${tl('Cycle', 'รอบ')} ${dl(cyc.start)} – ${dly(cyc.end)}`;
  $('avail').textContent = fm(r.safe);
  $('avail').closest('.big').classList.toggle('neg', r.safe < 0);
  $('perDay').textContent = `฿${fm(Math.max(0, r.perDay))}`; $('perDayLbl').textContent = tl(`Per day, ${r.daysLeft} days left`, `ต่อวัน เหลือ ${r.daysLeft} วัน`);
  // runway: one cell per remaining day + payday
  const cells = []; for (let i = 0; i <= r.daysLeft; i++) cells.push(C.addDays(ST.today, i));
  $('days').style.gridTemplateColumns = `repeat(${cells.length},1fr)`;
  $('days').innerHTML = cells.map((d, i) => { const pay = i === r.daysLeft;
    return `<div class="day ${i === 0 ? 'today' : ''} ${pay ? 'pay' : ''}"><i style="--h:${pay ? 0 : 100}%"></i><span>${pay ? tl('Pay', 'เงินเข้า') : dow(d)}</span><span class="num">${+d.slice(8)}</span></div>`; }).join('');
  // card bill due
  const due = C.statements(ST, ST.today).filter(s => s.closed && s.remaining > 0);
  $('due').hidden = !due.length;
  if (due.length) {
    const s = due[0], over = s.status === 'overdue';
    $('due').classList.toggle('over', over);
    $('dueTxt').innerHTML = `${over ? tl('Card bill overdue since', 'บิลบัตรเลยกำหนดตั้งแต่') : tl('Card bill due', 'บิลบัตรครบกำหนด')} ${dl(s.due)} · <b class="num">฿${fm(s.remaining)}</b>`;
    $('dueSub').textContent = tl(`Statement closed ${dl(s.close)} · scan the QR and pay from SCB`, `สรุปยอด ${dl(s.close)} · สแกน QR จ่ายจาก SCB`);
    $('payBill').onclick = () => attempt({ type: 'transfer', date: ST.today, amount: s.remaining, from: 'SCB', to: 'CARD' }, { msg: tl('Card bill recorded as paid', 'บันทึกจ่ายบิลบัตรแล้ว') }) && home();
  }
  // breakdown
  const b = r.balances, row = (k, v, cls = '', sub = '') => `<div class="ln"><span class="k">${k}${sub ? `<small>${sub}</small>` : ''}</span><span class="num ${cls}">${v}</span></div>`;
  const nextSt = C.statements(ST, ST.today).find(s => !s.closed);
  $('calc').innerHTML =
    row('SCB', fm(b.SCB || 0)) + ((b.KPLUS || 0) ? row('K+', fm(b.KPLUS)) : '') + ((b.CASH || 0) ? row(tl('Cash', 'เงินสด'), fm(b.CASH)) : '') +
    (r.cardBilled ? row(tl('Card bill, closed', 'บิลบัตรที่สรุปยอดแล้ว'), '−' + fm(r.cardBilled), 'neg') : '') +
    (r.cardOpen ? row(tl('Card, not billed yet', 'บัตร ยังไม่สรุปยอด'), '−' + fm(r.cardOpen), 'neg', nextSt ? tl(`Closes ${dl(nextSt.close)}, due ${dl(nextSt.due)}`, `สรุปยอด ${dl(nextSt.close)} จ่าย ${dl(nextSt.due)}`) : '') : '') +
    (r.iOwe ? row(tl('You owe', 'ค้างจ่าย'), '−' + fm(r.iOwe), 'neg', Object.entries(r.people).filter(([, v]) => v < 0).map(([k, v]) => `${person(k)} ${fm0(-v)}`).join(' · ')) : '') +
    `<div class="ln sum"><span class="k">${tl('Safe to spend', 'ใช้ได้จริง')}</span><span class="num">${fm(r.safe)}</span></div>`;
  // people
  const ppl = Object.entries(r.people).filter(([, v]) => v !== 0).sort((a, z) => z[1] - a[1]);
  $('pplSec').hidden = !ppl.length;
  $('pplSum').textContent = r.owedToMe ? `+${fm(r.owedToMe)}` : '';
  $('ppl').innerHTML = ppl.map(([k, v]) => `<div class="prow"><div class="pl"><b>${esc(person(k))}</b><small>${v > 0 ? tl('owes you', 'ค้างคุณ') : tl('you owe', 'คุณค้าง')} <span class="num">฿${fm(Math.abs(v))}</span></small></div>
    <input class="field" type="number" inputmode="decimal" step="0.01" min="0.01" id="pp-${esc(k)}" value="${(Math.abs(v) / 100).toFixed(2)}" aria-label="${esc(person(k))}">
    <button class="act" data-p="${esc(k)}" data-dir="${v > 0 ? 'in' : 'out'}">${v > 0 ? tl('Received', 'ได้รับ') : tl('Paid', 'จ่ายแล้ว')}</button></div>`).join('');
  $('ppl').querySelectorAll('[data-p]').forEach(btn => btn.onclick = () => {
    const k = btn.dataset.p, amt = C.toSatang($('pp-' + k).value);
    const e = btn.dataset.dir === 'in' ? { type: 'transfer', date: ST.today, amount: amt, from: 'person:' + k, to: 'SCB' } : { type: 'transfer', date: ST.today, amount: amt, from: 'SCB', to: 'person:' + k };
    attempt(e, { msg: btn.dataset.dir === 'in' ? tl(`${person(k)} paid back ฿${fm(amt)}`, `${person(k)} คืน ฿${fm(amt)}`) : tl(`Paid ${person(k)} ฿${fm(amt)}`, `โอนให้${person(k)} ฿${fm(amt)}`) }) && home();
  });
  // recent
  $('recent').innerHTML = sorted().filter(e => e.date <= ST.today).slice(0, 5).map(rowHTML).join('');
  bindRows($('recent'));
  // pockets
  const pots = ST.pots.filter(p => !p.arch);
  $('potSum').textContent = '฿' + fm(pots.reduce((s, p) => s + (b['pot:' + p.id] || 0), 0));
  $('pots').innerHTML = pots.map(p => { const have = b['pot:' + p.id] || 0;
    return `<div class="pk"><span>${esc(pn(p))}</span><span class="num">${fm(have)}</span>${p.goal ? `<div class="meta"><div class="bar"><i style="width:${Math.max(0, Math.min(100, have / p.goal * 100))}%"></i></div><span class="num">${fm0(p.goal)}</span></div>` : ''}</div>`; }).join('');
  // close cycle preview
  $('closeSec').hidden = r.daysLeft > 3;
  $('closeTxt').textContent = r.safe > 0
    ? tl(`If nothing else changes, ฿${fm(r.safe)} is left when this cycle ends on ${dl(cyc.end)}.`, `ถ้าไม่มีอะไรเปลี่ยน จะเหลือ ฿${fm(r.safe)} ตอนจบรอบ ${dl(cyc.end)}`)
    : tl(`This cycle is over budget by ฿${fm(-r.safe)}. Cover it from Cash flow.`, `รอบนี้เกินงบ ฿${fm(-r.safe)} ดึงจาก Cash flow มาเติม`);
  $('closeBtn').textContent = r.safe > 0 ? tl('Move it to Cash flow', 'ย้ายเข้า Cash flow') : tl('Cover from Cash flow', 'ดึงจาก Cash flow');
  $('closeBtn').onclick = () => {
    const amt = Math.abs(r.safe); if (!amt) return;
    const e = r.safe > 0 ? { type: 'transfer', date: ST.today, amount: amt, from: 'SCB', to: 'pot:cashflow', note: 'cycle close' } : { type: 'transfer', date: ST.today, amount: amt, from: 'pot:cashflow', to: 'SCB', note: 'cycle close' };
    attempt(e) && home();
  };
  // reconcile
  const bank = $('realScb'); if (!bank.dataset.touched) bank.value = ((b.SCB || 0) / 100).toFixed(2);
  reconcile();
}
function reconcile() {
  const book = C.balances(ST, { asOf: ST.today }).SCB || 0, real = C.toSatang($('realScb').value);
  $('bookScb').textContent = fm(book);
  if (Number.isNaN(real)) { $('diff').textContent = '—'; $('diffNote').textContent = ''; $('adjBtn').hidden = true; return; }
  const diff = real - book, ok = diff === 0;
  $('diff').textContent = (diff > 0 ? '+' : '') + fm(diff); $('diff').className = 'num ' + (ok ? 'pos' : 'neg');
  $('diffNote').textContent = ok ? tl('Matches the bank.', 'ตรงกับธนาคารแล้ว') : tl(`Off by ฿${fm(Math.abs(diff))}. Look for a missed entry near that amount, or record the difference as an adjustment.`, `ต่างกัน ฿${fm(Math.abs(diff))} · ลองหารายการที่ลืมจด หรือบันทึกเป็นรายการปรับยอด`);
  $('adjBtn').hidden = ok;
  $('adjBtn').onclick = () => {
    const e = diff < 0 ? { type: 'expense', date: ST.today, amount: -diff, from: 'SCB', cat: 'other', note: tl('Bank adjustment', 'ปรับยอดธนาคาร') } : { type: 'income', date: ST.today, amount: diff, to: 'SCB', cat: 'other-in', note: tl('Bank adjustment', 'ปรับยอดธนาคาร') };
    attempt(e, { msg: tl('Adjustment recorded', 'บันทึกการปรับยอดแล้ว') }) && home();
  };
}
$('realScb').oninput = () => { $('realScb').dataset.touched = 1; reconcile(); };

// ---------- entry rows (shared by home and history) ----------
let openId = null;
function rowHTML(e) {
  const st = e.type === 'expense' && e.shares ? C.shareStatus(ST, e.id) : [], wait = st.some(s => s.left > 0);
  const tags = [e.type === 'expense' ? acct(e.from) : e.type === 'income' ? acct(e.to) : '', st.length ? st.map(s => s.p).join(', ') : ''].filter(Boolean);
  return `<div class="hwrap"><button class="crow" data-id="${e.id}" aria-expanded="${openId === e.id}"><span class="dt">${String(+e.date.slice(8)).padStart(2, '0')} ${MN()[+e.date.slice(5, 7) - 1]}</span>
    <span class="nm">${esc(label(e))} <em>${e.type === 'expense' ? '· ' + esc(cn(e.cat)) + ' ' : ''}${tags.length ? '· ' + esc(tags.join(' · ')) : ''}</em>${wait ? '<span class="dotw" title="waiting refund"></span>' : ''}</span>${money(e)}</button>
    ${openId === e.id ? detailHTML(e) : ''}</div>`;
}
function stmtPaidOn(close) {
  const st = C.statements(ST, null); let need = 0;
  for (const s of st) { need += s.total; if (s.close === close) break; }
  let cum = 0; for (const p of ST.entries.filter(x => x.type === 'transfer' && x.to === 'CARD').sort((a, b) => a.date.localeCompare(b.date))) { cum += p.amount; if (cum >= need) return p.date; }
  return null;
}
function detailHTML(e) {
  const ev = [], D = dl;
  if (e.type === 'expense') {
    ev.push({ at: e.date, ok: 1, k: tl('Paid', 'จ่าย'), v: `${D(e.date)} · ${acct(e.from)} ฿${fm(e.amount)}` });
    if (e.from === 'CARD') {
      const s = C.statementOf(e.date), closed = ST.today > s.close, paid = stmtPaidOn(s.close);
      ev.push({ at: s.close, ok: closed, wait: !closed, k: tl('Card bill', 'บิลบัตร'), v: `${tl('closes', 'สรุปยอด')} ${D(s.close)}` });
      ev.push(paid ? { at: paid, ok: 1, k: tl('Left SCB', 'เงินออกจาก SCB'), v: `${D(paid)} · ${tl('bill paid', 'จ่ายบิลแล้ว')}` } : { at: '9999', wait: 1, k: tl('Left SCB', 'เงินออกจาก SCB'), v: `${tl('due', 'กำหนด')} ${D(s.due)}` });
    }
    if (C.isPerson(e.from)) ev.push({ at: '9999', wait: 1, k: tl(`Owed to ${person(e.from.slice(7))}`, `ค้าง${person(e.from.slice(7))}`), v: tl('settled in the next transfer', 'จ่ายรวมในการโอนครั้งถัดไป') });
    for (const s of C.shareStatus(ST, e.id)) ev.push(s.left === 0 ? { at: s.paidOn, ok: 1, k: tl(`${s.p} paid back`, `${s.p} คืนแล้ว`), v: `${D(s.paidOn)} · ฿${fm(s.amount)}` }
      : { at: '9999', wait: 1, k: tl(`${s.p} still owes`, `${s.p} ยังค้าง`), v: `฿${fm(s.left)}${s.left < s.amount ? tl(` of ${fm(s.amount)}`, ` จาก ${fm(s.amount)}`) : ''}` });
  } else {
    ev.push({ at: e.date, ok: 1, k: e.type === 'income' ? tl('Received', 'ได้รับ') : tl('Moved', 'โอน'), v: `${D(e.date)} · ${e.type === 'income' ? acct(e.to) : acct(e.from) + ' → ' + acct(e.to)} ฿${fm(e.amount)}` });
  }
  ev.sort((a, b) => (!!a.wait - !!b.wait) || String(a.at).localeCompare(String(b.at)));
  const info = [];
  if (e.type === 'expense' && e.shares) info.push([tl('My share', 'ส่วนของฉัน'), `฿${fm(C.myShare(e))} ${tl('of', 'จาก')} ฿${fm(e.amount)}`]);
  if (e.type === 'expense') { const c = C.cycleOf(e.date); info.push([tl('Budget cycle', 'รอบงบ'), `${dl(c.start)} – ${dl(c.end)}`]); if (C.isPot(e.from)) info.push([tl('Budget', 'งบ'), tl('Not counted, paid from a pocket', 'ไม่นับ จ่ายจากกอง')]); }
  if (e.note && e.type === 'expense' && e.place) info.push([tl('Note', 'โน้ต'), esc(e.note)]);
  return `<ol class="tl">${ev.map(x => `<li class="${x.ok ? 'ok' : x.wait ? 'wait' : ''}"><span>${x.k}</span><b>${x.v}</b></li>`).join('')}</ol>
    <div class="tinfo">${info.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="racts"><button class="act" data-edit="${e.id}">${tl('Edit', 'แก้ไข')}</button><button class="act danger" data-del="${e.id}">${tl('Delete', 'ลบ')}</button></div>`;
}
function bindRows(root) {
  root.querySelectorAll('.crow').forEach(b => b.onclick = () => { const id = +b.dataset.id; openId = openId === id ? null : id; render(); });
  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => startEdit(+b.dataset.edit));
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (b.dataset.armed) { removeEntry(+b.dataset.del); openId = null; render(); return; }
    b.dataset.armed = 1; b.textContent = tl('Tap again to delete', 'แตะอีกครั้งเพื่อลบ');
  });
}

// ---------- ADD / EDIT ----------
const blankForm = () => ({ type: 'expense', amount: '', from: 'SCB', pot: '', cat: 'food', place: '', note: '', date: ST.today, split: [], custom: {}, to: 'SCB', incCat: 'salary', tFrom: 'KPLUS', tTo: 'SCB', editingId: null, confirmed: false });
let F = blankForm();
function startEdit(id) {
  const e = ST.entries.find(x => x.id === id); if (!e) return;
  F = { ...blankForm(), type: e.type, amount: (e.amount / 100).toFixed(2), date: e.date, note: e.note || '', editingId: id };
  if (e.type === 'expense') { Object.assign(F, { from: C.isPot(e.from) ? 'POT' : e.from, pot: C.isPot(e.from) ? e.from.slice(4) : '', cat: e.cat, place: e.place || '' });
    F.split = (e.shares || []).map(s => s.p); F.custom = Object.fromEntries((e.shares || []).map(s => [s.p, (s.amount / 100).toFixed(2)])); }
  if (e.type === 'income') Object.assign(F, { to: e.to, incCat: e.cat });
  if (e.type === 'transfer') Object.assign(F, { tFrom: e.from, tTo: e.to });
  go('add');
}
function sharesFor(total) {
  const n = F.split.length; if (!n || !(total > 0)) return [];
  const each = Math.floor(total / (n + 1));
  return F.split.map(p => ({ p, amount: F.custom[p] != null && F.custom[p] !== '' ? C.toSatang(F.custom[p]) : each }));
}
function buildEntry() {
  const amount = C.toSatang(F.amount);
  if (F.type === 'expense') {
    const from = F.from === 'POT' ? 'pot:' + F.pot : F.from;
    const e = { type: 'expense', date: F.date, amount, from, cat: F.cat };
    if (F.place.trim()) e.place = F.place.trim(); if (F.note.trim()) e.note = F.note.trim();
    const sh = sharesFor(amount); if (sh.length) e.shares = sh;
    return e;
  }
  if (F.type === 'income') return { type: 'income', date: F.date, amount, to: F.to, cat: F.incCat, ...(F.note.trim() ? { note: F.note.trim() } : {}) };
  return { type: 'transfer', date: F.date, amount, from: F.tFrom, to: F.tTo, ...(F.note.trim() ? { note: F.note.trim() } : {}) };
}
const ACCTS_SPEND = ['SCB', 'CARD', 'CASH', 'KPLUS', 'POT', 'person:Mom'];
const ACCTS_MOVE = () => ['KPLUS', 'SCB', 'CASH', 'DIME', ...ST.pots.filter(p => !p.arch).map(p => 'pot:' + p.id), 'CARD', 'person:Mom', ...ST.people.map(p => 'person:' + p)];
function seg(el, items, cur, onPick) {
  const cls = el.classList.contains('chips') ? ' class="chip"' : '';
  el.innerHTML = items.map(([k, l]) => `<button type="button"${cls} aria-pressed="${k === cur}" data-k="${esc(k)}">${l}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { onPick(b.dataset.k); F.confirmed = false; renderAdd(); });
}
function renderAdd() {
  $('addTitle').textContent = F.editingId ? tl('Edit entry', 'แก้ไขรายการ') : tl('New entry', 'จดรายการ');
  $('cancelEdit').hidden = !F.editingId;
  seg($('etype'), [['expense', tl('Spend', 'จ่าย')], ['income', tl('Income', 'รับ')], ['transfer', tl('Move', 'โอน')]], F.type, k => { F.type = k; });
  $('amt').value = F.amount; $('date').value = F.date; $('note').value = F.note;
  const isX = F.type === 'expense', isI = F.type === 'income', isT = F.type === 'transfer';
  $('gFrom').hidden = !isX; $('gCat').hidden = !isX; $('gPlace').hidden = !isX; $('gSplit').hidden = !isX; $('gPot').hidden = !(isX && F.from === 'POT');
  $('gTo').hidden = !isI; $('gInc').hidden = !isI; $('gMove').hidden = !isT;
  if (isX) {
    seg($('srcs'), ACCTS_SPEND.map(a => [a, a === 'POT' ? tl('Pocket', 'กอง') : a === 'person:Mom' ? tl('Mom, later', 'ค้างแม่') : acct(a)]), F.from, k => { F.from = k; if (k === 'POT' && !F.pot) F.pot = ST.pots.find(p => !p.arch).id; });
    const bal = C.balances(ST, { exclude: F.editingId });
    seg($('potChips'), ST.pots.filter(p => !p.arch).map(p => [p.id, `${esc(pn(p))} <span class="pill">${fm0(bal['pot:' + p.id] || 0)}</span>`]), F.pot, k => { F.pot = k; });
    seg($('cats'), ST.cats.filter(c => !c.arch || c.id === F.cat).map(c => [c.id, esc(L === 'th' ? c.th : c.en)]), F.cat, k => { F.cat = k; });
    $('place').value = F.place;
    const q = F.place.trim().toLowerCase(), hits = ST.places.filter(p => !q || p.n.toLowerCase().includes(q)).slice(0, 5);
    $('placeChips').innerHTML = hits.map((p, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="${p.n.toLowerCase() === q}">${esc(p.n)}<span class="pill">${esc(cn(p.c))} · ${esc(acct(p.s))}</span></button>`).join('');
    $('placeChips').querySelectorAll('button').forEach(b => b.onclick = () => { const p = hits[+b.dataset.i]; F.place = p.n; F.cat = p.c; F.from = p.s; renderAdd(); });
    $('people').innerHTML = ST.people.map(p => `<button type="button" class="chip" aria-pressed="${F.split.includes(p)}" data-p="${esc(p)}">${esc(p)}</button>`).join('');
    $('people').querySelectorAll('button').forEach(b => b.onclick = () => { const p = b.dataset.p; F.split = F.split.includes(p) ? F.split.filter(x => x !== p) : [...F.split, p]; delete F.custom[p]; F.confirmed = false; renderAdd(); });
    const total = C.toSatang(F.amount), sh = sharesFor(total);
    $('shares').hidden = !F.split.length;
    const mine = total > 0 ? total - sh.reduce((s, x) => s + (x.amount || 0), 0) : 0;
    $('shares').innerHTML = `<div class="ln"><span class="k">${tl('My share', 'ส่วนของฉัน')}<small>${tl('Counted as my spending', 'นับเป็นรายจ่ายของฉัน')}</small></span><b class="num ${mine < 0 ? 'neg' : ''}">${fm(mine)}</b></div>` +
      sh.map(s => `<div class="ln"><span class="k">${esc(s.p)}<small>${tl('Owes you', 'ต้องคืนคุณ')}</small></span><input class="field" type="number" inputmode="decimal" step="0.01" data-s="${esc(s.p)}" value="${Number.isNaN(s.amount) ? '' : (s.amount / 100).toFixed(2)}"></div>`).join('');
    $('shares').querySelectorAll('[data-s]').forEach(i => i.onchange = ev => { F.custom[i.dataset.s] = ev.target.value; F.confirmed = false; renderAdd(); });
  }
  if (isI) {
    seg($('incTo'), [['KPLUS', 'K+'], ['SCB', 'SCB'], ['CASH', tl('Cash', 'เงินสด')], ['person:Mom', tl('Mom owes me', 'แม่ค้างให้')]], F.to, k => { F.to = k; });
    seg($('incCats'), ST.incCats.map(c => [c.id, esc(L === 'th' ? c.th : c.en)]), F.incCat, k => { F.incCat = k; if (k === 'side') F.to = 'person:Mom'; });
    $('hoursRow').hidden = F.incCat !== 'side' || !ST.helpRate;
    $('hoursLbl').textContent = tl(`Hours × ฿${fm0(ST.helpRate)}`, `ชั่วโมง × ฿${fm0(ST.helpRate)}`);
    if (document.activeElement !== $('hours')) $('hours').value = F.hours || '';
  }
  if (isT) {
    const opts = ACCTS_MOVE().map(a => `<option value="${esc(a)}">${esc(acct(a))}${a === 'CARD' ? ' (' + tl('pay bill', 'จ่ายบิล') + ')' : ''}</option>`).join('');
    $('tFrom').innerHTML = opts.replace(/<option value="CARD">[^<]*<\/option>/, ''); $('tTo').innerHTML = opts;
    $('tFrom').value = F.tFrom; $('tTo').value = F.tTo;
  }
  // routing preview + validation
  const e = buildEntry(), v = Number.isFinite(e.amount) && e.amount > 0 ? C.validate(ST, e, { editingId: F.editingId }) : { ok: false, errors: [], warnings: [] };
  const rows = [], r = (k, val) => rows.push(`<div class="ln"><span class="k">${k}</span><b>${val}</b></div>`);
  if (isX && e.amount > 0) {
    const c = C.cycleOf(e.date); r(tl('Budget cycle', 'รอบงบ'), C.isPot(e.from) ? tl('Not counted (pocket)', 'ไม่นับ (จ่ายจากกอง)') : `${dl(c.start)} – ${dl(c.end)}`);
    if (e.from === 'CARD') { const s = C.statementOf(e.date); r(tl('Card bill', 'บิลบัตร'), `${tl('closes', 'สรุปยอด')} ${dly(s.close)}`); r(tl('Leaves SCB', 'เงินออกจาก SCB'), `${tl('by', 'ภายใน')} ${dly(s.due)}`); }
    else if (C.isPerson(e.from)) r(tl('Mom account', 'บัญชีกับแม่'), tl('You owe Mom; settle in one transfer', 'ค้างแม่ไว้ จ่ายรวมทีเดียว'));
    else r(tl('Leaves', 'เงินออกจาก'), `${acct(e.from)} · ${dl(e.date)}`);
    if (e.shares) r(tl('Friends owe you', 'เพื่อนต้องคืน'), '฿' + fm(C.sharesTotal(e)));
  }
  if (isT && e.amount > 0) r(tl('Moves', 'โอน'), `${acct(e.from)} → ${acct(e.to)}`);
  if (isI && e.amount > 0) r(tl('Goes to', 'เข้า'), acct(e.to));
  $('where').innerHTML = rows.length ? `<h3><svg class="i" style="width:16px;height:16px"><use href="#i-route"/></svg>${tl('Where this goes', 'รายการนี้ไปที่ไหน')}</h3>${rows.join('')}` : '';
  $('where').hidden = !rows.length;
  $('msgs').innerHTML = v.errors.map(x => `<div class="msg err">${esc(x.msg)}</div>`).join('') + v.warnings.map(x => `<div class="msg warn">${esc(x.msg)}</div>`).join('');
  $('save').disabled = !v.ok;
  $('save').textContent = v.ok && v.warnings.length && !F.confirmed ? tl('Check the warning, then tap to save', 'ตรวจคำเตือน แล้วแตะเพื่อบันทึก') : F.editingId ? tl('Save changes', 'บันทึกการแก้ไข') : tl('Save entry', 'บันทึก');
}
$('amt').oninput = ev => { F.amount = ev.target.value; F.confirmed = false; renderAdd(); $('amt').focus(); };
$('date').oninput = ev => { F.date = ev.target.value; F.confirmed = false; renderAdd(); };
$('note').oninput = ev => { F.note = ev.target.value; };
$('hours').oninput = ev => { F.hours = ev.target.value; const h = Number(F.hours); F.amount = h > 0 ? (Math.round(h * ST.helpRate) / 100).toFixed(2) : ''; F.confirmed = false; renderAdd(); };
$('place').oninput = ev => { F.place = ev.target.value; const p = ST.places.find(x => x.n.toLowerCase() === F.place.trim().toLowerCase()); if (p) { F.cat = p.c; F.from = p.s; } renderAdd(); $('place').focus(); };
$('tFrom').onchange = ev => { F.tFrom = ev.target.value; renderAdd(); };
$('tTo').onchange = ev => { F.tTo = ev.target.value; renderAdd(); };
$('cancelEdit').onclick = () => { F = blankForm(); go('hist'); };
$('save').onclick = () => {
  const e = buildEntry(), v = C.validate(ST, e, { editingId: F.editingId });
  if (!v.ok) { renderAdd(); return; }
  if (v.warnings.length && !F.confirmed) { F.confirmed = true; $('save').textContent = tl('Save anyway', 'บันทึกต่อ'); return; }
  if (e.type === 'expense' && e.place && !ST.places.some(p => p.n.toLowerCase() === e.place.toLowerCase()) && !C.isPot(e.from) && !C.isPerson(e.from)) ST.places.unshift({ n: e.place, c: e.cat, s: e.from });
  const wasEdit = F.editingId; commit(e, { editingId: F.editingId });
  F = blankForm(); go(wasEdit ? 'hist' : 'home');
};

// ---------- HISTORY ----------
let HF = 'all', HV = 'compact'; try { HV = localStorage.getItem('hv') || 'compact'; } catch (e) {}
const openMonths = new Set([ST.today.slice(0, 7)]);
function renderHist() {
  seg2($('hv'), [['detail', tl('Detailed', 'ละเอียด')], ['compact', tl('Compact', 'กระชับ')], ['month', tl('Months', 'รายเดือน')]], HV, k => { HV = k; try { localStorage.setItem('hv', k); } catch (e) {} renderHist(); });
  const friends = [...new Set(ST.entries.flatMap(e => (e.shares || []).map(s => s.p)))];
  const F2 = [['all', tl('All', 'ทั้งหมด')], ['CARD', tl('Card', 'บัตร')], ['SCB', 'SCB'], ['income', tl('Income', 'รายรับ')], ['transfer', tl('Moves', 'โอน')], ['waiting', tl('Waiting refund', 'รอคืน')], ['Mom', tl('Mom', 'แม่')], ...friends.map(p => ['p:' + p, p])];
  $('hf').innerHTML = F2.map(([k, l]) => `<button class="chip" aria-pressed="${HF === k}" data-k="${esc(k)}">${esc(l)}</button>`).join('');
  $('hf').querySelectorAll('button').forEach(b => b.onclick = () => { HF = b.dataset.k; renderHist(); });
  const q = $('hq').value.trim().toLowerCase();
  const rows = sorted().filter(e => {
    const sh = (e.shares || []).map(s => s.p);
    if (HF === 'CARD' && !(e.from === 'CARD' || e.to === 'CARD')) return false;
    if (HF === 'SCB' && !(e.from === 'SCB' || e.to === 'SCB')) return false;
    if (HF === 'income' && e.type !== 'income') return false;
    if (HF === 'transfer' && e.type !== 'transfer') return false;
    if (HF === 'waiting' && !(e.shares && C.shareStatus(ST, e.id).some(s => s.left > 0))) return false;
    if (HF === 'Mom' && !(e.from === 'person:Mom' || e.to === 'person:Mom')) return false;
    if (HF.startsWith('p:') && !(sh.includes(HF.slice(2)) || e.from === 'person:' + HF.slice(2) || e.to === 'person:' + HF.slice(2))) return false;
    if (q && ![label(e), e.note, cn(e.cat), ...sh, acct(e.from || ''), acct(e.to || '')].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
  const byM = {}; rows.forEach(e => (byM[e.date.slice(0, 7)] = byM[e.date.slice(0, 7)] || []).push(e));
  const keys = Object.keys(byM).sort().reverse();
  $('mjump').innerHTML = keys.map(k => `<button data-k="${k}">${MN()[+k.slice(5) - 1]} ${k.slice(2, 4)}</button>`).join('');
  $('mjump').querySelectorAll('button').forEach(b => b.onclick = () => { openMonths.add(b.dataset.k); if (HV === 'month') renderHist(); $('m-' + b.dataset.k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const spentOf = list => list.filter(e => e.type === 'expense').reduce((s, e) => s + C.myShare(e), 0);
  if (!rows.length) { $('hlist').innerHTML = `<p class="hint">${tl('No entries match.', 'ไม่มีรายการที่ตรง')}</p>`; return; }
  if (HV === 'detail') {
    const byD = {}; rows.forEach(e => (byD[e.date] = byD[e.date] || []).push(e));
    $('hlist').innerHTML = Object.keys(byD).map(d => `<div id="m-${d.slice(0, 7)}" style="scroll-margin-top:56px"><div class="day-h"><span>${dow(d)} ${dly(d)}</span><span class="num">−${fm(spentOf(byD[d]))}</span></div><div class="ledger detail">${byD[d].map(rowHTML).join('')}</div></div>`).join('');
  } else {
    $('hlist').innerHTML = keys.map(k => { const list = byM[k], open = HV === 'compact' || openMonths.has(k);
      return `<div class="ledger" style="padding:0 14px"><button class="mon" id="m-${k}" data-m="${k}" aria-expanded="${open}" style="scroll-margin-top:56px"><span><b>${MN()[+k.slice(5) - 1]} ${k.slice(0, 4)}</b><small>${list.length} ${tl('entries', 'รายการ')}</small></span><span><span class="num">−${fm(spentOf(list))}</span>${HV === 'month' ? '<span class="chev">›</span>' : ''}</span></button>${open ? list.map(rowHTML).join('') : ''}</div>`; }).join('');
    $('hlist').querySelectorAll('.mon').forEach(b => b.onclick = () => { if (HV !== 'month') return; const k = b.dataset.m; openMonths.has(k) ? openMonths.delete(k) : openMonths.add(k); renderHist(); });
  }
  bindRows($('hlist'));
}
function seg2(el, items, cur, onPick) {
  el.innerHTML = items.map(([k, l]) => `<button aria-pressed="${k === cur}" data-k="${k}">${l}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => onPick(b.dataset.k));
}
$('hq').oninput = renderHist;
$('seeAll').onclick = () => go('hist');

// ---------- SUMMARY ----------
let sumMode = 'm', sumCycle = C.cycleOf(ST.today).start;
function cyclesWithData() {
  const set = new Set(ST.entries.map(e => C.cycleOf(e.date).start)); set.add(C.cycleOf(ST.today).start);
  return [...set].filter(s => s <= ST.today).sort();
}
function renderSum() {
  seg2($('sumMode'), [['m', tl('Cycle', 'รายรอบ')], ['y', tl('Year', 'ทั้งปี')]], sumMode, k => { sumMode = k; renderSum(); });
  const cycles = cyclesWithData(), budget = ST.cats.filter(c => !c.arch).reduce((s, c) => s + c.b, 0);
  const vals = cycles.map(s => C.spending(ST, s, C.cycleOf(s).end).mine), max = Math.max(budget, ...vals, 1);
  $('chart').style.gridTemplateColumns = `repeat(${Math.max(cycles.length, 6)},1fr)`;
  $('chart').innerHTML = cycles.map((s, i) => { const end = C.cycleOf(s).end;
    return `<button aria-pressed="${sumMode === 'm' && s === sumCycle}" data-s="${s}" aria-label="${dl(end)} ${fm0(vals[i])}"><span class="cv num">${fm0(vals[i])}</span><i style="height:${Math.max(4, vals[i] / max * 110)}px;${vals[i] > budget ? 'background:var(--debit)' : ''}"></i>${MN()[+end.slice(5, 7) - 1]}</button>`; }).join('');
  $('chart').querySelectorAll('button').forEach(b => b.onclick = () => { sumCycle = b.dataset.s; sumMode = 'm'; renderSum(); });
  $('budgetLine').textContent = tl(`Budget ฿${fm0(budget)} per cycle`, `งบ ฿${fm0(budget)} ต่อรอบ`);
  let from, to, nCycles;
  if (sumMode === 'm') { from = sumCycle; to = C.cycleOf(sumCycle).end; nCycles = 1; $('sumSub').textContent = `${dl(from)} – ${dly(to)}`; }
  else { from = cycles[0]; to = ST.today; nCycles = cycles.length; $('sumSub').textContent = tl(`${nCycles} cycles · ${dly(from)} – ${dly(to)}`, `${nCycles} รอบ · ${dly(from)} – ${dly(to)}`); }
  const sp = C.spending(ST, from, to), bud = budget * nCycles;
  $('stats').innerHTML = `<div><span>${tl('Spent', 'ใช้ไป')}</span><b class="num">${fm0(sp.mine)}</b></div><div><span>${tl('Budget', 'งบ')}</span><b class="num">${fm0(bud)}</b></div>` +
    (sumMode === 'm' ? `<div><span>${tl('Left', 'เหลือ')}</span><b class="num ${bud - sp.mine < 0 ? 'neg' : 'pos'}">${fm0(bud - sp.mine)}</b></div>` : `<div><span>${tl('Income', 'รายรับ')}</span><b class="num">${fm0(sp.income)}</b></div>`);
  const cats = ST.cats.filter(c => sp.byCat[c.id] || (!c.arch && c.b));
  $('catList').innerHTML = cats.map(c => { const v = sp.byCat[c.id] || 0, b = c.b * nCycles, over = b > 0 && v > b;
    return `<div class="cat ${over ? 'over' : ''}"><span>${esc(L === 'th' ? c.th : c.en)}${c.arch ? ` <span class="pill">${tl('archived', 'เก็บแล้ว')}</span>` : ''}</span><span class="amt num">${fm0(v)} <span class="of">/ ${b ? fm0(b) : '—'}</span></span><span class="track"><i style="width:${b ? Math.min(100, v / b * 100) : (v ? 100 : 0)}%"></i></span></div>`; }).join('');
  const places = Object.entries(sp.byPlace).sort((a, b) => b[1].amount - a[1].amount), pmax = places[0] ? places[0][1].amount : 1;
  $('placeList2').innerHTML = places.map(([n, x]) => `<div class="cat"><span>${esc(n)}</span><span class="amt num">${fm0(x.amount)} <span class="of">· ${x.count}×</span></span><span class="track"><i style="width:${x.amount / pmax * 100}%"></i></span></div>`).join('') || `<p class="hint" style="padding:10px 0">${tl('No places recorded.', 'ยังไม่มีร้าน')}</p>`;
  $('potSpend').textContent = sp.pots ? tl(`Paid from pockets in this period: ฿${fm(sp.pots)} (not in the budget).`, `จ่ายจากกองในช่วงนี้ ฿${fm(sp.pots)} (ไม่นับในงบ)`) : '';
}

// ---------- SPLIT SALARY (each tick records a real transfer) ----------
const monthsLeft = (by, from) => { const [y, m] = by.split('-').map(Number), [fy, fmn] = from.split('-').map(Number); return Math.max(1, (y - fy) * 12 + (m - fmn) + 1); };
function monthly(p, have, from) { if (p.fixed) return p.fixed; if (p.goal && p.by) return Math.max(0, Math.ceil((p.goal - have) / monthsLeft(p.by, from) / 100) * 100); return 0; }
function renderPlan() {
  const pay = C.addDays(C.cycleOf(ST.today).end, 1), SAL = ST.salary, tag = k => `plan:${pay}:${k}`;
  const done = k => ST.entries.find(e => e.tag === tag(k) || (e.tag || '').startsWith(tag(k) + ':'));
  const bal = C.balances(ST);
  const list = ST.pots.filter(p => !p.arch).map(p => ({ p, amt: monthly(p, bal['pot:' + p.id] || 0, pay) })).filter(x => x.amt > 0);
  const toPots = list.reduce((s, x) => s + x.amt, 0);
  const bills = ST.momBills || [], billsTotal = bills.reduce((s, x) => s + x.amount, 0);
  const momPaid = done('mom-pay'), billsDone = done('mom-bills');
  const momNet = momPaid ? momPaid.amount : Math.max(0, -(bal['person:Mom'] || 0) + (billsDone ? 0 : billsTotal));
  const rest = SAL - toPots - momNet;
  $('planSub').textContent = tl(`Payday ${dly(pay)} · ฿${fm0(SAL)}`, `เงินเดือนเข้า ${dly(pay)} · ฿${fm0(SAL)}`);
  $('toMake').textContent = '฿' + fm0(toPots); $('toScb').textContent = '฿' + fm0(rest);
  $('splitBar').innerHTML = `<i style="flex:${toPots};background:var(--marigold)"></i><i style="flex:${Math.max(0, rest)};background:var(--credit)"></i>`;
  const steps = [{ k: 'salary', name: tl('Salary arrived in K+', 'เงินเดือนเข้า K+'), amt: SAL, entry: { type: 'income', date: pay, amount: SAL, to: 'KPLUS', cat: 'salary', tag: tag('salary') } },
    ...(bills.length ? [{ k: 'mom-bills', name: tl("This month's bills to Mom", 'ค่าใช้จ่ายเดือนนี้ที่ต้องให้แม่'), amt: billsTotal, info: true,
      sub: bills.map(b => `${cn(b.cat)} ${fm0(b.amount)}`).join(' · ') + tl(' · change amounts in Settings', ' · แก้ยอดได้ในตั้งค่า'),
      entries: bills.map((b, j) => ({ type: 'expense', date: pay, amount: b.amount, from: 'person:Mom', cat: b.cat, tag: tag('mom-bills') + ':' + j })) }] : []),
    ...(momNet > 0 || momPaid ? [{ k: 'mom-pay', name: tl('Pay Mom the net amount', 'โอนให้แม่ (ยอดสุทธิ)'), amt: momNet,
      sub: tl('Bills minus help income. Record this month\'s help hours first.', 'ค่าใช้จ่ายหักรายได้ช่วยแม่ · จดชั่วโมงช่วยแม่ก่อน'),
      entry: { type: 'transfer', date: pay, amount: momNet, from: 'KPLUS', to: 'person:Mom', tag: tag('mom-pay') } }] : []),
    ...list.map(({ p, amt }) => ({ k: p.id, name: pn(p), sub: p.fixed ? tl('Same every month', 'เท่าเดิมทุกเดือน') : tl(`Goal ${fm0(p.goal)} by ${MN()[+p.by.slice(5) - 1]} ${p.by.slice(0, 4)} · ${monthsLeft(p.by, pay)} mo left`, `เป้า ${fm0(p.goal)} ภายใน ${MN()[+p.by.slice(5) - 1]} ${p.by.slice(0, 4)} · เหลือ ${monthsLeft(p.by, pay)} เดือน`), amt, p,
      entry: { type: 'transfer', date: pay, amount: amt, from: 'KPLUS', to: 'pot:' + p.id, tag: tag(p.id) } })),
    { k: 'scb', name: tl('Rest to SCB for spending', 'ที่เหลือโอนไป SCB'), amt: rest, entry: { type: 'transfer', date: pay, amount: rest, from: 'KPLUS', to: 'SCB', tag: tag('scb') } }];
  $('alloc').innerHTML = steps.map((s, i) => `<div class="al ${done(s.k) ? 'done' : ''}"><input class="ck" type="checkbox" id="ck${i}" ${done(s.k) ? 'checked' : ''} aria-label="${esc(s.name)}">
    <span class="nm">${esc(s.name)}</span><span class="amt num">${fm0(s.amt)}</span>
    <span class="sub">${s.sub ? esc(s.sub) : ''}${s.p ? ` <input class="field" id="v${i}" type="number" value="${(s.p.fixed || s.p.goal) / 100}" aria-label="${esc(s.name)}">` : ''}</span><span></span></div>`).join('');
  steps.forEach((s, i) => {
    $('ck' + i).onchange = ev => {
      const ex = done(s.k);
      if (ev.target.checked && !ex) {
        for (const en of s.entries || [s.entry]) { const v = C.validate(ST, en); if (!v.ok) { ev.target.checked = false; toast(v.errors[0].msg); return; } }
        for (const en of s.entries || [s.entry]) commit(en, { quiet: true });
      }
      if (!ev.target.checked && ex) {
        if (s.k === 'mom-bills' && done('mom-pay')) { ev.target.checked = true; toast(tl('Untick "Pay Mom" first', 'ติ๊ก "โอนให้แม่" ออกก่อน')); return; }
        ST.entries = ST.entries.filter(e => !(e.tag === tag(s.k) || (e.tag || '').startsWith(tag(s.k) + ':'))); persist();
      }
      renderPlan();
    };
    if (s.p) $('v' + i).onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); renderPlan(); return; } s.p.fixed ? (s.p.fixed = v) : (s.p.goal = v); persist(); renderPlan(); };
  });
  $('doneCount').textContent = `${steps.filter(s => done(s.k)).length} / ${steps.length}`;
}

// ---------- SETTINGS ----------
const ACCENTS = [{ id: 'marigold', l: '#c9760a', d: '#f4a52a' }, { id: 'jade', l: '#1f8a64', d: '#4cc79a' }, { id: 'sky', l: '#2468c9', d: '#6aa6ff' }, { id: 'rose', l: '#c23a5c', d: '#ff7a9a' }, { id: 'violet', l: '#6d4bd1', d: '#a98bff' }, { id: 'graphite', l: '#3c4658', d: '#c9d1de' }];
let PREF = { accent: 'marigold', custom: null, theme: 'system' }; try { Object.assign(PREF, JSON.parse(localStorage.getItem('pref') || '{}')); } catch (e) {}
const savePref = () => { try { localStorage.setItem('pref', JSON.stringify(PREF)); } catch (e) {} };
const isDark = () => PREF.theme === 'dark' || (PREF.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
const inkFor = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#16110a' : '#ffffff'; };
function applyLook() {
  const root = document.documentElement;
  PREF.theme === 'system' ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', PREF.theme);
  const x = ACCENTS.find(a => a.id === PREF.accent) || ACCENTS[0], a = PREF.accent === 'custom' && PREF.custom ? PREF.custom : (isDark() ? x.d : x.l);
  root.style.setProperty('--marigold', a); root.style.setProperty('--marigold-ink', inkFor(a));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyLook);
function renderSet() {
  $('swatches').innerHTML = ACCENTS.map(x => `<button class="sw" style="--c:${isDark() ? x.d : x.l}" aria-pressed="${PREF.accent === x.id}" aria-label="${x.id}" data-a="${x.id}"></button>`).join('') +
    `<label class="sw custom" aria-pressed="${PREF.accent === 'custom'}" title="${tl('Custom', 'กำหนดเอง')}"><input type="color" id="customColor" value="${PREF.custom || '#c9760a'}" aria-label="${tl('Custom colour', 'สีกำหนดเอง')}"></label>`;
  $('swatches').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { PREF.accent = b.dataset.a; savePref(); applyLook(); renderSet(); });
  $('customColor').oninput = ev => { PREF.accent = 'custom'; PREF.custom = ev.target.value; savePref(); applyLook(); };
  seg2($('themeSeg'), [['system', tl('System', 'ตามเครื่อง')], ['light', tl('Light', 'สว่าง')], ['dark', tl('Dark', 'มืด')]], PREF.theme, k => { PREF.theme = k; savePref(); applyLook(); renderSet(); });
  // categories
  const used = id => ST.entries.filter(e => e.cat === id).length;
  $('catEd').innerHTML = ST.cats.map((c, i) => `<div class="ed ${c.arch ? 'arch' : ''}"><input class="name" id="cn${i}" value="${esc(L === 'th' ? c.th : c.en)}" ${c.arch ? 'disabled' : ''} aria-label="${tl('Category name', 'ชื่อหมวด')}">
    ${c.arch ? `<span class="hint" style="font-size:12px">${used(c.id)} ${tl('entries', 'รายการ')}</span>` : `<input class="field" id="cb${i}" type="number" min="0" value="${c.b / 100}" aria-label="${tl('Budget', 'งบ')}">`}
    <button class="act" id="ca${i}">${c.arch ? tl('Restore', 'คืน') : tl('Archive', 'เก็บ')}</button></div>`).join('') +
    `<div class="addrow"><input id="newCat" placeholder="${tl('New category', 'หมวดใหม่')}" aria-label="${tl('New category', 'หมวดใหม่')}"><button id="addCat">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.cats.forEach((c, i) => {
    const n = $('cn' + i); if (n) n.onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = L === 'th' ? c.th : c.en; return; }
      if (ST.cats.some(x => x !== c && (x.en === v || x.th === v))) { toast(tl('That name is already used', 'มีชื่อนี้แล้ว')); ev.target.value = L === 'th' ? c.th : c.en; return; }
      L === 'th' ? (c.th = v) : (c.en = v); persist(); toast(tl('Renamed. Past entries follow.', 'เปลี่ยนชื่อแล้ว รายการเก่าเปลี่ยนตาม')); };
    const b = $('cb' + i); if (b) b.onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v >= 0)) { toast(tl('Budget cannot be negative', 'งบติดลบไม่ได้')); ev.target.value = c.b / 100; return; } c.b = v; persist(); };
    $('ca' + i).onclick = () => { if (!c.arch && ST.cats.filter(x => !x.arch).length <= 1) { toast(tl('Keep at least one category', 'ต้องเหลืออย่างน้อยหนึ่งหมวด')); return; }
      c.arch = !c.arch; if (c.arch && F.cat === c.id) F.cat = ST.cats.find(x => !x.arch).id; persist(); toast(c.arch ? tl('Archived. History kept.', 'เก็บแล้ว ประวัติยังอยู่') : tl('Restored', 'คืนแล้ว')); renderSet(); };
  });
  $('addCat').onclick = () => { const v = $('newCat').value.trim(); if (!v) { $('newCat').focus(); return; }
    if (ST.cats.some(x => x.en === v || x.th === v)) { toast(tl('That name is already used', 'มีชื่อนี้แล้ว')); return; }
    ST.cats.push({ id: 'c' + Date.now(), en: v, th: v, b: 0 }); persist(); toast(tl('Category added', 'เพิ่มหมวดแล้ว')); renderSet(); };
  // pockets
  const bal = C.balances(ST);
  $('potEd').innerHTML = ST.pots.map((p, i) => `<div class="ed ${p.arch ? 'arch' : ''}" style="flex-wrap:wrap"><input class="name" id="pn${i}" value="${esc(pn(p))}" ${p.arch ? 'disabled' : ''} aria-label="${tl('Pocket name', 'ชื่อกอง')}">
    <span class="num" style="font-size:13px;color:var(--ink-2)">${fm(bal['pot:' + p.id] || 0)}</span><button class="act" id="pa${i}">${p.arch ? tl('Restore', 'คืน') : tl('Archive', 'เก็บ')}</button><span class="warn" id="pw${i}" hidden></span></div>`).join('') +
    `<div class="addrow"><input id="newPot" placeholder="${tl('New pocket', 'กองใหม่')}" aria-label="${tl('New pocket', 'กองใหม่')}"><button id="addPot">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.pots.forEach((p, i) => {
    const n = $('pn' + i); if (n) n.onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = pn(p); return; } p.n = p.th = v; persist(); toast(tl('Renamed. Rename it in MAKE too.', 'เปลี่ยนชื่อแล้ว อย่าลืมแก้ใน MAKE')); };
    $('pa' + i).onclick = () => { const have = bal['pot:' + p.id] || 0;
      if (!p.arch && have !== 0) { const w = $('pw' + i); w.textContent = tl(`Move the ฿${fm(have)} out first`, `ย้ายเงิน ฿${fm(have)} ออกก่อน`); w.hidden = false; return; }
      p.arch = !p.arch; persist(); renderSet(); };
  });
  $('addPot').onclick = () => { const v = $('newPot').value.trim(); if (!v) { $('newPot').focus(); return; }
    ST.pots.push({ id: 'p' + Date.now(), n: v, th: v, fixed: B(500) }); persist(); toast(tl('Pocket added. Create it in MAKE too.', 'เพิ่มกองแล้ว อย่าลืมสร้างใน MAKE')); renderSet(); };
  $('momEd').innerHTML = (ST.momBills || []).map((b, i) => `<div class="ed"><span style="flex:1">${esc(cn(b.cat))}</span><input class="field" id="mb${i}" type="number" min="0" step="0.01" value="${b.amount / 100}" aria-label="${esc(cn(b.cat))}"></div>`).join('') +
    `<div class="ed"><span style="flex:1">${tl('Help pay per hour', 'ค่าช่วยแม่ต่อชั่วโมง')}</span><input class="field" id="hrate" type="number" min="0" step="0.01" value="${ST.helpRate / 100}"></div>`;
  (ST.momBills || []).forEach((b, i) => $('mb' + i).onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); ev.target.value = b.amount / 100; return; } b.amount = v; persist(); toast(tl('Saved. Applies from the next payday.', 'บันทึกแล้ว มีผลรอบหน้า')); });
  $('hrate').onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { ev.target.value = ST.helpRate / 100; return; } ST.helpRate = v; persist(); };
  $('salaryIn').value = ST.salary / 100;
  $('salaryIn').onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { ev.target.value = ST.salary / 100; toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); return; } ST.salary = v; persist(); toast(tl('Salary saved', 'บันทึกเงินเดือนแล้ว')); };
  $('backupInfo').textContent = ST.lastBackup ? tl(`Last backup ${dly(ST.lastBackup)}`, `สำรองล่าสุด ${dly(ST.lastBackup)}`) : tl('No backup yet', 'ยังไม่เคยสำรอง');
  $('exportBtn').onclick = exportBackup;
  $('importFile').onchange = importBackup;
  $('eraseBtn').onclick = ev => { const b = ev.currentTarget;
    if (b.dataset.armed !== '2') { b.dataset.armed = String((+b.dataset.armed || 0) + 1); b.textContent = b.dataset.armed === '1' ? tl('This deletes every entry on this phone. Tap again', 'จะลบทุกรายการในเครื่องนี้ แตะอีกครั้ง') : tl('Last chance: tap to erase', 'แตะครั้งสุดท้ายเพื่อลบ'); return; }
    window.Store.erase().then(() => { SP = null; ST = emptyState(); ST.today = localToday(); F = blankForm(); go('setup'); }); };
}

// ---------- backup ----------
function exportBackup() {
  const copy = { ...ST }; delete copy.today;
  const blob = new Blob([JSON.stringify({ app: 'payday-runway', schema: SCHEMA, exportedAt: new Date().toISOString(), state: copy }, null, 1)], { type: 'application/json' });
  const name = `payday-runway-backup-${ST.today}.json`, file = new File([blob], name, { type: 'application/json' });
  const done = () => { ST.lastBackup = ST.today; persist(); render(); };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: name }).then(done).catch(err => { if (err && err.name !== 'AbortError') toast(tl('Sharing failed. Try again.', 'แชร์ไม่สำเร็จ ลองใหม่')); });
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); done();
  }
}
function importBackup(ev) {
  const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
  f.text().then(txt => {
    let data; try { data = JSON.parse(txt); } catch (e) { toast(tl('That file is not a backup from this app.', 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปนี้')); return; }
    const st = migrate(data && data.app === 'payday-runway' ? data.state : null);
    if (!st) { toast(tl('That file is not a backup from this app.', 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปนี้')); return; }
    if (data.schema > SCHEMA) { toast(tl('This backup is from a newer version. Update the app first.', 'ไฟล์นี้มาจากเวอร์ชันใหม่กว่า อัปเดตแอปก่อน')); return; }
    const bad = st.entries.find(e => !['expense', 'income', 'transfer'].includes(e.type) || !C.isDate(e.date) || !Number.isInteger(e.amount));
    if (bad) { toast(tl('The backup has a damaged entry. Nothing was changed.', 'ไฟล์สำรองมีรายการเสีย ไม่ได้เปลี่ยนอะไร')); return; }
    if (ev.target.id === 'importFile2') { ST = st; ST.today = localToday(); F = blankForm(); persist(); toast(tl('Backup restored', 'กู้คืนข้อมูลแล้ว')); go('home'); return; }
    $('importInfo').textContent = tl(`Backup from ${data.exportedAt.slice(0, 10)} with ${st.entries.length} entries. This replaces everything on this phone.`, `ไฟล์สำรองวันที่ ${data.exportedAt.slice(0, 10)} มี ${st.entries.length} รายการ จะแทนที่ข้อมูลทั้งหมดในเครื่องนี้`);
    $('importConfirm').hidden = false;
    $('importConfirm').onclick = () => { ST = st; ST.today = localToday(); F = blankForm(); persist(); $('importConfirm').hidden = true; $('importInfo').textContent = ''; toast(tl('Backup restored', 'กู้คืนข้อมูลแล้ว')); go('home'); };
  });
}

// ---------- first-run setup ----------
const lastClose = today => { const [y, m, d] = today.split('-').map(Number); return d > 17 ? `${y}-${String(m).padStart(2, '0')}-17` : C.addDays(`${y}-${String(m).padStart(2, '0')}-01`, -1).slice(0, 8) + '17'; };
let SP = null; // pockets being set up: [{id, name, bal, monthly}]
function readSetupPots() { document.querySelectorAll('[data-sp]').forEach(i => { SP[+i.dataset.i][i.dataset.sp] = i.value; }); }
function renderSetup() {
  if (!SP) SP = ST.pots.filter(p => !p.arch).map(p => ({ id: p.id, name: pn(p), bal: '', monthly: '' }));
  $('setupPots').innerHTML = SP.map((p, i) => `<div class="ln" style="gap:6px"><input class="note" style="flex:1;min-width:0;padding:7px 10px" data-sp="name" data-i="${i}" value="${esc(p.name)}" aria-label="${tl('Pocket name', 'ชื่อกอง')}" ${p.id === 'cashflow' ? 'readonly' : ''}>
    <input class="field" style="width:84px" type="number" inputmode="decimal" step="0.01" min="0" data-sp="bal" data-i="${i}" value="${esc(p.bal)}" placeholder="0" aria-label="${tl('Balance', 'ยอด')}">
    <input class="field" style="width:72px" type="number" inputmode="decimal" step="0.01" min="0" data-sp="monthly" data-i="${i}" value="${esc(p.monthly)}" placeholder="—" aria-label="${tl('Per month', 'ต่อเดือน')}"></div>`).join('');
  $('addSetupPot').onclick = () => { readSetupPots(); SP.push({ id: 'p' + Date.now(), name: '', bal: '', monthly: '' }); renderSetup(); document.querySelector(`[data-sp="name"][data-i="${SP.length - 1}"]`).focus(); };
  const lc = lastClose(ST.today), nc = C.statementOf(ST.today).close;
  $('billedLbl').textContent = tl(`Card bill closed ${dl(lc)}, not paid yet`, `บิลบัตรสรุปยอด ${dl(lc)} ที่ยังไม่จ่าย`);
  $('unbilledLbl').textContent = tl(`Card spending since then (bills ${dl(nc)})`, `ยอดรูดหลังจากนั้น (สรุปยอด ${dl(nc)})`);
  if (ST.salary && !$('setupSalary').value) $('setupSalary').value = ST.salary / 100;
}
$('startBtn') && ($('startBtn').onclick = () => {
  const num = id => { const v = $(id).value.trim(); return v === '' ? 0 : C.toSatang(v); };
  const vals = { SCB: num('setupScb'), KPLUS: num('setupKplus'), CASH: num('setupCash'), billed: num('setupBilled'), unbilled: num('setupUnbilled'), mom: num('setupMom'), salary: num('setupSalary') };
  readSetupPots();
  const sat = v => (String(v).trim() === '' ? 0 : C.toSatang(v));
  const pots = SP.map(p => ({ ...p, name: p.name.trim(), balS: sat(p.bal), monS: sat(p.monthly) })).filter(p => p.name || p.balS || p.monS);
  const bills = [['rent', num('setupRent')], ['net', num('setupNet')], ['car', num('setupCarBill')]], rate = num('setupRate');
  const all = [...Object.values(vals), ...pots.flatMap(p => [p.balS, p.monS]), ...bills.map(b => b[1]), rate];
  if (all.some(v => Number.isNaN(v) || v < 0)) { $('setupMsg').textContent = tl('Amounts must be numbers of 0 or more.', 'ยอดต้องเป็นตัวเลข 0 ขึ้นไป'); return; }
  if (!(vals.salary > 0)) { $('setupMsg').textContent = tl('Enter your monthly salary.', 'ใส่เงินเดือน'); return; }
  if (pots.some(p => !p.name)) { $('setupMsg').textContent = tl('Every pocket needs a name.', 'ทุกกองต้องมีชื่อ'); return; }
  if (new Set(pots.map(p => p.name.toLowerCase())).size !== pots.length) { $('setupMsg').textContent = tl('Two pockets have the same name.', 'มีกองชื่อซ้ำกัน'); return; }
  const people = [...new Set($('setupPeople').value.split(/[,،、\n]/).map(x => x.trim()).filter(Boolean))].filter(n => n.toLowerCase() !== 'mom');
  if (!pots.some(p => p.id === 'cashflow')) pots.unshift({ id: 'cashflow', name: 'Cash flow', balS: 0, monS: 0 });
  ST.pots = pots.map(p => ({ id: p.id, n: p.name, th: p.name, ...(p.monS ? { fixed: p.monS } : {}) }));
  ST.people = people;
  ST.momBills = bills.filter(b => b[1] > 0).map(([cat, amount]) => ({ cat, amount }));
  ST.helpRate = rate;
  const friends = [];
  const o = {}; ['SCB', 'KPLUS', 'CASH'].forEach(k => { if (vals[k]) o[k] = vals[k]; });
  pots.forEach(p => { if (p.balS) o['pot:' + p.id] = p.balS; });
  friends.forEach(([n, v]) => { if (v) o['person:' + n] = v; });
  if (vals.mom) o['person:Mom'] = -vals.mom;
  const os = {}; if (vals.billed) os[lastClose(ST.today)] = vals.billed; if (vals.unbilled) os[C.statementOf(ST.today).close] = (os[C.statementOf(ST.today).close] || 0) + vals.unbilled;
  if (vals.billed + vals.unbilled) o.CARD = vals.billed + vals.unbilled;
  Object.assign(ST, { opening: o, openingStatements: os, salary: vals.salary, setupDone: true, startDate: ST.today, sample: false });
  SP = null; persist(); toast(tl('All set. Record your first entry with +', 'พร้อมแล้ว กด + เพื่อจดรายการแรก')); go('home');
});
$('importFile2').onchange = importBackup;
$('sampleBtn') && ($('sampleBtn').onclick = () => window.__app.loadSample());

// ---------- chrome ----------
function applyText() {
  document.documentElement.lang = L;
  document.querySelectorAll('[data-en]').forEach(el => { el.textContent = L === 'th' ? el.dataset.th : el.dataset.en; });
  document.querySelectorAll('[data-ph-en]').forEach(el => { el.placeholder = L === 'th' ? el.dataset.phTh : el.dataset.phEn; });
  $('langLbl').textContent = L === 'en' ? 'ไทย' : 'EN';
}
let cur = 'home';
function render(s = cur) { cur = s; applyText(); ({ home, add: renderAdd, plan: renderPlan, sum: renderSum, set: renderSet, hist: renderHist, setup: renderSetup })[s](); }
function go(s) {
  ['home', 'sum', 'add', 'plan', 'set', 'hist', 'setup'].forEach(x => $('s-' + x).hidden = x !== s);
  document.querySelector('nav.bar').hidden = s === 'setup';
  document.querySelectorAll('nav.bar button').forEach(b => b.dataset.go === s ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (s !== 'add' && F.editingId) F = blankForm();
  render(s); scrollTo(0, 0);
}
document.querySelectorAll('nav.bar button').forEach(b => b.onclick = () => go(b.dataset.go));
$('histBack').onclick = () => go('home');
$('lang2').onclick = () => $('lang').onclick();
$('lang').onclick = () => { L = L === 'en' ? 'th' : 'en'; try { localStorage.setItem('lang', L); } catch (e) {} render(); };
let tt;
function toast(m, withUndo = false) {
  const el = $('toast'); el.innerHTML = `<span>${esc(m)}</span>${withUndo && undoStack ? `<button id="undoBtn">${tl('Undo', 'ย้อนกลับ')}</button>` : ''}`; el.hidden = false;
  if (withUndo && undoStack) $('undoBtn').onclick = () => { const u = undoStack; undoStack = null; u(); persist(); el.hidden = true; render(); };
  clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, withUndo ? 5000 : 2200);
}
applyLook();
if (!ST.setupDone) go('setup'); else go('home');
window.Store.persistStorage();
window.__app = { get ST() { return ST; }, go, F: () => F, setF: f => { F = { ...blankForm(), ...f }; }, renderAdd, C,
  loadSample() { ST = sampleState(); ST.today = '2026-11-23'; F = blankForm(); persist(); go('home'); } };
})();
