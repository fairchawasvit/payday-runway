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
const fmS = s => (s < 0 ? '−฿' : '฿') + fm(Math.abs(s)); // one minus style everywhere: −฿1,000.00
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
  ex('2026-10-29', 1200, 'person:Mom', 'rent', { bill: 'b0' }); ex('2026-10-29', 4900, 'person:Mom', 'car', { bill: 'b2' }); ex('2026-10-29', 500, 'person:Mom', 'net', { bill: 'b1' });
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
    ...defaultMoneySetup(), schema: SCHEMA, bills: [{ id: 'b0', n: '', cat: 'rent', amount: B(1200), from: 'SCB' }, { id: 'b1', n: '', cat: 'net', amount: B(500), from: 'SCB' }, { id: 'b2', n: '', cat: 'car', amount: B(4900), from: 'SCB' }], helpRate: B(150), cyclePlans: {}, cfFloor: 0, coverLater: null, sweptZero: [],
    places: [{ n: '7-Eleven', c: 'food', s: 'CARD' }, { n: 'Lotus', c: 'food', s: 'CARD' }, { n: 'Shell', c: 'fuel', s: 'CARD' }, { n: 'Café Amazon', c: 'food', s: 'SCB' }],
    entries: E,
  };
}
const SCHEMA = 3;
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// A fresh install carries no personal data: the owner types it in during setup.
function emptyState() {
  return {
    schema: SCHEMA, setupDone: false, nextId: 1, salary: 0, opening: {}, openingStatements: {},
    pots: [{ id: 'cashflow', n: 'Cash flow', th: 'Cash flow' }, { id: 'emerg', n: 'Emergency fund', th: 'เงินฉุกเฉิน' }],
    cats: [{ id: 'food', en: 'Food', th: 'กิน', b: 0 }, { id: 'fuel', en: 'Fuel', th: 'น้ำมัน', b: 0 }, { id: 'goods', en: 'Goods', th: 'ของใช้', b: 0 },
      { id: 'travel', en: 'Travel', th: 'เที่ยว', b: 0 }, { id: 'personal', en: 'Personal', th: 'ส่วนตัว', b: 0 },
      { id: 'haircut', en: 'Haircut', th: 'ตัดผม', b: 0 }, { id: 'laundry', en: 'Laundry', th: 'ซักผ้า', b: 0 },
      { id: 'splurge', en: 'Splurge', th: 'ฟุ่มเฟือย', b: 0 }, { id: 'other', en: 'Other', th: 'อื่นๆ', b: 0 }],
    incCats: [{ id: 'salary', en: 'Salary', th: 'เงินเดือน' }, { id: 'side', en: 'Helping Mom', th: 'ช่วยแม่' }, { id: 'other-in', en: 'Other income', th: 'รายรับอื่น' }],
    people: [], places: [], helpRate: 0, cyclePlans: {}, cfFloor: 0, coverLater: null, sweptZero: [],
    ...defaultMoneySetup(),
    entries: [], lastBackup: null,
  };
}
// accounts, cards and bills the owner can change; CARD/SCB/KPLUS/CASH keep their keys so old entries still point at them
function defaultMoneySetup() {
  return {
    accounts: [{ k: 'SCB', n: 'SCB' }, { k: 'KPLUS', n: 'K+' }, { k: 'CASH', n: '' }],
    cards: [{ k: 'CARD', n: '', from: 'SCB', sched: [{ since: '0000-01-01', close: 17, due: 2 }] }],
    salaryTo: 'KPLUS', spendTo: 'SCB', bills: [],
  };
}
function migrate(st) {
  if (!st || typeof st !== 'object' || !Array.isArray(st.entries)) return null;
  if (!st.schema) st.schema = 1;
  if (!Number.isInteger(st.helpRate)) st.helpRate = 0;
  if (!Number.isInteger(st.salary)) st.salary = 0;
  if (!Array.isArray(st.people)) st.people = [];
  if (st.schema < 2) {
    // v2: editable accounts and cards; the monthly items with Mom become ordinary monthly bills paid from SCB
    const d = defaultMoneySetup();
    for (const k of ['accounts', 'cards', 'salaryTo', 'spendTo']) if (st[k] == null) st[k] = d[k];
    if (!Array.isArray(st.bills)) st.bills = (st.momBills || []).map((b, i) => ({ id: 'b' + i, n: '', amount: b.amount, from: 'SCB', cat: b.cat }));
    delete st.momBills;
    st.schema = 2;
  }
  if (st.schema < 3) {
    // v3: cycle plans, cash-flow floor, cover-later and swept-zero marks; nothing else is rewritten
    if (!st.cyclePlans || typeof st.cyclePlans !== 'object') st.cyclePlans = {};
    if (!Number.isInteger(st.cfFloor)) st.cfFloor = 0;
    if (st.coverLater === undefined) st.coverLater = null;
    if (!Array.isArray(st.sweptZero)) st.sweptZero = [];
    st.schema = 3;
  }
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
const cyc = d => C.cycleOf(d, ST.payday);
const payDay = () => { const S = ST.payday && ST.payday.length ? ST.payday : [{ day: 28 }]; return S[S.length - 1]; };
const acctOf = k => (ST.accounts || []).find(x => x.k === k);
const cardCfg = k => (ST.cards || []).find(x => x.k === k);
const liveAccts = () => ST.accounts.filter(x => !x.arch).map(x => x.k);
const liveCards = () => ST.cards.filter(x => !x.arch).map(x => x.k);
const billName = b => b.n || cn(b.cat);
const cardFrom = k => (cardCfg(k) || {}).from || ST.spendTo;
// friends: names typed before plus anyone who appears in the data (never Mom: she is not split with)
const friendList = () => [...new Set([...ST.people, ...ST.entries.flatMap(e => (e.shares || []).map(s => s.p))])];
function acct(a) {
  const x = acctOf(a) || cardCfg(a); if (x && x.n) return x.n;
  if (a === 'SCB') return 'SCB'; if (a === 'KPLUS') return 'K+'; if (a === 'DIME') return 'Dime';
  if (a === 'CASH') return tl('Cash', 'เงินสด'); if (a === 'CARD') return tl('Card', 'บัตร');
  if (C.isCard(a)) return tl('Card', 'บัตร');
  if (C.isPot(a)) { const p = potOf(a.slice(4)); return p ? pn(p) : a; }
  if (C.isPerson(a)) return person(a.slice(7));
  return a;
}
const catIcon = { food: 'i-food', fuel: 'i-fuel', power: 'i-bolt', rent: 'i-home', car: 'i-route' };
const icon = e => e.type === 'income' ? 'i-plus' : e.type === 'transfer' ? 'i-split' : (catIcon[e.cat] || 'i-dot');
function label(e) {
  if (e.type === 'expense') return e.place || e.note || cn(e.cat);
  if (e.type === 'income') return `${cn(e.cat)}${e.note ? ' · ' + e.note : ''}`;
  if (C.isCard(e.to)) return tl(`${acct(e.to)} bill payment`, `จ่ายบิล${acct(e.to)}`);
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
// core messages are English; show them in the app language, with account names instead of keys
const nm = k => (/^(acct:|card:|pot:|person:)/.test(k) || ['SCB', 'KPLUS', 'CASH', 'DIME', 'CARD'].includes(k) ? acct(k) : k);
const MSG_TH = [
  [/^Unknown entry type$/, () => 'ประเภทรายการไม่ถูกต้อง'], [/^Enter a real date$/, () => 'ใส่วันที่ให้ถูกต้อง'],
  [/^Amount must be more than 0$/, () => 'ยอดต้องมากกว่า 0'], [/^Amount is larger than 1,000,000 baht/, () => 'ยอดเกิน 1,000,000 บาท ตรวจว่าใส่ 0 เกินหรือเปล่า'],
  [/^This date is in the future$/, () => 'วันที่นี้ยังมาไม่ถึง'], [/^Choose what you paid with$/, () => 'เลือกว่าจ่ายด้วยอะไร'],
  [/^Choose a category$/, () => 'เลือกหมวด'], [/^A friend share has no name$/, () => 'มีส่วนของเพื่อนที่ยังไม่มีชื่อ'],
  [/^(.+) is listed twice$/, (m, a) => `${a} ซ้ำกัน 2 ครั้ง`], [/^(.+)'s share must be more than 0$/, (m, a) => `ส่วนของ ${a} ต้องมากกว่า 0`],
  [/^(.+) cannot both pay and owe on one entry$/, (m, a) => `${a} เป็นคนจ่ายและคนค้างในรายการเดียวกันไม่ได้`],
  [/^Friends' shares \((.+)\) are more than the bill \((.+)\)$/, (m, a, b) => `ส่วนของเพื่อน (${a}) มากกว่ายอดบิล (${b})`],
  [/^Choose where the money went$/, () => 'เลือกว่าเงินเข้าที่ไหน'], [/^Choose where the money came from$/, () => 'เลือกว่าเงินออกจากที่ไหน'],
  [/^From and to are the same$/, () => 'ต้นทางกับปลายทางเป็นที่เดียวกัน'],
  [/^That is more than you owe on the card \((.+)\)$/, (m, a) => `มากกว่ายอดที่ค้างบัตรอยู่ (${a})`],
  [/^(.+) only owes you (.+)$/, (m, a, b) => `${a} ค้างคุณแค่ ${b}`],
  [/^You only owe (.+?) (\S+); the rest becomes money they owe you$/, (m, a, b) => `คุณค้าง ${a} แค่ ${b} ส่วนที่เกินจะกลายเป็นเงินที่เขาค้างคุณ`],
  [/^Not enough in this pocket\. It would be (.+) short\.$/, (m, a) => `เงินในกองไม่พอ ขาดอยู่ ${a}`],
  [/^(\S+) would go below zero by (.+)\. Did you forget to record income or a transfer\?$/, (m, a, b) => `${nm(a)} จะติดลบ ${b} บาท ลืมจดเงินเข้าหรือการโอนหรือเปล่า? ถ้ายอดในบัญชีจริงมีพอ อาจเป็นเพราะยอดตอนเริ่มใช้ไม่ตรง แก้ได้ที่ ตั้งค่า → ยอดตอนเริ่มใช้`],
];
const MSG_EN = [[/^(\S+) would go below zero by (.+)\. (.*)$/, (m, a, b, c) => `${nm(a)} would go below zero by ${b}. ${c}`]];
function tr(m) { for (const [re, f] of (L === 'th' ? MSG_TH : MSG_EN)) { const x = String(m).match(re); if (x) return f(...x); } return m; }
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
  if (!v.ok) { toast(tr(v.errors[0].msg)); return false; }
  commit(entry, opts); return true;
}

// ---------- HOME ----------
const cardOwed = k => C.statements(ST, ST.today, k).reduce((s, x) => s + x.remaining, 0);
function home() {
  const r = C.safeToSpend(ST, ST.today), cyc = r.cycle;
  $('sampleNote').hidden = !ST.sample;
  $('cycleLbl').textContent = `${tl('Cycle', 'รอบ')} ${dl(cyc.start)} – ${dly(cyc.end)}`;
  $('avail').textContent = fm(Math.abs(r.safe)); $('avail').previousElementSibling.textContent = r.safe < 0 ? '−฿' : '฿';
  $('avail').closest('.big').classList.toggle('neg', r.safe < 0);
  $('perDayLbl').textContent = r.daysLeft ? tl(`${r.daysLeft} days left in this cycle`, `อีก ${r.daysLeft} วันจบรอบ`) : tl('New cycle tomorrow', 'พรุ่งนี้เริ่มรอบใหม่');
  { const neg = liveAccts().filter(k => (r.balances[k] || 0) < 0);
    $('heroWhy').hidden = r.safe >= 0; $('why').hidden = r.safe < 0;
    if (r.safe < 0) {
      const parts = [r.cardBilled + r.cardOpen ? tl(`cards ฿${fm0(r.cardBilled + r.cardOpen)}`, `ค้างบัตร ฿${fm0(r.cardBilled + r.cardOpen)}`) : '', r.reserved ? tl(`bills set aside ฿${fm0(r.reserved)}`, `กันไว้จ่ายบิล ฿${fm0(r.reserved)}`) : '', r.iOwe ? tl(`you owe ฿${fm0(r.iOwe)}`, `ค้างคนอื่น ฿${fm0(r.iOwe)}`) : ''].filter(Boolean).join(' · ');
      $('heroWhy').innerHTML = neg.length
        ? `<span>${esc(tl(`${acct(neg[0])} is −฿${fm0(-r.balances[neg[0]])}, which cannot be right`, `${acct(neg[0])} ติดลบ ฿${fm0(-r.balances[neg[0]])} ซึ่งเป็นไปไม่ได้`) + (parts ? ' · ' + tl('also ', 'และหัก ') + parts : '') + tl(' · see To do', ' · ดูในต้องจัดการ'))}</span>`
        : `<span>${esc(tl(`Money in accounts ฿${fm0(r.liquid)} is less than ${parts}`, `เงินในบัญชี ฿${fm0(r.liquid)} น้อยกว่า ${parts}`))}</span>`;
    } }
  $('perDay').innerHTML = r.safe < 0 ? `<b style="color:#ff9b85">${r.safe + r.reserved >= 0 ? tl('Bills set aside are more than you have', 'บิลที่กันไว้มากกว่าเงินที่มี') : tl('Short this cycle', 'รอบนี้เงินไม่พอ')}</b>` : tl(`<span class="num">฿${fm0(Math.max(0, r.perDay))}</span> a day`, `วันละ <span class="num">฿${fm0(Math.max(0, r.perDay))}</span>`);
  // how far through the cycle we are
  const span = C.daysBetween(cyc.start, cyc.end) + 1, gone = C.daysBetween(cyc.start, ST.today) + 1;

  // breakdown (folded inside the card)
  const b = r.balances, allSt = C.cardList(ST).flatMap(k => C.statements(ST, ST.today, k));
  const row = (k, v, cls = '', sub = '') => `<div class="ln"><span class="k">${k}${sub ? `<small>${sub}</small>` : ''}</span><span class="num ${cls}">${v}</span></div>`;
  const openSt = allSt.filter(s => !s.closed && s.remaining > 0).sort((a, z) => a.close.localeCompare(z.close));
  const accts = [...new Set([ST.spendTo, ...liveAccts(), ...Object.keys(b).filter(C.isLiquid)])].filter(k => k === ST.spendTo || b[k]);
  const billsLeft = r.bills.filter(x => x.reserve > 0);
  $('calc').innerHTML =
    accts.map(k => row(esc(acct(k)), fm(b[k] || 0))).join('') +
    (r.cardBilled ? row(tl('Card bills, closed', 'บิลบัตรที่สรุปยอดแล้ว'), '−' + fm(r.cardBilled), 'neg') : '') +
    (r.cardOpen ? row(tl('Cards, not billed yet', 'บัตร ยังไม่สรุปยอด'), '−' + fm(r.cardOpen), 'neg', openSt.map(s => tl(`${esc(acct(s.card))} closes ${dl(s.close)}, due ${dl(s.due)}`, `${esc(acct(s.card))} สรุปยอด ${dl(s.close)} จ่าย ${dl(s.due)}`)).join(' · ')) : '') +
    (r.reserved ? row(tl('Set aside for monthly bills', 'กันไว้จ่ายรายจ่ายประจำ'), '−' + fm(r.reserved), 'neg', billsLeft.map(x => `${esc(billName(x))} ${fm0(x.reserve)}`).join(' · ')) : '') +
    (r.iOwe ? row(tl('You owe', 'ค้างจ่าย'), '−' + fm(r.iOwe), 'neg', Object.entries(r.people).filter(([, v]) => v < 0).map(([k, v]) => `${esc(person(k))} ${fm0(-v)}`).join(' · ')) : '') +
    `<div class="ln sum"><span class="k">${tl('Safe to spend', 'ใช้ได้จริง')}</span><span class="num">${fm(r.safe)}</span></div>`;

  // category bars from the cycle plan
  const cs = C.cycleStatus(ST, ST.today);
  homeCats(cs);
  endCard();

  // to do: everything that needs a tap, most urgent first
  const T = [];
  if (cs.belowFloor) T.push({ id: 'cfloor', cls: 'red', ico: 'i-route', t: tl(`Cash flow is below ฿${fm0(ST.cfFloor)}`, `Cash flow ต่ำกว่า ฿${fm0(ST.cfFloor)}`),
    sub: tl(`Now ฿${fm(cs.cashflow)}`, `ตอนนี้มี ฿${fm(cs.cashflow)}`), btn: tl('View', 'ดู'), fn: () => go('wallet') });
  Object.entries(cs.overStreak).filter(([, n]) => n >= 3).forEach(([id, n]) => T.push({ id: 'streak', cls: 'grey', ico: 'i-split',
    t: tl(`${cn(id)} went over budget ${n} cycles in a row`, `หมวด ${cn(id)} เกินงบ ${n} รอบติด`), sub: tl('Try changing its starting budget', 'ลองปรับค่าตั้งต้นไหม'), btn: tl('Open plan', 'เปิดแผน'), fn: () => go('plan') }));
  allSt.filter(s => s.closed && s.remaining > 0).sort((a, z) => a.due.localeCompare(z.due)).forEach(s => {
    const over = s.status === 'overdue', src = cardFrom(s.card), left = C.daysBetween(ST.today, s.due);
    T.push({ id: 'due', cls: over || left <= 3 ? 'red' : '', ico: 'i-card',
      t: over ? tl(`${acct(s.card)} bill is overdue`, `บิลบัตร ${acct(s.card)} เลยกำหนดแล้ว`) : tl(`${acct(s.card)} bill due ${dl(s.due)}`, `บิลบัตร ${acct(s.card)} ครบกำหนด ${dl(s.due)}`) + (over ? '' : tl(` (${left} days)`, ` (อีก ${left} วัน)`)),
      sub: tl(`฿${fm(s.remaining)} · pay from ${acct(src)}`, `฿${fm(s.remaining)} · จ่ายจาก ${acct(src)}`), btn: tl('Mark paid', 'จ่ายแล้ว'),
      fn: () => attempt({ type: 'transfer', date: ST.today, amount: s.remaining, from: src, to: s.card }, { msg: tl('Card bill recorded as paid', 'บันทึกจ่ายบิลบัตรแล้ว') }) && home() });
  });
  r.bills.filter(x => x.left > 0).forEach(x => T.push({ id: 'bill', ico: 'i-bolt',
    t: tl(`${billName(x)} not paid yet this cycle`, `${billName(x)} ยังไม่จ่ายรอบนี้`),
    sub: x.reserve ? tl(`฿${fm(x.left)} set aside`, `กันเงินไว้แล้ว ฿${fm(x.left)}`) : tl(`฿${fm(x.left)} from its pocket`, `฿${fm(x.left)} จ่ายจากกอง`), btn: tl('Record', 'จด'),
    fn: () => { F = { ...blankForm(), type: 'expense', bill: x.id, cat: x.cat, amount: (x.left / 100).toFixed(2), ...(C.isPot(x.from) ? { from: 'POT', pot: x.from.slice(4) } : { from: x.from }) }; go('add'); } }));
  liveAccts().filter(k => (b[k] || 0) < 0).forEach(k => T.unshift({ id: 'neg', cls: 'danger', ico: 'i-bell',
    t: tl(`${acct(k)} is −฿${fm(-b[k])}: the app no longer matches your bank`, `${acct(k)} ติดลบ −฿${fm(-b[k])} · ตัวเลขในแอปไม่ตรงกับธนาคาร`),
    sub: tl('A starting balance is off, or an income/transfer is missing', 'ยอดตอนเริ่มใช้ไม่ตรง หรือลืมจดเงินเข้า/การโอน'), btn: tl('Fix', 'แก้ยอด'),
    fn: () => { go('set'); openFold('Starting balances'); } }));
  const owe = Object.entries(r.people).filter(([, v]) => v > 0);
  if (owe.length > 1) T.push({ id: 'ppl', cls: 'green', ico: 'i-user', t: tl(`${owe.length} friends owe you ฿${fm(owe.reduce((t, [, v]) => t + v, 0))}`, `เพื่อนค้างคืน ${owe.length} คน รวม ฿${fm(owe.reduce((t, [, v]) => t + v, 0))}`),
    sub: owe.map(([k, v]) => `${person(k)} ${fm0(v)}`).join(' · '), btn: tl('View', 'ดู'), fn: () => go('wallet') });
  Object.entries(r.people).filter(([, v]) => v < 0 || (v > 0 && owe.length === 1)).sort((a, z) => z[1] - a[1]).forEach(([k, v]) => T.push({ id: 'ppl', cls: v > 0 ? 'green' : '', ico: 'i-user',
    t: v > 0 ? tl(`${person(k)} owes you ฿${fm(v)}`, `${person(k)} ค้างคืน ฿${fm(v)}`) : tl(`You owe ${person(k)} ฿${fm(-v)}`, `คุณค้าง${person(k)} ฿${fm(-v)}`),
    sub: tl('Got only part of it? Change it in Wallet', 'ได้ไม่ครบ? แก้ยอดได้ในกระเป๋า'), btn: v > 0 ? tl('Got it all', 'ได้คืนครบ') : tl('Paid', 'จ่ายแล้ว'),
    fn: () => attempt(v > 0 ? { type: 'transfer', date: ST.today, amount: v, from: 'person:' + k, to: ST.spendTo } : { type: 'transfer', date: ST.today, amount: -v, from: ST.spendTo, to: 'person:' + k },
      { msg: v > 0 ? tl(`${person(k)} paid back ฿${fm(v)}`, `${person(k)} คืน ฿${fm(v)}`) : tl(`Paid ${person(k)} ฿${fm(-v)}`, `โอนให้${person(k)} ฿${fm(-v)}`) }) && home() }));
  { const pay = planPay(), salDone = salaryIn(pay);
    if ((r.daysLeft <= 2 || pay <= ST.today) && !salDone) T.unshift({ id: 'plan', ico: 'i-split', t: pay <= ST.today ? tl(`Salary for the cycle from ${dl(pay)} in yet? Split it when it is`, `เงินเดือนรอบ ${dl(pay)} เข้าหรือยัง? เข้าแล้วกดแบ่งเงิน`) : tl(`New cycle ${dl(pay)}: split your salary when it arrives`, `รอบใหม่เริ่ม ${dl(pay)} · เงินเดือนเข้าแล้วกดแบ่งเงิน`),
      sub: tl(`฿${fm(ST.salary)} into ${acct(ST.salaryTo)}`, `฿${fm(ST.salary)} เข้า ${acct(ST.salaryTo)}`), btn: tl('Open', 'เปิด'), fn: () => go('plan') }); }
  if (!ST.sample && ST.entries.length >= 10 && (!ST.lastBackup || C.daysBetween(ST.lastBackup, ST.today) > 30))
    T.push({ id: 'backup', cls: 'grey', ico: 'i-bell', t: tl('Back up your data', 'ถึงเวลาสำรองข้อมูล'), sub: tl('It lives only on this phone', 'ข้อมูลอยู่ในเครื่องนี้เท่านั้น'), btn: tl('Back up', 'สำรอง'), fn: () => { go('set'); openFold('Backup'); } });
  T.sort((x, y) => (y.cls === 'danger') - (x.cls === 'danger')); // a balance that cannot be right always comes first
  $('todoN').textContent = T.length ? String(T.length) : '';
  const SHOW = TODO_ALL ? T.length : 2;
  $('todo').innerHTML = T.length ? T.map((x, i) => `<div class="todo ${x.cls || ''}" data-todo="${x.id}"${i >= SHOW ? ' hidden' : ''}><span class="ico"><svg class="i"><use href="#${x.ico}"/></svg></span><div class="txt"><span>${esc(x.t)}</span><small>${esc(x.sub)}</small></div><button data-i="${i}">${esc(x.btn)}</button></div>`).join('')
    + (T.length > SHOW ? `<button type="button" class="btn link" id="todoMore">${tl(`Show ${T.length - SHOW} more`, `ดูอีก ${T.length - SHOW} เรื่อง`)}</button>` : '')
    : `<p class="none">${tl('Nothing to do. All caught up.', 'ไม่มีอะไรค้าง เรียบร้อยดี')}</p>`;
  if ($('todoMore')) $('todoMore').onclick = () => { TODO_ALL = true; home(); };
  $('todo').querySelectorAll('button[data-i]').forEach(btn => btn.onclick = () => T[+btn.dataset.i].fn());

  // wallet strip
  const strip = [...liveAccts().map(k => [(b[k] || 0) < 0 ? 'negk' : '', acct(k), (b[k] < 0 ? '−' : '') + fm(Math.abs(b[k] || 0))]), ...liveCards().map(k => ['cardk', acct(k), (cardOwed(k) ? '−' : '') + fm(cardOwed(k))]),
    ...ST.pots.filter(p => !p.arch).map(p => ['', pn(p), fm(b['pot:' + p.id] || 0)])];
  $('strip').innerHTML = strip.map(([c, n, v]) => `<button class="${c}"><small>${esc(n)}</small><b class="num">${v}</b></button>`).join('');
  $('strip').querySelectorAll('button').forEach(x => x.onclick = () => { if (!$('strip').dataset.dragged) go('wallet'); });
  // recent
  $('recent').innerHTML = sorted().filter(e => e.date <= ST.today).slice(0, 5).map(rowHTML).join('');
  bindRows($('recent'));
}
// end-of-cycle card: last 2 days of a cycle, or the first 5 days of the next, until the leftover is moved (or dismissed when there is none)
function endCard() {
  const el = $('endCard'), cy = cyc(ST.today); el.hidden = true;
  let tgt = null;
  if (C.daysBetween(ST.today, cy.end) <= 1) tgt = { cycle: cy, asOf: ST.today };
  else if (C.daysBetween(cy.start, ST.today) <= 4) {
    const pv = cyc(C.addDays(cy.start, -1));
    if (ST.entries.some(e => e.date >= pv.start && e.date <= pv.end)) tgt = { cycle: pv, asOf: pv.end };
  }
  if (!tgt || !ST.setupDone) return;
  const start = tgt.cycle.start;
  if (ST.entries.some(e => e.tag === `sweep:${start}`) || (ST.sweptZero || []).includes(start)) return;
  const sw = C.sweep(ST, tgt.asOf), bal = C.balances(ST, { asOf: tgt.asOf })[sw.from] || 0, owed = Math.max(0, bal - sw.amount);
  const cats = C.cycleStatus(ST, tgt.asOf).cats.filter(c => (c.budget > 0 || c.spent > 0) && c.left !== 0);
  const when = tgt.asOf === ST.today ? tl('today', 'วันนี้') : dl(tgt.asOf);
  const sub = `${tl('Cycle', 'รอบ')} ${dl(tgt.cycle.start)} – ${dl(tgt.cycle.end)}`;
  if (!(sw.amount > 0)) {
    el.innerHTML = `<div class="lbl">${esc(sub)}</div><div class="amt" style="font-size:22px">${tl('Nothing left this cycle', 'รอบนี้ไม่มีเงินเหลือ')}</div>`
      + `<button type="button" class="btn quiet" id="endDismiss">${tl('Got it', 'รับทราบ')}</button>`;
    $('endDismiss').onclick = () => { ST.sweptZero = [...(ST.sweptZero || []), start]; persist(); home(); };
    el.hidden = false; return;
  }
  const gap = Math.abs(sw.gap) > 1000;
  el.innerHTML = `<div class="lbl">${tl('Left this cycle', 'รอบนี้เหลือ')} · ${esc(sub)}</div>`
    + `<div class="amt num"><small>฿</small>${fm(sw.amount)}</div>`
    + `<div class="arrow">${tl('Move it to Cash flow in one go', 'โอนเข้า Cash flow ทีเดียว')}</div>`
    + `<div><div class="eln"><span>${esc(acct(sw.from))}<small>${esc(when)}</small></span><span class="num">${fm(bal)}</span></div>`
    + (owed ? `<div class="eln"><span>${tl('Card owed', 'ค้างจ่ายบัตร')}<small>${tl('kept, not moved', 'กันไว้ ไม่โอน')}</small></span><span class="num">−${fm(owed)}</span></div>` : '') + `</div>`
    + (cats.length ? `<p class="from">${tl('From categories: ', 'มาจากหมวด: ')}${cats.map(c => `${esc(cn(c.id))} ${c.left < 0 ? '−' : '+'}${fm0(Math.abs(c.left))}`).join(' · ')}</p>` : '')
    + (gap ? `<div class="gapln"><span>${tl(`Differs from your records by ฿${fm0(Math.abs(sw.gap))}`, `ต่างจากที่จด ฿${fm0(Math.abs(sw.gap))}`)}</span><button type="button" id="endCheck">${tl('Check balance', 'เช็กยอด')}</button></div>` : '')
    + `<button type="button" class="btn" id="endGo">${tl(`Move ฿${fm(sw.amount)} · plan the new cycle`, `โอน ฿${fm(sw.amount)} · เริ่มแผนรอบใหม่`)}</button>`;
  if (gap) $('endCheck').onclick = () => { RA = sw.from; go('wallet'); setTimeout(() => $('realScb').scrollIntoView({ block: 'center' }), 0); };
  $('endGo').onclick = () => {
    attempt({ type: 'transfer', date: ST.today, amount: sw.amount, from: sw.from, to: 'pot:cashflow', note: 'cycle close', tag: `sweep:${start}` },
      { msg: tl(`Moved ฿${fm0(sw.amount)} to Cash flow`, `โอน ฿${fm0(sw.amount)} เข้า Cash flow แล้ว`) }) && go('plan'); };
  el.hidden = false;
}
// one bar per category: grey toward the budget, marigold when nearly used, hatched red past it
function homeCats(cs) {
  const rows = cs.cats.filter(c => c.budget > 0 || c.spent > 0);
  $('catSec').hidden = !rows.length;
  if (!rows.length) return;
  const days = C.daysBetween(ST.today, cs.cycle.end) + 1;
  $('catLeft').textContent = tl(`${cs.left < 0 ? "−" : ""}฿${fm0(Math.abs(cs.left))} left this cycle · ${days} days`, `รอบนี้เหลือ ${cs.left < 0 ? "−" : ""}฿${fm0(Math.abs(cs.left))} · อีก ${days} วัน`);
  const later = ST.coverLater && ST.coverLater.cycleStart === cs.cycle.start ? ST.coverLater.ids : [];
  const covered = id => ST.entries.reduce((s, e) => s + (e.tag === `cover:${cs.cycle.start}:${id}` ? e.amount : 0), 0);
  $('hcats').innerHTML = rows.map(c => {
    const over = c.spent - c.budget, ov = c.over, low = !ov && c.budget > 0 && c.left / c.budget < 0.15;
    const bar = ov ? `<div class="hbar over"><div class="tr" style="flex:${c.budget}"><i style="width:100%"></i></div><div class="ov" style="flex:${over}"></div><span class="tick" style="left:${(c.budget / c.spent * 100).toFixed(1)}%"></span></div>`
      : `<div class="hbar${low ? ' low' : ''}"><div class="tr"><i style="width:${(c.spent / c.budget * 100).toFixed(1)}%"></i></div></div>`;
    const head = ov ? `<span class="num" style="color:var(--debit);font-weight:600">${tl('Over', 'เกิน')} ฿${fm0(over)}</span>` : `<span><span class="num">${tl('Left', 'เหลือ')} ${fm0(c.left)}</span> <small>/ ${fm0(c.budget)}</small></span>`;
    let offer = '';
    if (ov) {
      const done = covered(c.id), need = over - done, amt = Math.min(need, cs.cashflow);
      if (need <= 0) offer = `<div class="cover done"><span>${tl(`Covered ฿${fm0(done)} from Cash flow`, `ดึงจาก Cash flow แล้ว ฿${fm0(done)}`)}</span></div>`;
      else if (amt > 0 && !later.includes(c.id)) offer = `<div class="cover"><span>${tl(`Cover ฿${fm0(amt)} from Cash flow?`, `ดึงจาก Cash flow ฿${fm0(amt)}?`)}</span><span class="acts"><button type="button" class="later" data-later="${esc(c.id)}">${tl('Later', 'ไว้ทีหลัง')}</button><button type="button" data-cover="${esc(c.id)}" data-amt="${amt}">${tl('Cover it', 'ดึงมาสมทบ')}</button></span></div>`;
    }
    return `<div class="hc"><button type="button" class="cbtn" data-cat="${esc(c.id)}"><span class="h"><span>${esc(cn(c.id))}</span>${head}</span>${bar}</button>${offer}</div>`;
  }).join('');
  $('hcats').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { HF = 'c:' + b.dataset.cat; go('hist'); });
  $('hcats').querySelectorAll('[data-later]').forEach(b => b.onclick = () => {
    ST.coverLater = { cycleStart: cs.cycle.start, ids: [...later, b.dataset.later] }; persist(); home(); });
  $('hcats').querySelectorAll('[data-cover]').forEach(b => b.onclick = () => {
    const id = b.dataset.cover, fresh = C.cycleStatus(ST, ST.today), f = fresh.cats.find(c => c.id === id);
    const done = ST.entries.reduce((s, e) => s + (e.tag === `cover:${fresh.cycle.start}:${id}` ? e.amount : 0), 0);
    const amt = f ? Math.min(Math.max(0, -f.left - done), fresh.cashflow) : 0;
    if (amt <= 0) { toast(tl('Nothing left to cover', 'ไม่มีส่วนที่ต้องสมทบแล้ว')); return home(); }
    attempt({ type: 'transfer', date: ST.today, amount: amt, from: 'pot:cashflow', to: ST.spendTo, note: 'cover ' + id, tag: `cover:${fresh.cycle.start}:${id}` },
      { msg: tl(`Covered ${cn(id)} from Cash flow`, `ดึง Cash flow มาสมทบ${cn(id)}แล้ว`) }) && home(); });
}
let TODO_ALL = false; // Home shows the two most urgent to-dos until asked for the rest
let RA = null; // account being checked against the bank app
function wallet() {
  const r = C.safeToSpend(ST, ST.today), b = r.balances;
  const accts = liveAccts();
  $('wAcctSum').textContent = fmS(accts.reduce((s, k) => s + (b[k] || 0), 0));
  const wr = (hf, ico, name, sub, val, cls = '') => `<button class="wrow" data-hf="${esc(hf)}"><span class="sico" style="margin:0"><svg class="i"><use href="#${ico}"/></svg></span><span class="k">${esc(name)}${sub ? `<small>${sub}</small>` : ''}</span><b class="num ${cls}">${val}</b><span class="chev">›</span></button>`;
  $('wAccts').innerHTML = accts.map(k => wr('a:' + k, k === 'CASH' ? 'i-wallet' : 'i-home', acct(k), [k === ST.salaryTo ? tl('salary in', 'เงินเดือนเข้า') : '', k === ST.spendTo ? tl('spending', 'ใช้จ่ายประจำ') : ''].filter(Boolean).join(' · '), fm(b[k] || 0))).join('');
  const cards = liveCards();
  $('wCardSec').hidden = !cards.length;
  const owedAll = cards.reduce((s, k) => s + cardOwed(k), 0); $('wCardSum').textContent = '฿' + fm(owedAll); $('wCardSum').classList.toggle('neg', owedAll > 0);
  $('wCards').innerHTML = cards.map(k => { const sts = C.statements(ST, ST.today, k), billed = sts.filter(s => s.closed && s.remaining > 0), open = sts.filter(s => !s.closed);
    const openAmt = open.reduce((t, s) => t + s.remaining, 0), nx = open[0] || C.cardStatementOf(ST, k, ST.today);
    // the same two numbers the bank's card app shows: the bill to pay, and what is not billed yet
    const sub = [...billed.map(s => tl(`Bill ฿${fm(s.remaining)} · pay by ${dl(s.due)}`, `บิล ฿${fm(s.remaining)} · จ่ายภายใน ${dl(s.due)}`)),
      tl(`Not billed ฿${fm(openAmt)} · closes ${dl(nx.close)}`, `ยังไม่ออกบิล ฿${fm(openAmt)} · สรุป ${dl(nx.close)}`)].join('<br>');
    return wr('cards', 'i-card', acct(k), sub, fm(cardOwed(k)), cardOwed(k) > 0 ? 'neg' : ''); }).join('');
  document.querySelectorAll('#s-wallet [data-hf]').forEach(x => x.onclick = () => { HF = x.dataset.hf; go('hist'); });
  // pockets
  const pots = ST.pots.filter(p => !p.arch);
  $('potSum').textContent = fmS(pots.reduce((s, p) => s + (b['pot:' + p.id] || 0), 0));
  $('pots').innerHTML = pots.map(p => { const have = b['pot:' + p.id] || 0;
    const x = C.potPlan(p, have, nextPay()), late = x.status === 'late';
    return `<div class="pk"><span>${esc(pn(p))}</span><span class="num">${fm(have)}</span>${p.goal ? `<div class="meta"><div class="bar"><i style="width:${Math.max(0, Math.min(100, have / p.goal * 100))}%"></i></div><span class="num">${fm0(p.goal)}</span></div>` : ''}${p.id === 'cashflow' ? '' : `<div class="meta" style="${late ? 'color:var(--debit)' : ''}">${esc(potLine(p, have, nextPay()))}</div>`}</div>`; }).join('');
  // people
  const ppl = Object.entries(r.people).filter(([, v]) => v !== 0).sort((a, z) => z[1] - a[1]);
  $('pplSec').hidden = !ppl.length;
  $('pplSum').textContent = r.owedToMe ? `+${fm(r.owedToMe)}` : '';
  $('ppl').innerHTML = ppl.map(([k, v]) => `<div class="prow"><div class="pl"><b>${esc(person(k))}</b><small>${v > 0 ? tl('owes you', 'ค้างคุณ') : tl('you owe', 'คุณค้าง')} <span class="num">฿${fm(Math.abs(v))}</span></small></div>
    <input class="field" type="number" inputmode="decimal" step="0.01" min="0.01" id="pp-${esc(k)}" value="${(Math.abs(v) / 100).toFixed(2)}" aria-label="${esc(person(k))}">
    <button class="act" data-p="${esc(k)}" data-dir="${v > 0 ? 'in' : 'out'}">${v > 0 ? tl('Received', 'ได้รับ') : tl('Paid', 'จ่ายแล้ว')}</button></div>`).join('');
  $('ppl').querySelectorAll('[data-p]').forEach(btn => btn.onclick = () => {
    const k = btn.dataset.p, amt = C.toSatang($('pp-' + k).value);
    const e = btn.dataset.dir === 'in' ? { type: 'transfer', date: ST.today, amount: amt, from: 'person:' + k, to: ST.spendTo } : { type: 'transfer', date: ST.today, amount: amt, from: ST.spendTo, to: 'person:' + k };
    attempt(e, { msg: btn.dataset.dir === 'in' ? tl(`${person(k)} paid back ฿${fm(amt)}`, `${person(k)} คืน ฿${fm(amt)}`) : tl(`Paid ${person(k)} ฿${fm(amt)}`, `โอนให้${person(k)} ฿${fm(amt)}`) }) && wallet();
  });
  // check against the bank app
  if (!RA || !accts.includes(RA)) RA = accts.includes(ST.spendTo) ? ST.spendTo : accts[0];
  $('recSel').innerHTML = opts(accts, RA);
  $('recSel').onchange = () => { RA = $('recSel').value; delete $('realScb').dataset.touched; wallet(); };
  $('realScb').setAttribute('aria-label', tl(`Balance in the ${acct(RA)} app`, `ยอดในแอป ${acct(RA)}`));
  const bank = $('realScb'); if (!bank.dataset.touched) bank.value = ((b[RA] || 0) / 100).toFixed(2);
  reconcile();
}
function reconcile() {
  const book = C.balances(ST, { asOf: ST.today })[RA] || 0, real = C.toSatang($('realScb').value);
  if (Number.isNaN(real)) { $('diff').textContent = '—'; $('diffNote').textContent = tl(`Type the balance from the ${acct(RA)} app`, `ใส่ยอดจากแอป ${acct(RA)}`); $('adjBtn').hidden = true; return; }
  const diff = real - book, ok = diff === 0;
  $('diff').textContent = ok ? tl('Match', 'ตรง') : (diff > 0 ? '+' : '−') + fm(Math.abs(diff)); $('diff').className = 'num ' + (ok ? 'pos' : 'neg');
  $('diffNote').textContent = ok ? tl('Matches what you recorded', 'ตรงกับที่จดไว้') : tl(`Recorded ${fmS(book)} · look for a missed entry`, `ที่จดไว้ ${fmS(book)} · ลองหารายการที่ลืมจด`);
  $('adjBtn').hidden = ok;
  $('adjBtn').onclick = () => {
    const e = diff < 0 ? { type: 'expense', date: ST.today, amount: -diff, from: RA, cat: 'other', note: tl('Bank adjustment', 'ปรับยอดธนาคาร') } : { type: 'income', date: ST.today, amount: diff, to: RA, cat: 'other-in', note: tl('Bank adjustment', 'ปรับยอดธนาคาร') };
    if (attempt(e, { msg: tl('Adjustment recorded', 'บันทึกการปรับยอดแล้ว') })) { delete $('realScb').dataset.touched; wallet(); }
  };
}
$('realScb').oninput = () => { $('realScb').dataset.touched = 1; reconcile(); };
document.querySelectorAll('[data-qa]').forEach(b => b.onclick = () => { const k = b.dataset.qa; if (k === 'plan') return go('plan'); F = { ...blankForm(), type: k }; go('add'); });
$('toWallet').onclick = () => go('wallet');
// let a mouse drag the wallet strip sideways (a finger already can)
{ const el = $('strip'); let x0 = null, s0 = 0;
  el.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') return; x0 = ev.clientX; s0 = el.scrollLeft; delete el.dataset.dragged; });
  addEventListener('pointermove', ev => { if (x0 === null) return; const dx = ev.clientX - x0; if (Math.abs(dx) > 4) el.dataset.dragged = 1; el.scrollLeft = s0 - dx; });
  addEventListener('pointerup', () => { x0 = null; setTimeout(() => delete el.dataset.dragged, 0); }); }
$('toPlan').onclick = () => go('plan');
document.querySelectorAll('[data-hs]').forEach(b => b.onclick = () => { const [scr, m] = b.dataset.hs.split(':'); if (m) { sumMode = m; if (m === 'm') sumCycle = cyc(ST.today).start; } go(scr); });
function markHs(s) { document.querySelectorAll('[data-hs]').forEach(b => b.setAttribute('aria-pressed', b.dataset.hs === (s === 'sum' ? 'sum:' + sumMode : s))); }
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => go('wallet'));
const SICO = { Accounts: 'i-wallet', 'Credit cards': 'i-card', 'Monthly must-pay bills': 'i-bolt', Salary: 'i-in', Pockets: 'i-pig', Categories: 'i-tag', 'Starting balances': 'i-edit', Appearance: 'i-sun', Backup: 'i-save', 'How to use': 'i-list' };
document.querySelectorAll('#s-set .fold > h2').forEach(h => {
  const t = h.querySelector('.h'), wrap = document.createElement('div'); wrap.className = 'stxt';
  h.insertBefore(wrap, t); wrap.append(t); const sub = document.createElement('small'); sub.className = 'ssub'; wrap.append(sub);
  const ic = document.createElement('span'); ic.className = 'sico'; ic.innerHTML = `<svg class="i"><use href="#${SICO[t.dataset.en] || 'i-dot'}"/></svg>`; h.prepend(ic);
  h.onclick = () => { if ($('s-set').classList.contains('sub')) return; openFold(t.dataset.en); };
});
function closeSub() { $('s-set').classList.remove('sub'); document.querySelectorAll('#s-set .fold.open').forEach(x => x.classList.remove('open')); $('setBack').hidden = true; }
$('setBack').onclick = () => { closeSub(); scrollTo(0, 0); };
function setSubs() {
  const n = (k, en, th) => tl(`${k} ${en}`, `${k} ${th}`);
  const sub = { Accounts: liveAccts().map(acct).join(' · '), 'Credit cards': liveCards().length ? liveCards().map(acct).join(' · ') : tl('None', 'ไม่มี'),
    'Monthly must-pay bills': n((ST.bills || []).length, 'bills', 'รายการ'), Salary: tl(`Cycle from day ${payDay().day} · `, `รอบเริ่มวันที่ ${payDay().day} · `) + `${acct(ST.salaryTo)} → ${acct(ST.spendTo)}`,
    Pockets: n(ST.pots.filter(p => !p.arch).length, 'pockets', 'กอง'), Categories: n(ST.cats.filter(c => !c.arch).length, 'categories', 'หมวด'),
    'Starting balances': tl('Fix a typo from day one', 'แก้เลขที่กรอกผิดตอนเริ่ม'), Appearance: { system: tl('Follows the phone', 'ตามเครื่อง'), light: tl('Light', 'สว่าง'), dark: tl('Dark', 'มืด') }[PREF.theme],
    'How to use': tl(`${window.HELP_ORDER.length} topics`, `${window.HELP_ORDER.length} หัวข้อ`),
    Backup: ST.lastBackup ? tl(`Last backup ${dly(ST.lastBackup)}`, `สำรองล่าสุด ${dly(ST.lastBackup)}`) : tl('No backup yet', 'ยังไม่เคยสำรอง') };
  document.querySelectorAll('#s-set .fold > h2').forEach(h => { h.querySelector('.ssub').textContent = sub[h.querySelector('.h').dataset.en] || ''; });
}
function openFold(en) { const h = [...document.querySelectorAll('#s-set .fold > h2 .h')].find(x => x.dataset.en === en); if (!h) return; closeSub(); h.closest('.fold').classList.add('open'); $('s-set').classList.add('sub'); $('setBack').hidden = false; scrollTo(0, 0); }

// ---------- entry rows (shared by home and history) ----------
let openId = null;
function rowHTML(e) {
  const st = e.type === 'expense' && e.shares ? C.shareStatus(ST, e.id) : [], wait = st.some(s => s.left > 0);
  const tags = [e.type === 'expense' ? acct(e.from) : e.type === 'income' ? acct(e.to) : '', st.length ? st.map(s => s.p).join(', ') : ''].filter(Boolean);
  return `<div class="hwrap"><button class="crow" data-id="${e.id}" aria-expanded="${openId === e.id}"><span class="dt">${String(+e.date.slice(8)).padStart(2, '0')} ${MN()[+e.date.slice(5, 7) - 1]}</span>
    <span class="nm">${esc(label(e))} <em>${e.type === 'expense' ? '· ' + esc(cn(e.cat)) + ' ' : ''}${tags.length ? '· ' + esc(tags.join(' · ')) : ''}</em>${wait ? '<span class="dotw" title="waiting refund"></span>' : ''}${e.pre ? `<span class="pill">${tl('not deducted', 'ไม่หักยอด')}</span>` : ''}</span>${e.pre ? money(e).replace('class="num ', 'class="num prev ') : money(e)}</button>
    ${openId === e.id ? detailHTML(e) : ''}</div>`;
}
// the payment that finished paying this statement (payments settle the oldest statement first)
function stmtPayment(card, close) {
  const st = C.statements(ST, null, card); let need = 0;
  for (const s of st) { need += s.total; if (s.close === close) break; }
  let cum = 0; for (const p of ST.entries.filter(x => x.type === 'transfer' && x.to === card).sort((a, b) => a.date.localeCompare(b.date))) { cum += p.amount; if (cum >= need) return p; }
  return null;
}
function detailHTML(e) {
  const ev = [], D = dl;
  if (e.type === 'expense') {
    ev.push({ at: e.date, ok: 1, k: tl('Paid', 'จ่าย'), v: `${D(e.date)} · ${esc(acct(e.from))} ฿${fm(e.amount)}` });
    if (C.isCard(e.from)) {
      const s = C.cardStatementOf(ST, e.from, e.date), closed = ST.today > s.close, p = stmtPayment(e.from, s.close);
      const src = acct(p ? p.from : cardFrom(e.from));
      ev.push({ at: s.close, ok: closed, wait: !closed, k: tl('Card bill', 'บิลบัตร'), v: `${tl('closes', 'สรุปยอด')} ${D(s.close)}` });
      ev.push(p ? { at: p.date, ok: 1, k: tl(`Left ${src}`, `เงินออกจาก ${src}`), v: `${D(p.date)} · ${tl('bill paid', 'จ่ายบิลแล้ว')}` } : { at: '9999', wait: 1, k: tl(`Left ${src}`, `เงินออกจาก ${src}`), v: `${tl('due', 'กำหนด')} ${D(s.due)}` });
    }
    if (e.bill) { const bl = (ST.bills || []).find(x => x.id === e.bill); if (bl) ev.push({ at: e.date, ok: 1, k: tl('Monthly bill', 'รายจ่ายประจำ'), v: esc(billName(bl)) }); }
    if (C.isPerson(e.from)) ev.push({ at: '9999', wait: 1, k: tl(`Owed to ${person(e.from.slice(7))}`, `ค้าง${person(e.from.slice(7))}`), v: tl('settled in the next transfer', 'จ่ายรวมในการโอนครั้งถัดไป') });
    for (const s of C.shareStatus(ST, e.id)) ev.push(s.left === 0 ? { at: s.paidOn, ok: 1, k: tl(`${s.p} paid back`, `${s.p} คืนแล้ว`), v: `${D(s.paidOn)} · ฿${fm(s.amount)}` }
      : { at: '9999', wait: 1, k: tl(`${s.p} still owes`, `${s.p} ยังค้าง`), v: `฿${fm(s.left)}${s.left < s.amount ? tl(` of ${fm(s.amount)}`, ` จาก ${fm(s.amount)}`) : ''}` });
  } else {
    ev.push({ at: e.date, ok: 1, k: e.type === 'income' ? tl('Received', 'ได้รับ') : tl('Moved', 'โอน'), v: `${D(e.date)} · ${e.type === 'income' ? acct(e.to) : acct(e.from) + ' → ' + acct(e.to)} ฿${fm(e.amount)}` });
  }
  ev.sort((a, b) => (!!a.wait - !!b.wait) || String(a.at).localeCompare(String(b.at)));
  const info = [];
  if (e.type === 'expense' && e.shares) info.push([tl('My share', 'ส่วนของฉัน'), `฿${fm(C.myShare(e))} ${tl('of', 'จาก')} ฿${fm(e.amount)}`]);
  if (e.type === 'expense') { const c = cyc(e.date); info.push([tl('Budget cycle', 'รอบงบ'), `${dl(c.start)} – ${dl(c.end)}`]); if (C.isPot(e.from)) info.push([tl('Budget', 'งบ'), tl('Not counted, paid from a pocket', 'ไม่นับ จ่ายจากกอง')]); }
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
const blankForm = () => ({ type: 'expense', amount: '', from: ST.spendTo, pot: '', cat: 'food', place: '', note: '', date: ST.today, split: [], custom: {}, to: ST.spendTo, incCat: 'salary', tFrom: ST.salaryTo, tTo: ST.spendTo, bill: '', editingId: null, confirmed: false });
let F = blankForm();
function startEdit(id) {
  const e = ST.entries.find(x => x.id === id); if (!e) return;
  F = { ...blankForm(), type: e.type, amount: (e.amount / 100).toFixed(2), date: e.date, note: e.note || '', editingId: id };
  if (e.type === 'expense') { Object.assign(F, { from: C.isPot(e.from) ? 'POT' : e.from, pot: C.isPot(e.from) ? e.from.slice(4) : '', cat: e.cat, place: e.place || '' });
    F.split = (e.shares || []).map(s => s.p); F.custom = Object.fromEntries((e.shares || []).map(s => [s.p, (s.amount / 100).toFixed(2)])); F.bill = e.bill || ''; }
    F.pre = !!e.pre;
  if (e.type === 'income') Object.assign(F, { to: e.to, incCat: e.cat });
  if (e.type === 'transfer') Object.assign(F, { tFrom: e.from, tTo: e.to });
  go('add');
}
function sharesFor(total) {
  const n = F.split.length; if (!n || !(total > 0)) return [];
  const each = Math.floor(total / (n + 1));
  return F.split.map(p => ({ p, amount: F.custom[p] != null && F.custom[p] !== '' ? C.toSatang(F.custom[p]) : each }));
}
// back-dated: before the start day it always is; on the start day the user says so
const isPre = () => !!ST.startDate && C.isDate(F.date) && (F.date < ST.startDate || (F.date === ST.startDate && F.pre));
function buildEntry() { const e = buildEntry0(); if (isPre()) e.pre = true; return e; }
function buildEntry0() {
  const amount = C.toSatang(F.amount);
  if (F.type === 'expense') {
    const from = F.from === 'POT' ? 'pot:' + F.pot : F.from;
    const e = { type: 'expense', date: F.date, amount, from, cat: F.cat };
    if (F.bill) e.bill = F.bill;
    const old = F.editingId && ST.entries.find(x => x.id === F.editingId); if (old && old.tag) e.tag = old.tag; // keep the payday link when editing
    if (F.place.trim()) e.place = F.place.trim(); if (F.note.trim()) e.note = F.note.trim();
    const sh = sharesFor(amount); if (sh.length) e.shares = sh;
    return e;
  }
  if (F.type === 'income') return { type: 'income', date: F.date, amount, to: F.to, cat: F.incCat, ...(F.note.trim() ? { note: F.note.trim() } : {}) };
  return { type: 'transfer', date: F.date, amount, from: F.tFrom, to: F.tTo, ...(F.note.trim() ? { note: F.note.trim() } : {}) };
}
// lists keep the value being edited even if that account was removed since, so an old entry stays editable
const withCur = (list, cur) => (cur && !list.includes(cur) ? [...list, cur] : list);
const ACCTS_SPEND = () => withCur([...liveAccts(), ...liveCards(), 'POT'], F.from);
const ACCTS_MOVE = () => {
  const b = C.balances(ST), people = Object.keys(b).filter(k => C.isPerson(k) && b[k]).concat(friendList().map(p => 'person:' + p));
  return [...new Set([...liveAccts(), ...(b.DIME ? ['DIME'] : []), ...ST.pots.filter(p => !p.arch).map(p => 'pot:' + p.id), ...liveCards(), ...people, F.tFrom, F.tTo])];
};
function seg(el, items, cur, onPick) {
  const cls = el.classList.contains('chips') ? ' class="chip"' : '';
  el.innerHTML = items.map(([k, l]) => `<button type="button"${cls} aria-pressed="${k === cur}" data-k="${esc(k)}">${l}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { onPick(b.dataset.k); F.confirmed = false; renderAdd(); });
}
function renderAdd() {
  $('addTitle').textContent = F.editingId ? tl('Edit entry', 'แก้ไขรายการ') : tl('New entry', 'จดรายการ');
  $('cancelEdit').hidden = !F.editingId;
  seg($('etype'), [['expense', tl('Spend', 'จ่าย')], ['income', tl('Income', 'รับ')], ['transfer', tl('Move', 'โอน')]], F.type, k => { F.type = k; });
  // a new spend starts on the keypad; editing, income, moves and "more details" use the full form
  const quick = F.type === 'expense' && !F.editingId && !F.full;
  $('quick').hidden = !quick; $('full').hidden = quick;
  $('toQuick').hidden = !(F.full && F.type === 'expense' && !F.editingId);
  if (quick) { renderQuick(); if (!F.dOpen) return; }
  $('amt').value = F.amount; $('date').value = F.date; $('note').value = F.note;
  const onStart = ST.startDate && F.date === ST.startDate, before = ST.startDate && C.isDate(F.date) && F.date < ST.startDate;
  $('preRow').hidden = !onStart; $('pre').checked = !!F.pre;
  $('preNote').hidden = !isPre();
  if (isPre()) $('preNote').textContent = tl(`Not deducted: before you started on ${dl(ST.startDate)}, so your starting balances already include it. It counts in this month's spending, bills paid and friends' debts, but no account or card balance changes.`,
    `ไม่หักยอด · ก่อนเริ่มใช้แอป (${dl(ST.startDate)}) ยอดในบัญชีที่กรอกตอนเริ่มหักไปแล้ว รายการนี้นับในสรุปรายจ่าย บิลที่จ่าย และเงินที่เพื่อนค้าง แต่ไม่หักเงินในบัญชีหรือบัตรซ้ำ`);
  const isX = F.type === 'expense', isI = F.type === 'income', isT = F.type === 'transfer';
  $('gFrom').hidden = !isX; $('gCat').hidden = !isX; $('gPlace').hidden = !isX; $('gSplit').hidden = !isX; $('gPot').hidden = !(isX && F.from === 'POT');
  $('gTo').hidden = !isI; $('gInc').hidden = !isI; $('gMove').hidden = !isT;
  const bills = C.billStatus(ST, F.date && C.isDate(F.date) ? F.date : ST.today);
  $('gBill').hidden = !isX || !bills.length;
  if (isX) {
    seg($('billChips'), bills.map(x => [x.id, `${esc(billName(x))} <span class="pill">${x.left ? fm0(x.left) : tl('paid', 'จ่ายแล้ว')}</span>`]), F.bill, k => {
      if (F.bill === k) { F.bill = ''; return; }
      const x = bills.find(y => y.id === k); F.bill = k; F.cat = x.cat;
      if (C.isPot(x.from)) { F.from = 'POT'; F.pot = x.from.slice(4); } else F.from = x.from;
      if (!F.amount && x.left) F.amount = (x.left / 100).toFixed(2);
    });
    seg($('srcs'), ACCTS_SPEND().map(a => [a, a === 'POT' ? tl('Pocket', 'กอง') : esc(acct(a))]), F.from, k => { F.from = k; if (k === 'POT' && !F.pot) F.pot = ST.pots.find(p => !p.arch).id; });
    const bal = C.balances(ST, { exclude: F.editingId });
    seg($('potChips'), ST.pots.filter(p => !p.arch).map(p => [p.id, `${esc(pn(p))} <span class="pill">${fm0(bal['pot:' + p.id] || 0)}</span>`]), F.pot, k => { F.pot = k; });
    const live = ST.cats.filter(c => !c.arch || c.id === F.cat), used = {};
    for (const x of ST.entries) if (x.type === 'expense') used[x.cat] = (used[x.cat] || 0) + 1;
    const top = [...live].sort((a, z) => (used[z.id] || 0) - (used[a.id] || 0) || live.indexOf(a) - live.indexOf(z)).slice(0, 5);
    if (!top.some(c => c.id === F.cat)) { const c = live.find(c => c.id === F.cat); if (c) top[4] = c; }
    const shown = F.allCats ? live : live.filter(c => top.includes(c)); // keep the user's own order
    seg($('cats'), [...shown.map(c => [c.id, esc(L === 'th' ? c.th : c.en)]), ...(live.length > 5 ? [['__more', F.allCats ? tl('Fewer', 'ย่อ') : tl(`More (${live.length - 5})`, `ดูหมวดเพิ่ม (${live.length - 5})`)]] : [])], F.cat, k => { if (k === '__more') F.allCats = !F.allCats; else F.cat = k; });
    const mb = $('cats').querySelector('[data-k="__more"]'); if (mb) { mb.classList.add('morec'); mb.setAttribute('aria-pressed', 'false'); }
    $('place').value = F.place;
    const q = F.place.trim().toLowerCase(), hits = ST.places.filter(p => !q || p.n.toLowerCase().includes(q)).slice(0, 5);
    $('placeChips').innerHTML = hits.map((p, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="${p.n.toLowerCase() === q}">${esc(p.n)}<span class="pill">${esc(cn(p.c))} · ${esc(acct(p.s))}</span></button>`).join('');
    $('placeChips').querySelectorAll('button').forEach(b => b.onclick = () => { const p = hits[+b.dataset.i]; F.place = p.n; F.cat = p.c; F.from = p.s; renderAdd(); });
    $('people').innerHTML = withCur(friendList(), null).concat(F.split.filter(p => !friendList().includes(p))).map(p => `<button type="button" class="chip" aria-pressed="${F.split.includes(p)}" data-p="${esc(p)}">${esc(p)}</button>`).join('');
    $('people').querySelectorAll('button').forEach(b => b.onclick = () => { const p = b.dataset.p; F.split = F.split.includes(p) ? F.split.filter(x => x !== p) : [...F.split, p]; delete F.custom[p]; F.confirmed = false; renderAdd(); });
    const total = C.toSatang(F.amount), sh = sharesFor(total);
    $('shares').hidden = !F.split.length;
    const mine = total > 0 ? total - sh.reduce((s, x) => s + (x.amount || 0), 0) : 0;
    $('shares').innerHTML = `<div class="ln"><span class="k">${tl('My share', 'ส่วนของฉัน')}<small>${tl('Counted as my spending', 'นับเป็นรายจ่ายของฉัน')}</small></span><b class="num ${mine < 0 ? 'neg' : ''}">${fm(mine)}</b></div>` +
      sh.map(s => `<div class="ln"><span class="k">${esc(s.p)}<small>${tl('Owes you', 'ต้องคืนคุณ')}</small></span><input class="field" type="number" inputmode="decimal" step="0.01" data-s="${esc(s.p)}" value="${Number.isNaN(s.amount) ? '' : (s.amount / 100).toFixed(2)}"></div>`).join('');
    $('shares').querySelectorAll('[data-s]').forEach(i => i.onchange = ev => { F.custom[i.dataset.s] = ev.target.value; F.confirmed = false; renderAdd(); });
  }
  if (isI) {
    seg($('incTo'), withCur(liveAccts(), F.to).map(a => [a, esc(acct(a))]), F.to, k => { F.to = k; });
    seg($('incCats'), ST.incCats.map(c => [c.id, esc(L === 'th' ? c.th : c.en)]), F.incCat, k => { F.incCat = k; });
    $('hoursRow').hidden = F.incCat !== 'side' || !ST.helpRate;
    $('hoursLbl').textContent = tl(`Hours × ฿${fm0(ST.helpRate)}`, `ชั่วโมง × ฿${fm0(ST.helpRate)}`);
    if (document.activeElement !== $('hours')) $('hours').value = F.hours || '';
  }
  if (isT) {
    const opt = a => `<option value="${esc(a)}">${esc(acct(a))}${C.isCard(a) ? ' (' + tl('pay bill', 'จ่ายบิล') + ')' : ''}</option>`;
    $('tFrom').innerHTML = ACCTS_MOVE().filter(a => !C.isCard(a)).map(opt).join(''); $('tTo').innerHTML = ACCTS_MOVE().map(opt).join('');
    $('tFrom').value = F.tFrom; $('tTo').value = F.tTo;
  }
  // routing preview + validation
  const e = buildEntry(), v = Number.isFinite(e.amount) && e.amount > 0 ? C.validate(ST, e, { editingId: F.editingId }) : { ok: false, errors: [], warnings: [] };
  const rows = [], r = (k, val) => rows.push(`<div class="ln"><span class="k">${k}</span><b>${val}</b></div>`);
  if (isX && e.amount > 0) {
    const c = cyc(e.date); r(tl('Budget cycle', 'รอบงบ'), C.isPot(e.from) ? tl('Not counted (pocket)', 'ไม่นับ (จ่ายจากกอง)') : `${dl(c.start)} – ${dl(c.end)}`);
    if (e.pre) {}
    else if (C.isCard(e.from)) { const s = C.cardStatementOf(ST, e.from, e.date), src = esc(acct(cardFrom(e.from)));
      r(tl('Card bill', 'บิลบัตร'), `${tl('closes', 'สรุปยอด')} ${dly(s.close)}`); r(tl(`Leaves ${src}`, `เงินออกจาก ${src}`), `${tl('by', 'ภายใน')} ${dly(s.due)}`); }
    else if (C.isPerson(e.from)) r(tl('Owed', 'ค้างจ่าย'), esc(person(e.from.slice(7))));
    else r(tl('Leaves', 'เงินออกจาก'), `${esc(acct(e.from))} · ${dl(e.date)}`);
    if (e.bill) { const x = bills.find(y => y.id === e.bill); if (x) r(tl('Monthly bill', 'รายจ่ายประจำ'), tl(`${esc(billName(x))} · no longer set aside`, `${esc(billName(x))} · เลิกกันเงินส่วนนี้`)); }
    if (e.shares) r(tl('Friends owe you', 'เพื่อนต้องคืน'), '฿' + fm(C.sharesTotal(e)));
  }
  if (e.pre && e.amount > 0) r(tl('Balances', 'ยอดในบัญชี/บัตร'), tl('unchanged (not deducted)', 'ไม่เปลี่ยน (ไม่หักยอด)'));
  if (isT && e.amount > 0) r(tl('Moves', 'โอน'), `${esc(acct(e.from))} → ${esc(acct(e.to))}`);
  if (isI && e.amount > 0) r(tl('Goes to', 'เข้า'), esc(acct(e.to)));
  $('where').innerHTML = rows.length ? `<h3><svg class="i" style="width:16px;height:16px"><use href="#i-route"/></svg>${tl('Where this goes', 'รายการนี้ไปที่ไหน')}</h3>${rows.join('')}` : '';
  $('where').hidden = !rows.length;
  // what Safe to spend becomes once this is saved
  if (v.ok && e.amount > 0) { const st = { ...ST, entries: [...ST.entries.filter(x => x.id !== F.editingId), { ...e, id: -1 }] };
    const now = C.safeToSpend(ST, ST.today).safe, then = C.safeToSpend(st, ST.today).safe;
    $('afterLbl').innerHTML = then === now ? tl('Safe to spend stays the same', 'ยอดใช้ได้จริงไม่เปลี่ยน') : `${tl('Safe to spend after this', 'หลังจดแล้วใช้ได้จริง')} <b class="num ${then < 0 ? 'neg' : ''}">${then < 0 ? '−' : ''}฿${fm(Math.abs(then))}</b>`;
  } else $('afterLbl').textContent = '';
  const mo = $('moreBox'); if (!mo.dataset.bound) { mo.dataset.bound = 1; mo.ontoggle = () => { F.more = mo.open; }; }
  mo.hidden = !isX && !isI && !isT; mo.open = !!(F.more || F.place.trim() || F.note.trim() || F.split.length);
  $('msgs').innerHTML = v.errors.map(x => `<div class="msg err">${esc(tr(x.msg))}</div>`).join('') + v.warnings.map(x => `<div class="msg warn">${esc(tr(x.msg))}</div>`).join('');
  $('save').disabled = !v.ok;
  $('save').textContent = v.ok && v.warnings.length && !F.confirmed ? tl('Check the warning, then tap to save', 'ตรวจคำเตือน แล้วแตะเพื่อบันทึก') : F.editingId ? tl('Save changes', 'บันทึกการแก้ไข') : tl('Save entry', 'บันทึก');
}
$('amt').oninput = ev => { F.amount = ev.target.value; F.confirmed = false; renderAdd(); $('amt').focus(); };
$('pre').onchange = ev => { F.pre = ev.target.checked; F.confirmed = false; renderAdd(); };
$('date').oninput = ev => { F.date = ev.target.value; F.confirmed = false; renderAdd(); };
$('note').oninput = ev => { F.note = ev.target.value; };
$('hours').oninput = ev => { F.hours = ev.target.value; const h = Number(F.hours); F.amount = h > 0 ? (Math.round(h * ST.helpRate) / 100).toFixed(2) : ''; F.confirmed = false; renderAdd(); };
$('place').oninput = ev => { F.place = ev.target.value; const p = ST.places.find(x => x.n.toLowerCase() === F.place.trim().toLowerCase()); if (p) { F.cat = p.c; F.from = p.s; } renderAdd(); $('place').focus(); };
$('addFriend').onclick = () => {
  const v = $('newFriend').value.trim(); if (!v) { $('newFriend').focus(); return; }
  if (!friendList().includes(v)) { ST.people.push(v); persist(); }
  if (!F.split.includes(v)) F.split.push(v);
  $('newFriend').value = ''; F.confirmed = false; renderAdd();
};
$('tFrom').onchange = ev => { F.tFrom = ev.target.value; renderAdd(); };
$('tTo').onchange = ev => { F.tTo = ev.target.value; renderAdd(); };

// ---------- keypad quick entry ----------
const CAT_ICO = { food: 'i-food', fuel: 'i-fuel', power: 'i-bolt', rent: 'i-home', car: 'i-route' };
const fmAmt = v => { if (!v) return '0'; const [a, b] = v.split('.'); return Number(a || 0).toLocaleString('en-US') + (b !== undefined ? '.' + b : ''); };
function sheet(title, items, cur, onPick, extra = '') {
  $('qsT').textContent = title;
  $('qsRow').innerHTML = items.map(([k, l]) => `<button type="button" class="chip" aria-pressed="${k === cur}" data-k="${esc(k)}">${esc(l)}</button>`).join('');
  $('qsExtra').innerHTML = extra; $('qSheet').hidden = false;
  $('qsRow').querySelectorAll('button').forEach(b => b.onclick = () => { onPick(b.dataset.k); });
}
const closeSheet = () => { $('qSheet').hidden = true; renderAdd(); };
$('qsDone').onclick = closeSheet;
$('qSheet').onclick = ev => { if (ev.target === $('qSheet')) closeSheet(); };
function renderQuick() {
  $('qv').textContent = fmAmt(F.amount);
  const amt = C.toSatang(F.amount || 0), now = C.safeToSpend(ST, ST.today).safe;
  const live = ST.cats.filter(c => !c.arch), used = {};
  for (const x of ST.entries) if (x.type === 'expense') used[x.cat] = (used[x.cat] || 0) + 1;
  const top = [...live].sort((a, z) => (used[z.id] || 0) - (used[a.id] || 0) || live.indexOf(a) - live.indexOf(z)).slice(0, live.length > 8 ? 7 : 8);
  if (amt > 0) {
    const e = buildEntry(); e.cat = (top[0] || {}).id;
    const then = C.safeToSpend({ ...ST, entries: [...ST.entries, { ...e, id: -1 }] }, ST.today).safe;
    $('qAfter').innerHTML = then === now ? tl('Safe to spend stays the same', 'ยอดใช้ได้จริงไม่เปลี่ยน') : `${tl('Safe to spend after this', 'หลังจดแล้วใช้ได้จริง')} <b class="num ${then < 0 ? 'neg' : ''}">${then < 0 ? '−' : ''}฿${fm(Math.abs(then))}</b>`;
  } else $('qAfter').innerHTML = `${tl('Safe to spend now', 'ใช้ได้จริงตอนนี้')} <b class="num">${now < 0 ? '−' : ''}฿${fm(Math.abs(now))}</b>`;
  const fromName = F.from === 'POT' ? (F.pot && potOf(F.pot) ? pn(potOf(F.pot)) : tl('Pocket', 'กอง')) : acct(F.from);
  $('qFrom').innerHTML = `${tl('Paid with', 'จ่ายด้วย')} <b>${esc(fromName)}</b>`;
  const dLbl = F.date === ST.today ? tl('Today', 'วันนี้') : F.date === C.addDays(ST.today, -1) ? tl('Yesterday', 'เมื่อวาน') : dl(F.date);
  $('qDate').innerHTML = `${tl('Date', 'วันที่')} <b>${esc(dLbl)}</b>${isPre() ? ' · ' + tl('not deducted', 'ไม่หักยอด') : ''}`;
  { const bl = F.bill && C.billStatus(ST, ST.today).find(x => x.id === F.bill), got = [bl ? billName(bl) : '', F.place.trim(), F.split.length ? tl('split with ', 'หารกับ ') + F.split.join(', ') : '', F.note.trim() ? tl('note', 'โน้ต') : ''].filter(Boolean);
    $('qMore').innerHTML = got.length ? `<b>${esc(got.join(' · '))}</b>` : tl('+ Details: bill, shop, friends, note', '+ รายละเอียด: บิล ร้าน เพื่อน โน้ต'); }
  const picked = F.qcat && live.some(c => c.id === F.qcat) ? F.qcat : '';
  $('qHint').textContent = !amt ? tl('Type the amount, then pick a category', 'พิมพ์ยอด แล้วเลือกหมวด') : !picked ? tl('Pick a category', 'เลือกหมวด') : tl('Check, then tap Save', 'ตรวจแล้วกดบันทึก');
  $('qCats').classList.toggle('ready', amt > 0 && !picked);
  const ok = amt > 0 && picked; $('qSave').disabled = !ok;
  $('qSave').textContent = ok ? tl(`Save ${cn(picked)} ฿${fm(amt)}`, `บันทึก ${cn(picked)} ฿${fm(amt)}`) : tl('Save', 'บันทึก');
  if (picked && !top.some(c => c.id === picked)) top[top.length - 1] = live.find(c => c.id === picked); // keep a pick from "Others" visible
  $('qCats').innerHTML = top.map(c => `<button type="button" class="qcat" aria-pressed="${c.id === picked}" data-c="${esc(c.id)}"><svg class="i"><use href="#${CAT_ICO[c.id] || 'i-tag'}"/></svg><span>${esc(L === 'th' ? c.th : c.en)}</span></button>`).join('') +
    (live.length > top.length ? `<button type="button" class="qcat qmore" data-c="__more"><svg class="i"><use href="#i-list"/></svg><span>${tl('Others', 'อื่นๆ')}</span></button>` : '');
  $('qCats').querySelectorAll('button').forEach(b => b.onclick = () => {
    if (b.dataset.c === '__more') return sheet(tl('Other categories', 'หมวดอื่นๆ'), live.filter(c => !top.includes(c)).map(c => [c.id, L === 'th' ? c.th : c.en]), picked, k => { F.qcat = k; closeSheet(); });
    F.qcat = F.qcat === b.dataset.c ? '' : b.dataset.c; renderQuick();
  });
  $('qPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map(k => `<button type="button" class="${k === 'del' ? 'fn' : ''}" data-k="${k}" aria-label="${k === 'del' ? tl('Delete', 'ลบ') : k}">${k === 'del' ? '<svg class="i" viewBox="0 0 24 24" style="width:24px;height:24px"><path d="M9 5h11v14H9l-6-7zM12 9l5 6M17 9l-5 6"/></svg>' : k}</button>`).join('');
  $('qPad').querySelectorAll('button').forEach(b => b.onclick = () => {
    let v = F.amount || ''; const k = b.dataset.k;
    if (k === 'del') v = v.slice(0, -1);
    else if (k === '.') { if (!v.includes('.')) v = (v || '0') + '.'; }
    else { if (v.includes('.') && v.split('.')[1].length >= 2) return; if (v.replace('.', '').length >= 9) return; v = v === '0' ? k : v + k; }
    F.amount = v; F.confirmed = false; renderQuick();
  });
}
function quickSave(cat) {
  if (!(C.toSatang(F.amount || 0) > 0) || !cat) return;
  F.cat = cat; const e = buildEntry(), v = C.validate(ST, e);
  if (!v.ok) { toast(tr(v.errors[0].msg)); return; }
  if (v.warnings.length) { F.full = true; F.cat = cat; renderAdd(); scrollTo(0, 0); return; } // the full form shows the warning and asks before saving
  commit(e, { msg: tl(`Saved ${cn(cat)} ฿${fm(e.amount)}`, `บันทึก ${cn(cat)} ฿${fm(e.amount)} แล้ว`) });
  F = { ...blankForm(), from: F.from, pot: F.pot, date: F.date }; renderAdd();
}
$('qSave').onclick = () => quickSave(F.qcat);
$('qFrom').onclick = () => sheet(tl('Paid with', 'จ่ายด้วย'), ACCTS_SPEND().map(k => [k, k === 'POT' ? tl('Pocket', 'กอง') : acct(k)]), F.from, k => {
  if (k === 'POT') return sheet(tl('Which pocket', 'กองไหน'), ST.pots.filter(p => !p.arch).map(p => ['pot:' + p.id, pn(p)]), 'pot:' + F.pot, x => { F.from = 'POT'; F.pot = x.slice(4); closeSheet(); });
  F.from = k; closeSheet();
});
$('qDate').onclick = () => {
  sheet(tl('Date', 'วันที่'), [[ST.today, tl('Today', 'วันนี้')], [C.addDays(ST.today, -1), tl('Yesterday', 'เมื่อวาน')], [C.addDays(ST.today, -2), tl('2 days ago', '2 วันก่อน')]], F.date, k => { F.date = k; closeSheet(); },
    `<label class="switch"><span>${tl('Other date', 'วันอื่น')}</span><input type="date" id="qsDate" value="${esc(F.date)}"></label>`);
  $('qsDate').onchange = () => { const d = $('qsDate').value; if (C.isDate(d)) F.date = d; };
  $('qsDate').onblur = () => { if (C.isDate($('qsDate').value)) closeSheet(); };
};
// "Details" opens over the keypad; the real form parts move into the sheet and back, so nothing is lost
const D_PARTS = ['gBill', 'gPlace', 'gSplit', 'gNote'].map(id => { const n = $(id); return { n, parent: n.parentNode, next: n.nextSibling }; });
$('qMore').onclick = () => { F.dOpen = true; D_PARTS.forEach(x => $('dSlot').appendChild(x.n)); $('dSheet').hidden = false; renderAdd(); };
function closeDetails() {
  if (!F.dOpen) return; F.dOpen = false; $('dSheet').hidden = true;
  [...D_PARTS].reverse().forEach(x => x.parent.insertBefore(x.n, x.next));
  if (F.cat && ST.cats.some(c => c.id === F.cat && !c.arch)) F.qcat = F.cat; // a bill or a known shop picks the category
  renderAdd();
}
$('dDone').onclick = closeDetails;
$('dSheet').onclick = ev => { if (ev.target === $('dSheet')) closeDetails(); };
$('toQuick').onclick = () => { F.full = false; renderAdd(); scrollTo(0, 0); };

// ---------- guide: How-to page, "?" buttons, first-run tour ----------
const H = k => { const x = window.HELP[k]; return x ? x[L === 'th' ? 'th' : 'en'] : null; };
function renderHelpList() {
  $('helpList').innerHTML = window.HELP_ORDER.map(k => { const [t, ps] = H(k);
    return `<details data-topic="${k}"><summary>${esc(t)}</summary>${ps.map(p => `<p>${esc(p)}</p>`).join('')}</details>`; }).join('');
}
let helpKey = null;
function openHelp(k) {
  const x = H(k); if (!x) return; helpKey = k;
  $('hsT').textContent = x[0]; $('hsB').innerHTML = x[1].map(p => `<p>${esc(p)}</p>`).join(''); $('helpSheet').hidden = false;
}
$('hsDone').onclick = () => { $('helpSheet').hidden = true; };
addEventListener('keydown', ev => { if (ev.key !== 'Escape') return; if (!$('helpSheet').hidden) $('helpSheet').hidden = true; else if (!$('qSheet').hidden) closeSheet(); else if (!$('tour').hidden) endTour(); });
$('helpSheet').onclick = ev => { if (ev.target === $('helpSheet')) $('helpSheet').hidden = true; };
$('hsMore').onclick = () => { $('helpSheet').hidden = true; go('set'); openFold('How to use');
  const d = document.querySelector(`#helpList [data-topic="${helpKey}"]`); if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start' }), 0); } };
// "?" next to the headings people ask about
[['.runway', 'safe', true], ['#wCardSec > h2', 'card'], ['#s-wallet .sec:has(#pots) > h2', 'pockets'], ['#s-wallet .sec:has(#realScb) > h2', 'fix'], ['#s-plan .top', 'payday'], ['#s-add .top', 'log']]
  .forEach(([sel, k, corner]) => { const el = document.querySelector(sel); if (!el) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'qbtn'; b.textContent = '?'; b.dataset.help = k;
    b.setAttribute('aria-label', L === 'th' ? 'วิธีใช้' : 'Help'); b.onclick = ev => { ev.stopPropagation(); openHelp(k); };
    if (corner) { el.style.position = 'relative'; b.style.cssText = 'position:absolute;top:6px;right:6px;margin:0'; }
    el.append(b); });
// short tour, once after setup (and again from the How-to page)
let tourAt = 0;
function showTour(at = 0) { tourAt = at; const T = window.TOUR, x = T[at][L === 'th' ? 'th' : 'en'];
  $('tStep').textContent = `${at + 1} / ${T.length}`; $('tT').textContent = x[0]; $('tB').textContent = x[1];
  $('tDots').innerHTML = T.map((_, i) => `<i class="${i === at ? 'on' : ''}"></i>`).join('');
  $('tNext').textContent = at < T.length - 1 ? tl('Next', 'ถัดไป') : tl('Start using', 'เริ่มใช้เลย'); $('tSkip').hidden = at === T.length - 1;
  $('tour').hidden = false; }
const endTour = () => { $('tour').hidden = true; try { localStorage.setItem('toured', '1'); } catch (e) {} };
$('tNext').onclick = () => (tourAt < window.TOUR.length - 1 ? showTour(tourAt + 1) : endTour());
$('tSkip').onclick = endTour;
$('tourAgain').onclick = () => { go('home'); showTour(0); };
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
  // everyone who appears in the data: friends in splits and anyone money was owed to or by (e.g. Mom in old entries)
  const persons = [...new Set([...ST.entries.flatMap(e => (e.shares || []).map(s => s.p)), ...ST.entries.flatMap(e => [e.from, e.to]).filter(C.isPerson).map(a => a.slice(7))])];
  const F2 = [['all', tl('All', 'ทั้งหมด')], ...(liveCards().length ? [['cards', tl('Cards', 'บัตร')]] : []), ...liveAccts().map(k => ['a:' + k, acct(k)]),
    ['income', tl('Income', 'รายรับ')], ['transfer', tl('Moves', 'โอน')], ['waiting', tl('Waiting refund', 'รอคืน')], ...persons.map(p => ['p:' + p, person(p)]), ...(HF.startsWith('c:') ? [[HF, cn(HF.slice(2))]] : [])];
  if (!F2.some(([k]) => k === HF)) HF = 'all';
  $('hf').innerHTML = F2.map(([k, l]) => `<button class="chip" aria-pressed="${HF === k}" data-k="${esc(k)}">${esc(l)}</button>`).join('');
  $('hf').querySelectorAll('button').forEach(b => b.onclick = () => { HF = b.dataset.k; renderHist(); });
  $('hfNow').textContent = [(F2.find(([k]) => k === HF) || [])[1], { detail: tl('Detailed', 'ละเอียด'), compact: tl('Compact', 'กระชับ'), month: tl('Months', 'รายเดือน') }[HV]].filter(Boolean).join(' · ');
  const q = $('hq').value.trim().toLowerCase();
  const rows = sorted().filter(e => {
    const sh = (e.shares || []).map(s => s.p);
    if (HF === 'cards' && !(C.isCard(e.from) || C.isCard(e.to))) return false;
    if (HF.startsWith('a:') && !(e.from === HF.slice(2) || e.to === HF.slice(2))) return false;
    if (HF.startsWith('c:') && !(e.type === 'expense' && e.cat === HF.slice(2))) return false;
    if (HF === 'income' && e.type !== 'income') return false;
    if (HF === 'transfer' && e.type !== 'transfer') return false;
    if (HF === 'waiting' && !(e.shares && C.shareStatus(ST, e.id).some(s => s.left > 0))) return false;
    if (HF.startsWith('p:') && !(sh.includes(HF.slice(2)) || e.from === 'person:' + HF.slice(2) || e.to === 'person:' + HF.slice(2))) return false;
    if (q && ![label(e), e.note, cn(e.cat), ...sh, acct(e.from || ''), acct(e.to || '')].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
  const byM = {}; rows.forEach(e => (byM[e.date.slice(0, 7)] = byM[e.date.slice(0, 7)] || []).push(e));
  const keys = Object.keys(byM).sort().reverse();
  $('mjump').innerHTML = keys.map(k => `<button data-k="${k}">${MN()[+k.slice(5) - 1]} ${k.slice(2, 4)}</button>`).join('');
  $('mjump').querySelectorAll('button').forEach(b => b.onclick = () => { openMonths.add(b.dataset.k); if (HV === 'month') renderHist(); $('m-' + b.dataset.k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const spentOf = list => list.filter(e => e.type === 'expense').reduce((s, e) => s + C.myShare(e), 0);
  if (!rows.length) { $('hlist').innerHTML = `<p class="empty">${ST.entries.length ? tl('No entries match this filter.', 'ไม่มีรายการที่ตรงกับตัวกรองนี้') : tl('No entries yet. Tap + to record your first one.', 'ยังไม่มีรายการ · กด + เพื่อจดรายการแรก')}</p>`; return; }
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
let sumMode = 'm', sumCycle = cyc(ST.today).start;
function cyclesWithData() {
  const set = new Set(ST.entries.map(e => cyc(e.date).start)); set.add(cyc(ST.today).start);
  return [...set].filter(s => s <= ST.today).sort();
}
function renderSum() {
  $('sumMode').hidden = true; markHs('sum');
  const cycles = cyclesWithData(), budget = ST.cats.filter(c => !c.arch).reduce((s, c) => s + c.b, 0);
  const vals = cycles.map(s => C.spending(ST, s, cyc(s).end).mine), max = Math.max(budget, ...vals, 1);
  $('chart').style.gridTemplateColumns = `repeat(${Math.max(cycles.length, 6)},1fr)`;
  $('chart').closest('.ledger').hidden = cycles.length < 2;
  $('chart').innerHTML = cycles.map((s, i) => { const end = cyc(s).end;
    return `<button aria-pressed="${sumMode === 'm' && s === sumCycle}" data-s="${s}" aria-label="${dl(end)} ${fm0(vals[i])}"><span class="cv num">${fm0(vals[i])}</span><i style="height:${Math.max(4, vals[i] / max * 110)}px;${budget && vals[i] > budget ? 'background:var(--debit)' : ''}"></i>${MN()[+end.slice(5, 7) - 1]}</button>`; }).join('');
  $('chart').querySelectorAll('button').forEach(b => b.onclick = () => { sumCycle = b.dataset.s; sumMode = 'm'; renderSum(); });
  $('budgetLine').textContent = budget ? tl(`Budget ฿${fm0(budget)} per cycle`, `งบ ฿${fm0(budget)} ต่อรอบ`) : tl('No budget set yet. Set one per category in Settings → Categories.', 'ยังไม่ได้ตั้งงบ ตั้งได้ที่ ตั้งค่า → หมวด');
  let from, to, nCycles;
  if (sumMode === 'm') { from = sumCycle; to = cyc(sumCycle).end; nCycles = 1; $('sumSub').textContent = `${dl(from)} – ${dly(to)}`; }
  else { from = cycles[0]; to = ST.today; nCycles = cycles.length; $('sumSub').textContent = tl(`${nCycles} cycles · ${dly(from)} – ${dly(to)}`, `${nCycles} รอบ · ${dly(from)} – ${dly(to)}`); }
  const sp = C.spending(ST, from, to), bud = budget * nCycles;
  $('stats').innerHTML = `<div><span>${tl('Spent', 'ใช้ไป')}</span><b class="num">${fm0(sp.mine)}</b></div><div><span>${tl('Budget', 'งบ')}</span><b class="num" style="${bud ? '' : 'font-size:13px;font-weight:500;color:var(--ink-3)'}">${bud ? fm0(bud) : tl('not set', 'ยังไม่ตั้ง')}</b></div>` +
    (sumMode === 'm' ? `<div><span>${tl('Left', 'เหลือ')}</span><b class="num ${!bud ? '' : bud - sp.mine < 0 ? 'neg' : 'pos'}">${bud ? fm0(bud - sp.mine) : '—'}</b></div>` : `<div><span>${tl('Income', 'รายรับ')}</span><b class="num">${fm0(sp.income)}</b></div>`);
  { const drew = sumMode === 'm' ? C.cycleStatus(ST, to < ST.today ? to : ST.today).drewCashflow : 0;
    $('sumDraw').hidden = !(drew > 0); $('sumDraw').textContent = drew > 0 ? tl(`Drew ฿${fm(drew)} from Cash flow this cycle`, `รอบนี้ดึง Cash flow ฿${fm(drew)}`) : ''; }
  const cats = ST.cats.filter(c => sp.byCat[c.id] || (!c.arch && c.b));
  $('catList').innerHTML = cats.map(c => { const v = sp.byCat[c.id] || 0, b = c.b * nCycles, over = b > 0 && v > b;
    return `<div class="cat ${over ? 'over' : ''}"><span>${esc(L === 'th' ? c.th : c.en)}${c.arch ? ` <span class="pill">${tl('archived', 'เก็บแล้ว')}</span>` : ''}</span><span class="amt num">${fm0(v)} <span class="of">/ ${b ? fm0(b) : '—'}</span></span><span class="track"><i style="width:${b ? Math.min(100, v / b * 100) : (v ? 100 : 0)}%"></i></span></div>`; }).join('') || `<p class="empty">${tl('No spending in this period yet. Tap + to record your first one.', 'ยังไม่มีรายจ่ายในช่วงนี้ · กด + เพื่อจดรายการแรก')}</p>`;
  const places = Object.entries(sp.byPlace).sort((a, b) => b[1].amount - a[1].amount), pmax = places[0] ? places[0][1].amount : 1;
  $('placeList2').innerHTML = places.map(([n, x]) => `<div class="cat"><span>${esc(n)}</span><span class="amt num">${fm0(x.amount)} <span class="of">· ${x.count}×</span></span><span class="track"><i style="width:${x.amount / pmax * 100}%"></i></span></div>`).join('') || `<p class="empty">${tl('No places yet. Add the shop under More details when you record a spend.', 'ยังไม่มีร้าน · ใส่ชื่อร้านได้ตอนจด ใน "รายละเอียดเพิ่มเติม"')}</p>`;
  $('potSpend').textContent = sp.pots ? tl(`Paid from pockets in this period: ฿${fm(sp.pots)} (not in the budget).`, `จ่ายจากกองในช่วงนี้ ฿${fm(sp.pots)} (ไม่นับในงบ)`) : '';
}

// ---------- SPLIT SALARY (each tick records a real transfer) ----------
const nextPay = () => C.addDays(cyc(ST.today).end, 1);
const salaryIn = pay => ST.entries.some(e => e.tag === `plan:${pay}:salary`);
// The payday the split screen works on: for the first 10 days of a cycle, the payday that started it
// (so late pay and unfinished transfers can still be ticked); after that, the next one.
function planPay() { const c = cyc(ST.today); return C.daysBetween(c.start, ST.today) <= 10 && c.start > (ST.startDate || '') ? c.start : C.addDays(c.end, 1); }
function potGoalHTML(p, i, have) {
  const per = p.monthly != null ? p.monthly : p.fixed;
  return `<div class="pgoal">
    <label>${tl('Goal ฿', 'เป้า ฿')}<input class="field" id="pg${i}" type="number" inputmode="decimal" min="0" step="0.01" value="${p.goal ? p.goal / 100 : ''}" placeholder="${tl('none', 'ไม่มี')}"></label>
    <label>${tl('Reach by', 'ครบภายใน')}<input class="field" id="pb${i}" type="month" value="${esc(p.by || '')}"></label>
    <label>${tl('Per month ฿', 'โอน/เดือน ฿')}<input class="field" id="pm${i}" type="number" inputmode="decimal" min="0" step="0.01" value="${per ? per / 100 : ''}" placeholder="${tl('auto', 'ให้แอปคิด')}"></label>
    <label class="rep"><input type="checkbox" id="pr${i}" ${p.repeat ? 'checked' : ''}> ${tl('Same goal every year', 'เป้าวนทุกปี')}</label>
    <span class="pline" style="${C.potPlan(p, have, nextPay()).status === 'late' ? 'color:var(--debit)' : ''}">${esc(potLine(p, have, nextPay()))}</span></div>`;
}
const monthsLeft = (by, from) => { const [y, m] = by.split('-').map(Number), [fy, fmn] = from.split('-').map(Number); return Math.max(1, (y - fy) * 12 + (m - fmn) + 1); };
// a one-off amount for a single payday (set on the split screen) beats the plan; the plan itself is unchanged
function monthly(p, have, from) { return p.once && p.once.pay === from ? p.once.v : C.potPlan(p, have, from).amount; }
const ym = v => `${MN()[+v.slice(5) - 1]} ${v.slice(0, 4)}`;
// one line saying where a pocket's plan stands
function potLine(p, have, from) {
  const x = C.potPlan(p, have, from);
  if (x.status === 'none') return tl('No monthly transfer', 'ไม่ได้โอนประจำ');
  if (x.status === 'fixed') return tl(`฿${fm0(x.per)} every month`, `เดือนละ ฿${fm0(x.per)}`);
  if (x.status === 'done') return tl(`Goal ฿${fm0(x.goal)} reached`, `ครบเป้า ฿${fm0(x.goal)} แล้ว`);
  const goal = tl(`Goal ฿${fm0(x.goal)}`, `เป้า ฿${fm0(x.goal)}`);
  if (x.status === 'open' && !x.per) return `${goal} · ${tl('add a month or an amount per month', 'ใส่เดือนที่อยากให้ครบ หรือยอดต่อเดือน')}`;
  if (x.status === 'open') return `${goal} · ${tl(`done ${ym(x.finish)}`, `ครบ ${ym(x.finish)}`)}`;
  if (x.status === 'late') return `${goal} ${tl(`by ${ym(x.by)}`, `ภายใน ${ym(x.by)}`)} · ${tl(`${x.late} mo late, needs ฿${fm0(x.need)}/mo`, `ช้าไป ${x.late} เดือน ต้องเดือนละ ฿${fm0(x.need)}`)}`;
  const early = x.per > x.need ? tl(` · at ฿${fm0(x.per)}/mo done ${ym(x.finish)}`, ` · โอนเดือนละ ฿${fm0(x.per)} ครบ ${ym(x.finish)}`) : '';
  return `${goal} ${tl(`by ${ym(x.by)}`, `ภายใน ${ym(x.by)}`)} · ${tl(`on track (needs ฿${fm0(x.need)}/mo)`, `ทันกำหนด (ต้องเดือนละ ฿${fm0(x.need)})`)}${early}`;
}
// ---------- CYCLE PLAN (salary · pockets · bills · categories for one cycle) ----------
// Defaults live on state (salary, cats[].b, pots[].monthly); edits here for one cycle go to state.cyclePlans[start].
const assignHTML = left => `<div><span class="k">${tl('Left to assign', 'เหลือให้แบ่ง')}</span><b>${left < 0 ? '−' : ''}฿${fm0(Math.abs(left))}</b></div>
  <span class="k" style="text-align:right">${left === 0 ? tl('All assigned', 'แบ่งครบแล้ว') : left < 0 ? tl('Over by this much', 'แบ่งเกินไป') : tl('Must reach 0', 'ต้องเป็น 0 ถึงจะครบ')}</span>`;
function renderCyclePlan() {
  const start = planPay(), c = cyc(start), P = C.planFor(ST, start), ov = (ST.cyclePlans || {})[start] || {}, ovc = ov.cats || {};
  const extra = C.extraIncome(ST, c), bal = C.balances(ST), sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const pots = ST.pots.filter(p => !p.arch && p.id !== 'cashflow'), cats = ST.cats.filter(x => !x.arch);
  const bills = (ST.bills || []).filter(b => !C.isPot(b.from));
  const v = n => n / 100;
  $('cpSub').textContent = `${dl(c.start)} – ${dl(c.end)}`;
  const catRow = x => { const now = P.cats[x.id], over = ovc[x.id] != null && ovc[x.id] !== (x.b || 0);
    return `<div class="ln"><span class="k">${esc(L === 'th' ? x.th : x.en)}<small>${tl('Default', 'ค่าตั้งต้น')} ${fm0(x.b || 0)}</small></span>
      <span class="pin"><span class="row">${over ? `<span class="was">${fm0(x.b || 0)}</span>` : ''}<input class="field${over ? ' ch' : ''}" type="number" inputmode="decimal" min="0" step="0.01" data-pc="${esc(x.id)}" value="${v(now)}" aria-label="${esc(L === 'th' ? x.th : x.en)}"></span>
      ${over ? `<button type="button" class="mkdef" data-mkdef="${esc(x.id)}">${tl('Make default', 'ตั้งเป็นค่าตั้งต้น')}</button>` : ''}</span></div>`; };
  $('cyclePlan').innerHTML = `
    <div class="ledger"><div class="ln"><span class="k">${tl('Salary this cycle', 'เงินเดือนรอบนี้')}<small>${tl('Usual', 'ค่าปกติ')} ฿${fm0(ST.salary)}</small></span>
      <input class="field${ov.salary != null && ov.salary !== ST.salary ? ' ch' : ''}" id="cpSal" type="number" inputmode="decimal" min="0" step="0.01" value="${v(P.salary)}" aria-label="${tl('Salary this cycle', 'เงินเดือนรอบนี้')}"></div></div>
    <div class="assign" id="cpAssign"></div>
    ${extra > 0 ? `<div class="extra"><span>${tl(`New money <b class="num">฿${fm0(extra)}</b> not assigned yet`, `เงินเพิ่ม <b class="num">฿${fm0(extra)}</b> ยังไม่ได้แบ่ง`)}</span><button type="button" class="btn" id="cpSplitExtra">${tl('Assign', 'แบ่ง')}</button></div>` : ''}
    <div class="sec"><h2><span class="h">${tl('Save to MAKE', 'โอนเก็บ MAKE ต้นรอบ')}</span><span class="num" id="cpPotSum">฿${fm0(sum(P.pots))}</span></h2><div class="ledger">
      ${pots.map(p => `<div class="ln"><span class="k">${esc(pn(p))}<small>${esc(potLine(p, bal['pot:' + p.id] || 0, start))}</small></span><input class="field" type="number" inputmode="decimal" min="0" step="0.01" data-pp="${esc(p.id)}" value="${P.pots[p.id] ? v(P.pots[p.id]) : ''}" placeholder="0" aria-label="${esc(pn(p))}"></div>`).join('') || `<div class="ln"><span class="k">${tl('No pockets yet', 'ยังไม่มีกอง')}</span></div>`}</div></div>
    <div class="sec"><h2><span class="h">${tl('Monthly bills', 'บิลประจำ')}</span><span class="num">฿${fm0(P.bills)}</span></h2><div class="ledger">
      ${bills.map(b => `<div class="ln"><span class="k">${esc(b.n)}</span><span class="num">${fm0(b.amount)}</span></div>`).join('') || `<div class="ln"><span class="k">${tl('No monthly bills', 'ไม่มีบิลประจำ')}</span></div>`}</div>
      <button type="button" class="btn link" id="cpBills">${tl('Change bills in Settings ›', 'แก้บิลในตั้งค่า ›')}</button></div>
    <div class="sec" id="cpCats"><h2><span class="h">${tl('Spending categories', 'หมวดใช้จ่าย')}</span><span class="num" id="cpCatSum">฿${fm0(sum(P.cats))}</span></h2><div class="ledger">${cats.map(catRow).join('')}</div></div>`;
  // live total while typing; the value is stored on change
  const read = (sel, f) => [...$('cyclePlan').querySelectorAll(sel)].reduce((s, i) => { const x = String(i.value).trim() === '' ? 0 : C.toSatang(i.value); return s + (x >= 0 ? x : 0); }, 0);
  const live = () => { const sal = C.toSatang($('cpSal').value) || 0, pp = read('[data-pp]'), cc = read('[data-pc]');
    const left = sal + extra - pp - P.bills - cc;
    $('cpAssign').className = 'assign' + (left === 0 ? ' ok' : ''); $('cpAssign').innerHTML = assignHTML(left);
    $('cpPotSum').textContent = '฿' + fm0(pp); $('cpCatSum').textContent = '฿' + fm0(cc); };
  live();
  $('cyclePlan').querySelectorAll('input').forEach(i => i.oninput = live);
  const own = () => ((ST.cyclePlans ||= {})[start] ||= {});
  const tidy = () => { const o = ST.cyclePlans && ST.cyclePlans[start]; if (!o) return; if (o.cats && !Object.keys(o.cats).length) delete o.cats; if (!Object.keys(o).length) delete ST.cyclePlans[start]; };
  const done = () => { tidy(); persist(); renderPlan(); };
  $('cpSal').onchange = ev => { const x = C.toSatang(ev.target.value); if (!(x > 0)) { toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); return renderPlan(); }
    if (x === ST.salary) delete own().salary; else own().salary = x; done(); };
  $('cyclePlan').querySelectorAll('[data-pc]').forEach(i => i.onchange = () => { const cat = ST.cats.find(x => x.id === i.dataset.pc), t = i.value.trim(), x = t === '' ? 0 : C.toSatang(t);
    if (!(x >= 0)) { toast(tl('Budget cannot be negative', 'งบติดลบไม่ได้')); return renderPlan(); }
    const o = own(); o.cats ||= {}; if (x === (cat.b || 0)) delete o.cats[cat.id]; else o.cats[cat.id] = x; done(); });
  $('cyclePlan').querySelectorAll('[data-mkdef]').forEach(b => b.onclick = () => { const cat = ST.cats.find(x => x.id === b.dataset.mkdef);
    cat.b = ovc[cat.id]; delete own().cats[cat.id]; done(); toast(tl('Saved as the default for every cycle', 'ตั้งเป็นค่าตั้งต้นทุกรอบแล้ว')); });
  $('cyclePlan').querySelectorAll('[data-pp]').forEach(i => i.onchange = () => { const p = ST.pots.find(x => x.id === i.dataset.pp), t = i.value.trim(), cur = P.pots[p.id] || 0;
    if (t === '') return renderPlan(); // blank: back to the shown amount
    const x = C.toSatang(t);
    if (!(x >= 0)) { toast(tl('Amounts must be 0 or more', 'ยอดต้องเป็น 0 ขึ้นไป')); return renderPlan(); }
    if (x === cur) return renderPlan();
    p.monthly = x; delete p.fixed; done(); });
  $('cpBills').onclick = () => go('set');
  if ($('cpSplitExtra')) $('cpSplitExtra').onclick = () => { const f = $('cpCats').querySelector('[data-pc]'); $('cpCats').scrollIntoView({ behavior: 'smooth', block: 'start' }); if (f) f.focus({ preventScroll: true }); };
}
function renderPlan() {
  renderCyclePlan();
  const pay = planPay(), when = ST.today > pay ? ST.today : pay, SAL = C.planFor(ST, pay).salary, tag = k => `plan:${pay}:${k}`; // late salary: record on the day it arrives
  const done = k => ST.entries.find(e => e.tag === tag(k) || (e.tag || '').startsWith(tag(k) + ':'));
  const bal = C.balances(ST);
  const list = ST.pots.filter(p => !p.arch).map(p => ({ p, amt: monthly(p, bal['pot:' + p.id] || 0, pay) })).filter(x => x.amt > 0);
  const toPots = list.reduce((s, x) => s + x.amt, 0);
  const IN = ST.salaryTo, OUT = ST.spendTo, inN = acct(IN), outN = acct(OUT);
  // bills paid straight from the salary account stay there; the rest of the bills ride along to the spending account
  const keep = IN === OUT ? 0 : (ST.bills || []).filter(b => b.from === IN).reduce((s, b) => s + b.amount, 0);
  const billsTotal = (ST.bills || []).filter(b => !C.isPot(b.from)).reduce((s, b) => s + b.amount, 0);
  const rest = SAL - toPots - keep;
  $('planSub').textContent = tl(`Cycle from ${dly(pay)} · ฿${fm0(SAL)}`, `รอบเริ่ม ${dly(pay)} · ฿${fm0(SAL)}`);
  $('toMake').textContent = '฿' + fm0(toPots); $('toScb').textContent = '฿' + fm0(rest);
  $('toSpendLbl').textContent = IN === OUT ? tl(`Stays in ${outN}`, `อยู่ใน ${outN}`) : tl(`To ${outN}`, `ไป ${outN}`);
  $('planHint').textContent = tl(`Transfer in the ${inN} app, then tick each step here.`, `โอนในแอป ${inN} แล้วติ๊กทีละขั้นที่นี่`);
  $('splitBar').innerHTML = `<i style="flex:${toPots};background:var(--marigold)"></i><i style="flex:${Math.max(0, rest)};background:var(--credit)"></i>`;
  const steps = [{ k: 'salary', name: tl(`Salary arrived in ${inN}`, `เงินเดือนเข้า ${inN}`), amt: SAL, entry: { type: 'income', date: when, amount: SAL, to: IN, cat: 'salary', tag: tag('salary') } },
    ...list.map(({ p, amt }) => ({ k: p.id, name: pn(p), sub: potLine(p, bal['pot:' + p.id] || 0, pay), amt, p,
      entry: { type: 'transfer', date: when, amount: amt, from: IN, to: 'pot:' + p.id, tag: tag(p.id) } })),
    ...(IN === OUT ? [] : [{ k: 'scb', name: tl(`Rest to ${outN} for spending`, `ที่เหลือโอนไป ${outN}`), amt: rest,
      sub: keep ? tl(`Keeps ฿${fm0(keep)} in ${inN} for bills paid from it`, `เก็บ ฿${fm0(keep)} ไว้ใน ${inN} สำหรับรายจ่ายที่จ่ายจากบัญชีนี้`) : '',
      entry: { type: 'transfer', date: when, amount: rest, from: IN, to: OUT, tag: tag('scb') } }])];
  $('alloc').innerHTML = steps.map((s, i) => `<div class="al ${done(s.k) ? 'done' : ''}"><input class="ck" type="checkbox" id="ck${i}" ${done(s.k) ? 'checked' : ''} aria-label="${esc(s.name)}">
    <span class="nm">${esc(s.name)}</span><span class="amt num">${fm0(s.amt)}</span>
    <span class="sub">${s.sub ? esc(s.sub) : ''}${s.p ? ` <input class="field" id="v${i}" type="number" inputmode="decimal" value="${s.amt / 100}" title="${tl('Per month', 'ต่อเดือน')}" aria-label="${esc(s.name)}">` : ''}</span><span></span></div>`).join('');
  steps.forEach((s, i) => {
    $('ck' + i).onchange = ev => {
      const ex = done(s.k);
      if (ev.target.checked && !ex) {
        for (const en of s.entries || [s.entry]) { const v = C.validate(ST, en); if (!v.ok) { ev.target.checked = false; toast(tr(v.errors[0].msg)); return; } }
        for (const en of s.entries || [s.entry]) commit(en, { quiet: true });
      }
      if (!ev.target.checked && ex) {
        ST.entries = ST.entries.filter(e => !(e.tag === tag(s.k) || (e.tag || '').startsWith(tag(s.k) + ':'))); persist();
      }
      renderPlan();
    };
    if (s.p) $('v' + i).onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); renderPlan(); return; } s.p.once = { pay, v }; persist(); toast(tl('Changed for this payday only. The plan stays the same.', 'เปลี่ยนเฉพาะรอบนี้ แผนหลักไม่เปลี่ยน')); renderPlan(); };
  });
  $('doneCount').textContent = `${steps.filter(s => done(s.k)).length} / ${steps.length}`;
}

// ---------- SETTINGS ----------
const ACCENTS = [{ id: 'marigold', l: '#c9760a', d: '#f4a52a' }, { id: 'jade', l: '#1f8a64', d: '#4cc79a' }, { id: 'sky', l: '#2468c9', d: '#6aa6ff' }, { id: 'rose', l: '#c23a5c', d: '#ff7a9a' }, { id: 'violet', l: '#6d4bd1', d: '#a98bff' }, { id: 'graphite', l: '#3c4658', d: '#c9d1de' }];
let PREF = { accent: 'marigold', custom: null, theme: 'light' }; try { Object.assign(PREF, JSON.parse(localStorage.getItem('pref') || '{}')); } catch (e) {}
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
  seg2($('langSeg'), [['th', 'ไทย'], ['en', 'English']], L, k => { L = k; try { localStorage.setItem('lang', L); } catch (e) {} render(); });
  seg2($('themeSeg'), [['system', tl('System', 'ตามเครื่อง')], ['light', tl('Light', 'สว่าง')], ['dark', tl('Dark', 'มืด')]], PREF.theme, k => { PREF.theme = k; savePref(); applyLook(); renderSet(); });
  // categories
  const used = id => ST.entries.filter(e => e.cat === id).length;
  $('catEd').innerHTML = ST.cats.map((c, i) => `<div class="ed ${c.arch ? 'arch' : ''}"><input class="name" id="cn${i}" value="${esc(L === 'th' ? c.th : c.en)}" ${c.arch ? 'disabled' : ''} aria-label="${tl('Category name', 'ชื่อหมวด')}">
    ${c.arch ? `<span class="hint" style="font-size:13px">${used(c.id)} ${tl('entries', 'รายการ')}</span>` : `<span class="num" style="font-size:13px;color:var(--ink-2)">${fm0(c.b)}</span>`}
    <button class="act" id="ca${i}">${c.arch ? tl('Restore', 'คืน') : tl('Archive', 'เก็บ')}</button></div>`).join('') +
    `<div class="addrow"><input id="newCat" placeholder="${tl('New category', 'หมวดใหม่')}" aria-label="${tl('New category', 'หมวดใหม่')}"><button id="addCat">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.cats.forEach((c, i) => {
    const n = $('cn' + i); if (n) n.onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = L === 'th' ? c.th : c.en; return; }
      if (ST.cats.some(x => x !== c && (x.en === v || x.th === v))) { toast(tl('That name is already used', 'มีชื่อนี้แล้ว')); ev.target.value = L === 'th' ? c.th : c.en; return; }
      L === 'th' ? (c.th = v) : (c.en = v); persist(); toast(tl('Renamed. Past entries follow.', 'เปลี่ยนชื่อแล้ว รายการเก่าเปลี่ยนตาม')); };
    $('ca' + i).onclick = () => { if (!c.arch && ST.cats.filter(x => !x.arch).length <= 1) { toast(tl('Keep at least one category', 'ต้องเหลืออย่างน้อยหนึ่งหมวด')); return; }
      c.arch = !c.arch; if (c.arch && F.cat === c.id) F.cat = ST.cats.find(x => !x.arch).id; persist(); toast(c.arch ? tl('Archived. History kept.', 'เก็บแล้ว ประวัติยังอยู่') : tl('Restored', 'คืนแล้ว')); renderSet(); };
  });
  $('addCat').onclick = () => { const v = $('newCat').value.trim(); if (!v) { $('newCat').focus(); return; }
    if (ST.cats.some(x => x.en === v || x.th === v)) { toast(tl('That name is already used', 'มีชื่อนี้แล้ว')); return; }
    ST.cats.push({ id: 'c' + Date.now(), en: v, th: v, b: 0 }); persist(); toast(tl('Category added', 'เพิ่มหมวดแล้ว')); renderSet(); };
  // pockets
  const bal = C.balances(ST);
  $('potEd').innerHTML = ST.pots.map((p, i) => `<div class="ed ${p.arch ? 'arch' : ''}" style="flex-wrap:wrap"><input class="name" id="pn${i}" value="${esc(pn(p))}" ${p.arch ? 'disabled' : ''} aria-label="${tl('Pocket name', 'ชื่อกอง')}">
    <span class="num" style="font-size:13px;color:var(--ink-2)">${fm(bal['pot:' + p.id] || 0)}</span><button class="act" id="pa${i}">${p.arch ? tl('Restore', 'คืน') : tl('Archive', 'เก็บ')}</button><span class="warn" id="pw${i}" hidden></span>
    ${p.arch || p.id === 'cashflow' ? '' : potGoalHTML(p, i, bal['pot:' + p.id] || 0)}</div>`).join('') +
    `<div class="addrow"><input id="newPot" placeholder="${tl('New pocket', 'กองใหม่')}" aria-label="${tl('New pocket', 'กองใหม่')}"><button id="addPot">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.pots.forEach((p, i) => {
    const n = $('pn' + i); if (n) n.onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = pn(p); return; } p.n = p.th = v; persist(); toast(tl('Renamed. Rename it in MAKE too.', 'เปลี่ยนชื่อแล้ว อย่าลืมแก้ใน MAKE')); };
    $('pa' + i).onclick = () => { const have = bal['pot:' + p.id] || 0;
      if (!p.arch && have !== 0) { const w = $('pw' + i); w.textContent = tl(`Move the ฿${fm(have)} out first`, `ย้ายเงิน ฿${fm(have)} ออกก่อน`); w.hidden = false; return; }
      p.arch = !p.arch; persist(); renderSet(); };
  });
  ST.pots.forEach((p, i) => { if (!$('pg' + i)) return;
    const money = (id, key) => $(id + i).onchange = ev => { const t = ev.target.value.trim(), v = t === '' ? null : C.toSatang(t);
      if (v !== null && !(v >= 0)) { toast(tl('Amounts must be 0 or more', 'ยอดต้องเป็น 0 ขึ้นไป')); return renderSet(); }
      if (v === null || v === 0) delete p[key]; else p[key] = v; if (key === 'monthly') delete p.fixed; delete p.once; persist(); renderSet(); };
    money('pg', 'goal'); money('pm', 'monthly');
    $('pb' + i).onchange = ev => { const v = ev.target.value; if (v) p.by = v; else delete p.by; persist(); }; // no redraw while the iOS wheel is open
    $('pb' + i).onblur = () => renderSet();
    $('pr' + i).onchange = ev => { if (ev.target.checked) p.repeat = true; else delete p.repeat; persist(); renderSet(); };
  });
  $('addPot').onclick = () => { const v = $('newPot').value.trim(); if (!v) { $('newPot').focus(); return; }
    ST.pots.push({ id: 'p' + Date.now(), n: v, th: v, fixed: B(500) }); persist(); toast(tl('Pocket added. Create it in MAKE too.', 'เพิ่มกองแล้ว อย่าลืมสร้างใน MAKE')); renderSet(); };
  renderMoneySettings(bal);
  $('salaryIn').value = ST.salary / 100;
  $('salaryIn').onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { ev.target.value = ST.salary / 100; toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); return; } ST.salary = v; persist(); toast(tl('Salary saved', 'บันทึกเงินเดือนแล้ว')); };
  $('backupInfo').textContent = ST.lastBackup ? tl(`Last backup ${dly(ST.lastBackup)}`, `สำรองล่าสุด ${dly(ST.lastBackup)}`) : tl('No backup yet', 'ยังไม่เคยสำรอง');
  const PD = ST.payday || [], pend = PD.find(x => x.since > ST.today);
  $('paydayIn').value = PD_STEP ? PD_STEP.day : pend ? pend.day : payDay().day;
  $('paydayNote').textContent = pend && pend.prevStart ? tl(`This cycle ends ${dly(C.addDays(pend.since, -1))}. Day ${pend.day} from ${dly(pend.since)}.`, `รอบนี้จบ ${dly(C.addDays(pend.since, -1))} · เริ่มวันที่ ${pend.day} ตั้งแต่ ${dly(pend.since)}`) : pend ? (() => { const mid = cyc(C.addDays(cyc(ST.today).end, 1)); return tl(`Moves to day ${pend.day} from ${dly(pend.since)}. This cycle stays as it is; ${dl(mid.start)} – ${dl(mid.end)} is a one-off in-between cycle.`, `เปลี่ยนเป็นวันที่ ${pend.day} ตั้งแต่ ${dly(pend.since)} · รอบนี้ไม่เปลี่ยน · รอบ ${dl(mid.start)} – ${dl(mid.end)} เป็นรอบคั่นครั้งเดียว`); })()
    : tl(`For example, 24 means each cycle runs from the 24th to the 23rd. Salary counts only once you record it arriving, so a late salary never shows as money you have. In a short month, a late day becomes the month's last day.`, `เช่น ตั้ง 24 = รอบงบ 24 ถึง 23 เดือนถัดไป · เงินเดือนนับเมื่อจดว่าเข้าแล้วเท่านั้น ถ้าเลทก็ไม่นับล่วงหน้า · เดือนที่ไม่มีวันนั้นจะใช้วันสุดท้ายของเดือน`);
  $('paydayIn').onchange = ev => { const v = +ev.target.value; if (!(Number.isInteger(v) && v >= 1 && v <= 31)) { toast(tl('Day must be 1 to 31', 'วันต้องอยู่ระหว่าง 1 ถึง 31')); PD_STEP = null; return renderSet(); }
    if (v === ((ST.payday || []).filter(x => x.since <= ST.today).at(-1) || { day: 28 }).day) { C.changePayday(ST, ST.today, v); PD_STEP = null; persist(); toast(tl('Cycle day unchanged', 'วันเริ่มรอบเหมือนเดิม')); return renderSet(); }
    PD_STEP = { day: v, start: cyc(ST.today).start, end: defaultEndOn(v) }; renderPaydayStep(); };
  renderPaydayStep();
  document.querySelectorAll('#s-set [data-goplan]').forEach(b => b.onclick = () => go('plan'));
  renderHelpList();
  setSubs();
  $('exportBtn').onclick = exportBackup;
  $('importFile').onchange = importBackup;
  $('eraseBtn').onclick = ev => { const b = ev.currentTarget;
    if (b.dataset.armed !== '2') { b.dataset.armed = String((+b.dataset.armed || 0) + 1); b.textContent = b.dataset.armed === '1' ? tl('This deletes every entry on this phone. Tap again', 'จะลบทุกรายการในเครื่องนี้ แตะอีกครั้ง') : tl('Last chance: tap to erase', 'แตะครั้งสุดท้ายเพื่อลบ'); return; }
    window.Store.erase().then(() => { SU = null; ST = emptyState(); ST.today = localToday(); F = blankForm(); go('setup'); }); };
}

// first date with day-of-month `day` (clamped to month length) strictly after `d`, then the ones after it
const payDatesFrom = (day, d) => { const [y, m] = d.split('-').map(Number), out = [];
  for (let i = 0; i < 5; i++) { const t = new Date(Date.UTC(y, m - 1 + i, 1)), dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    const x = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, dim)).padStart(2, '0')}`; if (x > d) out.push(x); }
  return out; };
// the cycle open now ends the day before a new-day date that is within 14 days of where it would have ended anyway
function defaultEndOn(day) {
  const cy = cyc(ST.today), nat = C.addDays(cy.end, 1), ds = payDatesFrom(day, ST.today);
  const hit = ds.find(x => Math.abs(C.daysBetween(nat, x)) <= 14) || ds.reduce((a, x) => Math.abs(C.daysBetween(nat, x)) < Math.abs(C.daysBetween(nat, a)) ? x : a, ds[0]);
  return C.addDays(hit, -1);
}
let PD_STEP = null; // { day, start, end } while the cycle-day step is open
function renderPaydayStep() {
  const box = $('paydayStep'); if (!box) return;
  box.hidden = !PD_STEP; if (!PD_STEP) { box.innerHTML = ''; return; }
  const { day, start, end } = PD_STEP, since = C.addDays(end, 1);
  box.innerHTML = `<p class="pdt">${tl('When does this cycle run?', 'รอบนี้เริ่มและจบวันไหน?')}</p>`
    + `<label class="pdr"><span>${tl('Starts', 'เริ่มวันที่')}</span><input type="date" id="pdStart" value="${start}" max="${ST.today}"></label>`
    + `<label class="pdr"><span>${tl('Ends', 'จบวันที่')}</span><input type="date" id="pdEnd" value="${end}" min="${ST.today}"></label>`
    + `<p class="pdprev" aria-live="polite">${tl(`This cycle: ${dly(start)} – ${dly(end)}. Then day ${day} from ${dly(since)}.`, `รอบนี้เริ่มวันที่ ${dly(start)} จบวันที่ ${dly(end)} · จากนั้นรอบเริ่มวันที่ ${day} ตั้งแต่ ${dly(since)}`)}</p>`
    + `<div class="pdacts"><button type="button" class="btn ghost" id="pdCancel">${tl('Cancel', 'ยกเลิก')}</button><button type="button" class="btn" id="pdOk">${tl('Confirm', 'ยืนยัน')}</button></div>`;
  const pick = (id, key, ok, msg) => $(id).onchange = ev => { const v = ev.target.value;
    if (!C.isDate(v) || !ok(v)) { toast(msg); ev.target.value = PD_STEP[key]; return; }
    PD_STEP[key] = v; renderPaydayStep(); };
  pick('pdStart', 'start', v => v <= ST.today, tl('Start must be today or earlier', 'วันเริ่มต้องเป็นวันนี้หรือก่อนหน้า'));
  pick('pdEnd', 'end', v => v >= ST.today, tl('End must be today or later', 'วันจบต้องเป็นวันนี้หรือหลังจากนี้'));
  $('pdCancel').onclick = () => { PD_STEP = null; renderSet(); };
  $('pdOk').onclick = () => { if (start > end) { toast(tl('Start must be before the end', 'วันเริ่มต้องอยู่ก่อนวันจบ')); return; }
    const s = C.changePayday(ST, ST.today, day, { endOn: end, startFrom: start }); PD_STEP = null; persist();
    toast(tl(`Cycle ends ${dly(end)}, then day ${day} from ${dly(s)}`, `รอบนี้จบ ${dly(end)} · จากนั้นเริ่มวันที่ ${day} ตั้งแต่ ${dly(s)}`)); renderSet(); };
}

// accounts, cards, monthly bills, and where the salary goes
const opts = (keys, cur) => keys.map(k => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(acct(k))}</option>`).join('');
const billSources = cur => withCur([...liveAccts(), ...liveCards(), ...ST.pots.filter(p => !p.arch).map(p => 'pot:' + p.id)], cur);
const dayOk = v => Number.isInteger(v) && v >= 1 && v <= 28;
function renderMoneySettings(bal) {
  const saved = m => { persist(); toast(m || tl('Saved', 'บันทึกแล้ว')); renderSet(); };
  // accounts
  $('acctEd').innerHTML = ST.accounts.map((a, i) => `<div class="ed ${a.arch ? 'arch' : ''}" style="flex-wrap:wrap"><input class="name" id="an${i}" value="${esc(acct(a.k))}" ${a.arch ? 'disabled' : ''} aria-label="${tl('Account name', 'ชื่อบัญชี')}">
    <span class="num" style="font-size:13px;color:var(--ink-2)">${fm(bal[a.k] || 0)}</span><button class="act" id="aa${i}">${a.arch ? tl('Restore', 'คืน') : tl('Remove', 'ลบ')}</button><span class="warn" id="aw${i}" hidden></span></div>`).join('') +
    `<div class="addrow"><input id="newAcct" placeholder="${tl('New account', 'บัญชีใหม่')}" aria-label="${tl('New account', 'บัญชีใหม่')}"><button id="addAcct">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.accounts.forEach((a, i) => {
    const n = $('an' + i); if (n) n.onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = acct(a.k); return; } a.n = v; saved(tl('Renamed. Past entries follow.', 'เปลี่ยนชื่อแล้ว รายการเก่าเปลี่ยนตาม')); };
    $('aa' + i).onclick = () => {
      const w = $('aw' + i), have = bal[a.k] || 0, show = m => { w.textContent = m; w.hidden = false; };
      if (!a.arch) {
        if (have !== 0) return show(tl(`Move the ฿${fm(have)} out first`, `ย้ายเงิน ฿${fm(have)} ออกก่อน`));
        if (a.k === ST.salaryTo || a.k === ST.spendTo) return show(tl('Salary or spending goes here. Pick another account below first.', 'บัญชีนี้รับเงินเดือนหรือใช้จ่ายอยู่ เปลี่ยนในหัวข้อเงินเดือนก่อน'));
        if (ST.cards.some(c => !c.arch && c.from === a.k) || (ST.bills || []).some(b => b.from === a.k)) return show(tl('A card or bill is paid from here. Change that first.', 'มีบัตรหรือรายจ่ายประจำที่จ่ายจากบัญชีนี้ เปลี่ยนก่อน'));
      }
      a.arch = !a.arch; saved(a.arch ? tl('Removed. History kept.', 'ลบแล้ว ประวัติยังอยู่') : tl('Restored', 'คืนแล้ว'));
    };
  });
  $('addAcct').onclick = () => { const v = $('newAcct').value.trim(); if (!v) { $('newAcct').focus(); return; }
    ST.accounts.push({ k: 'acct:a' + Date.now(), n: v }); saved(tl('Account added', 'เพิ่มบัญชีแล้ว')); };
  // cards
  const today = ST.today;
  $('cardEd').innerHTML = ST.cards.map((c, i) => {
    const cur = c.sched.filter(x => x.since <= today).at(-1) || c.sched[0], next = c.sched.find(x => x.since > today), owe = bal[c.k] || 0;
    return `<div class="ed ${c.arch ? 'arch' : ''}" style="flex-wrap:wrap;row-gap:6px"><input class="name" id="kn${i}" value="${esc(acct(c.k))}" ${c.arch ? 'disabled' : ''} aria-label="${tl('Card name', 'ชื่อบัตร')}">
      <span class="num" style="font-size:13px;color:var(--ink-2)">${owe ? '−' + fm(owe) : ''}</span><button class="act" id="ka${i}">${c.arch ? tl('Restore', 'คืน') : tl('Remove', 'ลบ')}</button>
      ${c.arch ? '' : `<div class="daygrid" style="flex-basis:100%"><label>${tl('Closes day', 'สรุปยอดวันที่')}<input class="field" id="kc${i}" type="number" inputmode="numeric" min="1" max="28" value="${(next || cur).close}"></label><label>${tl('Due day', 'ครบกำหนดวันที่')}<input class="field" id="kd${i}" type="number" inputmode="numeric" min="1" max="28" value="${(next || cur).due}"></label>
        <label style="grid-column:1/-1">${tl('Paid from', 'จ่ายจาก')}<select class="sel" id="kf${i}">${opts(withCur(liveAccts(), c.from), c.from)}</select></label></div>
        ${next ? `<span class="hint" style="flex-basis:100%;font-size:13px">${tl(`New days start ${dly(next.since)} (now day ${cur.close}, due ${cur.due})`, `วันใหม่เริ่ม ${dly(next.since)} (ตอนนี้วันที่ ${cur.close} ครบกำหนด ${cur.due})`)}</span>` : ''}`}
      <span class="warn" id="kw${i}" hidden></span></div>`; }).join('') +
    `<div class="addrow"><input id="newCard" placeholder="${tl('New card', 'บัตรใหม่')}" aria-label="${tl('New card', 'บัตรใหม่')}"><button id="addCard">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.cards.forEach((c, i) => {
    const n = $('kn' + i); if (n) n.onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = acct(c.k); return; } c.n = v; saved(); };
    $('ka' + i).onclick = () => { const owe = bal[c.k] || 0;
      if (!c.arch && owe !== 0) { const w = $('kw' + i); w.textContent = tl(`Pay off the ฿${fm(owe)} first`, `จ่ายยอด ฿${fm(owe)} ให้หมดก่อน`); w.hidden = false; return; }
      c.arch = !c.arch; saved(c.arch ? tl('Removed. History kept.', 'ลบแล้ว ประวัติยังอยู่') : tl('Restored', 'คืนแล้ว')); };
    if (c.arch) return;
    const days = () => {
      const cl = +$('kc' + i).value, du = +$('kd' + i).value;
      if (!dayOk(cl) || !dayOk(du)) { toast(tl('Days must be 1 to 28', 'วันต้องอยู่ระหว่าง 1 ถึง 28')); renderSet(); return; }
      const used = ST.entries.some(e => e.from === c.k || e.to === c.k) || ST.opening[c.k] || Object.keys(ST.openingStatements || {}).some(k => k.startsWith(c.k + '@') || (c.k === 'CARD' && !k.includes('@')));
      if (!used) { c.sched = [{ since: '0000-01-01', close: cl, due: du }]; saved(); return; } // nothing recorded yet: apply straight away
      const since = C.changeCardDates(c, today, cl, du);
      saved(tl(`Saved. Starts ${dly(since)}; earlier statements stay as they were.`, `บันทึกแล้ว เริ่ม ${dly(since)} บิลก่อนหน้าไม่เปลี่ยน`));
    };
    $('kc' + i).onchange = days; $('kd' + i).onchange = days;
    $('kf' + i).onchange = ev => { c.from = ev.target.value; saved(); };
  });
  $('addCard').onclick = () => { const v = $('newCard').value.trim(); if (!v) { $('newCard').focus(); return; }
    ST.cards.push({ k: 'card:c' + Date.now(), n: v, from: ST.spendTo, start: ST.today, sched: [{ since: '0000-01-01', close: 17, due: 2 }] }); saved(tl('Card added. Set its days below.', 'เพิ่มบัตรแล้ว ตั้งวันสรุปยอดด้านล่าง')); };
  // monthly bills
  ST.bills = ST.bills || [];
  $('billEd').innerHTML = ST.bills.map((b, i) => `<div class="ed" style="flex-wrap:wrap;row-gap:6px"><input class="name" id="bn${i}" value="${esc(billName(b))}" aria-label="${tl('Bill name', 'ชื่อรายการ')}">
    <input class="field" id="ba${i}" type="number" min="0" step="0.01" value="${b.amount / 100}" aria-label="${tl('Amount', 'ยอด')}"><button class="act" id="bx${i}">${tl('Remove', 'ลบ')}</button>
    <span class="lnsub" style="flex-basis:100%">${tl('Paid from', 'จ่ายจาก')} <select class="sel" id="bf${i}">${opts(billSources(b.from), b.from)}</select></span></div>`).join('') +
    `<div class="addrow"><input id="newBill" placeholder="${tl('New bill, e.g. Rent', 'รายการใหม่ เช่น ค่าหอ')}" aria-label="${tl('New bill', 'รายการใหม่')}"><button id="addBill">${tl('Add', 'เพิ่ม')}</button></div>`;
  ST.bills.forEach((b, i) => {
    $('bn' + i).onchange = ev => { const v = ev.target.value.trim(); if (!v) { ev.target.value = billName(b); return; } b.n = v; saved(); };
    $('ba' + i).onchange = ev => { const v = C.toSatang(ev.target.value); if (!(v > 0)) { toast(tl('Enter an amount above 0', 'ใส่ยอดมากกว่า 0')); renderSet(); return; } b.amount = v; saved(); };
    $('bf' + i).onchange = ev => { b.from = ev.target.value; saved(); };
    $('bx' + i).onclick = ev => { const el = ev.currentTarget; if (!el.dataset.armed) { el.dataset.armed = 1; el.textContent = tl('Tap again', 'แตะอีกครั้ง'); return; }
      ST.bills.splice(i, 1); saved(tl('Bill removed. Past entries stay.', 'ลบแล้ว รายการที่จดไว้ยังอยู่')); };
  });
  $('addBill').onclick = () => { const v = $('newBill').value.trim(); if (!v) { $('newBill').focus(); return; }
    ST.bills.push({ id: 'b' + Date.now(), n: v, amount: 0, from: ST.spendTo, cat: catFor(v) }); persist(); renderSet();
    const i = ST.bills.length - 1; $('ba' + i).value = ''; $('ba' + i).focus(); toast(tl('Now enter the amount', 'ใส่ยอดต่อเดือน')); };
  // starting balances: what each account, pocket and card held before the first entry
  const field = (id, v) => `<input class="field" id="${id}" type="number" inputmode="decimal" step="0.01" min="0" value="${(v / 100).toFixed(2)}">`;
  const live = [...liveAccts().map(k => [k, acct(k)]), ...ST.pots.filter(p => !p.arch).map(p => ['pot:' + p.id, pn(p)])];
  $('openEd').innerHTML = live.map(([k, n], i) => `<div class="ed"><span style="flex:1">${esc(n)}</span>${field('oa' + i, (ST.opening || {})[k] || 0)}</div>`).join('') +
    liveCards().map((k, i) => { const o = C.cardOpening(ST, k), st = C.cardStatementOf(ST, k, C.cardStart(ST, k)).close;
      return `<div class="ed" style="flex-wrap:wrap"><span style="flex-basis:100%;font-weight:600">${esc(acct(k))}</span>
        <span style="flex:1;font-size:13px;color:var(--ink-2)">${tl('Bill already closed, unpaid', 'บิลที่สรุปแล้วยังไม่จ่าย')}</span>${field('ob' + i, o.billed)}
        <span style="flex-basis:100%;height:0"></span><span style="flex:1;font-size:13px;color:var(--ink-2)">${tl(`Spent since then (bills ${dl(st)})`, `รูดหลังจากนั้น (รอบ ${dl(st)})`)}</span>${field('ou' + i, o.unbilled)}</div>`; }).join('');
  // apply a change only if nothing would end up below zero today
  const tryOpening = (change, input) => {
    const copy = JSON.parse(JSON.stringify(ST)); change(copy);
    const b = C.balances(copy, { asOf: ST.today }), bad = Object.entries(b).find(([k, v]) => v < 0 && (C.isAsset(k) || C.isCard(k)));
    if (bad) { toast(tl(`That would make ${acct(bad[0])} go below zero (${fm(bad[1])}). Check the number.`, `ทำให้ ${acct(bad[0])} ติดลบ (${fm(bad[1])}) ตรวจตัวเลขอีกครั้ง`)); renderSet(); return; }
    change(ST); saved(tl('Starting balance saved. Everything is recalculated.', 'บันทึกยอดตอนเริ่มแล้ว คำนวณใหม่ทั้งหมด'));
  };
  const val = id => { const v = C.toSatang($(id).value || 0); return Number.isNaN(v) || v < 0 ? null : v; };
  live.forEach(([k], i) => $('oa' + i).onchange = () => { const v = val('oa' + i); if (v == null) { toast(tl('Enter 0 or more', 'ใส่ 0 ขึ้นไป')); renderSet(); return; }
    tryOpening(s => { s.opening = s.opening || {}; if (v) s.opening[k] = v; else delete s.opening[k]; }); });
  liveCards().forEach((k, i) => { const go2 = () => { const b = val('ob' + i), u = val('ou' + i); if (b == null || u == null) { toast(tl('Enter 0 or more', 'ใส่ 0 ขึ้นไป')); renderSet(); return; }
    tryOpening(s => C.setCardOpening(s, k, b, u)); }; $('ob' + i).onchange = go2; $('ou' + i).onchange = go2; });
  // Cash flow floor
  $('cfFloorIn').value = ST.cfFloor ? (ST.cfFloor / 100).toFixed(2) : '';
  $('cfFloorIn').onchange = ev => { const v = ev.target.value.trim() === '' ? 0 : C.toSatang(ev.target.value); if (Number.isNaN(v) || v < 0) { toast(tl('Enter 0 or more', 'ใส่ 0 ขึ้นไป')); renderSet(); return; } ST.cfFloor = v; saved(); };
  // salary
  $('salaryTo').innerHTML = opts(withCur(liveAccts(), ST.salaryTo), ST.salaryTo); $('spendTo').innerHTML = opts(withCur(liveAccts(), ST.spendTo), ST.spendTo);
  $('salaryTo').onchange = ev => { ST.salaryTo = ev.target.value; saved(); };
  $('spendTo').onchange = ev => { ST.spendTo = ev.target.value; saved(); };
}
// a category for a new bill: reuse one with the same name, else make one
function catFor(name) {
  const lc = name.toLowerCase(), hit = ST.cats.find(c => c.en.toLowerCase() === lc || c.th.toLowerCase() === lc);
  if (hit) { hit.arch = false; return hit.id; }
  const id = 'c' + Date.now() + Math.floor(Math.random() * 1000); ST.cats.push({ id, en: name, th: name, b: 0 }); return id;
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
const prevMonth = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 2, dd)).toISOString().slice(0, 10); };
let SU = null; // the setup form while it is being filled in
function freshSetup() {
  return {
    step: 1,
    accts: [{ k: 'SCB', n: 'SCB', bal: '' }, { k: 'CASH', n: '', bal: '' }], // blank name = follows the language
    pots: ST.pots.filter(p => !p.arch).map(p => ({ id: p.id, name: pn(p), bal: '', monthly: '', goal: '', by: '', repeat: false })),
    cards: [{ k: 'CARD', n: '', close: '17', due: '2', from: 'SCB', billed: '', unbilled: '' }],
    bills: [], // the owner names each bill; a bill named like a category takes that category off this list
    cats: ST.cats.filter(c => !c.arch).map(c => ({ id: c.id, name: L === 'th' ? c.th : c.en, b: c.b ? String(c.b / 100) : '' })),
    make: '',
    salaryTo: 'SCB', spendTo: 'SCB', salary: ST.salary ? String(ST.salary / 100) : '', payday: '28',
  };
}
function readSetup() {
  document.querySelectorAll('[data-su]').forEach(i => { const [list, idx, f] = i.dataset.su.split('.'); SU[list][+idx][f] = i.type === 'checkbox' ? i.checked : i.value; });
  SU.salaryTo = $('setupSalaryTo').value || SU.salaryTo; SU.spendTo = $('setupSpendTo').value || SU.spendTo; SU.salary = $('setupSalary').value; SU.payday = $('setupPayday').value; SU.make = $('setupMake').value;
}
const suName = a => a.n.trim() || acct(a.k);
// statements for a card with these days, as of today: the one that closed last and the one open now
function setupStatements(c) {
  const d = { close: +c.close, due: +c.due };
  if (!dayOk(d.close) || !dayOk(d.due)) return null;
  const open = C.statementOf(ST.today, d), last = prevMonth(open.close);
  return { open: open.close, openDue: open.due, last, lastDue: C.statementOf(last, d).due };
}
// a pocket's goal fields show when asked for, or when they already hold a value
const potOpen = p => p.open !== undefined ? !!p.open : !!(String(p.goal || '').trim() || p.by || p.repeat);
// the status line under a pocket's per-month input: goal progress, or what it takes to make the month
function setupPotStatus(p) {
  const g = sat0(p.goal) || 0, m = sat0(p.monthly) || 0, bal = sat0(p.bal) || 0;
  if (!(g >= 0 && m >= 0 && bal >= 0)) return tl('Amounts must be 0 or more', 'ยอดต้องเป็น 0 ขึ้นไป');
  return potLine({ goal: g, by: p.by || '', repeat: !!p.repeat, ...(m ? { monthly: m } : {}) }, bal, nextPay());
}
function renderSetup() {
  if (!SU) SU = freshSetup();
  // a bill and a spending category with the same name would budget the same money twice: the bill wins
  const billNames = new Set(SU.bills.map(b => b.n.trim().toLowerCase()).filter(Boolean));
  SU.cats = SU.cats.filter(c => !billNames.has(c.name.trim().toLowerCase()));
  $('setupStep1').hidden = $('setupNav1').hidden = SU.step !== 1; $('setupStep2').hidden = $('setupNav2').hidden = SU.step !== 2;
  $('setupTitle').textContent = SU.step === 1 ? tl('Where your money is today', 'เงินอยู่ที่ไหนวันนี้') : tl("This cycle's plan", 'แผนรอบ');
  $('setupLead').textContent = SU.step === 1 ? tl("Copy today's balances from your bank apps. Leave blank for 0.", 'ดูยอดวันนี้จากแอปธนาคาร ช่องที่ไม่มีเว้นว่างได้') : tl('Split your salary until nothing is left to assign.', 'แบ่งเงินเดือนลงแต่ละส่วนจนเหลือ 0');
  $('setupStepLbl').textContent = tl(`Step ${SU.step} of 2`, `ขั้น ${SU.step} จาก 2`);
  const num = (list, i, f, v, ph = '0', w = '') => `<input class="field${w}" type="number" inputmode="decimal" step="0.01" min="0" data-su="${list}.${i}.${f}" value="${esc(v)}" placeholder="${ph}">`;
  const txt = (list, i, f, v, ph = '') => `<input class="note" style="flex:1;min-width:0;padding:7px 10px" data-su="${list}.${i}.${f}" value="${esc(v)}" placeholder="${esc(ph)}">`;
  const del = (list, i) => `<button type="button" class="xbtn" data-del="${list}.${i}" aria-label="${tl('Remove', 'ลบ')}">×</button>`;
  const acctKeys = SU.accts.map(a => a.k);
  const sel = (list, i, f, keys, cur, names) => `<select class="sel" data-su="${list}.${i}.${f}">${keys.map(k => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(names(k))}</option>`).join('')}</select>`;
  const aName = k => { const a = SU.accts.find(x => x.k === k); return !a ? acct(k) : C.isAcct(k) && !a.n.trim() ? tl('New account (no name yet)', 'บัญชีใหม่ (ยังไม่ตั้งชื่อ)') : suName(a); };
  const cardish = n => /\b(ktc|visa|master|amex|jcb|uob|citi|card)\b|บัตร|เครดิต|first ?choice/i.test(n || '');
  $('setupAccts').innerHTML = SU.accts.map((a, i) => `<div class="ln" style="gap:6px;flex-wrap:wrap">${txt('accts', i, 'n', a.n, a.k === 'CASH' ? tl('Cash in wallet', 'เงินสดในกระเป๋า') : tl('Account name', 'ชื่อบัญชี'))}${num('accts', i, 'bal', a.bal, '0', '" style="width:96px')}${del('accts', i)}
    ${cardish(a.n) ? `<span class="warnline">${tl('Is this a credit card? Put cards under Credit cards below, or money you owe will count as money you have.', 'นี่คือบัตรเครดิตหรือเปล่า? ถ้าใช่ ให้ใส่ในส่วนบัตรเครดิตด้านล่าง ไม่งั้นแอปจะนับยอดค้างบัตรเป็นเงินที่มี')}</span>` : ''}</div>`).join('');
  $('setupSalaryTo').innerHTML = acctKeys.map(k => `<option value="${esc(k)}" ${k === SU.salaryTo ? 'selected' : ''}>${esc(aName(k))}</option>`).join('');
  $('setupSpendTo').innerHTML = acctKeys.map(k => `<option value="${esc(k)}" ${k === SU.spendTo ? 'selected' : ''}>${esc(aName(k))}</option>`).join('');
  $('setupSalary').value = SU.salary; $('setupPayday').value = SU.payday; $('setupMake').value = SU.make;
  $('setupPotPlan').innerHTML = SU.pots.map((p, i) => { if (p.id === 'cashflow') return '';
    const open = potOpen(p), nm = esc(p.name.trim() || tl('Pocket (no name yet)', 'กอง (ยังไม่ตั้งชื่อ)'));
    return `<div class="ln" style="flex-wrap:wrap;gap:6px"><span class="k">${nm}</span>${num('pots', i, 'monthly', p.monthly, '0', '" style="width:110px" aria-label="' + nm)}
    <div class="pgoal" style="padding-left:0"><span class="pline" data-pst="${i}">${esc(setupPotStatus(p))}</span>
      <button type="button" class="btn link" style="grid-column:1/-1;justify-self:start;padding:6px 0" data-open="${i}" aria-expanded="${open}">${open ? tl('Hide goal', 'ซ่อนเป้า') : tl('Goal', 'เป้า')}</button>${open ? `
      <label>${tl('Goal ฿', 'เป้า ฿')}<input class="field" type="number" inputmode="decimal" step="0.01" min="0" data-su="pots.${i}.goal" data-redraw="1" value="${esc(p.goal)}" placeholder="${tl('none', 'ไม่มี')}"></label>
      <label>${tl('Reach by', 'ครบภายใน')}<input class="field" type="month" data-su="pots.${i}.by" data-redraw="1" value="${esc(p.by)}"></label>
      <label class="rep"><input type="checkbox" data-su="pots.${i}.repeat" data-redraw="1" ${p.repeat ? 'checked' : ''}> ${tl('Same goal every year', 'เป้าวนทุกปี')}</label>` : ''}
    </div></div>`; }).join('') || `<div class="ln"><span class="k">${tl('No pockets yet', 'ยังไม่มีกอง')}</span></div>`;
  $('setupCats').innerHTML = SU.cats.map((c, i) => `<div class="ln"><span class="k">${esc(c.name)}</span>${num('cats', i, 'b', c.b)}</div>`).join('');
  $('setupPots').innerHTML = SU.pots.map((p, i) => { const cf = p.id === 'cashflow';
    return `<div class="ln" style="flex-wrap:wrap;gap:6px"><input class="note" style="flex:1;min-width:0;padding:7px 10px" data-su="pots.${i}.name" value="${esc(p.name)}" placeholder="${tl('Pocket name', 'ชื่อกอง')}" aria-label="${tl('Pocket name', 'ชื่อกอง')}" ${cf ? 'readonly' : ''}>${num('pots', i, 'bal', p.bal, '0', '" style="width:96px')}${cf ? '' : del('pots', i)}
    ${cf ? `<span class="pline" style="flex-basis:100%;font-size:13px;color:var(--ink-2)">${tl('Holds what is left (or covers what is short) at the end of each cycle. The app uses it, so it has no goal and cannot be renamed.', 'กองพักเงินเหลือ/ขาดตอนจบแต่ละรอบ แอปใช้เอง จึงไม่มีเป้าและเปลี่ยนชื่อไม่ได้')}</span>` : ''}</div>`; }).join('');
  $('setupCards').innerHTML = SU.cards.map((c, i) => { const st = setupStatements(c);
    return `<div class="ledger">
    <div class="ln" style="gap:6px">${txt('cards', i, 'n', c.n, tl('Card name, e.g. SCB card', 'ชื่อบัตร เช่น บัตร SCB'))}${del('cards', i)}</div>
    <div class="ln"><div class="daygrid"><label>${tl('Closes day', 'สรุปยอดวันที่')}<input class="field" type="number" inputmode="numeric" min="1" max="28" data-su="cards.${i}.close" data-redraw="1" value="${esc(c.close)}"></label>
      <label>${tl('Due day', 'ครบกำหนดวันที่')}<input class="field" type="number" inputmode="numeric" min="1" max="28" data-su="cards.${i}.due" data-redraw="1" value="${esc(c.due)}"></label></div></div>
    <div class="ln"><span class="k">${tl('Paid from', 'จ่ายจาก')}</span>${sel('cards', i, 'from', acctKeys, c.from, aName)}</div>
    ${st ? `<div class="ln"><span class="k">${tl('Billed, not paid yet', 'บิลที่สรุปแล้ว ยังไม่จ่าย')}<small>${tl(`closed ${dl(st.last)} · due ${dl(st.lastDue)}`, `สรุป ${dl(st.last)} · ครบกำหนด ${dl(st.lastDue)}`)}${st.lastDue < ST.today ? tl(' · already due: put 0 if you paid it', ' · เลยกำหนดแล้ว ถ้าจ่ายแล้วใส่ 0') : ''}</small></span>${num('cards', i, 'billed', c.billed)}</div>
    <div class="ln"><span class="k">${tl('Spent, not billed yet', 'ยอดรูดที่ยังไม่ออกบิล')}<small>${st.open === ST.today ? tl(`today is closing day: count today's new bill here, it becomes a bill tomorrow`, `วันนี้เป็นวันสรุปยอด: บิลที่เพิ่งออกวันนี้ใส่ช่องนี้ พรุ่งนี้แอปย้ายเป็นบิลให้เอง`) : tl(`will close ${dl(st.open)} · due ${dl(st.openDue)}`, `จะสรุป ${dl(st.open)} · ครบกำหนด ${dl(st.openDue)}`)}</small></span>${num('cards', i, 'unbilled', c.unbilled)}</div>`
      : `<div class="ln"><span class="k" style="color:var(--debit)">${tl('Days must be 1 to 28', 'วันต้องอยู่ระหว่าง 1 ถึง 28')}</span></div>`}</div>`; }).join('');
  const billFrom = [...acctKeys, ...SU.cards.map(c => c.k)];
  const bfName = k => C.isPot(k) ? (SU.pots.find(p => 'pot:' + p.id === k) || {}).name || '' : C.isCard(k) ? (SU.cards.find(c => c.k === k) || {}).n || acct(k) : aName(k);
  $('setupBills').innerHTML = SU.bills.map((b, i) => `<div class="ln brow">${txt('bills', i, 'n', b.n, tl('Bill name', 'ชื่อรายการ'))}${num('bills', i, 'amount', b.amount, '0', '" style="width:84px')}${del('bills', i)}
    <span class="bfrom">${tl('from', 'จ่ายจาก')} ${sel('bills', i, 'from', billFrom, b.from, bfName)}</span></div>`).join('');
  document.querySelectorAll('#s-setup [data-open]').forEach(b => b.onclick = () => { readSetup(); const q = SU.pots[+b.dataset.open]; q.open = !potOpen(q); renderSetup(); });
  // wiring: any edit is read back into SU; a few need a redraw (names feed the dropdowns, days feed the card labels)
  const isPicker = i => i.type === 'month' || i.type === 'date';
  document.querySelectorAll('#s-setup [data-su]').forEach(i => {
    i.onchange = () => { readSetup(); if (isPicker(i)) return; if (i.dataset.redraw || i.dataset.su.endsWith('.n') || i.dataset.su.endsWith('.name')) renderSetup(); };
    if (isPicker(i)) i.onblur = () => { readSetup(); renderSetup(); };
  });
  document.querySelectorAll('#s-setup [data-su], #setupMake, #setupSalary').forEach(i => { i.oninput = setupLive; });
  $('setupMake').onchange = setupLive;
  setupLive();
  document.querySelectorAll('#s-setup [data-del]').forEach(b => b.onclick = () => { readSetup(); const [list, i] = b.dataset.del.split('.');
    if (list === 'accts' && SU.accts.length <= 1) { toast(tl('Keep at least one account', 'ต้องมีอย่างน้อยหนึ่งบัญชี')); return; }
    const gone = SU[list].splice(+i, 1)[0];
    const fix = k => (k === gone.k ? SU.accts[0].k : k);
    if (list === 'accts') { SU.salaryTo = fix(SU.salaryTo); SU.spendTo = fix(SU.spendTo); SU.cards.forEach(c => { c.from = fix(c.from); }); }
    if (list === 'accts' || list === 'cards') SU.bills.forEach(x => { if (x.from === gone.k) x.from = SU.accts[0].k; });
    renderSetup(); });
  $('addSetupAcct').onclick = () => { readSetup(); SU.accts.push({ k: 'acct:a' + Date.now(), n: '', bal: '' }); renderSetup(); document.querySelector(`[data-su="accts.${SU.accts.length - 1}.n"]`).focus(); };
  $('addSetupPot').onclick = () => { readSetup(); SU.pots.push({ id: 'p' + Date.now(), name: '', bal: '', monthly: '', goal: '', by: '', repeat: false }); renderSetup(); document.querySelector(`[data-su="pots.${SU.pots.length - 1}.name"]`).focus(); };
  $('addSetupCard').onclick = () => { readSetup(); SU.cards.push({ k: SU.cards.some(c => c.k === 'CARD') ? 'card:c' + Date.now() : 'CARD', n: '', close: '17', due: '2', from: SU.spendTo, billed: '', unbilled: '' }); renderSetup(); };
  $('addSetupBill').onclick = () => { readSetup(); SU.bills.push({ n: '', amount: '', from: SU.spendTo }); renderSetup(); document.querySelector(`[data-su="bills.${SU.bills.length - 1}.n"]`).focus(); };
}
// live numbers on the first-run page: MAKE total still to split across pockets, and the plan's left to assign
const sat0 = v => (String(v ?? '').trim() === '' ? 0 : C.toSatang(v));
const pos = v => { const x = sat0(v); return x >= 0 ? x : 0; };
function setupNumbers() {
  const unsplit = pos(SU.make) - SU.pots.reduce((s, p) => s + pos(p.bal), 0);
  const potSum = SU.pots.reduce((s, p) => s + (p.id === 'cashflow' ? 0 : pos(p.monthly)), 0);
  const billSum = SU.bills.reduce((s, b) => s + pos(b.amount), 0), catSum = SU.cats.reduce((s, c) => s + pos(c.b), 0);
  return { unsplit, potSum, billSum, catSum, left: pos(SU.salary) - potSum - billSum - catSum };
}
function setupLive() {
  readSetup(); const n = setupNumbers(), u = $('setupUnsplit');
  u.className = 'unsplit' + (n.unsplit === 0 ? ' ok' : '');
  u.innerHTML = n.unsplit === 0 ? `<span>${tl('MAKE total is fully split', 'แบ่งยอด MAKE ครบแล้ว')}</span><b>฿0</b>`
    : n.unsplit > 0 ? `<span>${tl('Not split into pockets yet', 'ยังไม่ได้แบ่ง')}</span><b>฿${fm(n.unsplit)}</b>`
    : `<span>${tl('Pockets add up to more than the total', 'กองรวมเกินยอดรวม')}</span><b>฿${fm(-n.unsplit)}</b>`;
  $('nextBtn').disabled = n.unsplit !== 0;
  $('setupAssign').className = 'assign' + (n.left === 0 ? ' ok' : ''); $('setupAssign').innerHTML = assignHTML(n.left);
  document.querySelectorAll('#s-setup [data-pst]').forEach(e => { const p = SU.pots[+e.dataset.pst]; if (p) e.textContent = setupPotStatus(p); });
  $('setupPotSum').textContent = '฿' + fm0(n.potSum); $('setupBillSum').textContent = '฿' + fm0(n.billSum); $('setupCatSum').textContent = '฿' + fm0(n.catSum);
}
// what step 1 asks for, checked before moving on ('' when fine); the account filter matches Start's
const keepAcct = a => !(C.isAcct(a.k) && !a.n.trim() && !String(a.bal ?? '').trim() && a.k !== SU.salaryTo && a.k !== SU.spendTo);
function step1Error() {
  readSetup();
  const kept = SU.accts.filter(keepAcct), names = kept.map(a => suName(a).toLowerCase());
  const pots = SU.pots.map(p => ({ name: p.name.trim(), any: sat0(p.bal) || sat0(p.monthly) || sat0(p.goal) })).filter(p => p.name || p.any);
  const cards = SU.cards.map(c => ({ n: c.n.trim(), close: +c.close, due: +c.due }));
  const nums = [...SU.accts.map(a => a.bal), ...SU.pots.map(p => p.bal), ...SU.cards.flatMap(c => [c.billed, c.unbilled]), SU.make].map(sat0);
  if (nums.some(v => Number.isNaN(v) || v < 0)) return tl('Amounts must be numbers of 0 or more.', 'ยอดต้องเป็นตัวเลข 0 ขึ้นไป');
  if (setupNumbers().unsplit !== 0) return tl('Split the MAKE total across pockets until nothing is left.', 'แบ่งยอดรวม MAKE ลงกองให้ครบก่อน');
  if (kept.some(a => C.isAcct(a.k) && !a.n.trim())) return tl('Every account you added needs a name.', 'บัญชีที่เพิ่มต้องมีชื่อ');
  if (new Set(names).size !== names.length) return tl('Two accounts have the same name.', 'มีบัญชีชื่อซ้ำกัน');
  if (pots.some(p => !p.name)) return tl('Every pocket needs a name.', 'ทุกกองต้องมีชื่อ');
  if (new Set(pots.map(p => p.name.toLowerCase())).size !== pots.length) return tl('Two pockets have the same name.', 'มีกองชื่อซ้ำกัน');
  if (cards.some(c => !dayOk(c.close) || !dayOk(c.due))) return tl('Card days must be 1 to 28.', 'วันของบัตรต้องอยู่ระหว่าง 1 ถึง 28');
  if (cards.some(c => !c.n)) return tl('Give each card a name, e.g. KTC.', 'ตั้งชื่อบัตร เช่น KTC');
  if (new Set(cards.map(c => c.n.toLowerCase())).size !== cards.length) return tl('Give each card its own name.', 'ตั้งชื่อบัตรแต่ละใบให้ไม่ซ้ำกัน');
  return '';
}
$('nextBtn') && ($('nextBtn').onclick = () => {
  const e = step1Error(); $('setupMsg').textContent = e; if (e) return;
  SU.step = 2; renderSetup(); window.scrollTo(0, 0);
});
$('backBtn') && ($('backBtn').onclick = () => { readSetup(); $('setupMsg').textContent = ''; SU.step = 1; renderSetup(); window.scrollTo(0, 0); });
$('startBtn') && ($('startBtn').onclick = () => {
  readSetup();
  SU.accts = SU.accts.filter(keepAcct);
  const msg = m => { $('setupMsg').textContent = m; };
  const sat = v => (String(v ?? '').trim() === '' ? 0 : C.toSatang(v));
  const accts = SU.accts.map(a => ({ k: a.k, n: suName(a), balS: sat(a.bal) }));
  const pots = SU.pots.map(p => ({ ...p, name: p.name.trim(), balS: sat(p.bal), monS: sat(p.monthly), goalS: sat(p.goal) })).filter(p => p.name || p.balS || p.monS || p.goalS);
  const cards = SU.cards.map(c => ({ ...c, n: c.n.trim(), close: +c.close, due: +c.due, billedS: sat(c.billed), unbilledS: sat(c.unbilled) }));
  const bills = SU.bills.map(b => ({ ...b, n: b.n.trim(), amountS: sat(b.amount) })).filter(b => b.amountS);
  const salary = sat(SU.salary), pday = +SU.payday, catB = SU.cats.map(c => sat(c.b));
  const e1 = step1Error(); if (e1) { SU.step = 1; renderSetup(); window.scrollTo(0, 0); return msg(e1); }
  if (!(Number.isInteger(pday) && pday >= 1 && pday <= 31)) return msg(tl('Cycle start must be a day from 1 to 31.', 'วันเริ่มรอบต้องอยู่ระหว่าง 1 ถึง 31'));
  const all = [salary, ...accts.map(a => a.balS), ...pots.flatMap(p => [p.balS, p.monS, p.goalS]), ...cards.flatMap(c => [c.billedS, c.unbilledS]), ...bills.map(b => b.amountS), ...catB, sat(SU.make)];
  if (all.some(v => Number.isNaN(v) || v < 0)) return msg(tl('Amounts must be numbers of 0 or more.', 'ยอดต้องเป็นตัวเลข 0 ขึ้นไป'));
  if (!(salary > 0)) return msg(tl('Enter your monthly salary.', 'ใส่เงินเดือน'));
  if (bills.some(b => !b.n)) return msg(tl('Every bill with an amount needs a name.', 'รายการที่มียอดต้องมีชื่อ'));
  if (!pots.some(p => p.id === 'cashflow')) pots.unshift({ id: 'cashflow', name: 'Cash flow', balS: 0, monS: 0 });
  const potKeys = pots.map(p => 'pot:' + p.id), acctKeys = accts.map(a => a.k), cardKeys = cards.map(c => c.k);
  if (bills.some(b => ![...acctKeys, ...cardKeys, ...potKeys].includes(b.from))) return msg(tl('A bill is paid from something that was removed. Pick again.', 'มีรายการที่เลือกที่จ่ายซึ่งถูกลบไปแล้ว เลือกใหม่'));
  ST.pots = pots.map(p => ({ id: p.id || 'p' + Date.now() + Math.random().toString(36).slice(2, 6), n: p.name, th: p.name, ...(p.monS ? { monthly: p.monS } : {}), ...(p.goalS ? { goal: p.goalS } : {}), ...(p.by ? { by: p.by } : {}), ...(p.repeat ? { repeat: true } : {}) }));
  // a built-in account left unnamed keeps following the language (Cash / เงินสด)
  ST.accounts = SU.accts.map(a => ({ k: a.k, n: a.n.trim() }));
  ST.cards = cards.map(c => ({ k: c.k, n: c.n, from: c.from, start: ST.today, sched: [{ since: '0000-01-01', close: c.close, due: c.due }] }));
  ST.salaryTo = SU.salaryTo; ST.spendTo = SU.spendTo; ST.salary = salary; ST.helpRate = 0;
  ST.bills = bills.map((b, i) => ({ id: 'b' + i, n: b.n, amount: b.amountS, from: b.from, cat: catFor(b.n) }));
  const o = {}, os = {};
  accts.forEach(a => { if (a.balS) o[a.k] = a.balS; });
  pots.forEach(p => { if (p.balS) o['pot:' + p.id] = p.balS; });
  cards.forEach(c => {
    const st = setupStatements(c), key = d => (c.k === 'CARD' ? d : c.k + '@' + d);
    if (c.billedS) os[key(st.last)] = c.billedS;
    if (c.unbilledS) os[key(st.open)] = c.unbilledS;
    if (c.billedS + c.unbilledS) o[c.k] = c.billedS + c.unbilledS;
  });
  const billSum = bills.reduce((t, b) => t + b.amountS, 0);
  if (billSum > salary && SU.okBills !== billSum) { SU.okBills = billSum; return msg(tl(`Monthly bills add up to ฿${fm(billSum)}, more than your salary ฿${fm(salary)}. Check for a typo, then tap Start again.`, `รายจ่ายประจำรวม ฿${fm(billSum)} มากกว่าเงินเดือน ฿${fm(salary)} ตรวจว่าพิมพ์ผิดไหม ถ้าถูกแล้วกดเริ่มใช้งานอีกครั้ง`)); }
  SU.cats.forEach((c, i) => { const x = ST.cats.find(k => k.id === c.id); if (x) x.b = catB[i]; });
  ST.payday = pday === 28 ? [] : [{ since: '0000-01-01', day: pday }];
  Object.assign(ST, { opening: o, openingStatements: os, setupDone: true, startDate: ST.today, sample: false });
  SU = null; persist(); toast(tl('All set. Record your first entry with +', 'พร้อมแล้ว กด + เพื่อจดรายการแรก')); go('home'); let seen = false; try { seen = !!localStorage.getItem('toured'); } catch (e) {} if (!seen) showTour(0);
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
function render(s = cur) { cur = s; applyText(); ({ home, wallet, add: renderAdd, plan: renderPlan, sum: renderSum, set: renderSet, hist: renderHist, setup: renderSetup })[s](); }
function go(s) {
  ['home', 'wallet', 'sum', 'add', 'plan', 'set', 'hist', 'setup'].forEach(x => $('s-' + x).hidden = x !== s);
  document.querySelector('nav.bar').hidden = s === 'setup';
  document.querySelectorAll('nav.bar button').forEach(b => b.dataset.go === (s === 'sum' ? 'hist' : s === 'plan' ? 'wallet' : s) ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (s !== 'add' && F.editingId) F = blankForm();
  if (s !== 'add') { F.full = false; F.qcat = ''; if (!F.editingId) F.amount = ''; $('qSheet').hidden = true; closeDetails(); }
  $('helpSheet').hidden = true;
  if (s === 'set') closeSub();
  markHs(s);
  document.body.classList.toggle('on-add', s === 'add');
  // a red dot on Wallet while any account is below zero
  { const b = C.balances(ST, { asOf: ST.today }), bad = (ST.setupDone && liveAccts().some(k => (b[k] || 0) < 0));
    const w = document.querySelector('nav.bar [data-go="wallet"]'); let d = w.querySelector('.dot'); if (bad && !d) { d = document.createElement('i'); d.className = 'dot'; w.append(d); } if (!bad && d) d.remove(); }
  render(s); scrollTo(0, 0);
}
document.querySelectorAll('nav.bar button').forEach(b => b.onclick = () => go(b.dataset.go));
$('histBack').onclick = () => go('home');
$('lang2').onclick = () => $('lang').onclick();
$('lang').onclick = () => { L = L === 'en' ? 'th' : 'en'; try { localStorage.setItem('lang', L); } catch (e) {} render(); };
// swipe right from the left edge goes back, like iOS
{ let sx = null, sy = 0;
  addEventListener('touchstart', ev => { const t = ev.touches[0]; sx = t.clientX < 28 ? t.clientX : null; sy = t.clientY; }, { passive: true });
  addEventListener('touchend', ev => { if (sx === null) return; const t = ev.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy); sx = null;
    if (dx < 70 || dy > 60) return;
    if (cur === 'set' && $('s-set').classList.contains('sub')) { closeSub(); scrollTo(0, 0); }
    else if (cur === 'plan') go('wallet'); else if (cur === 'add' && F.editingId) { F = blankForm(); go('hist'); } else if (cur !== 'home' && cur !== 'setup') go('home'); }, { passive: true }); }
let tt;
function toast(m, withUndo = false) {
  const el = $('toast'); el.innerHTML = `<span>${esc(m)}</span>${withUndo && undoStack ? `<button id="undoBtn">${tl('Undo', 'ย้อนกลับ')}</button>` : ''}`; el.hidden = false;
  if (withUndo && undoStack) $('undoBtn').onclick = () => { const u = undoStack; undoStack = null; u(); persist(); el.hidden = true; render(); };
  clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, withUndo ? 5000 : 2200);
}
applyLook();
if (!ST.setupDone) go('setup'); else go('home');
window.Store.persistStorage();
window.__app = { get ST() { return ST; }, go, F: () => F, setF: f => { F = { ...blankForm(), full: true, ...f }; }, renderAdd, C,
  loadSample() { ST = migrate(sampleState()); ST.today = '2026-11-23'; F = blankForm(); persist(); go('home'); } };
})();
