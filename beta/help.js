// In-app guide: topics for the How-to page, the "?" buttons and the first-run tour.
// Plain text only; each paragraph is one string. Keep it in step with what the app really does.
window.HELP = {
  start: {
    th: ['เริ่มต้นใช้', [
      'กรอกยอดที่เห็นในแต่ละแอปวันนี้ (ธนาคาร, TrueMoney, เงินสด, บัตรเครดิต, กองใน MAKE) แอปจะเริ่มนับจากยอดนี้',
      'ไม่ต้องจดของที่จ่ายไปก่อนวันนี้ เพราะยอดที่กรอกหักไปแล้ว ถ้าอยากให้สรุปเดือนนี้ครบ จดย้อนหลังได้ แอปจะไม่หักเงินซ้ำ (ดูหัวข้อ "จดย้อนหลัง")',
      'ตั้งค่าทุกอย่างแก้ทีหลังได้ใน ตั้งค่า']],
    en: ['Getting started', [
      'Enter what each app shows today (banks, TrueMoney, cash, credit cards, MAKE pockets). The app counts from there.',
      'You do not need to record what you paid before today: those balances already include it. To make this month\'s summary complete, record it back-dated and nothing is taken twice (see "Back-dated entries").',
      'Everything can be changed later in Settings.']],
  },
  safe: {
    th: ['ยอด "ใช้ได้จริง" คืออะไร', [
      'เงินที่ใช้ได้จริงจนถึงวันเงินเดือนเข้า = เงินในบัญชีทุกบัญชี − ยอดค้างบัตรเครดิต − เงินที่กันไว้จ่ายบิลประจำ − เงินที่คุณค้างคนอื่น',
      'เงินในกอง MAKE ไม่นับ เพราะเป็นเงินเก็บ และเงินที่เพื่อนค้างยังไม่นับจนกว่าจะได้คืนจริง',
      '"วันละ" คือยอดนี้หารด้วยจำนวนวันที่เหลือ กด "ตัวเลขนี้มาจากไหน" เพื่อดูรายละเอียดทีละบรรทัด',
      'ถ้าติดลบ แปลว่าใช้เกินไปแล้ว หรือมียอดบางที่ไม่ตรง ดูกล่อง "ต้องจัดการ"']],
    en: ['What "Safe to spend" means', [
      'Money you can really use until payday = all accounts − card balances − money set aside for monthly bills − what you owe people.',
      'MAKE pockets are savings, so they are not counted. Money friends owe you is not counted until it arrives.',
      '"Per day" is this divided by the days left. Tap "Where this number comes from" for each line.',
      'Below zero means overspent, or a balance is off: check "To do".']],
  },
  log: {
    th: ['จดรายจ่าย', [
      'กด + → พิมพ์ยอดบนแป้น → เลือกหมวด → กด "บันทึก" ถ้าบันทึกผิด กด "ย้อนกลับ" บนแถบที่ขึ้นมา',
      'ก่อนกดบันทึก เปลี่ยน "จ่ายด้วย" หรือ "วันที่" ได้ แอปจำบัญชีล่าสุดไว้ให้',
      'ออกให้เพื่อน ใส่ร้าน โน้ต หรือจ่ายบิลประจำ กด "+ ร้าน / เพื่อน / โน้ต / บิล" เพื่อเปิดฟอร์มเต็ม',
      'รับเงิน หรือย้ายเงินระหว่างบัญชี เลือกแท็บ "รับ" หรือ "โอน" ด้านบน',
      'แก้หรือลบรายการ: ประวัติ → แตะรายการ']],
    en: ['Recording a spend', [
      'Tap + → type the amount → pick a category → tap Save. Tap "Undo" on the bar if it was wrong.',
      'Change "Paid with" or "Date" before saving. The last account is remembered.',
      'For friends, a shop, a note or a monthly bill, tap "+ Shop / friends / note / bill" for the full form.',
      'Income or moving money: use the "Income" or "Move" tab at the top.',
      'Edit or delete: History → tap the entry.']],
  },
  card: {
    th: ['บัตรเครดิต', [
      'หน้ากระเป๋าโชว์ 2 ยอดแบบเดียวกับแอปบัตร: "บิล" (สรุปแล้ว ต้องจ่ายภายในวันครบกำหนด) และ "ยังไม่ออกบิล" (รูดหลังวันสรุปยอด)',
      'รายจ่ายนับตามวันที่รูด ไม่ใช่วันที่จ่ายบิล รูดวันไหนก็นับเข้ารอบเดือนของวันนั้น',
      'จ่ายบิลบัตร: กด "จ่ายแล้ว" ในกล่องต้องจัดการ หรือจด "โอน" จากบัญชีไปที่บัตร การจ่ายบิลไม่นับเป็นรายจ่ายซ้ำ',
      'เปลี่ยนวันสรุปยอด/ครบกำหนดได้ใน ตั้งค่า → บัตรเครดิต มีผลตั้งแต่รอบถัดไป']],
    en: ['Credit cards', [
      'Wallet shows the two numbers the card app shows: the "bill" (closed, pay by the due date) and "not billed" (spent since it closed).',
      'Spending counts on the day you swipe, not the day you pay the bill.',
      'Paying the bill: tap "Mark paid" in To do, or record a Move from an account to the card. It is not counted as spending again.',
      'Statement and due days: Settings → Credit cards. Changes start from the next statement.']],
  },
  bills: {
    th: ['รายจ่ายประจำ (บิล)', [
      'บิลที่ต้องจ่ายทุกเดือน เช่น ค่าหอ เน็ต แอปจะกันเงินไว้ทุกรอบ ยอด "ใช้ได้จริง" จึงไม่หลอกว่ามีเงินเยอะ',
      'จ่ายแล้ว: กด "จด" ข้างบิลในกล่องต้องจัดการ แอปเลิกกันเงินส่วนนั้น รอบหน้ากันใหม่เอง',
      'เพิ่ม แก้ยอด หรือเปลี่ยนบัญชีที่จ่าย ได้ใน ตั้งค่า → รายจ่ายจำเป็นทุกเดือน']],
    en: ['Monthly bills', [
      'Bills you pay every month (rent, internet). The app sets the money aside each cycle so Safe to spend never looks bigger than it is.',
      'Paid: tap "Record" next to the bill in To do. The money is released; next cycle it is set aside again.',
      'Add or change bills in Settings → Monthly must-pay bills.']],
  },
  pockets: {
    th: ['กองใน MAKE และเป้าหมาย', [
      'กองคือเงินเก็บแยกตามเป้า ตั้งชื่อให้ตรงกับใน MAKE',
      'ตั้งเป้าได้ 3 ช่อง กรอก 2 ช่องแล้วแอปคิดอีกช่องให้: เป้า + เดือนที่อยากครบ → แอปบอกยอดต่อเดือน, เป้า + ยอดต่อเดือน → แอปบอกว่าครบเมื่อไหร่',
      '"เป้าวนทุกปี" เหมาะกับเบี้ยประกัน พอเลยเดือนครบกำหนด แอปตั้งเป้าปีถัดไปให้เอง',
      'Cash flow (กองพักเงิน) เป็นกองพิเศษ: เงินที่เหลือตอนจบรอบย้ายมาที่นี่ และถ้ารอบไหนใช้เกินก็ดึงจากที่นี่']],
    en: ['MAKE pockets and goals', [
      'Pockets are savings by purpose. Name them as in MAKE.',
      'Fill two of goal, month and per month, and the app works out the third.',
      '"Same goal every year" suits insurance: after its month passes, next year\'s goal starts by itself.',
      'Cash flow is special: what is left at the end of a cycle moves here, and an overspent cycle is covered from here.']],
  },
  payday: {
    th: ['เงินเดือนเข้าและแบ่งเงิน', [
      'พอเริ่มรอบใหม่ กล่องต้องจัดการจะถามว่าเงินเดือนเข้าหรือยัง ขึ้น "แบ่งเงิน" กดแล้วติ๊กทีละขั้น: เงินเดือนเข้า → โอนเข้าแต่ละกอง → ที่เหลือไปบัญชีใช้จ่าย การติ๊กคือการบันทึกจริง',
      'เงินเดือนเลท: แอปยังไม่นับเงินเดือนจนกว่าจะติ๊ก ติ๊กวันไหนก็บันทึกวันนั้น ทำได้ภายใน 10 วันแรกของรอบ',
      'เปลี่ยนวันเริ่มรอบ: ตั้งค่า → เงินเดือน → รอบเริ่มวันที่ รอบที่ใช้อยู่ไม่ถูกตัด มีรอบคั่นครั้งเดียว']],
    en: ['Payday and splitting salary', [
      'Near payday, To do shows "Split". Tick each step: salary in → each pocket → the rest to spending. Ticking records it.',
      'Late salary: it is not counted until you tick it, and it is recorded on the day you tick. Works for the first 10 days of a cycle.',
      'Change payday in Settings → Salary. The current cycle stays; there is one in-between cycle.']],
  },
  friends: {
    th: ['เพื่อนค้างเงิน', [
      'ตอนจดรายจ่าย เปิดฟอร์มเต็มแล้วเลือก "ออกให้เพื่อนด้วยไหม" ใส่ส่วนของเพื่อน ยอดใช้ได้จริงนับแค่ส่วนของคุณ',
      'เพื่อนคืนเงิน: กด "ได้คืนครบ" ในกล่องต้องจัดการ หรือแก้ยอดที่ได้ในหน้ากระเป๋า ถ้าคืนไม่ครบ']],
    en: ['Friends who owe you', [
      'When recording, open the full form and choose "Paid for friends too?". Safe to spend counts only your share.',
      'Paid back: "Got it all" in To do, or change the amount in Wallet for a part payment.']],
  },
  backdated: {
    th: ['จดย้อนหลัง', [
      'รายการที่ลงวันที่ก่อนวันเริ่มใช้แอป ติดป้าย "ไม่หักยอด" ให้เอง ยอดในบัญชีและบัตรไม่ถูกหักซ้ำ เพราะยอดที่กรอกตอนเริ่มรวมไว้แล้ว',
      'แต่ยังนับในสรุปรายจ่าย นับว่าบิลจ่ายแล้ว และนับเงินที่เพื่อนค้าง',
      'วันที่เริ่มใช้แอป มีสวิตช์ "จ่ายไปก่อนเริ่มใช้แอปวันนี้" ให้เลือกเอง']],
    en: ['Back-dated entries', [
      'Entries dated before you started are marked "not deducted". Balances are not reduced again; the starting balances already include them.',
      'They still count in the summary, for bills paid, and for friends\' debts.',
      'On your start day, a switch asks if it was paid before you started.']],
  },
  fix: {
    th: ['ตัวเลขไม่ตรงกับธนาคาร', [
      'เช็ก: กระเป๋า → เช็กยอดกับแอปธนาคาร ใส่ยอดในแอปธนาคาร แอปบอกส่วนต่าง',
      'ถ้าต่าง: หารายการที่ลืมจด หรือบันทึกส่วนต่างเป็น "ปรับยอด"',
      'กรอกยอดตอนเริ่มผิด: ตั้งค่า → ยอดตอนเริ่มใช้ แก้ได้ รายการที่จดไว้ยังอยู่ครบ',
      'บัญชีติดลบเป็นไปไม่ได้ในชีวิตจริง แอปจะเตือนในกล่องต้องจัดการจนกว่าจะแก้']],
    en: ['Numbers do not match the bank', [
      'Check: Wallet → Check against your bank app. Enter the bank\'s balance and the app shows the difference.',
      'If it differs, look for a missed entry, or record the difference as an adjustment.',
      'Starting balance typed wrong: Settings → Starting balances. Your entries stay.',
      'An account below zero cannot be right; To do keeps warning until it is fixed.']],
  },
  backup: {
    th: ['สำรองข้อมูลและย้ายเครื่อง', [
      'ข้อมูลอยู่ในมือถือเครื่องนี้เท่านั้น ไม่ได้ส่งไปที่ไหน',
      'ตั้งค่า → สำรอง / กู้คืน / ลบข้อมูล → สำรองข้อมูล ได้ไฟล์ไว้เก็บใน Files หรือ iCloud Drive ควรทำเป็นระยะ',
      'ย้ายเครื่อง: เปิดแอปในเครื่องใหม่ → กู้คืนจากไฟล์สำรอง']],
    en: ['Backup and moving phones', [
      'Your data lives only on this phone.',
      'Settings → Backup → Export backup gives a file to keep in Files or iCloud Drive. Do it now and then.',
      'New phone: open the app → Restore from a backup file.']],
  },
};
window.HELP_ORDER = ['start', 'safe', 'log', 'card', 'bills', 'pockets', 'payday', 'friends', 'backdated', 'fix', 'backup'];
window.TOUR = [
  { th: ['ยอดใช้ได้จริง', 'ตัวเลขใหญ่บนสุดคือเงินที่ใช้ได้จริงจนเงินเดือนเข้า หักบัตร บิลประจำ และหนี้แล้ว'], en: ['Safe to spend', 'The big number is what you can really use until payday, after cards, bills and debts.'] },
  { th: ['จดรายจ่ายเร็วๆ', 'กด + พิมพ์ยอด เลือกหมวด แล้วกดบันทึก บันทึกผิดกดย้อนกลับได้'], en: ['Quick logging', 'Tap +, type the amount, pick a category, tap Save. Undo if it was wrong.'] },
  { th: ['ต้องจัดการ', 'บิลบัตร บิลประจำ เพื่อนค้าง และวันแบ่งเงินเดือน จะขึ้นที่นี่เมื่อถึงเวลา กดจัดการได้เลย'], en: ['To do', 'Card bills, monthly bills, friends and payday show up here when it is time.'] },
  { th: ['เช็กกับธนาคาร และสำรองข้อมูล', 'เช็กยอดได้ที่หน้ากระเป๋า และสำรองข้อมูลในตั้งค่าเป็นระยะ ดูวิธีใช้ทั้งหมดได้ที่ ตั้งค่า → วิธีใช้'], en: ['Check and back up', 'Check balances in Wallet, and back up in Settings now and then. Full guide: Settings → How to use.'] },
];
