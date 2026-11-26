/* Minimal runtime for exported LH Bank prototype pages.
   Renders the page template with {{holes}}, <sc-for>, <sc-if>, and wires
   onClick / onChange / onInput / onSubmit to the page's Component. */
(function () {
  'use strict';
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (o) {
    if (typeof o === 'function') o = o(this.state, this.props);
    Object.assign(this.state, o || {});
    schedule();
  };
  window.DCLogic = DCLogic;

  var tpl, root, comp, handlers = [], pending = false;
  var EVMAP = { onclick: 'click', onchange: 'change', oninput: 'input', onsubmit: 'submit' };

  function get(ctx, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.'), cur = ctx[parts[0]];
    for (var i = 1; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  function str(v) { return (v == null || typeof v === 'function' || typeof v === 'object') ? '' : String(v); }
  var HOLE = /\{\{([^}]+)\}\}/g;
  function sub(s, ctx) { return s.replace(HOLE, function (m, e) { return str(get(ctx, e)); }); }
  function only(s) { var m = s.match(/^\s*\{\{([^}]+)\}\}\s*$/); return m ? m[1] : null; }

  function build(src, ctx, out) {
    for (var n = src.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue.indexOf('{{') < 0 ? n.nodeValue : sub(n.nodeValue, ctx))); continue; }
      if (n.nodeType !== 1) continue;
      var tag = n.localName;
      if (tag === 'sc-for') {
        var lp = only(n.getAttribute('list') || ''), as = n.getAttribute('as');
        var list = lp ? get(ctx, lp) : null;
        if (list && list.length) for (var i = 0; i < list.length; i++) {
          var c2 = Object.create(ctx); c2[as] = list[i]; build(n, c2, out);
        }
        continue;
      }
      if (tag === 'sc-if') {
        var vp = only(n.getAttribute('value') || '');
        if (vp && get(ctx, vp)) build(n, ctx, out);
        continue;
      }
      var el = n.cloneNode(false);
      for (var a = n.attributes.length - 1; a >= 0; a--) {
        var at = n.attributes[a], v = at.value;
        if (v.indexOf('{{') < 0) continue;
        var ln = at.name.toLowerCase();
        if (EVMAP[ln]) {
          el.removeAttribute(at.name);
          var p = only(v), fn = p ? get(ctx, p) : null;
          if (typeof fn === 'function') { handlers.push(fn); el.setAttribute('data-ev-' + EVMAP[ln], handlers.length - 1); }
          continue;
        }
        if (ln.indexOf('hint-') === 0) { el.removeAttribute(at.name); continue; }
        el.setAttribute(at.name, sub(v, ctx));
      }
      build(n.content || n, ctx, el.content || el);
      out.appendChild(el);
    }
  }

  function syncAttrs(o, n) {
    for (var i = o.attributes.length - 1; i >= 0; i--) {
      var nm = o.attributes[i].name;
      if (!n.hasAttribute(nm) && !(nm === 'open' && o.localName === 'details')) o.removeAttribute(nm);
    }
    for (var j = 0; j < n.attributes.length; j++) {
      var a = n.attributes[j];
      if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value);
    }
    var t = o.localName;
    if (t === 'input' || t === 'textarea' || t === 'select') {
      if (n.hasAttribute('value') && o.value !== n.getAttribute('value')) o.value = n.getAttribute('value');
      if (o.type === 'checkbox' || o.type === 'radio') o.checked = n.hasAttribute('checked') && n.getAttribute('checked') !== 'false';
    }
  }
  function morph(op, np) {
    var oc = op.firstChild, nc = np.firstChild;
    while (nc) {
      var next = nc.nextSibling;
      if (!oc) { op.appendChild(nc); nc = next; continue; }
      var onext = oc.nextSibling;
      if (oc.nodeType !== nc.nodeType || (oc.nodeType === 1 && oc.localName !== nc.localName)) {
        op.replaceChild(nc, oc);
      } else if (oc.nodeType === 3) {
        if (oc.nodeValue !== nc.nodeValue) oc.nodeValue = nc.nodeValue;
      } else if (oc.nodeType === 1) {
        syncAttrs(oc, nc); morph(oc, nc);
      }
      oc = onext; nc = next;
    }
    while (oc) { var rm = oc; oc = oc.nextSibling; op.removeChild(rm); }
  }

  function render() {
    pending = false;
    handlers = [];
    var vals = comp.renderVals();
    var frag = document.createElement('div');
    build(tpl, vals, frag);
    var act = document.activeElement, actId = act && act.id, sel = null;
    try { if (act && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch (e) {}
    morph(root, frag);
    if (actId && document.activeElement !== act) {
      var again = document.getElementById(actId);
      if (again) { again.focus(); try { if (sel) again.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
  }
  function schedule() { if (!pending) { pending = true; Promise.resolve().then(render); } }

  function dispatch(type, e) {
    for (var el = e.target; el && el !== document; el = el.parentNode) {
      if (el.nodeType !== 1) continue;
      var k = el.getAttribute('data-ev-' + type);
      if (k != null) { var fn = handlers[+k]; if (fn) fn(e); if (type === 'submit') e.preventDefault(); return true; }
    }
    return false;
  }

  window.__dcBoot = function (tplId, C, props) {
    root = document.getElementById('dc-root');
    tpl = document.getElementById(tplId || 'dc-template').content;
    props = props || window.__dcProps || {};
    C = C || window.__dcComponent;
    comp = new C(props);
    if (!comp.state) comp.state = {};
    render();
    document.addEventListener('click', function (e) { dispatch('click', e); });
    document.addEventListener('input', function (e) {
      var t = e.target, tt = (t.type || '').toLowerCase();
      if (t.localName === 'select' || tt === 'checkbox' || tt === 'radio') return;
      dispatch('input', e) || dispatch('change', e);
    });
    document.addEventListener('change', function (e) {
      var t = e.target, tt = (t.type || '').toLowerCase();
      if (t.localName === 'select' || tt === 'checkbox' || tt === 'radio') dispatch('change', e);
    });
    document.addEventListener('submit', function (e) { if (!dispatch('submit', e)) { e.preventDefault(); if (window.__protoSubmit) window.__protoSubmit(e); } });
    if (window.__dcAfterBoot) window.__dcAfterBoot();
  };
  window.__dcRender = function () { schedule(); };
})();
