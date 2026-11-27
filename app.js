// Umi table page: tasks listed by lake depth (data stays in this browser, shared with the home page)
import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/modular/sortable.core.esm.js';
import { tinykeys } from 'https://cdn.jsdelivr.net/npm/tinykeys@4.0.1/+esm';
import { parseQuick, ymd } from './parse.js';
import { t as tr, md, mdw, applyStatic } from './i18n.js';
import { load } from './store.js';
applyStatic(); document.title = tr('L.title');

const KEY = 'umi.v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const COLORS = ['#2f6f8f', '#6a5acd', '#c0812c', '#3c8d5a', '#b4566e', '#4f7cc4', '#8a7a3c', '#3f8f8b'];
const SECS = ['surface', 'shallows', 'depths'];
const WD = new Proxy([], { get: (_, k) => (/^\d$/.test(k) ? tr('wd')[+k] : undefined) });
const SEC = s => tr('L.d.' + s);

// ---------------------------------------------------------------- storage
// The sample data is the same one the home page uses (store.js), in the current language
const sample = () => load();
let S;
try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { S = null; }
if (!S || !Array.isArray(S.tasks)) S = sample();
S.settings = { budget: 300, season: 'auto', ...(S.settings || {}) };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
save();

// ---------------------------------------------------------------- dates and sections
const todayStr = () => ymd(new Date());
const plusDays = n => { const x = new Date(); x.setDate(x.getDate() + n); return ymd(x); };
const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00') - new Date(b + 'T00:00')) / 86400e3);
function secOf(t) {
  if (t.done) return 'bed';
  if (t.pin) return t.pin;
  if (t.due) {
    if (t.due <= todayStr()) return 'surface';
    if (t.due <= plusDays(6)) return 'shallows';
  }
  return 'depths';
}
function dueLabel(t) {
  if (!t.due) return '';
  const n = dayDiff(t.due, todayStr());
  const tm = t.time ? ` ${t.time}` : '';
  if (n < 0) return { text: n === -1 ? tr('due.late1') : tr('due.late', { n: -n }), late: true };
  if (n === 0) return { text: tr('due.today', { tm }), late: !!t.time && t.time < new Date().toTimeString().slice(0, 5) };
  if (n === 1) return { text: tr('due.tomorrow', { tm }) };
  if (n < 7) return { text: tr('due.wd', { wd: WD[new Date(t.due + 'T00:00').getDay()], tm }) };
  const d = new Date(t.due + 'T00:00');
  return { text: tr('due.date', { md: md(d) }) + tm };
}
const estLabel = m => !m ? '' : m < 60 ? tr('est.m', { m }) : (m % 60 ? tr('est.hm', { h: Math.floor(m / 60), m: m % 60 }) : tr('est.h', { h: m / 60 }));
const REPEAT = { get daily() { return tr('repeat.daily'); }, get weekdays() { return tr('repeat.weekdays'); }, get weekly() { return tr('repeat.weekly'); }, get monthly() { return tr('repeat.monthly'); } };
const areaOf = id => S.areas.find(a => a.id === id);

// ---------------------------------------------------------------- display
let filter = '';
let openId = null, selId = null;
const visible = t => !filter || t.area === filter;

function rowHTML(t) {
  const a = areaOf(t.area), dl = dueLabel(t);
  const meta = [
    dl ? `<span class="${dl.late ? 'late' : ''}">${esc(dl.text)}</span>` : '',
    t.est ? `<span>${estLabel(t.est)}</span>` : '',
    t.repeat ? `<span>↻ ${REPEAT[t.repeat]}</span>` : '',
    a && !filter ? `<span><i class="adot" style="background:${a.color}"></i>${esc(a.name)}</span>` : '',
    t.notes ? `<span>${tr('L.notes')}</span>` : ''
  ].join('');
  const tag = t.kind ? `<span class="tag ${t.kind}">${tr(t.kind === 'must' ? 'kind.must' : 'kind.self')}</span>` : '<span></span>';
  return `<div class="row${t.done ? ' done' : ''}${t.id === selId ? ' sel' : ''}" data-id="${t.id}">
    <button class="ck" aria-label="${tr(t.done ? 'L.restore' : 'L.finish')}"></button>
    <div class="body"><div class="t">${esc(t.title)}</div>${meta ? `<div class="m">${meta}</div>` : ''}</div>${tag}
    ${t.id === openId ? editorHTML(t) : ''}</div>`;
}
function editorHTML(t) {
  const opt = (v, cur, label) => `<option value="${v}"${v === (cur ?? '') ? ' selected' : ''}>${label}</option>`;
  return `<div class="editor" data-edit="${t.id}">
    <label>${tr('L.f.task')}<input name="title" value="${esc(t.title)}"></label>
    <div class="f">
      <label>${tr('L.f.due')}<input type="date" name="due" value="${t.due || ''}"></label>
      <label>${tr('L.f.time')}<input type="time" name="time" value="${t.time || ''}"></label>
      <label>${tr('L.f.est')}<select name="est">${opt('', t.est ? String(t.est) : '', tr('L.none'))}${[10, 15, 20, 30, 45, 60, 90, 120, 180, 240].map(m => opt(String(m), t.est ? String(t.est) : '', estLabel(m))).join('')}</select></label>
      <label>${tr('L.f.area')}<select name="area">${opt('', t.area, tr('L.none'))}${S.areas.map(a => opt(a.id, t.area, esc(a.name))).join('')}</select></label>
      <label>${tr('L.f.kind')}<select name="kind">${opt('', t.kind, tr('L.none'))}${opt('must', t.kind, tr('L.mustLong'))}${opt('self', t.kind, tr('L.selfLong'))}</select></label>
      <label>${tr('L.f.repeat')}<select name="repeat">${opt('', t.repeat, tr('L.none'))}${['daily', 'weekdays', 'weekly', 'monthly'].map(k => opt(k, t.repeat, REPEAT[k])).join('')}</select></label>
      <label>${tr('L.f.pin')}<select name="pin">${opt('', t.pin, tr('L.byDue'))}${opt('surface', t.pin, tr('L.pin.surface'))}${opt('shallows', t.pin, tr('L.pin.shallows'))}${opt('depths', t.pin, tr('L.pin.depths'))}</select></label>
    </div>
    <label>${tr('L.f.notes')}<textarea name="notes">${esc(t.notes || '')}</textarea></label>
    <div class="acts"><button class="btn warn" data-act="delete">${tr('L.delete')}</button><button class="btn" data-act="close">${tr('L.close')}</button></div>
  </div>`;
}
function dayName(ts) {
  const d = new Date(ts), k = ymd(d), n = dayDiff(todayStr(), k);
  if (n === 0) return tr('L.today'); if (n === 1) return tr('L.yesterday');
  return mdw(d);
}
let bedLimit = 30;

function render() {
  $('today').textContent = mdw(new Date());
  const live = S.tasks.filter(t => !t.done);
  const groups = { surface: [], shallows: [], depths: [] };
  for (const t of live) groups[secOf(t)].push(t);
  for (const k of SECS) {
    groups[k].sort((a, b) => a.ord - b.ord);
    const shown = groups[k].filter(visible);
    $('L-' + k).innerHTML = shown.length ? shown.map(rowHTML).join('')
      : `<div class="empty">${tr('L.empty.' + k)}</div>`;
    const n = shown.length;
    $('n' + k[0].toUpperCase() + k.slice(1)).textContent = n ? tr('L.n', { n }) : '';
    $('c' + k[0].toUpperCase() + k.slice(1)).textContent = n || '';
  }
  // lakebed
  const bed = S.tasks.filter(t => t.done && visible(t)).sort((a, b) => b.doneAt - a.doneAt);
  let html = '', last = '';
  for (const t of bed.slice(0, bedLimit)) { const dn = dayName(t.doneAt); if (dn !== last) { html += `<div class="day">${dn}</div>`; last = dn; } html += rowHTML(t); }
  if (bed.length > bedLimit) html += `<button class="btn more" id="moreBed">${tr('L.more', { n: bed.length - bedLimit })}</button>`;
  $('L-bed').innerHTML = html || `<div class="empty">${tr('L.bedEmpty')}</div>`;
  const weekAgo = Date.now() - 7 * 86400e3;
  $('nBed').textContent = bed.length ? tr('L.bedWeek', { n: bed.filter(t => t.doneAt > weekAgo).length }) : '';
  $('cBed').textContent = bed.length || '';
  $('cAll').textContent = live.length || '';
  renderAreas(live);
  renderFocus(groups.surface.filter(visible));
  renderTide(groups.surface);
  $('clearSample').hidden = !S.tasks.some(t => t.sample);
  if (openId) { const inp = document.querySelector(`[data-edit="${openId}"] input[name=title]`); if (inp && document.activeElement?.closest?.('.editor') == null) inp.focus(); }
}

function renderAreas(live) {
  const cnt = id => live.filter(t => t.area === id).length;
  $('areaList').innerHTML = S.areas.map(a => `<button class="nav${filter === a.id ? ' on' : ''}" data-area="${a.id}">
    <span class="nm"><i class="dot" style="background:${a.color}"></i><span>${esc(a.name)}</span></span><span class="c">${cnt(a.id) || ''}</span></button>`).join('');
  document.querySelector('.nav[data-area=""]').classList.toggle('on', !filter);
  $('chips').innerHTML = `<button data-area="" class="${!filter ? 'on' : ''}">${tr('L.all')}</button>` +
    S.areas.map(a => `<button data-area="${a.id}" class="${filter === a.id ? 'on' : ''}">${esc(a.name)}</button>`).join('');
}

function focusPick(list) {
  const score = t => {
    let s = 0; const dl = t.due ? dayDiff(t.due, todayStr()) : 9;
    if (dl < 0) s += 100 + Math.min(30, -dl * 5);
    if (t.kind === 'must') s += 50;
    if (dl === 0) s += 20;
    if (t.time && dl === 0) { const [h, m] = t.time.split(':').map(Number); const left = (h * 60 + m) - (new Date().getHours() * 60 + new Date().getMinutes()); if (left < 180) s += 30 - Math.max(0, left) / 6; }
    if (t.est) s += Math.max(0, 8 - t.est / 15);
    return s - t.ord * 0.01;
  };
  return list.slice().sort((a, b) => score(b) - score(a))[0];
}
function renderFocus(surface) {
  const t = focusPick(surface);
  if (!t) { $('focus').innerHTML = `<div class="k">${tr('L.focusK')}</div><h2>Nagi</h2><p>${tr('L.focusNone')}</p>`; return; }
  const dl = dueLabel(t), why = [dl && dl.text, t.kind === 'must' ? tr('kind.must') : t.kind === 'self' ? tr('kind.self') : '', t.est ? tr('about', { t: estLabel(t.est) }) : ''].filter(Boolean).join(' · ');
  $('focus').innerHTML = `<div class="k">${tr('L.focusK')}</div><h2>${esc(t.title)}</h2><p>${esc(why || tr('L.focusWhy'))}</p>
    <div class="go"><button class="btn pri" data-focus-done="${t.id}">${tr('L.focusDone')}</button><button class="btn" data-focus-later="${t.id}">${tr('L.focusLater')}</button></div>`;
}
function renderTide(surface) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const plan = surface.reduce((s, t) => s + (t.est || 0), 0);
  const doneToday = S.tasks.filter(t => t.done && t.doneAt >= t0.getTime()).reduce((s, t) => s + (t.est || 0), 0);
  const total = plan + doneToday, B = S.settings.budget;
  const zero = tr('est.m', { m: 0 });
  $('tideText').innerHTML = `${esc(tr('L.tide', { t: estLabel(total) || zero }))}<button id="budgetBtn" title="${esc(tr('L.budgetTitle'))}">${estLabel(B)}</button>`;
  const over = total > B;
  $('tide').classList.toggle('over', over);
  $('tideRest').textContent = over ? tr('L.over', { t: estLabel(total - B) }) : tr('L.left', { t: estLabel(B - total) || zero });
  $('tideFill').style.width = `${Math.min(100, total / B * 100)}%`;
}

// ---------------------------------------------------------------- actions
const find = id => S.tasks.find(t => t.id === id);
let undoFn = null, toastTimer = 0;
function toast(text, undo) {
  $('toastText').textContent = text; undoFn = undo;
  $('toastUndo').hidden = !undo;
  $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 5000);
}
$('toastUndo').onclick = () => { if (undoFn) { undoFn(); undoFn = null; save(); render(); } $('toast').classList.remove('show'); };

function nextDue(t) {
  const base = new Date((t.due || todayStr()) + 'T00:00');
  const d = new Date(Math.max(base, new Date(todayStr() + 'T00:00')));
  if (t.repeat === 'daily') d.setDate(d.getDate() + 1);
  if (t.repeat === 'weekdays') { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); }
  if (t.repeat === 'weekly') d.setDate(d.getDate() + 7);
  if (t.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  return ymd(d);
}
function complete(id) {
  const t = find(id); if (!t || t.done) return;
  const row = document.querySelector(`.row[data-id="${id}"]`);
  const finish = () => {
    t.done = true; t.doneAt = Date.now();
    let next = null;
    if (t.repeat) {
      next = { ...t, id: uid(), done: false, doneAt: null, due: nextDue(t), pin: null, createdAt: Date.now() };
      t.repeat = null; S.tasks.push(next);
    }
    if (openId === id) openId = null;
    save(); render();
    toast(tr('L.sunk', { t: t.title }), () => { t.done = false; t.doneAt = null; if (next) { t.repeat = next.repeat; S.tasks = S.tasks.filter(x => x !== next); } });
  };
  if (row && !matchMedia('(prefers-reduced-motion: reduce)').matches) { row.classList.add('sinking'); setTimeout(finish, 850); }
  else finish();
}
function restore(id) { const t = find(id); if (!t) return; t.done = false; t.doneAt = null; save(); render(); toast(tr('L.raised', { t: t.title })); }
function setSec(id, sec) {
  const t = find(id); if (!t || t.done) return;
  const prev = t.pin; t.pin = sec;
  const list = S.tasks.filter(x => !x.done && secOf(x) === sec && x !== t);
  t.ord = list.length ? Math.max(...list.map(x => x.ord)) + 1 : 0;
  save(); render();
  toast(tr('L.moved', { t: t.title, s: SEC(sec) }), () => { t.pin = prev; });
}
function areaByName(name) {
  let a = S.areas.find(x => x.name === name);
  if (!a) { a = { id: uid(), name, color: COLORS[S.areas.length % COLORS.length] }; S.areas.push(a); }
  return a.id;
}
function addTask(text) {
  const p = parseQuick(text);
  if (!p.title) return;
  const t = { id: uid(), title: p.title, area: p.area ? areaByName(p.area) : (filter || null), due: p.due, time: p.time, est: p.est,
    kind: p.kind, repeat: p.repeat, pin: p.someday ? 'depths' : (p.due ? null : 'surface'), notes: '', done: false, doneAt: null,
    ord: 0, createdAt: Date.now() };
  const sec = secOf(t);
  const list = S.tasks.filter(x => !x.done && secOf(x) === sec);
  t.ord = list.length ? Math.max(...list.map(x => x.ord)) + 1 : 0;
  S.tasks.push(t); save(); render();
  toast(tr('L.added', { s: SEC(sec), t: t.title }), () => { S.tasks = S.tasks.filter(x => x !== t); });
}

// input box: show what was read, as you type
const showPreview = () => {
  const v = $('addInput').value.trim();
  if (!v) { $('preview').innerHTML = ''; return; }
  const p = parseQuick(v), bits = [];
  if (p.due) { const dl = dueLabel({ due: p.due, time: p.time }); bits.push(tr('L.pv.due', { d: dl.text })); }
  else if (p.someday) bits.push(tr('L.pv.someday'));
  if (p.est) bits.push(tr('L.pv.est', { t: estLabel(p.est) }));
  if (p.area) bits.push(tr('L.pv.area', { a: p.area }) + (S.areas.some(a => a.name === p.area) ? '' : tr('L.pv.newArea')));
  if (p.kind) bits.push(tr(p.kind === 'must' ? 'kind.must' : 'kind.self'));
  if (p.repeat) bits.push(tr('L.pv.repeat', { r: REPEAT[p.repeat] }));
  $('preview').innerHTML = bits.map(b => `<span>${esc(b)}</span>`).join('');
};
$('addInput').addEventListener('input', showPreview);
$('addForm').addEventListener('submit', e => { e.preventDefault(); addTask($('addInput').value); $('addInput').value = ''; showPreview(); });

// clicks inside the lists
document.querySelector('.main').addEventListener('click', e => {
  const ck = e.target.closest('.ck'), row = e.target.closest('.row');
  if (e.target.closest('#budgetBtn')) {
    const opts = [120, 180, 240, 300, 360, 420, 480, 600];
    S.settings.budget = opts[(opts.indexOf(S.settings.budget) + 1) % opts.length]; save(); render(); return;
  }
  if (e.target.id === 'moreBed') { bedLimit += 30; render(); return; }
  const fd = e.target.closest('[data-focus-done]'); if (fd) { complete(fd.dataset.focusDone); return; }
  const fl = e.target.closest('[data-focus-later]'); if (fl) { setSec(fl.dataset.focusLater, 'shallows'); return; }
  const act = e.target.closest('[data-act]');
  if (act) {
    const id = act.closest('.editor').dataset.edit;
    if (act.dataset.act === 'close') { openId = null; render(); }
    if (act.dataset.act === 'delete') {
      const t = find(id), i = S.tasks.indexOf(t);
      S.tasks.splice(i, 1); openId = null; save(); render();
      toast(tr('L.deleted', { t: t.title }), () => S.tasks.splice(i, 0, t));
    }
    return;
  }
  if (e.target.closest('.editor')) return;
  if (ck && row) { const t = find(row.dataset.id); t.done ? restore(t.id) : complete(t.id); return; }
  if (row) { openId = openId === row.dataset.id ? null : row.dataset.id; selId = row.dataset.id; render(); }
});
// save edits as they are made
document.querySelector('.main').addEventListener('change', e => {
  const ed = e.target.closest('.editor'); if (!ed) return;
  const t = find(ed.dataset.edit), f = e.target, v = f.value;
  if (f.name === 'title') t.title = v.trim() || t.title;
  if (f.name === 'due') t.due = v || null;
  if (f.name === 'time') t.time = v || null;
  if (f.name === 'est') t.est = v ? +v : null;
  if (f.name === 'area') t.area = v || null;
  if (f.name === 'kind') t.kind = v || null;
  if (f.name === 'repeat') { t.repeat = v || null; if (t.repeat && !t.due) t.due = todayStr(); }
  if (f.name === 'pin') t.pin = v || null;
  if (f.name === 'notes') t.notes = v;
  delete t.sample;
  save(); render();
});

// areas
document.addEventListener('click', e => {
  const b = e.target.closest('[data-area]'); if (!b || !b.closest('.side, .chips')) return;
  filter = b.dataset.area; openId = null; render();
});
$('areaAdd').addEventListener('submit', e => {
  e.preventDefault(); const n = $('areaName').value.trim(); if (!n) return;
  filter = areaByName(n); $('areaName').value = ''; save(); render();
});
// jump to a depth
document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => {
  const el = $('sec-' + b.dataset.jump), y = el.getBoundingClientRect().top + scrollY - 20;
  window.__lenis ? window.__lenis.scrollTo(y, { duration: 1.6 }) : scrollTo({ top: y, behavior: 'smooth' });
}));

// data
$('clearSample').onclick = () => {
  const before = S.tasks.slice(), beforeA = S.areas.slice();
  S.tasks = S.tasks.filter(t => !t.sample); save(); render();
  toast(tr('L.sampleCleared'), () => { S.tasks = before; S.areas = beforeA; });
};
$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `umi-${todayStr()}.json` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.tasks)) throw 0;
    const before = S; S = { ...sample(), ...d, settings: { ...S.settings, ...(d.settings || {}) } };
    save(); render(); toast(tr('L.imported', { n: d.tasks.length }), () => { S = before; });
  } catch (_) { toast(tr('L.importFail')); }
  e.target.value = '';
};

// drag to reorder or change depth
for (const sec of SECS) {
  Sortable.create($('L-' + sec), {
    group: 'umi', animation: 180, delay: 160, delayOnTouchOnly: true, forceFallback: true, fallbackTolerance: 4, filter: '.editor, .empty', preventOnFilter: false,
    onEnd: ev => {
      const to = ev.to.dataset.sec, ids = [...ev.to.querySelectorAll(':scope > .row')].map(r => r.dataset.id);
      ids.forEach((id, i) => { const t = find(id); t.ord = i; if (ev.from !== ev.to && id === ev.item.dataset.id) t.pin = to; });
      if (ev.from !== ev.to) { const t = find(ev.item.dataset.id); toast(tr('L.moved', { t: t.title, s: SEC(to) })); }
      save(); render();
    }
  });
}

// keyboard
const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
const rowsInOrder = () => [...document.querySelectorAll('.list .row')].map(r => r.dataset.id);
const moveSel = d => {
  const ids = rowsInOrder(); if (!ids.length) return;
  const i = ids.indexOf(selId); selId = ids[Math.max(0, Math.min(ids.length - 1, i < 0 ? 0 : i + d))]; render();
  document.querySelector(`.row[data-id="${selId}"]`)?.scrollIntoView({ block: 'nearest' });
};
tinykeys(window, {
  '$mod+KeyK': e => { e.preventDefault(); $('addInput').focus(); },
  '/': e => { if (!typing()) { e.preventDefault(); $('addInput').focus(); } },
  'c': e => { if (!typing()) { e.preventDefault(); $('addInput').focus(); } },
  'j': () => { if (!typing()) moveSel(1); }, 'k': () => { if (!typing()) moveSel(-1); },
  'x': () => { if (!typing() && selId) { const t = find(selId); t.done ? restore(selId) : complete(selId); } },
  'e': () => { if (!typing() && selId) { openId = selId; render(); } },
  '1': () => { if (!typing() && selId) setSec(selId, 'surface'); },
  '2': () => { if (!typing() && selId) setSec(selId, 'shallows'); },
  '3': () => { if (!typing() && selId) setSec(selId, 'depths'); },
  'Escape': () => { if (document.activeElement === $('addInput')) $('addInput').blur(); openId = null; $('envMenu').classList.remove('open'); render(); }
});

// ---------------------------------------------------------------- season and weather (same levels as the home page)
const Env = window.LakeEnv;
const SEASONS = ['auto', 'spring', 'summer', 'autumn', 'winter'].map(k => [k, tr('season.' + k)]);
const WEATHERS = ['auto', 'calm', 'ripple', 'waves', 'rough', 'storm'].map(k => [k, tr('weather.' + k)]);
const curSeason = () => S.settings.season === 'auto' ? Env.auto.season : S.settings.season;
function renderEnv() {
  $('envBtn').textContent = Env.statusText();
  $('seasonBtns').innerHTML = SEASONS.map(([k, v]) => `<button data-season="${k}" aria-pressed="${S.settings.season === k}">${v}</button>`).join('');
  $('weatherBtns').innerHTML = WEATHERS.map(([k, v]) => `<button data-weather="${k}" aria-pressed="${Env.weatherMode === k}">${v}</button>`).join('');
  window.LakeScene?.setSeason?.(curSeason());
}
if (S.settings.weather && S.settings.weather !== 'auto') Env.setWeatherMode(S.settings.weather);
Env.on(renderEnv);
$('envBtn').onclick = () => { const m = $('envMenu'); m.classList.toggle('open'); $('envBtn').setAttribute('aria-expanded', m.classList.contains('open')); };
$('envMenu').addEventListener('click', e => {
  const s = e.target.closest('[data-season]'), w = e.target.closest('[data-weather]');
  if (s) { S.settings.season = s.dataset.season; save(); renderEnv(); }
  if (w) { S.settings.weather = w.dataset.weather; save(); Env.setWeatherMode(w.dataset.weather); }
});
const waitScene = setInterval(() => { if (window.LakeScene?.setSeason) { clearInterval(waitScene); renderEnv(); } }, 100);

// ---------------------------------------------------------------- scroll depth → lake depth
const ANCHORS = [['sec-surface', 0], ['sec-shallows', 0.16], ['sec-depths', 0.45], ['sec-bed', 0.8]];
window.LakeDepth = () => {
  const probe = scrollY + innerHeight * 0.4;
  const pts = ANCHORS.map(([id, p]) => [$(id).getBoundingClientRect().top + scrollY, p]);
  const bedEl = $('sec-bed'); pts.push([bedEl.getBoundingClientRect().bottom + scrollY, 1]);
  if (probe <= pts[0][0]) return 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [y0, p0] = pts[i], [y1, p1] = pts[i + 1];
    if (probe <= y1) return p0 + (p1 - p0) * (probe - y0) / Math.max(1, y1 - y0);
  }
  return 1;
};
addEventListener('lake:frame', e => {
  const p = e.detail.P;
  $('dDot').style.top = $('dTxt').style.top = `${p * 100}%`;
  $('dTxt').textContent = SEC(p < 0.15 ? 'surface' : p < 0.45 ? 'shallows' : p < 0.8 ? 'depths' : 'bed');
});

// re-sort when the date changes
let lastDay = todayStr();
setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); render(); } }, 60e3);
render();
