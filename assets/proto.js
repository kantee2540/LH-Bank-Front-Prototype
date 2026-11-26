/* LH Bank 2027 · prototype layer
   - picks the Desktop or Mobile design for the current screen width
   - maps links between pages, simulates actions that need a backend
   - page navigator (left edge tab) for presenting */
(function () {
  'use strict';
  var P = window.__PAGE, PAGES = window.__PAGES || [], MAP = window.__MAP || {};
  var q = new URLSearchParams(location.search);
  var forced = q.get('view');
  var SHOT = q.has('shot');
  var BP = 900, DESK = 1280;

  function mode() {
    if (forced === 'desktop' || forced === 'mobile') return forced;
    return window.innerWidth >= BP ? 'desktop' : 'mobile';
  }
  var M = mode();
  document.documentElement.setAttribute('data-view', M);

  // keep ?view / ?shot when moving between pages
  function keep(url) {
    var extra = [];
    if (forced) extra.push('view=' + forced);
    if (SHOT) extra.push('shot=1');
    if (q.has('nobar')) extra.push('nobar=1');
    if (!extra.length) return url;
    var hash = '', i = url.indexOf('#');
    if (i >= 0) { hash = url.slice(i); url = url.slice(0, i); }
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + extra.join('&') + hash;
  }

  // desktop below 1280px: scale the 1280px layout down so nothing breaks
  function fit() {
    if (M !== 'desktop') { document.documentElement.style.zoom = ''; return; }
    var w = window.innerWidth;
    document.documentElement.style.zoom = (w < DESK && forced !== 'desktop') ? String(w / DESK) : '';
  }

  // ---------- boot ----------
  var helm = document.getElementById(M === 'desktop' ? 'helm-d' : 'helm-m');
  document.head.appendChild(helm.content.cloneNode(true));
  if (SHOT) {
    try { localStorage.setItem('lhbCookie', '1'); } catch (e) {}
  }
  window.__dcAfterBoot = function () {
    fit();
    // anchors land below the sticky header (and the page's own sticky nav when it has one)
    var hd = document.querySelector('header'), sn = null;
    document.querySelectorAll('nav, div').forEach(function (el) { if (!sn && el.style.position === 'sticky' && el.style.top && el.style.top !== '0px' && el.style.bottom === '') sn = el; });
    document.documentElement.style.scrollPaddingTop = ((hd ? hd.offsetHeight : 0) + (sn ? sn.offsetHeight : 0) + 12) + 'px';
    if (location.hash) {
      setTimeout(function () {
        var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (t) t.scrollIntoView({ block: 'start' });
      }, 60);
    }
  };
  var C = M === 'desktop' ? window.__mk_d() : window.__mk_m();
  window.__dcBoot(M === 'desktop' ? 'tpl-d' : 'tpl-m', C, M === 'desktop' ? window.__props_d : window.__props_m);

  var lastMode = M;
  window.addEventListener('resize', function () {
    if (forced) { fit(); return; }
    var now = window.innerWidth >= BP ? 'desktop' : 'mobile';
    if (now !== lastMode) { location.reload(); return; }
    fit();
  });

  // ---------- UI helpers ----------
  var layer = document.createElement('div');
  layer.id = 'proto-layer';
  document.body.appendChild(layer);

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('proto-toast');
    if (!t) { t = document.createElement('div'); t.id = 'proto-toast'; t.setAttribute('role', 'status'); layer.appendChild(t); }
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3200);
  }
  window.__protoToast = toast;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var lastFocus = null;
  function modal(html, onReady) {
    closeModal();
    lastFocus = document.activeElement;
    var w = document.createElement('div');
    w.id = 'proto-modal';
    w.innerHTML = '<div class="pm-back" data-close="1"></div><div class="pm-box" role="dialog" aria-modal="true" aria-labelledby="pm-title"><button class="pm-x" type="button" aria-label="ปิด" data-close="1">×</button>' + html + '</div>';
    layer.appendChild(w);
    document.documentElement.classList.add('pm-lock');
    w.addEventListener('click', function (e) { if (e.target.getAttribute('data-close')) closeModal(); });
    var f = w.querySelector('input, select, button.pm-primary, button');
    if (f) setTimeout(function () { f.focus(); }, 30);
    if (onReady) onReady(w.querySelector('.pm-box'));
  }
  function closeModal() {
    var w = document.getElementById('proto-modal');
    if (w) { w.remove(); document.documentElement.classList.remove('pm-lock'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeNav(); } });

  function refNo() { var d = new Date(); return 'LH' + String(d.getFullYear() + 543).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(Math.floor(1000 + Math.random() * 9000)); }

  function appModal() {
    modal('<span class="pm-eyebrow">LHB You</span><h2 id="pm-title">เข้าสู่ระบบผ่านแอป LHB You</h2>' +
      '<p class="pm-lead">ทำธุรกรรม เปิดบัญชี และดูยอดเงินได้ในแอป ใน prototype นี้จะจำลองการเปิดแอป</p>' +
      '<div class="pm-row"><button class="pm-primary" type="button" data-act="open">เปิดแอป LHB You</button><button class="pm-ghost" type="button" data-close="1">ไว้ทีหลัง</button></div>',
      function (box) { box.querySelector('[data-act=open]').addEventListener('click', function () { closeModal(); toast('จำลอง: เปิดแอป LHB You'); }); });
  }

  var FORM_IDS = ['apply', 'dp-app', 'tw', 'book', 'rm', 'advisor', 'mb-adv'];
  function toForm() {
    for (var i = 0; i < FORM_IDS.length; i++) {
      var el = document.getElementById(FORM_IDS[i]);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    var f = P ? P.file : '';
    if (/^(09|10)-/.test(f)) go('09-SME.html#book');
    else if (/^11-/.test(f)) go('11-Corporate.html#rm');
    else go('02-Personal.html#' + (M === 'desktop' ? 'advisor' : 'mb-adv'));
  }
  function label(el) { return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function topicFor(text) {
    var t = text + ' ' + (P && P.title || '');
    if (/รีไฟแนนซ์/.test(t)) return 'รีไฟแนนซ์บ้าน';
    if (/Happy Cash|เงินก้อน|รวมหนี้/.test(t)) return 'สินเชื่อส่วนบุคคล Happy Cash';
    if (/SME|ธุรกิจ/.test(t)) return /ลูกค้าธุรกิจ|RM|Corporate/.test(t) ? 'บริการลูกค้าธุรกิจ' : 'สินเชื่อ SME';
    if (/บ้าน/.test(t)) return 'สินเชื่อบ้าน';
    if (/ฝาก|บัญชี|B YOU/.test(t)) return 'เงินฝากและบัญชี B YOU';
    if (/ช่วงชีวิต/.test(t)) return 'วางแผนการเงินตามช่วงชีวิต';
    return 'อื่นๆ';
  }
  function act(el) {
    var t = label(el);
    if (!t) { toast('ปุ่มนี้จะทำงานในเว็บจริง'); return; }
    if (/^(EN|中文|English|TH|ไทย)( · [A-Z]{2})?$/.test(t)) { var d = el.closest('details'); if (d) d.removeAttribute('open'); toast('เว็บจริงรองรับ 3 ภาษา: ไทย อังกฤษ จีน'); return; }
    if (/เข้าสู่ระบบ|เปิดแอป|LHB You|ดาวน์โหลดแอป/.test(t)) { appModal(); return; }
    if (/ดาวน์โหลด|PDF|ไฟล์/.test(t)) { toast('จำลองการดาวน์โหลดไฟล์ “' + t.replace(/ดาวน์โหลด/, '').trim() + '”'); return; }
    if (/นัด|ผู้เชี่ยวชาญ|สมัคร|สนใจ|ติดต่อ|ปรึกษา|ให้เจ้าหน้าที่|ขอข้อมูล|RM|ลงทะเบียน|ยื่นกู้/.test(t)) { toForm(); return; }
    if (/โทร|1327/.test(t)) { toast('จำลองการโทร Call Center 1327'); return; }
    toast('“' + (t.length > 40 ? t.slice(0, 40) + '…' : t) + '” จะเปิดหน้าที่เกี่ยวข้องในเว็บจริง (ยังไม่อยู่ใน prototype)');
  }

  function go(url) { location.href = keep(url); }

  // capture clicks before the page logic: map links, simulate dead ends
  document.addEventListener('click', function (e) {
    if (e.target.closest('#proto-layer, #proto-nav')) return;
    var a = e.target.closest('a');
    if (a) {
      var href = a.getAttribute('href') || '';
      var m = href.match(/([A-Za-z0-9_]+)\.dc\.html(#.*)?$/);
      if (m) { e.preventDefault(); if (MAP[m[1]]) go(MAP[m[1]] + (m[2] || '')); else act(a); return; }
      if (/^[0-9]{2}-[A-Za-z-]+\.html/.test(href)) { e.preventDefault(); go(href); return; }
      if (/^tel:/.test(href)) { e.preventDefault(); toast('จำลองการโทร ' + href.slice(4)); return; }
      if (/^mailto:/.test(href)) { e.preventDefault(); toast('จำลองการส่งอีเมลถึง ' + href.slice(7)); return; }
      if (/^https?:/.test(href)) { e.preventDefault(); toast('ลิงก์ภายนอก จะเปิดในแท็บใหม่ในเว็บจริง'); return; }
      if (href === '' || href === '#') {
        e.preventDefault();
        if (!a.hasAttribute('data-ev-click')) act(a);
        return;
      }
      if (href.charAt(0) === '#') {
        var id = decodeURIComponent(href.slice(1));
        if (!document.getElementById(id)) { e.preventDefault(); if (!a.hasAttribute('data-ev-click')) act(a); }
        return;
      }
      return;
    }
    var b = e.target.closest('button');
    if (b && !b.hasAttribute('data-ev-click') && !b.closest('[data-ev-click]')) {
      var form = b.closest('form');
      if (form && (b.type || 'submit') === 'submit') return; // submit handled below
      e.preventDefault();
      act(b);
    }
  }, true);

  window.__protoSubmit = function (e) {
    var f = e.target;
    var t = label(f.querySelector('button[type=submit], button:not([type])') || f);
    if (/ค้นหา|ถาม|Advisor/.test(t)) { toast('จำลองการค้นหา'); return; }
    toast('ได้รับข้อมูลแล้ว (จำลอง)');
  };

  // ---------- page navigator (presentation helper) ----------
  function closeNav() { var n = document.getElementById('proto-nav'); if (n) n.classList.remove('open'); }
  if (!SHOT && !q.has('nobar')) {
    var nav = document.createElement('div');
    nav.id = 'proto-nav';
    var list = PAGES.map(function (p) {
      return '<a href="' + p.file + '"' + (P && p.file === P.file ? ' aria-current="page"' : '') + '><span>' + p.no + '</span>' + esc(p.title) + '</a>';
    }).join('');
    var here = P ? P.file : '';
    nav.innerHTML = '<button type="button" class="pn-tab" aria-expanded="false" aria-controls="pn-panel" title="หน้าทั้งหมดใน prototype"><span aria-hidden="true">☰</span><span class="pn-tab-t">หน้า</span></button>' +
      '<div id="pn-panel" class="pn-panel"><div class="pn-head"><b>LH Bank 2027 · Prototype</b><button type="button" class="pn-x" aria-label="ปิด">×</button></div>' +
      '<div class="pn-views" role="group" aria-label="มุมมอง"><a href="' + here + '"' + (!forced ? ' aria-current="true"' : '') + '>อัตโนมัติ</a><a href="' + here + '?view=desktop"' + (forced === 'desktop' ? ' aria-current="true"' : '') + '>Desktop</a><a href="' + here + '?view=mobile"' + (forced === 'mobile' ? ' aria-current="true"' : '') + '>Mobile</a></div>' +
      '<nav class="pn-list" aria-label="หน้าใน prototype">' + list + '</nav>' +
      '<a class="pn-index" href="index.html">ดูทุกหน้าแบบเทียบขนาดจอ →</a></div>';
    document.body.appendChild(nav);
    var tab = nav.querySelector('.pn-tab');
    tab.addEventListener('click', function () { var o = nav.classList.toggle('open'); tab.setAttribute('aria-expanded', o ? 'true' : 'false'); });
    nav.querySelector('.pn-x').addEventListener('click', function () { nav.classList.remove('open'); tab.setAttribute('aria-expanded', 'false'); });
    nav.querySelectorAll('.pn-list a').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); go(a.getAttribute('href')); }); });
  }
})();
