/* LH Bank 2027 – interactive prototype runtime (no backend, no dependencies) */
(function () {
  'use strict';

  /* ---------- tiny DC template engine ---------- */
  window.DCLogic = class {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(o) { Object.assign(this.state, o); if (this.__render) this.__render(); }
  };
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function look(path, scope) {
    const p = path.split('.');
    if (p[0] === 'true') return true; if (p[0] === 'false') return false;
    let cur;
    for (const sc of scope) { if (sc && Object.prototype.hasOwnProperty.call(sc, p[0])) { cur = sc[p[0]]; break; } }
    for (let i = 1; i < p.length; i++) cur = cur == null ? undefined : cur[p[i]];
    return cur;
  }
  function fmt(v) { if (v === true) return 'true'; if (v === false) return 'false'; if (v == null || typeof v === 'object' || typeof v === 'function') return ''; return String(v); }
  const EV = { onClick: 'click', onChange: 'change', onInput: 'input', onSubmit: 'submit', onKeyDown: 'keydown' };
  function holes(txt, scope, reg) {
    txt = txt.replace(/\s(on[A-Z][A-Za-z]*)="\{\{\s*([\w.]+)\s*\}\}"/g, function (m, ev, path) {
      const fn = look(path, scope); if (typeof fn !== 'function') return '';
      reg.push(fn); return ' data-on-' + (EV[ev] || ev.slice(2).toLowerCase()) + '="' + (reg.length - 1) + '"';
    });
    txt = txt.replace(/\shint-placeholder-[a-z]+="[^"]*"/g, '');
    return txt.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (m, path) { return esc(fmt(look(path, scope))); });
  }
  function findClose(s, name, start) {
    let depth = 1, i = start; const re = new RegExp('<(/?)' + name + '\\b[^>]*>', 'g');
    for (;;) { re.lastIndex = i; const m = re.exec(s); if (!m) throw new Error('unclosed ' + name); depth += m[1] ? -1 : 1; if (depth === 0) return [m.index, re.lastIndex]; i = re.lastIndex; }
  }
  function attr(a, n) { const m = a.match(new RegExp(n + '="\\{\\{\\s*([\\w.]+)\\s*\\}\\}"')); return m ? m[1] : null; }
  function render(s, scope, reg) {
    let out = '', i = 0; const TAG = /<(sc-for|sc-if)\b([^>]*)>/g;
    for (;;) {
      TAG.lastIndex = i; const m = TAG.exec(s);
      if (!m) { out += holes(s.slice(i), scope, reg); break; }
      out += holes(s.slice(i, m.index), scope, reg);
      const name = m[1], a = m[2], ce = findClose(s, name, TAG.lastIndex), body = s.slice(TAG.lastIndex, ce[0]);
      if (name === 'sc-if') { if (look(attr(a, 'value'), scope)) out += render(body, scope, reg); }
      else { const list = look(attr(a, 'list'), scope) || []; const v = a.match(/as="(\w+)"/)[1]; for (const it of list) { const o = {}; o[v] = it; out += render(body, [o].concat(scope), reg); } }
      i = ce[1];
    }
    return out;
  }
  /* ---------- DOM morph (keeps focus, slider drags, scroll) ---------- */
  function syncAttrs(a, b) {
    for (const at of Array.from(a.attributes)) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of Array.from(b.attributes)) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    if ((a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && document.activeElement !== a) { const v = b.getAttribute('value'); if (v !== null && a.value !== v) a.value = v; }
  }
  function morph(a, b) {
    const an = Array.from(a.childNodes), bn = Array.from(b.childNodes);
    for (let i = 0; i < bn.length; i++) {
      const x = an[i], y = bn[i];
      if (!x) { a.appendChild(y.cloneNode(true)); continue; }
      if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y.cloneNode(true), x); continue; }
      if (x.nodeType === 3 || x.nodeType === 8) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
      syncAttrs(x, y); morph(x, y);
    }
    for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
  }
  window.mountDC = function (rootId, Comp, tplId) {
    const root = document.getElementById(rootId), tpl = document.getElementById(tplId).textContent;
    const inst = new Comp({}); let reg = [];
    inst.__render = function () {
      reg = []; const html = render(tpl, [inst.renderVals()], reg);
      const t = document.createElement('template'); t.innerHTML = html; morph(root, t.content);
    };
    function fire(type, e) {
      const sel = '[data-on-' + type + ']'; const el = e.target.closest && e.target.closest(sel);
      if (!el || !root.contains(el)) return false;
      if (type === 'change' && el.tagName === 'INPUT' && !/checkbox|radio/.test(el.type)) return false;
      const fn = reg[+el.getAttribute('data-on-' + type)]; if (!fn) return false;
      if (type === 'submit') e.preventDefault();
      if (type === 'click' && el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
      e.__dc = true; fn(e); return true;
    }
    root.addEventListener('click', function (e) { fire('click', e); });
    root.addEventListener('input', function (e) { if (!fire('input', e)) { const el = e.target; if (el.hasAttribute && el.hasAttribute('data-on-change') && el.tagName === 'INPUT') { const fn = reg[+el.getAttribute('data-on-change')]; if (fn) fn(e); } } });
    root.addEventListener('change', function (e) { fire('change', e); });
    root.addEventListener('submit', function (e) { fire('submit', e); });
    inst.__render();
    return inst;
  };

  /* ---------- prototype layer: navigation, modals, toasts, search ---------- */
  const PAGES = { 'หน้าแรก': '01-Home.html', 'ลูกค้าบุคคล': '02-Personal.html', 'ลูกค้า SME': '03-SME.html', 'ลูกค้าธุรกิจ': '04-Business.html' };
  const ui = document.createElement('div'); ui.id = 'proto-ui';
  ui.innerHTML = `
  <div class="pt-toast" role="status" aria-live="polite"></div>
  <div class="pt-modal" id="pt-modal" hidden>
    <div class="pt-backdrop" data-close></div>
    <div class="pt-dialog" role="dialog" aria-modal="true" aria-labelledby="pt-title">
      <button class="pt-x" type="button" aria-label="ปิด" data-close>&times;</button>
      <div class="pt-body"></div>
    </div>
  </div>`;
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(ui); });
  function toast(msg) {
    const t = ui.querySelector('.pt-toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  let lastFocus = null;
  function openModal(html, after) {
    const m = ui.querySelector('#pt-modal'); lastFocus = document.activeElement;
    m.querySelector('.pt-body').innerHTML = html; m.hidden = false; document.documentElement.classList.add('pt-lock');
    const f = m.querySelector('input,select,button:not(.pt-x)'); if (f) setTimeout(function () { f.focus(); }, 30);
    if (after) after(m);
  }
  function closeModal() { const m = ui.querySelector('#pt-modal'); m.hidden = true; document.documentElement.classList.remove('pt-lock'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  ui.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ui.querySelector('#pt-modal').hidden) closeModal(); });

  function wireForm(m, okTitle, okText) {
    const form = m.querySelector('form'); if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const bad = Array.from(form.querySelectorAll('[required]')).filter(function (el) { return !el.value.trim() || (el.pattern && !new RegExp('^' + el.pattern + '$').test(el.value.trim())); });
      form.querySelectorAll('.pt-err').forEach(function (x) { x.remove(); });
      if (bad.length) { bad.forEach(function (el) { const s = document.createElement('span'); s.className = 'pt-err'; s.textContent = el.dataset.err || 'กรุณากรอกข้อมูล'; el.after(s); }); bad[0].focus(); return; }
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'กำลังส่งข้อมูล…';
      setTimeout(function () {
        const ref = 'LHB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        m.querySelector('.pt-body').innerHTML = `<div class="pt-ok"><div class="pt-check">✓</div><h2 id="pt-title">${okTitle}</h2><p>${okText}</p><p class="pt-ref">หมายเลขอ้างอิง <b>${ref}</b></p><button type="button" class="pt-btn" data-close>เสร็จสิ้น</button><p class="pt-note">ระบบจำลองสำหรับนำเสนอ ยังไม่มีการส่งข้อมูลจริง</p></div>`;
      }, 900);
    });
  }
  const TOPICS = ['บ้านและสินเชื่อ', 'ลงทุนและเกษียณ', 'เงินฝากและออม', 'ธุรกิจ SME', 'ลูกค้าธุรกิจ / RM'];
  function apptModal(topic) {
    openModal(`<h2 id="pt-title">นัดคุยกับผู้เชี่ยวชาญ</h2><p class="pt-sub">เลือกเรื่องและช่วงเวลา เจ้าหน้าที่จะติดต่อกลับเพื่อยืนยันนัด</p>
    <form novalidate>
      <label>ชื่อ-นามสกุล<input name="n" required autocomplete="name" placeholder="เช่น สมใจ ใจดี"></label>
      <label>เบอร์โทรศัพท์<input name="p" required inputmode="tel" pattern="0[0-9]{8,9}" data-err="กรุณากรอกเบอร์ 9–10 หลัก ขึ้นต้นด้วย 0" placeholder="08x-xxx-xxxx"></label>
      <label>เรื่องที่อยากคุย<select name="t">${TOPICS.map(function (t) { return '<option' + (t === topic ? ' selected' : '') + '>' + t + '</option>'; }).join('')}</select></label>
      <div class="pt-row"><label>ช่องทาง<select><option>ที่สาขา</option><option>วิดีโอคอล</option><option>โทรกลับ</option></select></label><label>ช่วงเวลา<select><option>เช้า</option><option selected>บ่าย</option><option>เย็น</option></select></label></div>
      <label class="pt-chk"><input type="checkbox" required data-err="กรุณายอมรับเงื่อนไข"> ยินยอมให้ธนาคารติดต่อกลับตามข้อมูลที่ให้ไว้</label>
      <button type="submit" class="pt-btn">ยืนยันนัดหมาย</button>
    </form>`, function (m) { wireForm(m, 'ส่งคำขอนัดหมายแล้ว', 'เจ้าหน้าที่จะติดต่อกลับภายใน 1 วันทำการ เพื่อยืนยันวันและเวลา'); });
  }
  /* booking card already holds the user's choices: read them, ask only for contact details */
  function readBooking(el) {
    let card = el.parentElement;
    for (let k = 0; k < 4 && card && card.querySelectorAll('[aria-pressed=true]').length < 2; k++) card = card.parentElement;
    if (!card || card.querySelectorAll('[aria-pressed=true]').length < 2) return null;
    const rows = [], DEF = ['เรื่องที่อยากคุย', 'ช่องทาง', 'ช่วงเวลา', 'ตัวเลือก'];
    card.querySelectorAll('[aria-pressed=true]').forEach(function (b, i) {
      const grp = b.parentElement && b.parentElement.parentElement, f = grp && grp.firstElementChild;
      let lab = f && f !== b.parentElement && f.tagName === 'SPAN' ? f.innerText.trim().replace(/^\d+\s*/, '') : '';
      rows.push([lab || DEF[Math.min(i, 3)], b.innerText.trim()]);
    });
    let calc = '';
    card.querySelectorAll('span,div').forEach(function (x) { const t = (x.innerText || '').replace(/\s+/g, ' ').trim(); const m = t.match(/^แนบตัวเลขที่คำนวณไว้:?\s*(.+)$/); if (m && !calc) calc = m[1].trim(); });
    if (calc) rows.push(['ตัวเลขที่คำนวณไว้', calc]);
    return rows;
  }
  function apptModalPre(rows) {
    const BIZ = /SME|ธุรกิจ/.test(document.title);
    const sum = rows.map(function (r) { return '<div class="pt-sum-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
    openModal(`<h2 id="pt-title">ยืนยันนัดหมาย</h2><p class="pt-sub">ตรวจสอบรายการที่เลือก แล้วกรอกชื่อและเบอร์ติดต่อ</p>
    <div class="pt-sum">${sum}<button type="button" class="pt-edit" data-close>แก้ไขตัวเลือก</button></div>
    <form novalidate>
      <label>${BIZ ? 'ชื่อกิจการ / ชื่อผู้ติดต่อ' : 'ชื่อ-นามสกุล'}<input name="n" required autocomplete="name" placeholder="${BIZ ? 'เช่น ร้านแพ็กดี ออนไลน์' : 'เช่น สมใจ ใจดี'}"></label>
      <label>เบอร์โทรศัพท์<input name="p" required inputmode="tel" pattern="0[0-9]{8,9}" data-err="กรุณากรอกเบอร์ 9–10 หลัก ขึ้นต้นด้วย 0" placeholder="08x-xxx-xxxx"></label>
      <label class="pt-chk"><input type="checkbox" required data-err="กรุณายอมรับเงื่อนไข"> ยินยอมให้ธนาคารติดต่อกลับตามข้อมูลที่ให้ไว้</label>
      <button type="submit" class="pt-btn">ยืนยันนัดหมาย</button>
    </form>`, function (m) { wireForm(m, 'ส่งคำขอนัดหมายแล้ว', rows.map(function (r) { return r[1]; }).join(' · ') + '<br>เจ้าหน้าที่จะติดต่อกลับภายใน 1 วันทำการ เพื่อยืนยันวันและเวลา'); });
  }
  function loginModal() {
    openModal(`<h2 id="pt-title">เข้าสู่ระบบ</h2><p class="pt-sub">เลือกบริการที่ต้องการใช้งาน</p>
    <div class="pt-grid"><a class="pt-card" data-pick="LHB You"><b>LHB You</b><span>ลูกค้าบุคคล</span></a><a class="pt-card" data-pick="LH Bank Speedy"><b>LH Bank Speedy</b><span>Internet Banking ธุรกิจ</span></a><a class="pt-card" data-pick="LHB Biz Connect"><b>LHB Biz Connect</b><span>ดิจิทัลแบงก์กิ้งธุรกิจ</span></a></div>
    <p class="pt-note">ต้นแบบจำลอง: เว็บไซต์จริงจะพาไปยังหน้าเข้าสู่ระบบของแต่ละบริการ</p>`, function (m) {
      m.querySelectorAll('[data-pick]').forEach(function (c) { c.addEventListener('click', function () { closeModal(); toast('จำลอง: เปิด ' + c.dataset.pick); }); });
    });
  }
  function appModal() {
    openModal(`<h2 id="pt-title">ดาวน์โหลดแอป LHB You</h2><p class="pt-sub">เปิดบัญชีออนไลน์และจัดการบัญชี B YOU ได้ในแอปเดียว</p>
    <div class="pt-qr" aria-hidden="true"></div><p class="pt-note">สแกนเพื่อดาวน์โหลด (QR จำลอง) · ใช้ได้ทั้ง iOS และ Android</p>
    <button type="button" class="pt-btn" data-close>ปิด</button>`);
  }
  /* search overlay */
  const IDX = [
    ['เงินฝากออมทรัพย์ดิจิทัล', 'ลูกค้าบุคคล', '02-Personal.html'], ['Family Banking', 'ลูกค้าบุคคล', '02-Personal.html'], ['สินเชื่อบ้านใหม่ Home 1st Class', 'ลูกค้าบุคคล', '02-Personal.html'],
    ['รีไฟแนนซ์บ้าน', 'ลูกค้าบุคคล', '02-Personal.html'], ['เครื่องคำนวณสินเชื่อบ้าน', 'ลูกค้าบุคคล', '02-Personal.html'], ['แลกเงินต่างประเทศ', 'ลูกค้าบุคคล', '02-Personal.html'], ['LHB You', 'ดิจิทัลแบงก์กิ้ง', '02-Personal.html'],
    ['สินเชื่อเพื่อหมุนเวียนในธุรกิจ', 'ลูกค้า SME', '03-SME.html'], ['Green Transition Advisory Loan', 'ลูกค้า SME', '03-SME.html'], ['เครื่องคำนวณสินเชื่อ SME', 'ลูกค้า SME', '03-SME.html'], ['Product Program ตามอุตสาหกรรม', 'ลูกค้า SME', '03-SME.html'], ['Advisory Service', 'ลูกค้า SME', '03-SME.html'],
    ['Cross Border Fast Lane', 'ลูกค้าธุรกิจ', '04-Business.html'], ['Trade Finance Guarantee', 'ลูกค้าธุรกิจ', '04-Business.html'], ['เครือข่าย CTBC', 'ลูกค้าธุรกิจ', '04-Business.html'], ['Relationship Manager', 'ลูกค้าธุรกิจ', '04-Business.html'], ['LH Bank Speedy', 'ดิจิทัลแบงก์กิ้ง', '04-Business.html'],
    ['อัตราดอกเบี้ย', 'เครื่องมือ', '01-Home.html'], ['ค้นหาสาขา', 'ช่วยเหลือ', '01-Home.html'], ['นักลงทุนสัมพันธ์', 'เกี่ยวกับเรา', '01-Home.html'], ['ติดต่อ LH Bank 1327', 'ช่วยเหลือ', '01-Home.html']
  ];
  function searchModal() {
    openModal(`<h2 id="pt-title">ค้นหา</h2><label class="pt-sr" for="pt-q">ค้นหาผลิตภัณฑ์และบริการ</label><input id="pt-q" class="pt-q" placeholder="พิมพ์ชื่อผลิตภัณฑ์ เช่น สินเชื่อ, บัญชี, SME" autocomplete="off"><ul class="pt-res" aria-live="polite"></ul>`, function (m) {
      const q = m.querySelector('#pt-q'), ul = m.querySelector('.pt-res');
      function draw() {
        const v = q.value.trim().toLowerCase();
        const r = IDX.filter(function (x) { return !v || (x[0] + ' ' + x[1]).toLowerCase().indexOf(v) >= 0; }).slice(0, 8);
        ul.innerHTML = r.length ? r.map(function (x) { return '<li><a href="' + x[2] + '"><b>' + x[0] + '</b><span>' + x[1] + '</span></a></li>'; }).join('') : '<li class="pt-none">ไม่พบผลลัพธ์ ลองใช้คำอื่น หรือถาม LH Advisor ในหน้าแรก</li>';
      }
      q.addEventListener('input', draw); draw();
    });
  }
  window.LHProto = { toast: toast, apptModal: apptModal, loginModal: loginModal, searchModal: searchModal };

  function label(el) { return (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); }
  /* capture: segment navigation wins over in-page tab state */
  document.addEventListener('click', function (e) {
    const el = e.target.closest && e.target.closest('a,button'); if (!el) return;
    const t = label(el);
    const inSegNav = el.closest('[aria-label="กลุ่มลูกค้า"]') || el.closest('footer') || el.closest('#mega') || el.closest('nav') || el.getAttribute('href') === '#segments';
    let page = null;
    if (el.getAttribute('aria-label') === 'LH Bank หน้าแรก' || (el.closest('header') && el.querySelector && el.querySelector('img[alt="LH Bank"]'))) page = '01-Home.html';
    else if (inSegNav) { for (const k in PAGES) if (t === k || t.indexOf(k + ' ') === 0 || t.indexOf(k) === 0 && el.getAttribute('href') === '#segments') { page = PAGES[k]; break; } }
    if (page) { e.preventDefault(); e.stopPropagation(); const here = location.pathname.split('/').pop() || '01-Home.html'; if (here === page) window.scrollTo({ top: 0, behavior: 'smooth' }); else location.href = page; }
  }, true);
  /* bubble: everything the design left as a plain link/button */
  document.addEventListener('click', function (e) {
    if (e.__dc || e.defaultPrevented) return;
    const el = e.target.closest && e.target.closest('a,button'); if (!el || ui.contains(el)) return;
    if (el.closest('form') && el.type === 'submit') return;
    const t = label(el), href = el.getAttribute('href') || '';
    if (/^tel:/.test(href)) { e.preventDefault(); toast('จำลองการโทร ' + href.slice(4) + ' (LH Bank Contact Center)'); return; }
    if (href === '#search' || /ค้นหาอัจฉริยะ|^ค้นหา$/.test(t) && el.tagName === 'A') { e.preventDefault(); searchModal(); return; }
    if (/เข้าสู่ระบบ/.test(t)) { e.preventDefault(); loginModal(); return; }
    if (/ยืนยันนัด|ส่งคำขอ/.test(t) && !/กรอกชื่อ/.test(t)) {
      let box = el.parentElement;
      for (let k = 0; k < 3 && box && !box.querySelector('input[type=text],input:not([type]),textarea'); k++) box = /^(SECTION|MAIN|BODY)$/.test(box.tagName) ? null : box.parentElement;
      if (box && box.querySelector('input[type=text],input:not([type]),textarea')) {
        e.preventDefault();
        const empty = Array.from(box.querySelectorAll('input[type=text],input:not([type]),input[type=tel],input[type=email],textarea')).filter(function (x) { return !x.value.trim(); });
        if (empty.length) { empty[0].focus(); empty[0].style.outline = '3px solid #FFCD00'; setTimeout(function () { empty[0].style.outline = ''; }, 1600); toast('กรุณากรอกข้อมูลให้ครบก่อนส่งคำขอ'); return; }
        const picks = Array.from(box.querySelectorAll('[aria-pressed=true]')).map(function (x) { return x.innerText.trim(); }).filter(Boolean);
        const ref = 'LHB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        openModal('<div class="pt-ok"><div class="pt-check">✓</div><h2 id="pt-title">ส่งคำขอนัดหมายแล้ว</h2><p>เจ้าหน้าที่จะติดต่อกลับภายใน 1 วันทำการ เพื่อยืนยันวันและเวลา</p>' + (picks.length ? '<p class="pt-ref">' + picks.join(' · ') + '</p>' : '') + '<p class="pt-ref">หมายเลขอ้างอิง <b>' + ref + '</b></p><button type="button" class="pt-btn" data-close>เสร็จสิ้น</button><p class="pt-note">ระบบจำลองสำหรับนำเสนอ ยังไม่มีการส่งข้อมูลจริง</p></div>');
        return;
      }
    }
    if (/กรอกชื่อ|นัดคุย|นัดหมาย|นัดสาขา|ยืนยันนัด|ติดต่อ RM|กับ RM|ส่งคำขอนัด|เริ่มขั้นแรก|ส่งคำขอ/.test(t)) {
      e.preventDefault();
      const pre = readBooking(el); if (pre) { apptModalPre(pre); return; }
      const topic = /SME|ธุรกิจ/.test(document.title) ? (/SME/.test(document.title) ? 'ธุรกิจ SME' : 'ลูกค้าธุรกิจ / RM') : 'บ้านและสินเชื่อ';
      apptModal(topic); return;
    }
    if (/Google Play|App Store|ดาวน์โหลด|เปิดแอป/.test(t) || el.querySelector && el.querySelector('img[alt*="Play"],img[alt*="App Store"]')) { e.preventDefault(); appModal(); return; }
    if (/กลับขึ้นด้านบน/.test(t) || href === '#main') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (href.length > 1 && href[0] === '#') {
      const target = document.querySelector(href); const vis = target && target.offsetParent !== null;
      if (vis) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (el.tagName === 'A') { e.preventDefault(); toast('จำลอง: ไปยังส่วน “' + t.slice(0, 40) + '”'); }
      return;
    }
    if (el.tagName === 'A' && (href === '#' || href === '')) { e.preventDefault(); toast('ต้นแบบ: ลิงก์ “' + t.slice(0, 48) + '” จะไปยังหน้ารายละเอียดในเว็บไซต์จริง'); }
  });
})();
