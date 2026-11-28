// A tiny A2UI v0.9 renderer for Shiomi's question card (docs/ui-review/askback-mock.html).
//
// The agent sends A2UI messages (createSurface → updateComponents → updateDataModel), never HTML. Only the few
// basic-catalog components below are drawn, each with Umi's own parts (.seg toggles, .btn roles, .in fields);
// any other component is skipped, and every string goes in as text, never as markup.
//   Column / Row  · Text (caption | h3 | body) · ChoicePicker → .seg · DateTimeInput (date only) · TextField · Button
// onAction(name, context) is called when a Button fires; context values with { path } are read from the data model.

const get = (obj, path) => String(path || '').split('/').filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
function set(obj, path, v) {
  const keys = String(path || '').split('/').filter(Boolean); let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] = (o[k] && typeof o[k] === 'object') ? o[k] : {};
  if (keys.length) o[keys[keys.length - 1]] = v;
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; };
const str = v => (v && typeof v === 'object' && 'literalString' in v ? v.literalString : v == null ? '' : String(v));

// messages → { surfaceId, components: Map, root, model }
export function readSurface(messages) {
  const s = { surfaceId: '', components: new Map(), model: {} };
  for (const m of messages || []) {
    if (!m || typeof m !== 'object') continue;
    if (m.createSurface) s.surfaceId = m.createSurface.surfaceId;
    if (m.updateComponents) for (const c of m.updateComponents.components || []) if (c && c.id) s.components.set(c.id, c);
    if (m.updateDataModel) {
      const { path, value } = m.updateDataModel;
      if (!path || path === '/') s.model = structuredClone(value || {}); else set(s.model, path, structuredClone(value));
    }
  }
  return s;
}

export function renderSurface(messages, { onAction } = {}) {
  const s = readSurface(messages), model = s.model;
  const root = el('div', 'a2ui');
  const date = { box: null };
  const showDate = () => { if (date.box) date.box.hidden = get(model, '/answer/deadline') !== 'date'; };

  function draw(id, depth = 0) {
    const c = s.components.get(id); if (!c || depth > 6) return null;
    switch (c.component) {
      case 'Column': case 'Row': {
        const box = el('div', c.component === 'Row' ? 'a-row' : 'a-col');
        for (const k of c.children || []) { const n = draw(k, depth + 1); if (n) box.appendChild(n); }
        return box;
      }
      case 'Text': {
        const v = c.variant;
        return el(v === 'h3' ? 'h3' : v === 'caption' ? 'div' : 'p', v === 'caption' ? 'a-who' : v === 'h3' ? '' : 'a-sub', str(c.text));
      }
      case 'ChoicePicker': {
        const wrap = el('div', 'a-field');
        if (c.label) wrap.appendChild(el('div', 'lbl', str(c.label)));
        const seg = el('div', 'seg'); seg.dataset.seg = `a2ui-${c.id}`;
        const path = c.value && c.value.path;
        for (const o of (c.options || []).slice(0, 6)) {
          const b = el('button', get(model, path) === o.value ? 'on' : '', str(o.label)); b.type = 'button';
          b.onclick = () => { seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); set(model, path, o.value); showDate(); };
          seg.appendChild(b);
        }
        wrap.appendChild(seg); return wrap;
      }
      case 'DateTimeInput': {
        const wrap = el('div', 'a-field a-date');
        const inp = el('input', 'in'); inp.type = 'date'; inp.value = get(model, c.value && c.value.path) || '';
        inp.onchange = () => set(model, c.value && c.value.path, inp.value);
        wrap.appendChild(inp); date.box = wrap; return wrap;
      }
      case 'TextField': {
        const wrap = el('div', 'a-field');
        if (c.label) wrap.appendChild(el('div', 'lbl', str(c.label)));
        const inp = el('input', 'in'); inp.type = 'text'; inp.maxLength = 200;
        inp.placeholder = str(c.placeholder); inp.value = get(model, c.value && c.value.path) || '';
        inp.oninput = () => set(model, c.value && c.value.path, inp.value);
        wrap.appendChild(inp); return wrap;
      }
      case 'Button': {
        const label = s.components.get(c.child);
        const b = el('button', 'btn ' + (c.variant === 'primary' ? 'pri' : c.variant === 'borderless' ? 'quiet' : ''), label ? str(label.text) : '');
        b.type = 'button';
        b.onclick = () => {
          const ev = (c.action && c.action.event) || {}, ctx = {};
          for (const [k, v] of Object.entries(ev.context || {})) ctx[k] = v && typeof v === 'object' && 'path' in v ? structuredClone(get(model, v.path)) : v;
          onAction && onAction(String(ev.name || ''), ctx, model);
        };
        return b;
      }
      default: return null; // not in Umi's catalog: skipped
    }
  }
  const tree = draw('root');
  if (tree) root.appendChild(tree);
  showDate();
  return root;
}
