/*
  Emulador de ScriptUI + After Effects para a prévia do Mesmo Tools.
  Roda o MESMO código do painel (.jsx) no navegador:
  - layout automático (row/column/stack, alignment, spacing, margins)
  - controles nativos (texto, campos, dropdowns, checkboxes, sliders)
  - onDraw em <canvas> com a API de ScriptUIGraphics
  - um projeto do After simulado, para os botões responderem
  É uma aproximação: tamanhos e fontes podem diferir um pouco do After.
*/
(function () {
  "use strict";

  const FONT = '"Source Sans 3", "Segoe UI", system-ui, sans-serif';
  const meas = document.createElement("canvas").getContext("2d");
  function textW(s, size, bold) {
    meas.font = (bold ? "600 " : "") + (size || 12) + "px " + FONT;
    return meas.measureText(String(s == null ? "" : s)).width;
  }
  const rgba = (c) => c ? `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c.length > 3 ? c[3] : 1})` : "#ccc";

  // ---------- Dimensão indexável ([0]/[1] e width/height) ----------
  function dim(w, h, a, b) {
    const o = {};
    let W = w, H = h;
    Object.defineProperty(o, a, { get: () => W, set: (v) => { W = v; }, enumerable: true });
    Object.defineProperty(o, b, { get: () => H, set: (v) => { H = v; }, enumerable: true });
    Object.defineProperty(o, 0, { get: () => W, set: (v) => { W = v; } });
    Object.defineProperty(o, 1, { get: () => H, set: (v) => { H = v; } });
    Object.defineProperty(o, "length", { value: 2 });
    return o;
  }
  const asPair = (v) => (v == null ? [0, 0] : [v[0] !== undefined ? v[0] : v.width, v[1] !== undefined ? v[1] : v.height]);

  // ---------- Graphics ----------
  function Graphics(el) { this.el = el; this.ctx = null; this.foregroundColor = null; }
  Graphics.prototype = {
    BrushType: { SOLID_COLOR: 1 }, PenType: { SOLID_COLOR: 1 },
    newBrush(t, c) { return { color: c }; },
    newPen(t, c, w) { return { color: c, width: w || 1 }; },
    newPath() { this.ctx && this.ctx.beginPath(); },
    moveTo(x, y) { this.ctx && this.ctx.moveTo(x, y); },
    lineTo(x, y) { this.ctx && this.ctx.lineTo(x, y); },
    closePath() { this.ctx && this.ctx.closePath(); },
    rectPath(x, y, w, h) { this.ctx && this.ctx.rect(x, y, w, h); },
    ellipsePath(x, y, w, h) { this.ctx && this.ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); },
    fillPath(b) { if (!this.ctx) return; this.ctx.fillStyle = rgba(b && b.color); this.ctx.fill(); },
    strokePath(p) { if (!this.ctx) return; this.ctx.strokeStyle = rgba(p && p.color); this.ctx.lineWidth = (p && p.width) || 1; this.ctx.stroke(); },
    measureString(s, f) { const size = (f && f.size) || 12; return [textW(s, size, f && f.style === 1), size + 3]; },
    drawString(s, p, x, y, f) {
      if (!this.ctx) return;
      const size = (f && f.size) || 12;
      this.ctx.font = (f && f.style === 1 ? "600 " : "") + size + "px " + FONT;
      this.ctx.fillStyle = rgba(p && p.color);
      this.ctx.textBaseline = "top";
      this.ctx.fillText(String(s), x, y + 1);
    }
  };

  // ---------- Elementos ----------
  const CONTAINERS = { window: 1, panel: 1, group: 1, tab: 1, tabbedpanel: 1 };
  let ids = 0;
  const EMU = { root: null, dirty: true, onAlert: null, renderQueued: false };

  function El(type, text, props, parent) {
    this.id = "e" + (++ids);
    this.type = type;
    this.parent = parent || null;
    this.children = [];
    this.properties = props || {};
    this.text = text || "";
    this.visible = true;
    this.enabled = true;
    this.value = type === "checkbox" ? false : 0;
    this.helpTip = "";
    this.items = [];
    this._sel = null;
    this.listeners = {};
    this.orientation = type === "group" ? "row" : "column";
    this.spacing = 10;
    this.margins = type === "panel" ? 10 : type === "window" ? 12 : 0;
    this.alignment = null;
    this.alignChildren = null;
    this.graphics = new Graphics(this);
    // preferredSize: valores definidos pelo script; onde não foi definido (0/-1),
    // a leitura devolve o tamanho calculado pelo layout, como no ScriptUI.
    const self0 = this;
    const ex = [0, 0];
    const prefView = {};
    const rd = (i) => (ex[i] > 0 ? ex[i] : (self0._pref ? self0._pref[i] : ex[i]));
    [["width", 0], ["height", 1], [0, 0], [1, 1]].forEach(([k, i]) =>
      Object.defineProperty(prefView, k, { get: () => rd(i), set: (v) => { ex[i] = v; }, enumerable: typeof k === "string" }));
    Object.defineProperty(prefView, "length", { value: 2 });
    this._ex = ex;
    Object.defineProperty(this, "preferredSize", {
      get: () => prefView,
      set: (v) => { const p = asPair(v); ex[0] = p[0]; ex[1] = p[1]; }
    });
    let sizeRef = dim(0, 0, "width", "height");
    Object.defineProperty(this, "size", {
      get: () => sizeRef,
      set: (v) => { const p = asPair(v); sizeRef = dim(p[0], p[1], "width", "height"); }
    });
    let locRef = dim(0, 0, "x", "y");
    Object.defineProperty(this, "location", {
      get: () => locRef,
      set: (v) => { const p = asPair(v); locRef = dim(p[0], p[1], "x", "y"); }
    });
    let maxRef = [10000, 10000];
    Object.defineProperty(this, "maximumSize", {
      get: () => maxRef, set: (v) => { maxRef = asPair(v); }
    });
    const self = this;
    this.layout = {
      layout() { measure(self); if (self === EMU.root || !self.size[0]) { if (!self.size[0] && self !== EMU.root) self.size = self._pref; } place(self, self.location[0], self.location[1], self.size[0] || self._pref[0], self.size[1] || self._pref[1]); queueRender(); },
      resize() { place(self, self.location[0], self.location[1], self.size[0], self.size[1]); queueRender(); }
    };
  }
  El.prototype = {
    add(type, a, b, c) {
      let text = "", props = c || {};
      if (type === "item" || type === "separator") {
        const it = { text: type === "separator" ? "" : String(a), index: this.items.length, separator: type === "separator", subItems: [{ text: "" }] };
        this.items.push(it);
        return it;
      }
      if (typeof b === "string") text = b;
      const el = new El(type, text, props, this);
      if (Array.isArray(b)) b.forEach((x) => el.add("item", x));
      if (type === "slider" || type === "scrollbar") {
        el.value = typeof b === "number" ? b : 0;
        el.minvalue = typeof c === "number" ? c : 0;
        el.maxvalue = typeof arguments[4] === "number" ? arguments[4] : 100;
        el.properties = {};
      }
      if (type === "edittext") el.properties = props || {};
      this.children.push(el);
      return el;
    },
    remove(c) { this.children = this.children.filter((x) => x !== c); queueRender(); },
    removeAll() { this.items = []; this._sel = null; },
    addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); },
    hide() { this.visible = false; queueRender(); },
    show() { this.visible = true; queueRender(); },
    notify(ev) { if (this[ev]) this[ev](); },
    get selection() { return this._sel; },
    set selection(v) { this._sel = typeof v === "number" ? (this.items[v] || null) : v; },
    get window() { return EMU.root; }
  };

  // ---------- Layout ----------
  const marg = (m) => (typeof m === "number" ? [m, m, m, m] : [m[0] || 0, m[1] || 0, m[2] || 0, m[3] || 0]);
  function alignOf(child, parent, axis) {
    // axis 0 = horizontal, 1 = vertical
    let a = child.alignment;
    if (a == null) {
      let ac = parent.alignChildren;
      if (ac == null) ac = parent.orientation === "row" ? ["left", "center"] : ["center", "top"];
      a = ac;
    }
    if (typeof a === "string") a = [a, a];
    let v = a[axis];
    if (v === "top" && axis === 0) v = "left";
    if (v === "bottom" && axis === 0) v = "right";
    if (v === "left" && axis === 1) v = "top";
    if (v === "right" && axis === 1) v = "bottom";
    return v || "center";
  }

  function natural(el) {
    const t = el.type, txt = el.text || "";
    if (t === "statictext") {
      if (el.properties && el.properties.multiline) return [Math.min(textW(txt, 12) + 4, 240), 32];
      return [Math.ceil(textW(txt, 12)) + 3, 17];
    }
    if (t === "button") return [Math.ceil(textW(txt, 12)) + 24, 22];
    if (t === "checkbox") return [Math.ceil(textW(txt, 12)) + 22, 18];
    if (t === "edittext") {
      if (el.properties && el.properties.multiline) return [160, 60];
      const w = el.characters ? el.characters * 7.5 + 10 : Math.max(textW(txt, 12) + 14, 40);
      return [Math.ceil(w), 22];
    }
    if (t === "dropdownlist") {
      let w = 40;
      el.items.forEach((i) => { w = Math.max(w, textW(i.text, 12)); });
      return [Math.ceil(w) + 34, 22];
    }
    if (t === "slider") return [100, 20];
    if (t === "scrollbar") return [14, 100];
    if (t === "listbox") return [150, 100];
    return [0, 0];
  }

  function measure(el) {
    let w = 0, h = 0;
    if (CONTAINERS[el.type]) {
      const m = marg(el.margins);
      const kids = el.children;
      kids.forEach(measure);
      if (el.orientation === "stack") {
        kids.forEach((k) => { w = Math.max(w, k._pref[0]); h = Math.max(h, k._pref[1]); });
      } else if (el.orientation === "row") {
        kids.forEach((k, i) => { w += k._pref[0] + (i ? el.spacing : 0); h = Math.max(h, k._pref[1]); });
      } else {
        kids.forEach((k, i) => { h += k._pref[1] + (i ? el.spacing : 0); w = Math.max(w, k._pref[0]); });
      }
      w += m[0] + m[2];
      h += m[1] + m[3];
    } else {
      [w, h] = natural(el);
    }
    const p = el._ex;
    if (p[0] > 0) w = p[0];
    if (p[1] > 0) h = p[1];
    const mx = el.maximumSize;
    w = Math.min(w, mx[0]);
    h = Math.min(h, mx[1]);
    el._pref = [w, h];
    return el._pref;
  }

  function place(el, x, y, w, h) {
    el.location = [x, y];
    el.size = [w, h];
    if (!CONTAINERS[el.type]) return;
    const m = marg(el.margins);
    const iw = w - m[0] - m[2], ih = h - m[1] - m[3];
    const kids = el.children;
    if (!kids.length) return;
    if (!kids[0]._pref) kids.forEach(measure);

    if (el.orientation === "stack") {
      kids.forEach((k) => {
        const ah = alignOf(k, el, 0), av = alignOf(k, el, 1);
        const kw = ah === "fill" ? Math.min(iw, k.maximumSize[0]) : Math.min(k._pref[0], iw);
        const kh = av === "fill" ? Math.min(ih, k.maximumSize[1]) : k._pref[1];
        const kx = m[0] + (ah === "right" ? iw - kw : ah === "center" ? (iw - kw) / 2 : 0);
        const ky = m[1] + (av === "bottom" ? ih - kh : av === "center" ? (ih - kh) / 2 : 0);
        place(k, Math.round(kx), Math.round(ky), Math.round(kw), Math.round(kh));
      });
      return;
    }

    const row = el.orientation === "row";
    const mainAxis = row ? 0 : 1, crossAxis = row ? 1 : 0;
    const inner = row ? iw : ih, cross = row ? ih : iw;
    let sum = 0;
    kids.forEach((k, i) => { sum += k._pref[mainAxis] + (i ? el.spacing : 0); });
    let extra = inner - sum;
    const fills = kids.filter((k) => alignOf(k, el, mainAxis) === "fill");
    const sizes = kids.map((k) => k._pref[mainAxis]);
    if (extra > 0 && fills.length) {
      // espaço sobrando vai para os filhos "fill"
      let left = extra, pending = fills.slice();
      while (left > 0.5 && pending.length) {
        const share = left / pending.length;
        const next = [];
        pending.forEach((k) => {
          const i = kids.indexOf(k);
          const cap = k.maximumSize[mainAxis];
          const add = Math.min(share, cap - sizes[i]);
          sizes[i] += add; left -= add;
          if (sizes[i] < cap - 0.5) next.push(k);
        });
        if (next.length === pending.length && Math.abs(left) < 0.5) break;
        pending = next;
      }
      extra = left;
    } else if (extra < 0 && fills.length) {
      // painel menor que o conteúdo: os "fill" encolhem até o tamanho preferido mínimo do texto
      let need = -extra;
      fills.forEach((k) => {
        const i = kids.indexOf(k);
        const min = Math.min(sizes[i], 30);
        const take = Math.min(need, sizes[i] - min);
        sizes[i] -= take; need -= take;
      });
      extra = -need;
    }
    let pos = (row ? m[0] : m[1]);
    // alinhamento do grupo inteiro no eixo principal quando sobra espaço
    if (extra > 0) {
      const a0 = alignOf(kids[0], el, mainAxis);
      if (a0 === "center") pos += extra / 2;
      else if (a0 === "right" || a0 === "bottom") pos += extra;
    }
    kids.forEach((k, i) => {
      const ac = alignOf(k, el, crossAxis);
      let cs = ac === "fill" ? Math.min(cross, k.maximumSize[crossAxis]) : Math.min(k._pref[crossAxis], Math.max(cross, k._pref[crossAxis]));
      let co = (row ? m[1] : m[0]) + (ac === "fill" ? 0 : (ac === "center" ? (cross - cs) / 2 : (ac === "right" || ac === "bottom") ? cross - cs : 0));
      const ms = sizes[i];
      if (row) place(k, Math.round(pos), Math.round(co), Math.round(ms), Math.round(cs));
      else place(k, Math.round(co), Math.round(pos), Math.round(cs), Math.round(ms));
      pos += ms + el.spacing;
    });
  }

  // ---------- Render (DOM) ----------
  const nodes = new Map();
  const hover = new Set();
  let pressed = null;

  function queueRender() {
    if (EMU.renderQueued) return;
    EMU.renderQueued = true;
    requestAnimationFrame(() => { EMU.renderQueued = false; render(); });
  }
  EMU.queueRender = queueRender;

  function dispatch(fn) {
    try { fn(); } catch (e) { console.error(e); EMU.onAlert && EMU.onAlert("Erro no script: " + e.message, "error"); }
    queueRender();
  }

  function rel(ev, node) {
    const r = node.getBoundingClientRect();
    return { clientX: ev.clientX - r.left, clientY: ev.clientY - r.top, shiftKey: ev.shiftKey, button: ev.button };
  }

  function hookListeners(el, node) {
    ["mousedown", "mousemove", "mouseup", "mouseover", "mouseout"].forEach((t) => {
      const dom = t === "mouseover" ? "mouseenter" : t === "mouseout" ? "mouseleave" : t;
      node.addEventListener(dom, (ev) => {
        const ls = el.listeners[t];
        if (ls && ls.length) dispatch(() => ls.forEach((f) => f.call(el, rel(ev, node))));
      });
    });
  }

  function makeNode(el) {
    let node;
    const t = el.type;
    if (el.onDraw) {
      node = document.createElement("canvas");
      node.className = "su-draw";
      node.addEventListener("mouseenter", () => { hover.add(el); queueRender(); });
      node.addEventListener("mouseleave", () => { hover.delete(el); if (pressed === el) pressed = null; queueRender(); });
      node.addEventListener("mousedown", () => { pressed = el; queueRender(); });
      node.addEventListener("mouseup", () => {
        const was = pressed === el; pressed = null;
        if (was && (t === "button") && el.enabled && el.onClick) dispatch(() => el.onClick.call(el));
        queueRender();
      });
      if (el.helpTip) node.title = el.helpTip;
    } else if (CONTAINERS[t]) {
      node = document.createElement("div");
      node.className = "su-box";
    } else if (t === "statictext") {
      node = document.createElement("div");
      node.className = "su-text" + (el.properties && el.properties.multiline ? " multi" : "");
    } else if (t === "button") {
      node = document.createElement("button");
      node.className = "su-btn";
      node.addEventListener("click", () => el.onClick && dispatch(() => el.onClick.call(el)));
    } else if (t === "checkbox") {
      node = document.createElement("label");
      node.className = "su-check";
      const inp = document.createElement("input"); inp.type = "checkbox";
      const span = document.createElement("span");
      node.append(inp, span);
      inp.addEventListener("change", () => { el.value = inp.checked; el.onClick && dispatch(() => el.onClick.call(el)); });
    } else if (t === "edittext") {
      const multi = el.properties && el.properties.multiline;
      node = document.createElement(multi ? "textarea" : "input");
      node.className = "su-edit";
      node.spellcheck = false;
      node.addEventListener("input", () => { el.text = node.value; el.onChanging && dispatch(() => el.onChanging.call(el)); });
      node.addEventListener("change", () => { el.text = node.value; el.onChange && dispatch(() => el.onChange.call(el)); });
      if (!multi) node.addEventListener("keydown", (e) => { if (e.key === "Enter") node.blur(); });
    } else if (t === "dropdownlist") {
      node = document.createElement("select");
      node.className = "su-dd";
      node.addEventListener("change", () => {
        el._sel = el.items[Number(node.value)] || null;
        el.onChange && dispatch(() => el.onChange.call(el));
      });
    } else if (t === "listbox") {
      node = document.createElement("div"); node.className = "su-list"; node.tabIndex = 0;
      const pick = (ev) => {
        const row = ev.target.closest("[data-i]"); if (!row) return null;
        el._sel = el.items[Number(row.dataset.i)] || null; return row;
      };
      node.addEventListener("click", (ev) => { if (pick(ev)) el.onChange ? dispatch(() => el.onChange.call(el)) : queueRender(); });
      node.addEventListener("dblclick", (ev) => { if (pick(ev) && el.onDoubleClick) dispatch(() => el.onDoubleClick.call(el)); });
      node.addEventListener("keydown", (ev) => {
        if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
        const i = el._sel ? el.items.indexOf(el._sel) : -1;
        const j = Math.max(0, Math.min(el.items.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)));
        el._sel = el.items[j]; ev.preventDefault();
        el.onChange ? dispatch(() => el.onChange.call(el)) : queueRender();
      });
    } else if (t === "slider") {
      node = document.createElement("input"); node.type = "range"; node.className = "su-slider"; node.step = "any";
      node.addEventListener("input", () => { el.value = Number(node.value); el.onChanging && dispatch(() => el.onChanging.call(el)); });
      node.addEventListener("change", () => { el.value = Number(node.value); el.onChange && dispatch(() => el.onChange.call(el)); });
    } else if (t === "scrollbar") {
      node = document.createElement("div"); node.className = "su-scroll";
      const thumb = document.createElement("div"); thumb.className = "su-thumb"; node.appendChild(thumb);
      let drag = null;
      thumb.addEventListener("mousedown", (e) => { drag = { y: e.clientY, v: el.value }; e.preventDefault(); });
      window.addEventListener("mousemove", (e) => {
        if (!drag) return;
        const track = el.size[1] - thumb.offsetHeight;
        const range = el.maxvalue - (el.minvalue || 0);
        el.value = Math.max(0, Math.min(el.maxvalue, drag.v + (e.clientY - drag.y) / Math.max(1, track) * range));
        el.onChanging && dispatch(() => el.onChanging.call(el));
      });
      window.addEventListener("mouseup", () => { if (drag) { drag = null; el.onChange && dispatch(() => el.onChange.call(el)); } });
      node.addEventListener("wheel", (e) => {
        el.value = Math.max(0, Math.min(el.maxvalue, el.value + e.deltaY * 0.6));
        el.onChanging && dispatch(() => el.onChanging.call(el));
        e.preventDefault();
      }, { passive: false });
    } else {
      node = document.createElement("div");
    }
    node.style.position = "absolute";
    hookListeners(el, node);
    nodes.set(el, node);
    return node;
  }

  function sync(el, parentNode) {
    let node = nodes.get(el);
    if (!node) { node = makeNode(el); parentNode.appendChild(node); }
    else if (node.parentNode !== parentNode) parentNode.appendChild(node);
    const shown = el.visible && el.size[0] > 0 && el.size[1] > 0;
    node.hidden = !el.visible;
    node.style.left = el.location[0] + "px";
    node.style.top = el.location[1] + "px";
    node.style.width = Math.max(0, el.size[0]) + "px";
    node.style.height = Math.max(0, el.size[1]) + "px";
    if (el.helpTip) node.title = el.helpTip;
    const dis = !el.enabled || (el.parent && isDisabled(el.parent));
    node.classList.toggle("dis", !!dis);

    if (el.onDraw && node.tagName === "CANVAS") {
      if (shown) {
        const dpr = window.devicePixelRatio || 1;
        const W = el.size[0], H = el.size[1];
        if (node.width !== Math.round(W * dpr) || node.height !== Math.round(H * dpr)) { node.width = Math.round(W * dpr); node.height = Math.round(H * dpr); }
        const ctx = node.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        el.graphics.ctx = ctx;
        try { el.onDraw.call(el, { mouseOver: hover.has(el), leftButtonPressed: pressed === el }); } catch (e) { console.error(e); }
        el.graphics.ctx = null;
      }
    } else if (el.type === "statictext") {
      node.textContent = el.text;
      const fc = el.graphics.foregroundColor;
      node.style.color = fc ? rgba(fc.color) : "";
    } else if (el.type === "button") {
      node.textContent = el.text;
      node.disabled = !!dis;
    } else if (el.type === "checkbox") {
      node.lastChild.textContent = el.text;
      node.firstChild.checked = !!el.value;
      node.firstChild.disabled = !!dis;
    } else if (el.type === "edittext") {
      if (document.activeElement !== node && node.value !== el.text) node.value = el.text;
      node.disabled = !!dis;
    } else if (el.type === "dropdownlist") {
      const sig = el.items.map((i) => (i.separator ? "—" : i.text)).join("\u0001");
      if (node._sig !== sig) {
        node.innerHTML = "";
        el.items.forEach((it, i) => {
          const o = document.createElement("option");
          o.value = String(i);
          if (it.separator) { o.disabled = true; o.textContent = "──────────"; } else o.textContent = it.text;
          node.appendChild(o);
        });
        node._sig = sig;
      }
      node.value = el._sel ? String(el.items.indexOf(el._sel)) : "";
      node.disabled = !!dis;
    } else if (el.type === "listbox") {
      const sig = el.items.map((i) => i.text).join("\u0001");
      if (node._sig !== sig) {
        node.innerHTML = "";
        el.items.forEach((it, i) => {
          const r = document.createElement("div"); r.className = "su-row"; r.dataset.i = String(i);
          r.textContent = it.text; if (/^— .* —$/.test(it.text)) r.classList.add("hdr");
          node.appendChild(r);
        });
        node._sig = sig;
      }
      const si = el._sel ? el.items.indexOf(el._sel) : -1;
      Array.prototype.forEach.call(node.children, (r, i) => r.classList.toggle("on", i === si));
      if (si >= 0 && node._lastSel !== si) { const r = node.children[si]; if (r && r.scrollIntoView) { const top = r.offsetTop, bot = top + r.offsetHeight; if (top < node.scrollTop || bot > node.scrollTop + node.clientHeight) node.scrollTop = top - 20; } }
      node._lastSel = si;
    } else if (el.type === "slider") {
      node.min = String(el.minvalue); node.max = String(el.maxvalue);
      if (document.activeElement !== node) node.value = String(el.value);
      node.disabled = !!dis;
    } else if (el.type === "scrollbar") {
      const thumb = node.firstChild;
      const H = el.size[1];
      const vis = Math.max(30, el.jumpdelta || 100);
      const range = Math.max(1, el.maxvalue - (el.minvalue || 0));
      const th = Math.max(24, Math.min(H, H * vis / (vis + range)));
      thumb.style.height = th + "px";
      thumb.style.top = ((H - th) * (el.value / range)) + "px";
      node.classList.toggle("dis", !el.enabled);
    }
    if (CONTAINERS[el.type]) el.children.forEach((k) => sync(k, node));
  }
  function isDisabled(el) { while (el) { if (el.enabled === false) return true; el = el.parent; } return false; }

  function render() {
    if (!EMU.root || !EMU.host) return;
    sync(EMU.root, EMU.host);
  }
  EMU.render = render;

  // ---------- ScriptUI globals ----------
  function Panel() {}
  function Window(kind, title) { return new El("window", title || ""); }
  const ScriptUI = {
    newFont(name, style, size) { return { name: name, style: style, size: size }; },
    FontStyle: { REGULAR: 0, BOLD: 1, ITALIC: 2, BOLDITALIC: 3 },
    environment: { keyboardState: { altKey: false, shiftKey: false } }
  };
  window.addEventListener("keydown", (e) => { ScriptUI.environment.keyboardState.altKey = e.altKey; ScriptUI.environment.keyboardState.shiftKey = e.shiftKey; });
  window.addEventListener("keyup", (e) => { ScriptUI.environment.keyboardState.altKey = e.altKey; ScriptUI.environment.keyboardState.shiftKey = e.shiftKey; });

  // ---------- After Effects simulado ----------
  function buildAE(log) {
    let idn = 1;
    const PVT = { NO_VALUE: 0, ThreeD_SPATIAL: 1, ThreeD: 2, TwoD_SPATIAL: 3, TwoD: 4, OneD: 5, COLOR: 6, CUSTOM_VALUE: 7, MARKER: 8, LAYER_INDEX: 9, MASK_INDEX: 10, SHAPE: 11, TEXT_DOCUMENT: 12 };
    const PT = { PROPERTY: 1, INDEXED_GROUP: 2, NAMED_GROUP: 3 };
    function KeyframeEase(s, i) { this.speed = s; this.influence = i; }
    function MarkerValue(c) { this.comment = c; }
    const idxOf = (o) => { const P = o.parentProperty; const arr = P && (P.props || P.groups); return arr ? arr.indexOf(o) + 1 : 1; };
    const ownerOf = (o) => { let x = o; while (x.parentProperty) x = x.parentProperty; return x; };
    function prop(name, mn, v, vt, parent) {
      return {
        get propertyIndex() { return idxOf(this); }, _expr: "",
        get expression() { return this._expr; },
        set expression(c) { this._expr = String(c); log("ƒ " + ownerOf(this).name + " › " + this.name + "\n" + String(c).split("\n").filter((l) => l.trim()).slice(0, 4).join("\n") + (String(c).split("\n").length > 4 ? "\n…" : ""), "expr"); },
        name, matchName: mn, propertyType: PT.PROPERTY, propertyValueType: vt, parentProperty: parent, v, keys: [],
        expressionError: "", canSetExpression: true, canVaryOverTime: true, dimensionsSeparated: false,
        get value() { return this.v; }, get numKeys() { return this.keys.length; },
        get selectedKeys() { const o = []; this.keys.forEach((k, i) => { if (k.sel) o.push(i + 1); }); return o; },
        valueAtTime() { return this.keys.length ? this.keys[0].v : this.v; },
        setValue(x) { this.v = x; }, keyTime(i) { return this.keys[i - 1].t; }, keyValue(i) { return this.keys[i - 1].v; },
        setValueAtKey(i, x) { this.keys[i - 1].v = x; },
        setValueAtTime(t, x) { this.keys.push({ t, v: x, sel: false, ein: [new KeyframeEase(0, 16.7)], eout: [new KeyframeEase(0, 16.7)] }); this.keys.sort((a, b) => a.t - b.t); },
        setValuesAtTimes(ts, vs) { ts.forEach((t, i) => this.setValueAtTime(t, vs[i])); },
        removeKey(i) { this.keys.splice(i - 1, 1); },
        keyInTemporalEase(i) { return this.keys[i - 1].ein; }, keyOutTemporalEase(i) { return this.keys[i - 1].eout; },
        setTemporalEaseAtKey(i, a, b) { this.keys[i - 1].ein = a; this.keys[i - 1].eout = b; },
        keyInInterpolationType() { return 1; }, keyOutInterpolationType() { return 1; },
        setInterpolationTypeAtKey() {}, setTemporalContinuousAtKey() {}, setTemporalAutoBezierAtKey() {},
        propertyGroup(n) { let g = this; for (let i = 0; i < n; i++) g = g.parentProperty; return g; },
        get propertyDepth() { let d = 0, g = this; while (g.parentProperty) { d++; g = g.parentProperty; } return d; }
      };
    }
    function group(name, mn, parent) {
      const g = {
        name, matchName: mn, propertyType: PT.NAMED_GROUP, parentProperty: parent, props: [], get propertyIndex() { return idxOf(this); },
        get numProperties() { return this.props.length; },
        property(k) { return typeof k === "number" ? this.props[k - 1] || null : this.props.find((p) => p.name === k || p.matchName === k) || null; },
        addProperty(mn2) {
          const count = (m) => g.props.filter((p) => p.matchName === m).length + 1;
          const NAMES = { "ADBE Slider Control": "Slider Control", "ADBE Text Animator": "Animator " + count(mn2), "ADBE Text Selector": "Range Selector " + count(mn2), "ADBE Vector Shape - Rect": "Rectangle Path " + count(mn2), "ADBE Vector Graphic - Fill": "Fill " + count(mn2), "ADBE Text Opacity": "Opacity" };
          let n;
          if (mn2 === "ADBE Text Opacity") n = prop("Opacity", mn2, 100, PVT.OneD, g);
          else {
            n = group(NAMES[mn2] || mn2, mn2, g);
            if (mn2 === "ADBE Slider Control") n.props.push(prop("Slider", "ADBE Slider Control-0001", 0, PVT.OneD, n));
            if (mn2 === "ADBE Text Animator") n.props.push(group("Range Selectors", "ADBE Text Selectors", n), group("Properties", "ADBE Text Animator Properties", n));
            if (mn2 === "ADBE Text Selector") n.props.push(prop("Start", "ADBE Text Percent Start", 0, PVT.OneD, n), prop("End", "ADBE Text Percent End", 100, PVT.OneD, n));
            if (mn2 === "ADBE Vector Shape - Rect") n.props.push(prop("Size", "ADBE Vector Rect Size", [100, 100], PVT.TwoD, n));
          }
          g.props.push(n);
          log("+ " + ownerOf(g).name + " › " + n.name, "add");
          return n;
        },
        remove() { parent.props.splice(parent.props.indexOf(g), 1); },
        propertyGroup(n) { let x = this; for (let i = 0; i < n; i++) x = x.parentProperty; return x; },
        get propertyDepth() { let d = 0, x = this; while (x.parentProperty) { d++; x = x.parentProperty; } return d; }
      };
      return g;
    }
    class AVLayer {} class ShapeLayer extends AVLayer {} class TextLayer extends AVLayer {} class CameraLayer {} class LightLayer {}
    function CompItem() {}
    const comp = Object.create(CompItem.prototype);
    Object.assign(comp, { name: "Storyboard_v3", id: idn++, width: 1920, height: 1080, pixelAspect: 1, duration: 10, frameRate: 30, frameDuration: 1 / 30, time: 0, workAreaStart: 0, workAreaDuration: 10, motionBlur: false, renderer: "ADBE Advanced 3d", renderers: ["ADBE Advanced 3d", "ADBE Calder", "ADBE Ernst"], _layers: [], selectedProperties: [] });
    Object.defineProperty(comp, "numLayers", { get: () => comp._layers.length });
    Object.defineProperty(comp, "selectedLayers", { get: () => comp._layers.filter((l) => l.selected) });
    comp.layer = (i) => comp._layers[i - 1];
    comp.openInViewer = () => {};
    function layer(name, kind) {
      const L = Object.create((kind === "shape" ? ShapeLayer : kind === "text" ? TextLayer : kind === "camera" ? CameraLayer : kind === "light" ? LightLayer : AVLayer).prototype);
      Object.assign(L, { name, selected: false, enabled: true, threeDLayer: false, motionBlur: false, locked: false, parent: null, hasVideo: kind !== "audio", hasAudio: kind === "audio", nullLayer: kind === "null", adjustmentLayer: false, label: 0, containingComp: comp, groups: [], selectedProperties: [], source: { usedIn: [], remove() {} } });
      L.property = function (k) { return this.groups.find((g) => g.name === k || g.matchName === k) || null; };
      const tg = group("Transform", "ADBE Transform Group", L);
      tg.props.push(prop("Anchor Point", "ADBE Anchor Point", [0, 0, 0], PVT.ThreeD_SPATIAL, tg), prop("Position", "ADBE Position", [960, 540], PVT.ThreeD_SPATIAL, tg), prop("Scale", "ADBE Scale", [100, 100, 100], PVT.ThreeD, tg), prop("Rotation", "ADBE Rotate Z", 0, PVT.OneD, tg), prop("Opacity", "ADBE Opacity", 100, PVT.OneD, tg));
      L.groups.push(tg, group("Effects", "ADBE Effect Parade", L), prop("Marker", "ADBE Marker", null, PVT.MARKER, L));
      if (kind === "shape") { const c = group("Contents", "ADBE Root Vectors Group", L); ["Estrela", "Circulo"].forEach((n) => c.props.push(group(n, "ADBE Vector Group", c))); L.groups.push(c); }
      if (kind === "text") { const tp = group("Text", "ADBE Text Properties", L); tp.props.push(prop("Source Text", "ADBE Text Document", { text: "Mesmo Tools", baselineLocs: [0, 0, 300, 0] }, PVT.TEXT_DOCUMENT, tp), group("Animators", "ADBE Text Animators", tp)); L.groups.push(tp); }
      L.sourceRectAtTime = () => ({ left: 0, top: 0, width: 200, height: 100 });
      L.moveBefore = function (o) { const a = comp._layers; a.splice(a.indexOf(this), 1); a.splice(Math.max(0, a.indexOf(o)), 0, this); };
      L.duplicate = function () { const d = layer(this.name + " 2", kind); const a = comp._layers; a.splice(a.indexOf(this), 0, d); return d; };
      L.remove = function () { const a = comp._layers; a.splice(a.indexOf(this), 1); };
      Object.defineProperty(L, "index", { get: () => comp._layers.indexOf(L) + 1 });
      return L;
    }
    const logo = layer("Logo", "solid"); logo.selected = true;
    const pos = logo.groups[0].props[1];
    pos.keys = [{ t: 0, v: [200, 540], sel: true, ein: [new KeyframeEase(0, 33)], eout: [new KeyframeEase(0, 33)] }, { t: 1, v: [1700, 540], sel: true, ein: [new KeyframeEase(0, 33)], eout: [new KeyframeEase(0, 33)] }];
    logo.selectedProperties = [pos];
    comp.selectedProperties = [pos];
    pos.selected = true;
    comp._layers.push(layer("Titulo", "text"), layer("Subtitulo", "text"), logo, layer("Icones", "shape"), layer("Musica", "audio"));
    const add = (n, k) => { const l = layer(n, k); comp._layers.unshift(l); return l; };
    comp.layers = { addText: () => add("Texto", "text"), addSolid: (c, n) => add(n, "solid"), addNull: () => add("Null 1", "null"), addShape: () => add("Shape Layer 1", "shape"), addCamera: (n) => add(n, "camera"), addLight: (n) => add(n, "light") };
    const root = { name: "Root" };
    const settings = {};
    let undo = 0;
    const app = {
      project: { activeItem: comp, selection: [comp], rootFolder: root, items: { addFolder: (n) => ({ name: n, parentFolder: root }) } },
      settings: { haveSetting: (s, k) => k in settings, getSetting: (s, k) => settings[k], saveSetting: (s, k, v) => { settings[k] = String(v); } },
      beginUndoGroup(n) { if (undo === 0) log("↺ " + n, "undo"); undo++; }, endUndoGroup() { undo = Math.max(0, undo - 1); },
      findMenuCommandId: () => 0, executeCommand() {},
      preferences: { getPrefAsLong: () => 1 }
    };
    const store = {};
    function Folder(p) { this.fsName = p; this.exists = true; this.create = () => true; }
    Folder.userData = { fsName: "/userData" };
    function File(p) {
      this.fsName = p; this.name = p.split("/").pop(); this.encoding = "UTF-8"; this._buf = null; this._lines = null;
      Object.defineProperty(this, "exists", { get: () => p in store });
      Object.defineProperty(this, "eof", { get: () => !this._lines || this._lines.length === 0 });
    }
    File.prototype = {
      open(mode) { if (mode === "r") { if (!(this.fsName in store)) return false; this._lines = store[this.fsName].split("\n"); } else this._buf = []; return true; },
      readln() { return this._lines.shift(); }, writeln(s) { this._buf.push(s); }, write(s) { this._buf.push(s); },
      close() { if (this._buf) { store[this.fsName] = this._buf.join("\n"); this._buf = null; } this._lines = null; }
    };
    File.saveDialog = () => null; File.openDialog = () => null;
    return { app, comp, Folder, File, KeyframeEase, MarkerValue, CompItem, AVLayer, ShapeLayer, TextLayer, CameraLayer, LightLayer, PVT, PT, settings };
  }

  // ---------- montar e rodar ----------
  EMU.mount = function (host, source, log) {
    host.innerHTML = "";
    nodes.clear(); hover.clear();
    EMU.host = host;
    const ae = buildAE(log);
    EMU.ae = ae;
    const panel = new El("panel", "");
    panel.margins = 0;
    Object.setPrototypeOf(panel, Object.assign(Object.create(Panel.prototype), El.prototype));
    EMU.root = panel;
    const rect = host.getBoundingClientRect();
    panel.size = [Math.round(rect.width), Math.round(rect.height)];
    const $ = { global: {}, colorPicker: () => 0xBA99FA, writeln() {}, sleep() {} };
    const alertFn = (m) => log(String(m), "alert");
    const confirmFn = (m) => { log(String(m) + "  → Sim (automático na prévia)", "alert"); return true; };
    const names = ["Panel", "Window", "ScriptUI", "Folder", "File", "app", "alert", "confirm", "$", "CompItem", "AVLayer", "ShapeLayer", "TextLayer", "CameraLayer", "LightLayer", "KeyframeEase", "MarkerValue", "PropertyValueType", "PropertyType", "KeyframeInterpolationType", "LightType", "ParagraphJustification", "LineOrientation", "thisObj"];
    const vals = [Panel, Window, ScriptUI, ae.Folder, ae.File, ae.app, alertFn, confirmFn, $, ae.CompItem, ae.AVLayer, ae.ShapeLayer, ae.TextLayer, ae.CameraLayer, ae.LightLayer, ae.KeyframeEase, ae.MarkerValue, ae.PVT, ae.PT, { BEZIER: 1, LINEAR: 2, HOLD: 3 }, { POINT: 1 }, {}, undefined, panel];
    const code = source.replace(/\}\)\(this\);\s*$/, "})(thisObj);");
    // eslint-disable-next-line no-new-func
    const run = new Function(...names, code);
    run(...vals);
    render();
    EMU.resizeTo = function (w, h) {
      panel.size = [Math.round(w), Math.round(h)];
      place(panel, 0, 0, panel.size[0], panel.size[1]);
      dispatch(() => { if (panel.onResizing) panel.onResizing(); else if (panel.onResize) panel.onResize(); else panel.layout.resize(); });
    };
    return ae;
  };

  window.ScriptUIEmu = EMU;
})();
