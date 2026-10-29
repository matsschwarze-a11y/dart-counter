// Kleine DOM-Helfer: h(), Dialoge, Toast, Formatierung.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Zahl mit Dezimalkomma. */
export function fmt(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return '–';
  return x.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(x, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '–';
  return fmt(x * 100, digits) + ' %';
}

export function dateTime(ts) {
  return new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function dateShort(ts) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

let toastTimer = null;
export function toast(msg, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Modaler Dialog. content: Node; buttons: [{label, value, primary, danger}]. Liefert Promise mit value. */
export function modal({ title, content, buttons = [{ label: 'OK', value: true, primary: true }], dismissValue = null }) {
  return new Promise((resolve) => {
    let closed = false;
    const close = (v) => {
      if (closed) return;
      closed = true;
      // Backdrop kurz unsichtbar stehen lassen, damit der Tap nicht auf das Element darunter durchschlägt.
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 350);
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(dismissValue);
    };
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      title ? h('h2', {}, title) : null,
      content ? h('div', { class: 'modal-body' }, content) : null,
      h('div', { class: 'modal-actions' }, buttons.map((b) =>
        h('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onClick: () => close(typeof b.value === 'function' ? b.value() : b.value) }, b.label))),
    );
    const backdrop = h('div', { class: 'backdrop', onClick: (e) => e.target === backdrop && close(dismissValue) }, box);
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey);
    const focus = box.querySelector('input, .btn.primary');
    if (focus) setTimeout(() => focus.focus(), 30);
  });
}

export async function confirmDialog(title, text, { okLabel = 'OK', danger = false } = {}) {
  return modal({
    title,
    content: text ? h('p', {}, text) : null,
    buttons: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, primary: !danger, danger }],
    dismissValue: false,
  });
}

export async function askText(title, value = '', { placeholder = '', okLabel = 'Speichern' } = {}) {
  const input = h('input', { type: 'text', value, placeholder, maxlength: 30, autocomplete: 'off', class: 'text-input' });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.closest('.modal').querySelector('.btn.primary').click();
  });
  const r = await modal({
    title,
    content: input,
    buttons: [{ label: 'Abbrechen', value: null }, { label: okLabel, value: () => input.value.trim() || null, primary: true }],
  });
  return r;
}

/** Datei zum Speichern anbieten. */
export function downloadFile(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Segmentierte Auswahl. options: [{value,label}]
 * Die Knöpfe bleiben beim Umschalten erhalten (nur Klassen ändern sich): Würden sie neu erzeugt,
 * leitet Safari den Klick an das erste Element weiter, sobald die Gruppe in einem <label> steckt.
 */
export function segmented(options, value, onChange, { name = '' } = {}) {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': name });
  const buttons = options.map((o) => h('button', {
    type: 'button',
    role: 'radio',
    onClick: (e) => {
      e.preventDefault();
      mark(o.value);
      onChange(o.value);
    },
  }, o.label));
  const mark = (val) => buttons.forEach((b, i) => {
    const on = options[i].value === val;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  mark(value);
  wrap.append(...buttons);
  return wrap;
}

/** Plus/Minus-Zähler. `values` (optional) begrenzt auf erlaubte Werte, z. B. nur ungerade. */
export function stepper(value, { min = 0, max = 99, step = 1, values = null, format = String, onChange }) {
  let v = value;
  const out = h('span', { class: 'stepper-value' }, format(v));
  const allowed = values || [];
  const set = (dir) => {
    let nv = v + dir * step;
    if (values) {
      const list = dir > 0 ? allowed.filter((x) => x > v) : allowed.filter((x) => x < v).reverse();
      nv = list.length ? list[0] : v;
    }
    v = Math.min(max, Math.max(min, nv));
    out.textContent = format(v);
    onChange(v);
  };
  const el = h('div', { class: 'stepper' },
    h('button', { type: 'button', class: 'btn icon', 'aria-label': 'weniger', onClick: (e) => { e.preventDefault(); set(-1); } }, '−'),
    out,
    h('button', { type: 'button', class: 'btn icon', 'aria-label': 'mehr', onClick: (e) => { e.preventDefault(); set(1); } }, '+'));
  el.setValue = (nv) => {
    v = nv;
    out.textContent = format(v);
  };
  return el;
}
