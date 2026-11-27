// Saving and computing tasks (shares the umi.v1 storage key with the table page, list.html)
import { ymd } from './parse.js?v=47';
import { t as tr, getLang, md } from './i18n.js?v=47';

export const KEY = 'umi.v1';
export const COLORS = ['#2f6f8f', '#6a5acd', '#c0812c', '#3c8d5a', '#b4566e', '#4f7cc4', '#8a7a3c', '#3f8f8b'];
// Labels follow the current language (read at the moment they are used)
export const WD = new Proxy([], { get: (_, k) => (/^\d$/.test(k) ? tr('wd')[+k] : k === 'length' ? 7 : undefined) });
export const REPEAT = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? tr('repeat.' + k) : undefined) });
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sample() {
  const t = new Date(), d = n => { const x = new Date(t); x.setDate(x.getDate() + n); return ymd(x); };
  const ja = getLang() === 'ja';
  const A = [{ id: 'a1', name: ja ? '大学' : 'School', color: COLORS[0] }, { id: 'a2', name: 'Cypher', color: COLORS[1] },
             { id: 'a3', name: ja ? '制作' : 'Making', color: COLORS[2] }, { id: 'a4', name: ja ? '生活' : 'Life', color: COLORS[3] }];
  const L = (j, e) => (ja ? j : e);
  const mk = (title, o) => ({ id: uid(), title, area: null, due: null, time: null, est: null, kind: null, repeat: null,
    pin: null, notes: '', done: false, doneAt: null, ord: 0, createdAt: Date.now(), sample: true, ...o });
  const tasks = [
    mk(L('TIEカードの予約を取る', 'Book the residence card appointment'), { due: d(0), est: 15, kind: 'must', area: 'a4', weight: 2 }),
    mk(L('統計学の課題を提出する', 'Hand in the statistics assignment'), { due: d(0), time: '23:59', est: 60, kind: 'must', area: 'a1', weight: 3 }),
    mk(L('Cypher の AI クイズを作って報告する', 'Make the Cypher AI quiz and report'), { pin: 'surface', est: 30, kind: 'must', area: 'a2', weight: 1 }),
    mk(L('スペイン語の単語を20個', '20 Spanish words'), { due: d(0), est: 20, kind: 'self', area: 'a1', repeat: 'daily', weight: 1 }),
    mk(L('デスクトップを片付ける', 'Tidy up the desktop'), { due: d(1), est: 15, kind: 'self', area: 'a4', weight: 1 }),
    mk(L('英語教材 1-05 の台本を書く', 'Write the script for English lesson 1-05'), { due: d(2), est: 120, kind: 'self', area: 'a3', weight: 2 }),
    mk(L('ゼミの発表資料を送る', 'Send the seminar slides'), { due: d(3), est: 60, kind: 'must', area: 'a1', weight: 3 }),
    mk(L('家賃を振り込む', 'Pay the rent'), { due: d(4), est: 10, kind: 'must', area: 'a4', weight: 1 }),
    mk(L('会員アプリの改善案を3つ出す', 'Suggest 3 improvements for the members app'), { pin: 'shallows', est: 60, kind: 'self', area: 'a2', weight: 2 }),
    mk(L('ポートフォリオに Umi を載せる', 'Add Umi to the portfolio'), { due: d(20), est: 240, kind: 'self', area: 'a3', weight: 3 }),
    mk(L('AIで作った人シリーズの題材を10本ためる', 'Collect 10 topics for the "built with AI" series'), { pin: 'depths', kind: 'self', area: 'a3', weight: 1 }),
    mk(L('夏のインターンを調べる', 'Look into summer internships'), { due: d(70), est: 180, kind: 'self', area: 'a1', weight: 3 }),
    mk(L('アンダルシアの白い村を回る', 'Visit the white villages of Andalusia'), { pin: 'depths', kind: 'self', area: 'a4', weight: 2 }),
    mk(L('3Dの湖をコミットする', 'Commit the 3D lake'), { done: true, doneAt: Date.now() - 3600e3, area: 'a3' }),
    mk(L('経済学の小テスト', 'Economics quiz'), { done: true, doneAt: Date.now() - 86400e3 * 1.2, area: 'a1' })
  ];
  // sample: tasks finished over the last 5 weeks (to see how the lakebed pile looks)
  const past = ja ? ['洗濯', 'メールの返信', '統計の小テスト', '家計簿をつける', 'ゼミの文献を読む', 'Cypher の連絡', '英単語', '部屋の片付け', 'リールの台本', 'スーパーで買い物']
    : ['Laundry', 'Reply to emails', 'Stats quiz', 'Update the budget', 'Read for the seminar', 'Message Cypher', 'English words', 'Tidy the room', 'Reel script', 'Groceries'];
  for (let i = 0; i < 34; i++) {
    const daysAgo = 1 + Math.floor(Math.pow((i * 7919 % 97) / 97, 1.3) * 34);
    tasks.push(mk(past[i % past.length], { done: true, doneAt: Date.now() - daysAgo * 86400e3 - (i % 5) * 3600e3, kind: ['must', 'self', null][i % 3], area: A[i % 4].id }));
  }
  tasks.forEach((x, i) => { x.ord = i; });
  return { v: 1, areas: A, tasks, settings: { budget: 300, season: 'auto' } };
}

export function load() {
  let S = null;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  return normalize(S);
}
export function fromJson(json) {
  let S = null;
  try { S = JSON.parse(json || 'null'); } catch (_) {}
  return normalize(S);
}
function normalize(S) {
  if (!S || !Array.isArray(S.tasks)) S = sample();
  if (!Array.isArray(S.areas)) S.areas = [];
  S.settings = { budget: 300, season: 'auto', calm: false, sound: true, ...(S.settings || {}) };
  for (const t of S.tasks) if (t.weight && !t.w) { t.w = { ...WEIGHT_IP[t.weight] }; delete t.weight; } // old three-step weight → I/P
  return S;
}
export const save = S => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

export const todayStr = () => ymd(new Date());
export const plusDays = n => { const x = new Date(); x.setDate(x.getDate() + n); return ymd(x); };
export const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00') - new Date(b + 'T00:00')) / 86400e3);

export function secOf(t) {
  if (t.done) return 'bed';
  if (t.pin) return t.pin;
  if (t.due) {
    if (t.due <= todayStr()) return 'surface';
    if (t.due <= plusDays(6)) return 'shallows';
  }
  return 'depths';
}
export function dueLabel(t) {
  if (!t.due) return null;
  const n = dayDiff(t.due, todayStr()), tm = t.time ? ` ${t.time}` : '';
  if (n < 0) return { text: n === -1 ? tr('due.late1') : tr('due.late', { n: -n }), late: true };
  if (n === 0) return { text: tr('due.today', { tm }), soon: true };
  if (n === 1) return { text: tr('due.tomorrow', { tm }), soon: true };
  if (n < 7) return { text: tr('due.wd', { wd: WD[new Date(t.due + 'T00:00').getDay()], tm }) };
  return { text: tr('due.date', { md: md(new Date(t.due + 'T00:00')) }) };
}
export const estLabel = m => !m ? '' : m < 60 ? tr('est.m', { m }) : (m % 60 ? tr('est.hm', { h: Math.floor(m / 60), m: m % 60 }) : tr('est.h', { h: m / 60 }));

// ---------------------------------------------------------------- weighting (the formula from the earlier Umi)
// The AI (Shiomi) judges only four values, 1–10: I value, P cost of missing it, E effort, D people waiting.
// Everything else (slack, urgency, weight, order, alerts) is computed here every time.
//   W = ( I^1.2 × aging + P^1.3 ) × D' ÷ h^0.6 × U(s)
//   weight  V = ( I^1.2 × aging + P^1.3 ) × D'      … across (heavier = farther from the shore)
//   urgency U(s) = (1 + 2 ÷ (max(0, s) + 0.5))^1.5 … used for the order W
//   effort  h (hours)                               … buoy size
export const K = { alpha: 1.2, beta: 1.3, gamma: 0.6, delta: 1.5, lambda: 2.0, k: 0.15, agingCap: 3 };
export const EFFORT_HOURS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 56, 80];
export const EFFORT_LABEL = new Proxy([], { get: (_, k) => (/^\d$/.test(k) ? tr('effort')[+k] : k === 'length' ? 10 : undefined) });
const SHARK_W = 45, SHARK_MAX = 2;
const V_MAX = (Math.pow(10, K.alpha) + Math.pow(10, K.beta)) * 2;           // when I = P = D = 10
const U_MIN = Math.log(1 + 2) / Math.log(1 + V_MAX);                         // u of the lightest task (V = 2)
const SLACK_HALF = 3;                                                          // slack beyond one day that reaches half the depth
const U0 = Math.pow(1 + K.lambda / 0.5, K.delta);                            // urgency at zero slack (≈ 11.2)
const clamp10 = v => Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
const has = (s, words) => { const low = s.toLowerCase(); return words.some(w => low.includes(w)); };

// Until the AI answers (or when it cannot): an estimate from the words in the title (Japanese and English)
export function ruleGuess(t, areaName = '') {
  const s = `${t.title || ''} ${t.notes || ''} ${areaName}`;
  let e = 4;
  if (has(s, ['メール', '返信', '連絡', '送る', '確認', '予約', '払う', '支払', '振り込', '申し込', 'email', 'reply', 'send', 'check', 'book', 'pay', 'apply'])) e = 2;
  else if (has(s, ['調べ', '決め', '考え', '読む', 'look into', 'research', 'decide', 'think', 'read'])) e = 3;
  else if (has(s, ['動画', 'アプリ', 'サイト', '開発', '構築', '実装', '通しで', 'video', 'app', 'site', 'develop', 'build', 'implement'])) e = 7;
  else if (has(s, ['資料', 'スライド', '発表', 'レジュメ', 'エッセイ', 'レポート', '論文', '台本', 'slides', 'presentation', 'essay', 'report', 'paper', 'script'])) e = 6;
  else if (has(s, ['作る', '書く', '準備', 'まとめ', '直す', 'make', 'write', 'prepare', 'summar', 'fix'])) e = 5;
  let p = 2;
  if (has(s, ['提出', '締切', '申請', '支払', '払う', '振り込', '予約', '手続', '単位', '試験', 'チケット', 'フライト', '期限', '家賃', 'hand in', 'submit', 'deadline', 'pay', 'rent', 'book', 'exam', 'ticket', 'flight', 'apply'])) p = 7;
  else if (has(s, ['返信', '連絡', '約束', '報告', 'reply', 'contact', 'promise', 'report'])) p = 5;
  if (t.due) p = Math.min(10, p + 2);
  let i = 4;
  if (has(s, ['ポートフォリオ', '就活', 'インターン', 'ハッカソン', 'ガクチカ', '練習', '学習', '勉強', '作品', 'wd', 'portfolio', 'job', 'intern', 'hackathon', 'practice', 'study', 'learn'])) i = 6;
  let d = 1;
  if (has(s, ['提出', '発表', '送る', '返信', '共有', 'チーム', '運営', 'ゼミ', 'さん', '先生', '報告', 'hand in', 'submit', 'present', 'send', 'reply', 'share', 'team', 'seminar', 'professor', 'report'])) d = 6;
  return { i, p, e, d };
}

// The four values: what you set > Shiomi (AI) > the estimate
export function values(t, areaName = '') {
  const r = ruleGuess(t, areaName);
  const ai = t.ai && t.ai.title === t.title ? t.ai : null;
  const w = t.w || {};
  const pick = k => (w[k] != null ? { v: clamp10(w[k]), src: 'you' } : ai && ai[k] != null ? { v: clamp10(ai[k]), src: 'ai' } : { v: r[k], src: 'rule' });
  const p = pick('p');
  // must (real harm or no way back if skipped) or own (for your future): you > Shiomi > P ≥ 6
  const must = t.kind ? { v: t.kind === 'must', src: 'you' } : ai && typeof ai.m === 'boolean' ? { v: ai.m, src: 'ai' } : { v: p.v >= 6, src: p.src };
  return { i: pick('i'), p, e: pick('e'), d: pick('d'), must, why: ai ? ai.why || '' : '' };
}
export const kindOf = (t, areaName) => (values(t, areaName).must.v ? 'must' : 'self');

// Days until the due date (to its time if set, otherwise to the end of that day). null without a due date
function daysLeft(t) {
  if (t.due) {
    let left = dayDiff(t.due, todayStr());
    if (t.time) { const [h, m] = t.time.split(':').map(Number); left += (h * 60 + m) / 1440; } else left += 1;
    return left - (new Date().getHours() * 60 + new Date().getMinutes()) / 1440;
  }
  if (t.pin === 'surface') return 0.6;
  if (t.pin === 'shallows') return 4;
  return null;
}

export function compute(t, budget = 300, areaName = '') {
  const v = values(t, areaName);
  const I = v.i.v, P = v.p.v, E = v.e.v, D = v.d.v;
  const hours = t.est ? t.est / 60 : EFFORT_HOURS[E - 1];       // use the estimate when there is one
  const workHours = Math.max(0.5, budget / 60);                    // hours you can use in a day (setting)
  const T = daysLeft(t);
  const slack = T == null ? null : T - hours / workHours;
  const touched = t.touchedAt || t.createdAt || Date.now();
  const A = Math.max(0, (Date.now() - touched) / 86400e3);        // days since last touched
  const category = v.must.v ? 'MUST' : I >= 5 ? 'SHOULD' : 'NORMAL';
  const aging = category === 'SHOULD' ? Math.min(K.agingCap, 1 + K.k * A) : 1;
  const U = slack == null ? 1 : Math.pow(1 + K.lambda / (Math.max(0, slack) + 0.5), K.delta);
  const dep = 1 + (D - 1) / 9;
  const V = (Math.pow(I, K.alpha) * aging + Math.pow(P, K.beta)) * dep;
  let W = V / Math.pow(hours, K.gamma) * U;
  if (t.pin === 'surface') W *= 3; // moved to "today" by hand: ahead of all but the truly urgent
  return { W, V, U, I, P, E, D, hours, slack, aging, category, must: v.must.v, src: { i: v.i.src, p: v.p.src, e: v.e.src, d: v.d.src, m: v.must.src }, why: v.why,
    evaluated: !!(t.ai && t.ai.title === t.title) };
}

// Placement: u = weight (0 near the shore → 1 offshore), v = urgency (0 front → 1 back), size = effort (buoy size factor)
export function placeOf(t, budget = 300, areaName = '') {
  const c = compute(t, budget, areaName);
  const uRaw = Math.min(1, Math.max(0, Math.log(1 + c.V) / Math.log(1 + V_MAX)));
  // spread so the lightest possible task (I = P = D = 1) sits right by the shore and the heaviest far offshore
  const u = Math.max(0, (uRaw - U_MIN) / (1 - U_MIN));
  // depth = days of slack (days until due − days of work)
  // Within one day (late, half a day, today) all share the front line; Nagi mode's order (W) decides which stay
  // beyond one day they move back: 2 days ≈ 0.2, a week ≈ 0.6, no due date at the back
  const s = c.slack == null ? null : Math.max(0, c.slack - 1);
  const v = s == null ? 0.95 : Math.min(0.93, 0.93 * s / (s + SLACK_HALF));
  const size = 0.8 + 0.5 * Math.min(1, Math.max(0, Math.log(c.hours / 0.25) / Math.log(80 / 0.25)));
  return { u, v, size, uRaw };
}

// Order to do things in: by W, largest first
export function rank(list, budget = 300, areaOf = () => '') {
  return list.map(t => ({ t, w: compute(t, budget, areaOf(t)).W })).sort((a, b) => b.w - a.w || a.t.ord - b.t.ord).map(x => x.t);
}
// Fins (alerts): must tasks with W ≥ 45, at most two, heaviest first
export function sharkIds(list, budget = 300, areaOf = () => '') {
  return list.map(t => ({ t, c: compute(t, budget, areaOf(t)) }))
    .filter(x => x.c.must && x.c.W >= SHARK_W).sort((a, b) => b.c.W - a.c.W).slice(0, SHARK_MAX).map(x => x.t.id);
}

// ---------------------------------------------------------------- dragging a buoy: position → your values
// Across (u): find the I and P (1–10) whose weight V lands closest to that spot; prefer values near the current ones.
export function weightFromU(t, u, budget = 300, areaName = '') {
  const c = compute(t, budget, areaName);
  const uRaw = U_MIN + Math.min(1, Math.max(0, u)) * (1 - U_MIN);
  const target = Math.log(1 + Math.exp(uRaw * Math.log(1 + V_MAX)) - 1);
  const dep = 1 + (c.D - 1) / 9;
  let best = null, bd = Infinity;
  for (let i = 1; i <= 10; i++) for (let p = 1; p <= 10; p++) {
    const V = (Math.pow(i, K.alpha) * c.aging + Math.pow(p, K.beta)) * dep;
    const d = Math.abs(Math.log(1 + V) - target) + 0.004 * (Math.abs(i - c.I) + Math.abs(p - c.P));
    if (d < bd) { bd = d; best = { i, p }; }
  }
  return best;
}
// Front ↔ back (v): turn the depth back into days of slack, then into a due date.
// The front line means "within a day" (due today); the far back means someday (no due date).
export function dueFromV(t, v, budget = 300, areaName = '') {
  if (v >= 0.9) return { due: null, time: null, pin: 'depths' };
  const c = compute(t, budget, areaName);
  const s = v <= 0.02 ? 0 : SLACK_HALF * v / (0.93 - v);        // inverse of placeOf's depth curve
  const slack = s + 1, work = c.hours / Math.max(0.5, budget / 60);
  const nowFrac = (new Date().getHours() * 60 + new Date().getMinutes()) / 1440;
  const days = v <= 0.02 ? 0 : Math.max(0, Math.round(slack + work - 1 + nowFrac));
  const due = plusDays(days);
  return { due, time: due === t.due ? t.time : null, pin: null };
}

// Three weight steps (when set by hand): they overwrite I and P
export const WEIGHT = new Proxy({}, { get: (_, k) => (/^[123]$/.test(k) ? tr('w.' + k) : undefined) });
export const WEIGHT_IP = { 1: { i: 2, p: 2 }, 2: { i: 5, p: 4 }, 3: { i: 8, p: 8 } };
export function weightLevel(t, budget, areaName) {
  const { uRaw } = placeOf(t, budget, areaName);
  return uRaw < 0.5 ? 1 : uRaw < 0.72 ? 2 : 3;
}

export function nextDue(t) {
  const base = new Date((t.due || todayStr()) + 'T00:00');
  const d = new Date(Math.max(base, new Date(todayStr() + 'T00:00')));
  if (t.repeat === 'daily') d.setDate(d.getDate() + 1);
  if (t.repeat === 'weekdays') { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); }
  if (t.repeat === 'weekly') d.setDate(d.getDate() + 7);
  if (t.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  return ymd(d);
}
export function areaByName(S, name) {
  let a = S.areas.find(x => x.name === name);
  if (!a) { a = { id: uid(), name, color: COLORS[S.areas.length % COLORS.length] }; S.areas.push(a); }
  return a.id;
}
