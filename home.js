// Umi ホーム：湖に浮かぶブイ＝タスク。終えたら沈める。ホイールはページではなくカメラを動かす
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/+esm';
import { Observer } from 'https://cdn.jsdelivr.net/npm/gsap@3.15.1/Observer/+esm';
import { createHome } from './home-scene.js?v=22';
import { parseQuick } from './parse.js?v=22';
import * as St from './store.js?v=22';
import { Cloud, startCloud, Shiomi } from './cloud.js?v=22';
gsap.registerPlugin(Observer);

const $ = id => document.getElementById(id);
const { esc, secOf, dueLabel, estLabel } = St;
const areaName = t => (S.areas.find(a => a.id === t.area) || {}).name || '';
const rank = list => St.rank(list, S.settings.budget, areaName);
const kindOf = t => St.kindOf(t, areaName(t));
const levelOf = t => St.weightLevel(t, S.settings.budget, areaName(t));
let sharkSet = new Set();
let S = St.load();
let hooksReady = false;
// ログイン中はアカウント（Firestore）へ、していないときはこのブラウザへ保存。保存のたびに潮見に未評価のものを渡す
const save = () => {
  if (Cloud.user) Cloud.queueSave(JSON.stringify(S)); else St.save(S);
  if (hooksReady) Shiomi.kick(shiomiHooks);
};
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
let lastKeep = null;
function calmSet() { return new Set(rank(live().filter(t => secOf(t) === 'surface')).slice(0, 3).map(t => t.id)); }

function render() {
  const L = live(), calm = S.settings.calm, keep = calm ? calmSet() : null;
  home.setTasks(L.map(t => ({ id: t.id, kind: kindOf(t), sec: secOf(t), hidden: calm && !keep.has(t.id), ...St.placeOf(t, S.settings.budget, areaName(t)) })));
  home.setSunk(S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).map(t => t.kind));
  // 凪のあいだに残る3つが入れ替わったら、その配置に合わせて寄り直す
  const keepKey = calm ? [...keep].sort().join() : '';
  if (calm && lastKeep !== null && keepKey !== lastKeep) frameHome(1.8, 1400);
  lastKeep = keepKey;
  sharkSet = new Set(St.sharkIds(L.filter(t => !calm || keep.has(t.id)), S.settings.budget, areaName));
  home.setAlerts([...sharkSet]);

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
  $('summary').innerHTML = `${d.getMonth() + 1}月${d.getDate()}日（${St.WD[d.getDay()]}）${urg ? `　<button class="late linkish" data-go="map" title="空から見て、どれが急ぎか確かめる">急ぎ ${urg}件</button>` : ''}`;
  // 件数は「一覧（空から見る）」に出す
  $('mapSub').innerHTML = (calm ? `<span class="calmnote">凪：いまの3件だけ表示中</span>　` : '') + `浮かんでいる <b>${L.length}件</b>（今日 ${today}${urg ? `・<span class="late">急ぎ ${urg}</span>` : ''}・今週 ${cnt('shallows')}・いつか ${cnt('depths')}）` +
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
  $('tide').innerHTML = `<span class="long">今日の</span>潮位 <b>${estLabel(plan) || '0分'}</b> ／ ${estLabel(B)}　<span class="rest">${over ? `${estLabel(plan - B)}多い` : `あと${estLabel(B - plan) || '0分'}`}</span><div class="bar"><i style="width:${Math.min(100, plan / B * 100)}%"></i></div>`;

  // 今日の優先タスク（凪モードでは3件だけ）
  const ranked = rank(L.filter(t => secOf(t) === 'surface'));
  const f = ranked[0], top = ranked.slice(1, calm ? 3 : 4); // 凪では、浮かんでいる3つだけ
  $('cards').innerHTML = top.length ? top.map(cardHTML).join('') : '<div class="empty">ほかにはありません</div>';
  focusId = f ? f.id : null;
  $('focus').innerHTML = f ? `${cardHTML(f)}<div class="go"><button class="btn pri" data-sink="${f.id}">沈める</button><button class="btn" data-dive="${f.id}">潜る</button><button class="btn quiet" data-later="${f.id}">明日へ</button></div>`
    : '<div class="empty">急ぐものはありません。</div>';
  document.querySelectorAll('#calmBtn, [data-calm]').forEach(b => b.setAttribute('aria-pressed', String(calm)));
  const doneN = S.tasks.filter(t => t.done).length;
  $('bedCount').textContent = `湖底　${doneN}`;
  renderBed();
}
function cardHTML(t) {
  const dl = dueLabel(t);
  return `<button class="card" data-open="${t.id}"><div class="t">${esc(t.title)}</div>
    <span class="badge ${kindOf(t)}">${kindOf(t) === 'must' ? '必須' : '自主'}</span>
    <div class="m">${dl ? `<span class="${dl.late ? 'late' : ''}">${esc(dl.text)}</span>` : '期限なし'}${t.est ? `　約${estLabel(t.est)}` : ''}</div></button>`;
}
// 湖底：終えたタスクはすべて、沈んだブイのまま積もっていく
function renderBed() {
  const done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const weekAgo = Date.now() - 7 * 86400e3, t0 = new Date(); t0.setHours(0, 0, 0, 0);
  $('bedTitle').textContent = `湖底　これまでに沈めた ${done.length}件`;
  $('bedSub').textContent = `今日 ${done.filter(t => t.doneAt >= +t0).length}件・この7日 ${done.filter(t => t.doneAt > weekAgo).length}件　／　上へスクロールで水面へ`;
  const open = $('bedList').classList.contains('open');
  $('bedLevels').innerHTML = `<button class="btn" aria-pressed="${open}" id="bedToggle">${open ? '一覧を閉じる' : '一覧表示'}</button><button class="btn" data-go="home">水面へ戻る</button>`;
  $('bedList').innerHTML = done.length ? done.slice(0, 60).map(t => {
    const d = new Date(t.doneAt);
    return `<div class="it"><span>${esc(t.title)}<small>${d.getMonth() + 1}月${d.getDate()}日（${St.WD[d.getDay()]}）に沈めた</small></span><button class="btn" data-raise="${t.id}">引き上げる</button></div>`;
  }).join('') : '<div class="empty">まだ何も沈んでいません。</div>';
}

// ---------------------------------------------------------------- 名札（ブイの上の文字）
const tagEls = new Map();
let focusId = null, freshId = null, freshUntil = 0;
let hlId = null;
home.onFrame((pts, { inside }) => {
  const seen = new Set();
  // 名札：手前を最優先、次に右。常に出すのは上位3つ。ほかはカーソルを合わせたときだけ
  const SHOW = station === 'map' ? 999 : S.settings.calm ? 3 : 0; // 凪では残った3つの名前を出す
  const order = pts.slice().sort((a, b) => (Math.round(a.dist / 22) - Math.round(b.dist / 22)) || (b.x - a.x));
  const fresh = Date.now() < freshUntil ? freshId : null;
  if (fresh) order.sort((a, b) => (b.id === fresh) - (a.id === fresh)); // 追加したばかりのものは、いちばん先に場所をとる
  const always = new Set(order.slice(0, SHOW).map(p => p.id));
  if (fresh) always.add(fresh);
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
    el.className = 'tag' + (hlId === p.id ? ' hl' : '') + (sharkSet.has(t.id) ? ' urgent' : '') + (p.id === fresh ? ' fresh' : '') + (show ? '' : ' off');
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
// 削除：ブイを消す（トーストで元に戻せる）
function removeTask(id) {
  const i = S.tasks.findIndex(x => x.id === id); if (i < 0) return;
  const [t] = S.tasks.splice(i, 1); closePop(); save(); render();
  toast(`「${t.title}」を削除しました`, () => { S.tasks.splice(i, 0, t); });
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
  const prev = t.w ? { ...t.w } : null, lvl = Math.max(1, levelOf(t) - 1);
  t.w = { ...(t.w || {}), ...St.WEIGHT_IP[lvl] }; t.touchedAt = Date.now();
  delete t.sample; save(); closePop(); render();
  toast(`「${t.title}」を浅瀬へ（重さ：${St.WEIGHT[lvl]}）`, () => { t.w = prev; });
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
  const lvl = levelOf(t), c = St.compute(t, S.settings.budget, areaName(t));
  const moves = `<button class="btn quiet" data-lighter${lvl <= 1 ? ' disabled' : ''} title="軽くする（左の浅瀬へ）">浅瀬へ</button>`;
  const later = '';
  $('pop').innerHTML = `<h3>${esc(t.title)}</h3>
    <div class="m"><span>${SEC_NAME[sec]}</span>${dl ? `<span class="${dl.late ? 'late' : ''}">${esc(dl.text)}</span>` : ''}${t.est ? `<span>約${estLabel(t.est)}</span>` : ''}
    <span>${c.must ? '必須' : '自主'}</span><span>重さ：${St.WEIGHT[lvl]}</span>${a ? `<span>${esc(a.name)}</span>` : ''}${t.repeat ? `<span>↻ ${St.REPEAT[t.repeat]}</span>` : ''}${(t.diveMin || t.dives?.length) ? `<span>潜った 計${estLabel(t.diveMin || t.dives.reduce((s, d) => s + d.min, 0))}</span>` : ''}</div>
    ${t.notes ? `<div class="m">${esc(t.notes)}</div>` : ''}
    <div class="why" title="価値 ${c.I}・痛手 ${c.P}・手間 ${c.E}・待ち ${c.D}">${c.evaluated ? '潮見' : '目安'}：価値 ${c.I}・痛手 ${c.P}・待ち ${c.D}${c.why ? `　${esc(c.why)}` : ''}</div>
    <div class="pair"><div><div class="lbl">重さ</div><div class="seg" data-seg="weight">${[1, 2, 3].map(w => `<button class="${lvl === w ? 'on' : ''}" data-weight="${w}">${St.WEIGHT[w]}</button>`).join('')}</div></div>
      <div><div class="lbl">遠くへ</div><div class="seg plain">${[[1, '＋1日'], [3, '＋3日'], [7, '＋1週']].map(([n, l]) => `<button data-post="${n}">${l}</button>`).join('')}</div></div></div>
    ${later}
    <div class="go"><button class="btn pri" data-sink="${t.id}" title="ブイを長押ししても沈められます">沈める</button><button class="btn" data-dive="${t.id}">潜る</button>${moves}<a class="btn quiet" href="list.html">一覧で編集</a><button class="btn quiet del" data-del="${t.id}" title="このタスクを消す（元に戻せます）">削除</button></div>`;
  const pop = $('pop'); pop.classList.add('open');
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, x - w / 2))}px`;
  pop.style.top = `${Math.max(12, Math.min(innerHeight - h - 12, y - h - 24))}px`;
  $('scrim').classList.add('open');
}
function closePop() { $('pop').classList.remove('open'); $('envMenu').classList.remove('open'); $('scrim').classList.remove('open'); popId = null; hlId = null; home.setHover(null); }
$('scrim').onclick = () => { closePop(); closeAdd(); };

document.addEventListener('click', e => {
  if (e.target.closest('#bedToggle')) { $('bedList').classList.toggle('open'); renderBed(); return; }
  const sk = e.target.closest('[data-sink]'); if (sk) { complete(sk.dataset.sink); return; }
  const dl = e.target.closest('[data-del]'); if (dl) { removeTask(dl.dataset.del); return; }
  const lt = e.target.closest('[data-later]'); if (lt) { postpone(lt.dataset.later, 1); return; }
  const po = e.target.closest('[data-post]'); if (po && popId) { postpone(popId, +po.dataset.post); return; }
  const li = e.target.closest('[data-lighter]'); if (li && popId) { lighter(popId); return; }
  const rs = e.target.closest('[data-raise]'); if (rs) { raise(rs.dataset.raise); return; }
  const wt = e.target.closest('[data-weight]');
  if (wt && popId) { const t = S.tasks.find(x => x.id === popId); t.w = { ...(t.w || {}), ...St.WEIGHT_IP[+wt.dataset.weight] }; t.touchedAt = Date.now(); delete t.sample; save(); const id = popId, r = $('pop').getBoundingClientRect(); render(); openPop(id, r.left + r.width / 2, r.bottom + 24); return; }
  const op = e.target.closest('[data-open]');
  if (op) {
    const tag = tagEls.get(op.dataset.open);
    const r = (tag || op).getBoundingClientRect();
    openPop(op.dataset.open, r.left + r.width / 2, tag ? r.top : r.bottom + 260);
  }
});
// 3Dのブイを直接押す・指す
// 長押し（0.7秒）で沈める。押している間は円が満ちていく。指を離す・動かすと取り消し
const HOLD_MS = 700;
let hold = null, swallowClick = false;
function startHold(id, x, y) {
  cancelHold();
  const ring = $('hold'); ring.style.left = `${x}px`; ring.style.top = `${y}px`;
  ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on');
  hold = { id, x, y, timer: setTimeout(() => { swallowClick = true; cancelHold(); if (navigator.vibrate) navigator.vibrate(12); complete(id); }, HOLD_MS) };
}
function cancelHold() { if (hold) { clearTimeout(hold.timer); hold = null; } $('hold').classList.remove('on'); }
function holdTarget(e) {
  const tag = e.target.closest?.('.tag[data-open]');
  if (tag) return tag.dataset.open;
  return e.target === $('scene') ? home.pick(e.clientX, e.clientY) : null;
}
addEventListener('pointerdown', e => {
  if (e.button !== 0 || overlayOpen()) return;
  const id = holdTarget(e); if (id && station !== 'bed') startHold(id, e.clientX, e.clientY);
});
addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) cancelHold(); });
addEventListener('pointerup', cancelHold); addEventListener('pointercancel', cancelHold);
addEventListener('contextmenu', e => { if (e.target === $('scene') || e.target.closest?.('.tag')) e.preventDefault(); });
// 長押しで沈めた直後の「クリック」は、カードを開かない
addEventListener('click', e => { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
$('scene').addEventListener('click', e => { const id = home.pick(e.clientX, e.clientY); if (id) openPop(id, e.clientX, e.clientY); else closePop(); });
$('scene').addEventListener('pointermove', e => { if (popId) return; const id = home.pick(e.clientX, e.clientY); home.setHover(id); hlId = id; $('scene').style.cursor = id ? 'pointer' : ''; });

// 凪モード
function homeInsets() {
  const side = document.querySelector('.side').getBoundingClientRect(), top = $('top').getBoundingClientRect();
  return { left: (innerWidth > 820 ? side.right : 0) + 24, top: top.bottom + 20, right: 28, bottom: 28 };
}
// 凪：水面が一度大きくうねる → いらないブイが沈む → 静まりながら、残った3つが収まるところまで寄る
let calmTimer = 0;
function frameHome(dur, delay = 0) {
  clearTimeout(calmTimer);
  calmTimer = setTimeout(() => {
    if (station !== 'home' || moving) return;
    moving = true; document.body.classList.add('moving');
    home.flyTo(home.stationFor('home', homeInsets()), dur).then(() => { moving = false; document.body.classList.remove('moving'); });
  }, delay);
}
function toggleCalm() {
  S.settings.calm = !S.settings.calm; home.setCalm(S.settings.calm); save(); render();
  if (station === 'home') frameHome(S.settings.calm ? 2.6 : 2.2, S.settings.calm ? 700 : 300);
  // 一覧（空から）では、沈み終わってから残ったものに合わせて高さを変える
  if (station === 'map') setTimeout(() => { if (station === 'map' && !moving) { moving = true; home.flyTo(home.stationFor('map'), 2).then(() => { moving = false; }); } }, S.settings.calm ? 1900 : 400);
}
$('calmBtn').onclick = toggleCalm;
document.addEventListener('click', e => { if (e.target.closest('[data-calm]')) toggleCalm(); });

// 追加
// よく使う言葉：押すと入力欄に足す
const QUICK = ['今日', '明日', '来週月曜', '30分', '1時間', '必須', '重い', '軽い', '毎日', 'いつか'];
function openAdd() {
  const r = $('addBtn').getBoundingClientRect(), box = $('addbox');
  box.style.top = `${r.bottom + 10}px`; box.style.right = `${Math.max(12, innerWidth - r.right)}px`;
  $('quick').innerHTML = QUICK.map(w => `<button type="button" data-q="${w}">${w}</button>`).join('') +
    S.areas.slice(0, 4).map(a => `<button type="button" data-q="#${esc(a.name)}">#${esc(a.name)}</button>`).join('');
  box.classList.add('open'); $('scrim').classList.add('open'); $('addInput').value = ''; showPv();
  setTimeout(() => $('addInput').focus(), 60);
}
$('quick').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  const inp = $('addInput'); inp.value = (inp.value.trim() + ' ' + b.dataset.q).trim() + ' '; inp.focus(); showPv();
});
function closeAdd() { $('addbox').classList.remove('open'); if (!popId) $('scrim').classList.remove('open'); }
$('addBtn').onclick = openAdd;
function showPv() {
  const v = $('addInput').value.trim(); if (!v) { $('pv').innerHTML = ''; return; }
  const p = parseQuick(v), bits = [];
  if (p.due) bits.push(['due', dueLabel({ due: p.due, time: p.time }).text]); else if (p.someday) bits.push(['due', 'いつか']);
  if (p.est) bits.push(['est', `約${estLabel(p.est)}`]);
  if (p.area) bits.push(['area', `#${p.area}`]);
  if (p.kind) bits.push([p.kind, p.kind === 'must' ? '必須' : '自主']);
  if (p.weight) bits.push(['w', `重さ：${St.WEIGHT[p.weight]}`]);
  if (p.repeat) bits.push(['rep', `↻ ${St.REPEAT[p.repeat]}`]);
  $('pv').innerHTML = bits.map(b => `<span class="c-${b[0]}">${esc(b[1])}</span>`).join('');
}
$('addInput').addEventListener('input', showPv);
$('addForm').addEventListener('submit', e => {
  e.preventDefault();
  const p = parseQuick($('addInput').value); if (!p.title) return;
  const t = { id: St.uid(), title: p.title, area: p.area ? St.areaByName(S, p.area) : null, due: p.due, time: p.time, est: p.est,
    kind: p.kind, repeat: p.repeat, pin: p.someday ? 'depths' : (p.due ? null : 'surface'), notes: '', done: false, doneAt: null,
    w: p.weight ? { ...St.WEIGHT_IP[p.weight] } : undefined, ord: Math.max(0, ...S.tasks.map(x => x.ord)) + 1, createdAt: Date.now() };
  S.tasks.push(t); freshId = t.id; freshUntil = Date.now() + 5000; save(); render(); closeAdd();
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
  $('envMenu').innerHTML = `<p style="margin:0 0 6px;font-size:12px;color:var(--sub)">季節</p><div class="seg" data-seg="season" style="margin:0 0 12px">${SEASONS.map(([k, v]) => `<button class="${S.settings.season === k ? 'on' : ''}" data-season="${k}">${v}</button>`).join('')}</div>
    <p style="margin:0 0 6px;font-size:12px;color:var(--sub)">空と水面（ふだんは、やることの詰まり具合で自動）</p><div class="seg" data-seg="weather" style="margin:0 0 12px">${WEATHERS.map(([k, v]) => `<button class="${Env.weatherMode === k ? 'on' : ''}" data-weather="${k}">${v}</button>`).join('')}</div>
    <p style="margin:0 0 6px;font-size:12px;color:var(--sub)">1日に使える時間（潮位と、作業にかかる日数の計算に使う）</p><div class="seg" data-seg="hours" style="margin:0 0 12px">${[2, 3, 4, 5, 6, 8].map(h => `<button class="${S.settings.budget === h * 60 ? 'on' : ''}" data-hours="${h}">${h}時間</button>`).join('')}</div>
    <p style="margin:0 0 6px;font-size:12px;color:var(--sub)">凪モード（いまやる3件だけを浮かべる）</p><div class="go" style="margin:0 0 12px"><button class="calm small" data-calm aria-pressed="${!!S.settings.calm}"><span class="sw"><i></i></span><b>凪モード</b></button></div>
    <div class="menvacct" id="account2"></div>
    <p style="margin:0 0 6px;font-size:12px;color:var(--sub)">音</p><div class="go" style="margin:0"><button class="btn" aria-pressed="${!!S.settings.sound}" data-sound="1">沈めるときの音 ${S.settings.sound ? 'オン' : 'オフ'}</button></div>
    <p style="margin:10px 0 0;font-size:11px;color:var(--faint)">${esc(Env.statusText())}${Env.auto.reason ? `<br>${esc(Env.auto.reason)}` : ''}</p>`;
  const a2 = $('account2'); if (a2 && $('account')) a2.innerHTML = $('account').innerHTML;
}
Env.on(renderEnv);
$('envNav').onclick = e => { e.stopPropagation(); $('envMenu').classList.toggle('open'); $('scrim').classList.toggle('open', $('envMenu').classList.contains('open')); };
$('envMenu').addEventListener('click', e => {
  e.stopPropagation();
  const s = e.target.closest('[data-season]'), w = e.target.closest('[data-weather]'), so = e.target.closest('[data-sound]');
  const hr = e.target.closest('[data-hours]'); if (hr) { S.settings.budget = +hr.dataset.hours * 60; save(); renderEnv(); render(); }
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
// 窓の大きさが変わったら、いまの視点を測り直す（凪の3つ・空からの一覧が外れないように）
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (moving) return;
    if (station === 'home' && S.settings.calm) home.jumpTo(home.stationFor('home', homeInsets()));
    if (station === 'map') { const side = document.querySelector('.side').getBoundingClientRect(), mv = $('mapview');
      home.jumpTo(home.stationFor('map', { left: (innerWidth > 820 ? side.right : 0) + 18, top: mv.offsetTop + mv.offsetHeight + 18, right: 24, bottom: 24 })); }
  }, 250);
});
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
  if (name === station || moving || station === 'dive') return;
  const wasHome = station === 'home', from = station;
  moving = true; station = name; closePop(); closeAdd();
  // 空から見るときは、左の列と上のパネルの実際の大きさを測って、その外にブイを収める
  const side = document.querySelector('.side').getBoundingClientRect(), mv = $('mapview');
  const ins = { left: (innerWidth > 820 ? side.right : 0) + 18, top: mv.offsetTop + mv.offsetHeight + 18, right: 24, bottom: 24 };
  const st = home.stationFor(name, name === 'home' ? homeInsets() : ins);
  // 移動中は名札を消す（チカチカするので）
  document.body.classList.add('moving');
  const down = name === 'bed';
  document.querySelectorAll('.side .nav[data-go], .mbar [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === name));
  document.querySelectorAll('.mbar [data-dive-open]').forEach(b => b.classList.remove('on'));
  const up = name === 'map';
  document.body.classList.toggle('map', up);
  $('mapview').classList.toggle('on', up);
  moveInd();
  if (name === 'home' && from === 'bed') setTimeout(wetPanels, 650); // 水滴は湖底から上がってきたときだけ
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
const overlayOpen = () => station === 'dive' || !$('dive').hidden || $('addbox').classList.contains('open') || $('pop').classList.contains('open') || $('envMenu').classList.contains('open');
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
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || e.key === 'c' || e.key === '/') { e.preventDefault(); kbdOpen(); openAdd(); }
  if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !overlayOpen()) { e.preventDefault(); kbdOpen(); openDive(); }
});

// ほかのタブ（一覧画面）で変わったら読み直す
addEventListener('storage', e => { if (e.key === St.KEY) { S = St.load(); render(); } });
let lastDay = St.todayStr();
setInterval(() => { if (St.todayStr() !== lastDay) { lastDay = St.todayStr(); render(); } }, 60e3);
// ---------------------------------------------------------------- ログインと潮見（AI）
const shiomiHooks = {
  // まだ潮見が見ていないタスク（名前が変わったものも）
  pending: () => S.tasks.filter(t => !t.done && !(t.ai && t.ai.title === t.title))
    .map(t => ({ id: t.id, title: t.title, note: t.notes || '', project: areaName(t), hasDue: !!t.due })),
  // あなたが重さを直した例（潮見がこの人の物差しとして使う）
  examples: () => S.tasks.filter(t => t.w && (t.w.i != null || t.w.p != null)).slice(-6).map(t => {
    const c = St.compute(t, S.settings.budget, areaName(t));
    return { title: t.title, impact: c.I, penalty: c.P, effort: c.E, dependency: c.D, must: c.must };
  }),
  apply: results => {
    for (const r of results) {
      const t = S.tasks.find(x => x.id === r.id); if (!t) continue;
      t.ai = { title: t.title, i: r.impact, p: r.penalty, e: r.effort, d: r.dependency, m: r.must, why: r.reason, mwhy: r.must_reason };
    }
    if (Cloud.user) Cloud.queueSave(JSON.stringify(S)); else St.save(S);
    render();
  },
  status: () => renderAccount()
};
const SHIOMI_TEXT = { off: 'ログインすると潮見が重さを付けます', idle: '潮見：最新', busy: '潮見：考えています…', unset: '潮見：Vercel に API キーが未設定', denied: '潮見：このアカウントは許可されていません', error: '潮見：つながりません（あとで再試行）' };
function renderAccount() {
  const el = $('account'); if (!el) return;
  queueMicrotask(() => { const a2 = $('account2'); if (a2) a2.innerHTML = el.innerHTML; }); // スマホでは設定の中に出す
  if (!Cloud.ready) { el.innerHTML = ''; return; }
  el.innerHTML = Cloud.user
    ? `<div class="acct"><b title="${esc(Cloud.user.email || '')}">${esc(Cloud.user.displayName || Cloud.user.email || 'ログイン中')}</b><button class="linkbtn" id="signOut">ログアウト</button></div><small>${SHIOMI_TEXT[Shiomi.state] || ''}</small>`
    : `<button class="btn gbtn" id="signIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>Google でログイン</button>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('#signIn')) Cloud.signIn?.();
  if (e.target.closest('#signOut')) Cloud.signOut?.();
});
startCloud({
  getJson: () => JSON.stringify(S),
  setJson: json => { S = St.fromJson(json); render(); renderEnv(); },
  localJson: () => JSON.stringify(St.load()),
  onUser: () => { renderAccount(); Shiomi.kick(shiomiHooks, 800); },
  toast: text => toast(text)
}).catch(() => {});
hooksReady = true;
Cloud.onSaved = ok => { if (!ok) toast('アカウントに保存できませんでした'); };

render();
if (S.settings.calm) { home.setCalm(true, true); home.jumpTo(home.stationFor('home', homeInsets())); }
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

// ?check=1 のとき、レイアウトの線を測って結果をタイトルに書く（headless のテスト用）
if (new URLSearchParams(location.search).has('check')) {
  const sc = document.createElement('script'); sc.src = 'tools/align-check.js?' + Date.now();
  sc.onload = () => setTimeout(() => { document.title = 'ALIGN ' + JSON.stringify(window.alignCheck()); }, 2500);
  document.head.appendChild(sc);
}

// ================================================================ ダイブ（集中タイマー）
// 先行事例と案の評価は docs/dive-research.md。
// 潜る先のブイの下へ湖の中を下りる（深さ＝時間）→ 浮かんだ考えは泡メモ → 浮上 → 減圧（潜った時間の1/5）
const DIVE_KEY = 'umi.dive';
let dv = null, dvTimer = 0, dvMode = 25, restEnd = 0;
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dvSave = () => { try { dv ? localStorage.setItem(DIVE_KEY, JSON.stringify(dv)) : localStorage.removeItem(DIVE_KEY); } catch (_) {} };
function dvShow(part) { // setup / hud / rest
  $('dive').hidden = false; document.body.classList.toggle('diving', part === 'hud'); $('dive').classList.toggle('dim', part !== 'hud');
  $('dSetup').classList.toggle('on', part === 'setup'); $('dHud').classList.toggle('on', part === 'hud');
  $('dGauge').classList.toggle('on', part === 'hud'); $('dRest').classList.toggle('on', part === 'rest');
}
function openDive(id) {
  if (station === 'dive' || moving) return;
  closePop(); closeAdd();
  const L = rank(live());
  const pick = id || focusId || L[0]?.id;
  if (!pick) { toast('潜る先のタスクがありません'); return; }
  const GROUP = [['surface', '今日'], ['shallows', '今週'], ['depths', 'いつか']];
  $('dTask').innerHTML = GROUP.map(([s, name]) => { const g = L.filter(t => secOf(t) === s); return g.length ? `<optgroup label="${name}">${g.map(t => `<option value="${t.id}"${t.id === pick ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>` : ''; }).join('');
  const t = S.tasks.find(x => x.id === pick);
  setMode(t?.est && t.est >= 50 ? 50 : 25); dvShow('setup'); setTimeout(() => $('dStart').focus(), 50);
}
function setMode(m) {
  dvMode = m;
  $('dModes').querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', +b.dataset.m === m)); syncSeg($('dModes'));
  $('dNote').textContent = m ? `${m}分たつと、自動で浮上します。そのあと${Math.max(1, Math.round(m / 5))}分の減圧（休憩）。` : '自分で「浮上する」まで潜ります。休憩は、潜った時間の5分の1。';
}
$('dModes').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) setMode(+b.dataset.m); });
$('dCancel').onclick = () => { $('dive').hidden = true; };
$('dStart').onclick = () => startDive($('dTask').value, dvMode);
async function startDive(id, min, resume) {
  if (!id) return;
  if (station !== 'home') { // 一覧・湖底からは、フェードで直接ホームへ（2秒待たせない）
    const f = $('fade'); f.classList.add('on'); await new Promise(r => setTimeout(r, 380));
    station = 'home'; document.body.classList.remove('map'); $('mapview').classList.remove('on'); $('bedview').classList.remove('on');
    [$('top'), $('bedhint'), $('ticks'), $('axis')].forEach(el => el?.classList.remove('away')); $('tags').style.opacity = '1';
    home.jumpTo(home.diveStation(id, 0)); setTimeout(() => f.classList.remove('on'), 120);
  }
  dv = resume || { id, min, start: Date.now(), bubbles: [] }; dvSave();
  // 別のタブにいても浮上・減圧の終わりに気づけるように（最初の一度だけ許可を聞く）
  if (!resume && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  document.querySelectorAll('.side .nav').forEach(b => b.classList.toggle('on', b.hasAttribute('data-dive-open'))); moveInd();
  station = 'dive'; moving = true; document.body.classList.add('moving');
  const t = S.tasks.find(x => x.id === dv.id);
  $('dTaskName').textContent = t ? t.title : '';
  $('dSub').textContent = dv.min ? `${dv.min}分のダイブ` : '時間は決めない';
  dvShow('hud'); dvTick();
  plop();
  await home.flyTo(home.diveStation(dv.id, 0), 2.4);
  home.setDive(dv.id, 0); moving = false; document.body.classList.remove('moving');
  clearInterval(dvTimer); dvTimer = setInterval(dvTick, 500); dvTick();
}
function dvElapsed() { return Date.now() - dv.start; }
function dvTick() {
  if (!dv || dv.ended) return;
  const el = dvElapsed(), total = dv.min * 60e3;
  // 深さ：時間を決めたときはその割合、決めないときはだんだん深く（40分で6割ほど）
  const k = dv.min ? Math.min(1, el / total) : 1 - Math.exp(-el / (45 * 60e3));
  home.setDiveDepth(k);
  $('dDepth').style.height = `${k * 100}%`; $('dDepthTxt').textContent = `深さ ${Math.round(k * 30)}m`;
  const shown = dv.min ? fmt(total - el) : fmt(el);
  $('dTime').textContent = shown; document.title = `▼ ${shown} · Umi`;
  if (dv.min && el >= total) surface();
}
$('dBubbleForm').addEventListener('submit', e => {
  e.preventDefault(); const v = $('dBubble').value.trim(); if (!v || !dv) return;
  dv.bubbles.push(v); dvSave(); $('dBubble').value = ''; home.puff();
});
$('dUp').onclick = () => surface();
function surface() {
  if (!dv || dv.ended) return;
  clearInterval(dvTimer);
  const el = dvElapsed(), min = Math.max(1, Math.round((dv.min ? Math.min(el, dv.min * 60e3) : el) / 60e3));
  dv.ended = Date.now(); dv.used = min; dvSave();
  const t = S.tasks.find(x => x.id === dv.id);
  if (t && el > 60e3) { // 合計は diveMin にためて、記録は新しい50件だけ残す
    t.diveMin = (t.diveMin || (t.dives || []).reduce((s, d) => s + d.min, 0)) + min;
    t.dives = [...(t.dives || []), { at: dv.start, min }].slice(-50); save();
  }
  plop();
  notify('浮上しました', `${min}分 潜りました。${Math.max(1, Math.round(min / 5))}分の減圧（休憩）をどうぞ`);
  document.querySelectorAll('.side .nav').forEach(b => b.classList.toggle('on', b.dataset.go === 'home')); moveInd();
  document.title = 'Umi';
  home.setDive(null); moving = true; document.body.classList.add('moving');
  station = 'home';
  home.flyTo(home.stationFor('home', homeInsets()), 2.4).then(() => { moving = false; document.body.classList.remove('moving'); });
  setTimeout(wetPanels, 1700);
  showRest(min, t);
}
function showRest(min, t) {
  const rest = Math.max(1, Math.round(min / 5));
  restEnd = (dv.ended || Date.now()) + rest * 60e3;
  $('dSummary').textContent = `${min}分 潜りました`;
  renderBubbles(); dvShow('rest');
  $('dSink').hidden = !t || t.done;
  const upd = () => {
    const left = restEnd - Date.now();
    $('dRestTime').textContent = left > 0 ? `減圧 ${fmt(left)}` : '減圧おわり';
    document.title = left > 0 ? `減圧 ${fmt(left)} · Umi` : 'Umi';
    $('dBreathTxt').textContent = left > 0 ? '波に合わせて、ゆっくり吸って、吐いて' : 'また潜れます';
    if (left <= 0) { clearInterval(dvTimer); if (Date.now() - restEnd < 5000) { chime(); notify('減圧おわり', 'また潜れます'); } }
  };
  clearInterval(dvTimer); upd(); dvTimer = setInterval(upd, 500);
}
function renderBubbles() {
  const b = dv?.bubbles || [];
  $('dBubbles').innerHTML = b.length ? `<div class="dlab">泡メモ（${b.length}）</div>` + b.map((x, i) => `<div class="bub"><span>${esc(x)}</span><button class="btn" data-bf="${i}">浮かべる</button><button class="btn quiet" data-bx="${i}">消す</button></div>`).join('') : '';
}
$('dBubbles').addEventListener('click', e => {
  const f = e.target.closest('[data-bf]'), x = e.target.closest('[data-bx]');
  if (!f && !x) return;
  const i = +(f ? f.dataset.bf : x.dataset.bx), text = dv.bubbles[i];
  if (f) { // 泡 → タスク（日付などは追加の入力欄と同じように読む）
    const p = parseQuick(text);
    const t = { id: St.uid(), title: p.title || text, area: p.area ? St.areaByName(S, p.area) : null, due: p.due, time: p.time, est: p.est, kind: p.kind, repeat: p.repeat,
      pin: p.someday ? 'depths' : (p.due ? null : 'surface'), notes: '', done: false, doneAt: null, w: p.weight ? { ...St.WEIGHT_IP[p.weight] } : undefined,
      ord: Math.max(0, ...S.tasks.map(x => x.ord)) + 1, createdAt: Date.now() };
    S.tasks.push(t); freshId = t.id; freshUntil = Date.now() + 5000; save(); render();
  }
  dv.bubbles.splice(i, 1); dvSave(); renderBubbles();
});
function endDive() { clearInterval(dvTimer); dv = null; dvSave(); $('dive').hidden = true; document.body.classList.remove('diving'); document.title = 'Umi'; }
$('dSink').onclick = () => { const id = dv?.id; endDive(); if (id) complete(id); };
$('dAgain').onclick = () => { const id = dv?.id, m = dv?.min ?? 25; endDive(); openDive(id); setMode(m); };
$('dHome').onclick = () => endDive();
document.addEventListener('click', e => {
  const d = e.target.closest('[data-dive]'); if (d) { openDive(d.dataset.dive); return; }
  if (e.target.closest('[data-dive-open]')) openDive();
});
addEventListener('keydown', e => {
  if ($('dive').hidden) return;
  if (e.key === 'Escape' && $('dSetup').classList.contains('on')) $('dive').hidden = true;
  else if (e.key === 'Escape' && $('dRest').classList.contains('on')) endDive();
  else if (e.key === 'Enter' && $('dSetup').classList.contains('on') && document.activeElement?.tagName !== 'SELECT' && !document.activeElement?.closest?.('button')) startDive($('dTask').value, dvMode);
});
// 後ろの暗いところを押したら、設定の画面は閉じる
$('dive').addEventListener('click', e => { if (e.target === $('dive') && $('dSetup').classList.contains('on')) $('dive').hidden = true; });
function notify(title, body) { try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body, silent: true }); } catch (_) {} }
// 減圧おわりの合図：やわらかい2音
function chime() {
  if (!S.settings.sound) return;
  try {
    actx = actx || new AudioContext();
    [[523, 0], [784, 0.18]].forEach(([f, d]) => { const t = actx.currentTime + d, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 1); });
  } catch (_) {}
}
// 再読み込みしても続きから（時刻で数えているので、離れていた間も進んでいる。離れても責めない）
try {
  const saved = JSON.parse(localStorage.getItem(DIVE_KEY) || 'null');
  if (saved && S.tasks.some(t => t.id === saved.id)) {
    if (saved.ended) { dv = saved; if (Date.now() - dv.ended < 30 * 60e3) showRest(dv.used || 1, S.tasks.find(x => x.id === dv.id)); else endDive(); }
    else setTimeout(() => startDive(saved.id, saved.min, saved), 800);
  } else if (saved) localStorage.removeItem(DIVE_KEY);
} catch (_) {}
window.UmiHome.dive = { openDive, startDive, surface, get dv() { return dv; } };

// スマホの下のメニュー：設定（湖のようす）
$('mEnv').onclick = e => { e.stopPropagation(); $('envMenu').classList.toggle('open'); $('scrim').classList.toggle('open', $('envMenu').classList.contains('open')); };
$('bedhint').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo('bed'); } });

// ================================================================ 切り替え（白い札がすべる）
// 中身を作り直す所（ポップアップ・設定）でも、前の位置から次の位置へすべらせる
const segPrev = {};
function syncSeg(seg, from) {
  if (!seg) return;
  let ind = seg.querySelector(':scope > .seg-ind');
  if (!ind) { ind = document.createElement('i'); ind.className = 'seg-ind'; ind.setAttribute('aria-hidden', 'true'); seg.prepend(ind); }
  seg.classList.add('ready');
  const on = seg.querySelector('button.on');
  if (!on || !on.offsetWidth) { ind.style.opacity = '0'; return; }
  if (from) { ind.style.transition = 'none'; ind.style.transform = `translate(${from.x}px, ${from.y}px)`; ind.style.width = `${from.w}px`; ind.style.height = `${from.h}px`; void ind.offsetWidth; ind.style.transition = ''; }
  ind.style.opacity = '1';
  ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`; ind.style.width = `${on.offsetWidth}px`; ind.style.height = `${on.offsetHeight}px`;
}
const segRect = b => b && { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
document.addEventListener('pointerdown', e => {
  const seg = e.target.closest?.('.seg[data-seg]'); if (seg) segPrev[seg.dataset.seg] = segRect(seg.querySelector('button.on'));
}, true);
document.addEventListener('click', e => { const seg = e.target.closest?.('.seg'); if (seg && seg.isConnected) requestAnimationFrame(() => seg.isConnected && syncSeg(seg)); });
new MutationObserver(muts => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    const segs = n.matches?.('.seg') ? [n] : [...(n.querySelectorAll?.('.seg') || [])];
    for (const seg of segs) requestAnimationFrame(() => { const k = seg.dataset.seg; syncSeg(seg, k && segPrev[k]); if (k) delete segPrev[k]; });
  }
}).observe(document.body, { childList: true, subtree: true });
document.querySelectorAll('.seg').forEach(s => syncSeg(s));
addEventListener('resize', () => document.querySelectorAll('.seg.ready').forEach(s => syncSeg(s)));
// 開いた画面が見えたときにも合わせる（閉じている間は幅が測れないことがある）
['pop', 'envMenu', 'dive'].forEach(id => new MutationObserver(() => $(id).querySelectorAll('.seg').forEach(s => syncSeg(s))).observe($(id), { attributes: true, attributeFilter: ['class', 'hidden'] }));
function kbdOpen() { document.body.classList.add('kbd-open'); setTimeout(() => document.body.classList.remove('kbd-open'), 400); }
// ?ui=pop|env|dive|add|rest：その画面を開いた状態で表示する（スクリーンショットの確認用）
{
  const ui = new URLSearchParams(location.search).get('ui');
  if (ui) setTimeout(() => {
    if (ui === 'pop') { const c = document.querySelector('#cards .card'); const r = c.getBoundingClientRect(); openPop(c.dataset.open, r.left + r.width / 2, r.bottom + 260); }
    if (ui === 'env') $('envNav').click();
    if (ui === 'dive') openDive();
    if (ui === 'add') { openAdd(); $('addInput').value = '明日15時 統計の課題 #大学 1時間 必須'; showPv(); }
    if (ui === 'rest') { dv = { id: focusId, min: 25, start: Date.now() - 26 * 60e3, bubbles: ['返信メール 明日', '資料を印刷'], ended: Date.now(), used: 25 }; showRest(25, S.tasks.find(t => t.id === focusId)); }
  }, 2500);
}
