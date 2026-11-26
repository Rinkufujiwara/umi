// Umi ホーム：湖に浮かぶブイ＝タスク。終えたら沈める。ホイールはページではなくカメラを動かす
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/+esm';
import { Observer } from 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/Observer/+esm';
import { createHome } from './home-scene.js?v=10';
import { parseQuick } from './parse.js?v=10';
import * as St from './store.js?v=10';
gsap.registerPlugin(Observer);

const $ = id => document.getElementById(id);
const { esc, secOf, dueLabel, estLabel, rank } = St;
let S = St.load();
const save = () => St.save(S);
save();

const home = createHome($('scene'));
document.documentElement.classList.add('ready');

// ---------------------------------------------------------------- 表示
const SEC_NAME = { surface: '水面', shallows: '浅瀬', depths: '深み' };
const KIND_COLOR = { must: '#e0533f', self: '#f2b134', none: '#c9c4b8' };
const live = () => S.tasks.filter(t => !t.done);
// そろそろ危ない：遅れ・必須で明日まで・今日の時刻まで3時間以内
function urgent(t) {
  if (t.done || !t.due) return false;
  const n = St.dayDiff(t.due, St.todayStr());
  if (n < 0) return true;
  if (t.kind === 'must' && n <= 1) return true;
  if (n === 0 && t.time) {
    const [h, m] = t.time.split(':').map(Number);
    return h * 60 + m - (new Date().getHours() * 60 + new Date().getMinutes()) < 180;
  }
  return false;
}
function calmSet() { return new Set(rank(live().filter(t => secOf(t) === 'surface')).slice(0, 3).map(t => t.id)); }

function render() {
  const L = live(), calm = S.settings.calm, keep = calm ? calmSet() : null;
  home.setTasks(L.map(t => ({ id: t.id, kind: t.kind, sec: secOf(t), hidden: calm && !keep.has(t.id), ...St.placeOf(t, S.settings.budget) })));
  home.setSunk(S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).map(t => t.kind));
  home.setAlerts(rank(L.filter(t => urgent(t) && (!calm || keep.has(t.id)))).map(t => t.id));

  const d = new Date();

  // 数字
  const cnt = s => L.filter(t => secOf(t) === s).length;
  const weekAgo = Date.now() - 7 * 86400e3;
  const sunk = S.tasks.filter(t => t.done && t.doneAt > weekAgo).length;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const plan = L.filter(t => secOf(t) === 'surface').reduce((s, t) => s + (t.est || 0), 0)
             + S.tasks.filter(t => t.done && t.doneAt >= +t0).reduce((s, t) => s + (t.est || 0), 0);
  const B = S.settings.budget, over = plan > B;
  const late = L.filter(t => t.due && t.due < St.todayStr()).length;
  // あいさつとひとこと
  const hr = d.getHours();
  const hello = hr < 4 ? 'こんばんは' : hr < 11 ? 'おはようございます' : hr < 18 ? 'こんにちは' : 'こんばんは';
  const urg = L.filter(urgent).length, today = cnt('surface');
  $('hello').textContent = hello;
  $('summary').innerHTML = `${d.getMonth() + 1}月${d.getDate()}日（${St.WD[d.getDay()]}）${urg ? `　<span class="late">急ぎ ${urg}件</span>` : ''}`;
  // 件数は「一覧（空から見る）」に出す
  $('mapSub').innerHTML = `浮かんでいる <b>${L.length}件</b>（今日 ${today}${urg ? `・<span class="late">急ぎ ${urg}</span>` : ''}・今週 ${cnt('shallows')}・いつか ${cnt('depths')}）` +
    `${late ? `・<span class="late">遅れ ${late}</span>` : ''}　この7日で <b>${sunk}件</b> 沈めた`;
  // 忙しさ → 湖の天気と波
  // 今日の潮位（見積もり ÷ 1日に使える時間）を土台に、7日先までの詰まり・遅れ・急ぎを足す
  const in7 = St.plusDays(6);
  const week = L.filter(t => t.due && t.due <= in7).reduce((s, t) => s + (t.est || 30), 0) / (7 * B);
  const urgNotLate = L.filter(t => urgent(t) && !(t.due && t.due < St.todayStr())).length;
  const busy = plan / B + 0.5 * week + 0.25 * late + 0.12 * urgNotLate;
  const kind = busy < 0.55 ? 'calm' : busy < 0.85 ? 'ripple' : busy < 1.15 ? 'waves' : busy < 1.5 ? 'rough' : 'storm';
  Env.setBusy(kind, busy, `今日の潮位 ${Math.round(plan / B * 100)}% ＋ 7日先の詰まり ${Math.round(week * 100)}%×0.5 ＋ 遅れ ${late}件×0.25 ＋ 急ぎ ${urgNotLate}件×0.12`);
  $('tide').className = 'tide' + (over ? ' over' : '');
  $('tide').innerHTML = `今日の潮位 <b>${estLabel(plan) || '0分'}</b> ／ ${estLabel(B)}　<span class="rest">${over ? `${estLabel(plan - B)}多い` : `あと${estLabel(B - plan) || '0分'}`}</span><div class="bar"><i style="width:${Math.min(100, plan / B * 100)}%"></i></div>`;

  // 今日の優先タスク（凪モードでは3件だけ）
  const ranked = rank(L.filter(t => secOf(t) === 'surface'));
  const f = ranked[0], top = ranked.slice(1, 4);
  $('cards').innerHTML = top.length ? top.map(cardHTML).join('') : '<div class="empty">ほかにはありません</div>';
  focusId = f ? f.id : null;
  $('focus').innerHTML = f ? `${cardHTML(f)}<div class="go"><button class="btn pri" data-sink="${f.id}">沈める</button><button class="btn" data-later="${f.id}">明日へ</button></div>`
    : '<div class="empty">急ぐものはありません。</div>';
  $('calmBtn').setAttribute('aria-pressed', String(calm));
  const doneN = S.tasks.filter(t => t.done).length;
  $('bedCount').textContent = `湖底　${doneN}`;
  renderBed();
}
function cardHTML(t) {
  const dl = dueLabel(t);
  return `<button class="card" data-open="${t.id}"><div class="t">${esc(t.title)}</div>
    ${t.kind ? `<span class="badge ${t.kind}">${t.kind === 'must' ? '必須' : '自主'}</span>` : ''}
    <div class="m">${dl ? `<span class="${dl.late ? 'late' : ''}">${esc(dl.text)}</span>` : '期限なし'}${t.est ? `　約${estLabel(t.est)}` : ''}</div></button>`;
}
// 湖底：終えたタスクはすべて、沈んだブイのまま積もっていく
function renderBed() {
  const done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const weekAgo = Date.now() - 7 * 86400e3, t0 = new Date(); t0.setHours(0, 0, 0, 0);
  $('bedTitle').textContent = `湖底　これまでに沈めた ${done.length}件`;
  $('bedSub').textContent = `今日 ${done.filter(t => t.doneAt >= +t0).length}件・この7日 ${done.filter(t => t.doneAt > weekAgo).length}件　／　上へスクロールで水面へ`;
  const open = $('bedList').classList.contains('open');
  $('bedLevels').innerHTML = `<button class="btn${open ? ' pri' : ''}" id="bedToggle">${open ? '一覧を閉じる' : '一覧表示'}</button><button class="btn" data-go="home">水面へ戻る</button>`;
  $('bedList').innerHTML = done.length ? done.slice(0, 60).map(t => {
    const d = new Date(t.doneAt);
    return `<div class="it"><span>${esc(t.title)}<small>${d.getMonth() + 1}月${d.getDate()}日（${St.WD[d.getDay()]}）に沈めた</small></span><button class="btn" data-raise="${t.id}">引き上げる</button></div>`;
  }).join('') : '<div class="empty">まだ何も沈んでいません。</div>';
}

// ---------------------------------------------------------------- 名札（ブイの上の文字）
const tagEls = new Map();
let focusId = null;
let hlId = null;
home.onFrame((pts, { inside }) => {
  const seen = new Set();
  // 名札：手前を最優先、次に右。常に出すのは上位3つ。ほかはカーソルを合わせたときだけ
  const SHOW = station === 'map' ? 999 : 0;
  const order = pts.slice().sort((a, b) => (Math.round(a.dist / 22) - Math.round(b.dist / 22)) || (b.x - a.x));
  const always = new Set(order.slice(0, SHOW).map(p => p.id));
  if (station !== 'map' && focusId) always.add(focusId);
  // ぶつかってはいけない場所：ほかのブイ、上のパネル、左の列
  const blocks = [];
  for (const sel of ['#top .panel', '#top .hdr', '.side', '#axis', '#mapview.on']) document.querySelectorAll(sel).forEach(el => { if (el.closest('.away')) return; const r = el.getBoundingClientRect(); if (r.width) blocks.push({ l: r.left - 4, t: r.top - 4, r: r.right + 4, b: r.bottom + 4 }); });
  for (const p of pts) blocks.push(station === 'map' ? { l: p.x - 12, t: p.y - 4, r: p.x + 12, b: p.y + 20 } : { l: p.x - 16, t: p.y - 6, r: p.x + 16, b: p.y + 40 });
  const hit = (a) => blocks.some(b => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t);
  const lines = [];
  for (const p of order) {
    const t = S.tasks.find(x => x.id === p.id); if (!t) continue;
    const show = (always.has(p.id) || hlId === p.id || popId === p.id) && inside < 0.3;
    seen.add(p.id);
    let el = tagEls.get(p.id);
    if (!el) { el = document.createElement('div'); el.className = 'tag'; el.dataset.open = p.id; $('tags').appendChild(el); tagEls.set(p.id, el); }
    const html = `<i style="background:${KIND_COLOR[t.kind || 'none']}"></i>${esc(t.title)}`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; el._w = 0; }
    el.className = 'tag' + (hlId === p.id ? ' hl' : '') + (urgent(t) ? ' urgent' : '') + (show ? '' : ' off');
    if (!show) continue;
    if (!el._w) { el._w = el.offsetWidth || 160; el._hh = el.offsetHeight || 24; }
    const w = el._w, h = el._hh, gap = 10;
    // 置き場所の候補：上 → 右上 → 左上 → 右 → 左 → 下 → さらに上
    const cands = [[-w / 2, -h - gap], [8, -h - gap - 6], [-w - 8, -h - gap - 6], [22, -h / 2], [-w - 22, -h / 2], [-w / 2, 44], [-w / 2, -2 * h - gap - 8], [14, -2 * h - gap], [-w - 14, -2 * h - gap]];
    let pos = cands[0], ok = false;
    for (const [dx, dy] of cands) {
      const r = { l: p.x + dx, t: p.y + dy, r: p.x + dx + w, b: p.y + dy + h };
      if (r.l < 0 || r.r > innerWidth || r.t < 0) continue;
      if (!hit(r)) { pos = [dx, dy]; ok = true; break; }
    }
    const L = p.x + pos[0], T = p.y + pos[1];
    blocks.push({ l: L - 4, t: T - 3, r: L + w + 4, b: T + h + 3 });
    el.style.left = `${L}px`; el.style.top = `${T}px`;
    if (!ok && hlId !== p.id && popId !== p.id) el.classList.add('off');  // どこにも置けなければ出さない（合わせたときは出す）
    // 名札がブイから離れたら、細い線でつなぐ
    const cx = Math.max(L, Math.min(L + w, p.x)), cy = Math.max(T, Math.min(T + h, p.y));
    if (Math.hypot(cx - p.x, cy - p.y) > 14) lines.push(`M${p.x} ${p.y + 4}L${cx} ${cy}`);
  }
  $('tagLines').setAttribute('d', lines.join(''));
  $('tagLines').style.opacity = inside < 0.3 ? '1' : '0';
  for (const [id, el] of tagEls) if (!seen.has(id)) { el.remove(); tagEls.delete(id); }
});

// ---------------------------------------------------------------- 操作
let undoFn = null, toastTimer = 0;
function toast(text, undo) {
  $('toastText').textContent = text; undoFn = undo || null; $('toastUndo').hidden = !undo;
  $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 5000);
}
$('toastUndo').onclick = () => { if (undoFn) { undoFn(); undoFn = null; save(); render(); } $('toast').classList.remove('show'); };

// ポチャン（小さな水の音。設定でオフにできる）
let actx = null;
function plop() {
  if (!S.settings.sound) return;
  try {
    actx = actx || new AudioContext();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.32);
  } catch (_) {}
}

async function complete(id) {
  const t = S.tasks.find(x => x.id === id); if (!t || t.done) return;
  closePop();
  plop();
  const sinking = home.sink(id);
  t.done = true; t.doneAt = Date.now();
  let next = null;
  if (t.repeat) { next = { ...t, id: St.uid(), done: false, doneAt: null, due: St.nextDue(t), pin: null, createdAt: Date.now() }; t.repeat = null; S.tasks.push(next); }
  delete t.sample; save();
  toast(`「${t.title}」を沈めました`, () => { t.done = false; t.doneAt = null; if (next) { t.repeat = next.repeat; S.tasks = S.tasks.filter(x => x !== next); } });
  await sinking;
  render();
}
// 遠くへ：期限をのばす（遅れているものは今日から数える）
function postpone(id, days) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const prev = { due: t.due, pin: t.pin };
  const base = t.due && t.due > St.todayStr() ? new Date(t.due + 'T00:00') : new Date();
  base.setDate(base.getDate() + days);
  t.due = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  if (t.pin === 'surface' || t.pin === 'shallows') t.pin = null;
  delete t.sample; save(); closePop(); render();
  toast(`「${t.title}」を遠くへ（${dueLabel(t).text}）`, () => { t.due = prev.due; t.pin = prev.pin; });
}
// 浅瀬へ：軽くする（左へ）
function lighter(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const prev = t.weight || 2; t.weight = Math.max(1, prev - 1);
  delete t.sample; save(); closePop(); render();
  toast(`「${t.title}」を浅瀬へ（重さ：${St.WEIGHT[t.weight]}）`, () => { t.weight = prev; });
}
function moveTo(id, sec) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const prev = t.pin; t.pin = sec; save(); closePop(); render();
  toast(`「${t.title}」を${SEC_NAME[sec]}へ`, () => { t.pin = prev; });
}
function raise(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  t.done = false; t.doneAt = null; save(); render(); toast(`「${t.title}」を引き上げました`);
}

// ブイを押す → 小さなカード
let popId = null;
function openPop(id, x, y) {
  const t = S.tasks.find(x => x.id === id); if (!t || t.done) return;
  popId = id; hlId = id; home.setHover(id);
  const dl = dueLabel(t), sec = secOf(t), a = S.areas.find(a => a.id === t.area);
  const moves = `<button class="btn" data-lighter${(t.weight || 2) <= 1 ? ' disabled' : ''} title="軽くする（左の浅瀬へ）">浅瀬へ</button>`;
  const later = `<div class="wt">遠くへ ${[[1, '＋1日'], [3, '＋3日'], [7, '＋1週']].map(([n, l]) => `<button class="btn" data-post="${n}">${l}</button>`).join('')}</div>`;
  $('pop').innerHTML = `<h3>${esc(t.title)}</h3>
    <div class="m"><span>${SEC_NAME[sec]}</span>${dl ? `<span class="${dl.late ? 'late' : ''}">${esc(dl.text)}</span>` : ''}${t.est ? `<span>約${estLabel(t.est)}</span>` : ''}
    ${t.kind ? `<span>${t.kind === 'must' ? '必須' : '自主'}</span>` : ''}<span>重さ：${St.WEIGHT[t.weight || 2]}</span>${a ? `<span>${esc(a.name)}</span>` : ''}${t.repeat ? `<span>↻ ${St.REPEAT[t.repeat]}</span>` : ''}</div>
    ${t.notes ? `<div class="m">${esc(t.notes)}</div>` : ''}
    <div class="wt">重さ ${[1, 2, 3].map(w => `<button class="btn${(t.weight || 2) === w ? ' pri' : ''}" data-weight="${w}">${St.WEIGHT[w]}</button>`).join('')}</div>
    ${later}
    <div class="go"><button class="btn pri" data-sink="${t.id}">沈める</button>${moves}<a class="btn" href="list.html" style="text-decoration:none">一覧で編集</a></div>`;
  const pop = $('pop'); pop.classList.add('open');
  const w = 290, h = pop.offsetHeight;
  pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, x - w / 2))}px`;
  pop.style.top = `${Math.max(12, Math.min(innerHeight - h - 12, y - h - 24))}px`;
  $('scrim').classList.add('open');
}
function closePop() { $('pop').classList.remove('open'); $('envMenu').classList.remove('open'); $('scrim').classList.remove('open'); popId = null; hlId = null; home.setHover(null); }
$('scrim').onclick = () => { closePop(); closeAdd(); };

document.addEventListener('click', e => {
  if (e.target.closest('#bedToggle')) { $('bedList').classList.toggle('open'); renderBed(); return; }
  const sk = e.target.closest('[data-sink]'); if (sk) { complete(sk.dataset.sink); return; }
  const lt = e.target.closest('[data-later]'); if (lt) { postpone(lt.dataset.later, 1); return; }
  const po = e.target.closest('[data-post]'); if (po && popId) { postpone(popId, +po.dataset.post); return; }
  const li = e.target.closest('[data-lighter]'); if (li && popId) { lighter(popId); return; }
  const rs = e.target.closest('[data-raise]'); if (rs) { raise(rs.dataset.raise); return; }
  const wt = e.target.closest('[data-weight]');
  if (wt && popId) { const t = S.tasks.find(x => x.id === popId); t.weight = +wt.dataset.weight; delete t.sample; save(); const id = popId, r = $('pop').getBoundingClientRect(); render(); openPop(id, r.left + r.width / 2, r.bottom + 24); return; }
  const op = e.target.closest('[data-open]');
  if (op) {
    const tag = tagEls.get(op.dataset.open);
    const r = (tag || op).getBoundingClientRect();
    openPop(op.dataset.open, r.left + r.width / 2, tag ? r.top : r.bottom + 260);
  }
});
// 3Dのブイを直接押す・指す
$('scene').addEventListener('click', e => { const id = home.pick(e.clientX, e.clientY); if (id) openPop(id, e.clientX, e.clientY); else closePop(); });
$('scene').addEventListener('pointermove', e => { if (popId) return; const id = home.pick(e.clientX, e.clientY); home.setHover(id); hlId = id; $('scene').style.cursor = id ? 'pointer' : ''; });

// 凪モード
$('calmBtn').onclick = () => { S.settings.calm = !S.settings.calm; save(); render(); };

// 追加
function openAdd() { $('addbox').classList.add('open'); $('scrim').classList.add('open'); $('addInput').value = ''; showPv(); setTimeout(() => $('addInput').focus(), 30); }
function closeAdd() { $('addbox').classList.remove('open'); if (!popId) $('scrim').classList.remove('open'); }
$('addBtn').onclick = openAdd;
function showPv() {
  const v = $('addInput').value.trim(); if (!v) { $('pv').innerHTML = ''; return; }
  const p = parseQuick(v), bits = [];
  if (p.due) bits.push(dueLabel({ due: p.due, time: p.time }).text); else if (p.someday) bits.push('深み（いつか）');
  if (p.est) bits.push(`約${estLabel(p.est)}`);
  if (p.area) bits.push(`#${p.area}`);
  if (p.kind) bits.push(p.kind === 'must' ? '必須' : '自主');
  if (p.weight) bits.push(`重さ：${St.WEIGHT[p.weight]}`);
  if (p.repeat) bits.push(`↻ ${St.REPEAT[p.repeat]}`);
  $('pv').innerHTML = bits.map(b => `<span>${esc(b)}</span>`).join('');
}
$('addInput').addEventListener('input', showPv);
$('addForm').addEventListener('submit', e => {
  e.preventDefault();
  const p = parseQuick($('addInput').value); if (!p.title) return;
  const t = { id: St.uid(), title: p.title, area: p.area ? St.areaByName(S, p.area) : null, due: p.due, time: p.time, est: p.est,
    kind: p.kind, repeat: p.repeat, pin: p.someday ? 'depths' : (p.due ? null : 'surface'), notes: '', done: false, doneAt: null,
    weight: p.weight || 2, ord: Math.max(0, ...S.tasks.map(x => x.ord)) + 1, createdAt: Date.now() };
  S.tasks.push(t); save(); render(); closeAdd();
  toast(`${SEC_NAME[secOf(t)]}に浮かべました：${t.title}`, () => { S.tasks = S.tasks.filter(x => x !== t); });
});

// ---------------------------------------------------------------- 季節と天気
const Env = window.LakeEnv;
const SEASONS = [['auto', '自動'], ['spring', '春'], ['summer', '夏'], ['autumn', '秋'], ['winter', '冬']];
const WEATHERS = [['auto', '忙しさで自動'], ['calm', '凪'], ['ripple', 'さざ波'], ['waves', '波'], ['rough', '時化'], ['storm', '大時化']];
const curSeason = () => S.settings.season === 'auto' ? Env.auto.season : S.settings.season;
if (S.settings.weather && Env.KINDS[S.settings.weather]) Env.setWeatherMode(S.settings.weather);
function renderEnv() {
  home.setSeason(curSeason());
  home.setWeather(Env.target());
  const k = Env.KINDS[Env.weather], s = Env.SEASON_LABEL[curSeason()];
  $('envSmall').textContent = `${s}・${k.label}（${k.sky}）`;
  $('envMenu').innerHTML = `<p style="margin:0 0 6px;font-size:12px;color:var(--sub)">季節</p><div class="go" style="margin:0 0 12px">${SEASONS.map(([k, v]) => `<button class="btn${S.settings.season === k ? ' pri' : ''}" data-season="${k}">${v}</button>`).join('')}</div>
    <p style="margin:0 0 6px;font-size:12px;color:var(--sub)">空と水面（ふだんは、やることの詰まり具合で自動）</p><div class="go" style="margin:0 0 12px">${WEATHERS.map(([k, v]) => `<button class="btn${Env.weatherMode === k ? ' pri' : ''}" data-weather="${k}">${v}</button>`).join('')}</div>
    <p style="margin:0 0 6px;font-size:12px;color:var(--sub)">音</p><div class="go" style="margin:0"><button class="btn${S.settings.sound ? ' pri' : ''}" data-sound="1">沈めるときの音 ${S.settings.sound ? 'オン' : 'オフ'}</button></div>
    <p style="margin:10px 0 0;font-size:11px;color:var(--faint)">${esc(Env.statusText())}${Env.auto.reason ? `<br>${esc(Env.auto.reason)}` : ''}</p>`;
}
Env.on(renderEnv);
$('envNav').onclick = e => { e.stopPropagation(); $('envMenu').classList.toggle('open'); $('scrim').classList.toggle('open', $('envMenu').classList.contains('open')); };
$('envMenu').addEventListener('click', e => {
  e.stopPropagation();
  const s = e.target.closest('[data-season]'), w = e.target.closest('[data-weather]'), so = e.target.closest('[data-sound]');
  if (s) { S.settings.season = s.dataset.season; save(); renderEnv(); }
  if (w) { S.settings.weather = w.dataset.weather; save(); Env.setWeatherMode(w.dataset.weather); }
  if (so) { S.settings.sound = !S.settings.sound; save(); renderEnv(); }
});

// ---------------------------------------------------------------- カメラの移動（ホイール・スワイプ・矢印キー）
let station = 'home', moving = false;
// 左の列の「選んでいる印」をすべらせる
function moveInd() {
  const on = document.querySelector('.side .nav.on'), ind = $('navInd');
  if (!on) { ind.style.opacity = '0'; return; }
  ind.style.opacity = '1';
  ind.style.height = `${on.offsetHeight}px`;
  ind.style.transform = `translateY(${on.offsetTop}px)`;
}
addEventListener('resize', moveInd);
// 水面に上がったとき：パネルに水滴がつき、2秒ほどで落ちる
function wetPanels() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = [...document.querySelectorAll('#top .panel, .side, #tide, #calmBtn, #addBtn')];
  for (const el of targets) {
    const box = document.createElement('div'); box.className = 'drops';
    box.innerHTML = '<div class="sheen"></div>';
    const r = el.getBoundingClientRect(), n = Math.max(3, Math.round(r.width * r.height / 9000));
    for (let i = 0; i < Math.min(n, 18); i++) {
      const d = document.createElement('i'); d.className = 'd';
      const s = 3 + Math.random() * 7;
      d.style.cssText = `left:${Math.random() * 96}%;top:${Math.random() * 75}%;width:${s}px;height:${s * 1.15}px;--t:${1.3 + Math.random() * 0.8}s;--dl:${Math.random() * 0.35}s;--fall:${30 + Math.random() * 110}px`;
      box.appendChild(d);
    }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(box);
    setTimeout(() => box.remove(), 2600);
  }
}
const ORDER = ['map', 'home', 'bed'];
function step(dir) { const i = ORDER.indexOf(station); goTo(ORDER[Math.max(0, Math.min(ORDER.length - 1, i + dir))]); }
function goTo(name) {
  if (name === station || moving) return;
  const wasHome = station === 'home', from = station;
  moving = true; station = name; closePop(); closeAdd();
  // 空から見るときは、左の列と上のパネルの実際の大きさを測って、その外にブイを収める
  const side = document.querySelector('.side').getBoundingClientRect(), mv = $('mapview');
  const ins = { left: (innerWidth > 820 ? side.right : 0) + 18, top: mv.offsetTop + mv.offsetHeight + 18, right: 24, bottom: 24 };
  const st = home.stationFor(name, ins);
  // 移動中は名札を消す（チカチカするので）
  document.body.classList.add('moving');
  const down = name === 'bed';
  document.querySelectorAll('.side .nav[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === name));
  const up = name === 'map';
  document.body.classList.toggle('map', up);
  $('mapview').classList.toggle('on', up);
  moveInd();
  if (!down && !wasHome) setTimeout(wetPanels, 650);
  renderBed();
  [$('top'), $('bedhint'), $('ticks'), $('axis')].forEach(el => el.classList.toggle('away', down || up));
  $('tags').style.opacity = down ? '0' : '1';
  // 空 ↔ 湖底は遠すぎるので、フェードでつなぐ。ほかは位置と向きを同時に動かす
  if ((from === 'map' && name === 'bed') || (from === 'bed' && name === 'map')) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => { home.jumpTo(st); $('bedview').classList.toggle('on', down); setTimeout(() => { f.classList.remove('on'); moving = false; document.body.classList.remove('moving'); }, 120); }, 380);
  } else {
    if (!down) $('bedview').classList.remove('on');
    setTimeout(() => { if (station === 'bed') $('bedview').classList.add('on'); }, wasHome ? 1000 : 0);
    home.flyTo(st, 1.8).then(() => { moving = false; document.body.classList.remove('moving'); });
  }
}
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) goTo(g.dataset.go); });
const overlayOpen = () => $('addbox').classList.contains('open') || $('pop').classList.contains('open') || $('envMenu').classList.contains('open');
Observer.create({
  target: window, type: 'wheel,touch', tolerance: 24, preventDefault: true, wheelSpeed: -1,
  onUp: () => { if (!overlayOpen() && !scrollingInside()) step(1); },
  onDown: () => { if (!overlayOpen() && !scrollingInside()) step(-1); }
});
// 湖底の一覧の中でのスクロールは、一覧だけを動かす
let lastWheelTarget = null;
addEventListener('wheel', e => { lastWheelTarget = e.target; }, { capture: true, passive: true });
function scrollingInside() {
  const list = lastWheelTarget?.closest?.('.list');
  return !!(list && list.scrollHeight > list.clientHeight + 2 && station !== 'home');
}
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { if (e.key === 'Escape') { closeAdd(); document.activeElement.blur(); } return; }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') step(1);
  if (e.key === 'ArrowUp' || e.key === 'PageUp') step(-1);
  if (e.key === 'Escape') closePop();
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || e.key === 'c' || e.key === '/') { e.preventDefault(); openAdd(); }
});

// ほかのタブ（一覧画面）で変わったら読み直す
addEventListener('storage', e => { if (e.key === St.KEY) { S = St.load(); render(); } });
let lastDay = St.todayStr();
setInterval(() => { if (St.todayStr() !== lastDay) { lastDay = St.todayStr(); render(); } }, 60e3);
render();
renderEnv();
requestAnimationFrame(moveInd);
// 時間帯：1分ごとに太陽の高さを更新（?hour=19.5 で確かめられる）
const qhour = new URLSearchParams(location.search).get('hour');
function tick() {
  const d = new Date();
  if (qhour !== null) { const h = +qhour; d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); }
  home.setTime(d, Env.auto.lat, Env.auto.lon);
  document.documentElement.dataset.night = home.sunAlt < -3 ? '1' : '0';
}
tick(); setInterval(tick, 60e3); Env.on(tick);
const qv = new URLSearchParams(location.search).get('view'); if (ORDER.includes(qv)) setTimeout(() => goTo(qv), 600);
window.UmiHome = { goTo, complete, get S() { return S; }, home };
