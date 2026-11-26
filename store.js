// タスクの保存と計算（一覧画面 list.html と同じ保存場所 umi.v1 を使う）
import { ymd } from './parse.js?v=11';

export const KEY = 'umi.v1';
export const COLORS = ['#2f6f8f', '#6a5acd', '#c0812c', '#3c8d5a', '#b4566e', '#4f7cc4', '#8a7a3c', '#3f8f8b'];
export const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const REPEAT = { daily: '毎日', weekdays: '平日', weekly: '毎週', monthly: '毎月' };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sample() {
  const t = new Date(), d = n => { const x = new Date(t); x.setDate(x.getDate() + n); return ymd(x); };
  const A = [{ id: 'a1', name: '大学', color: COLORS[0] }, { id: 'a2', name: 'Cypher', color: COLORS[1] },
             { id: 'a3', name: '制作', color: COLORS[2] }, { id: 'a4', name: '生活', color: COLORS[3] }];
  const mk = (title, o) => ({ id: uid(), title, area: null, due: null, time: null, est: null, kind: null, repeat: null,
    pin: null, notes: '', done: false, doneAt: null, ord: 0, createdAt: Date.now(), sample: true, ...o });
  const tasks = [
    mk('TIEカードの予約を取る', { due: d(0), est: 15, kind: 'must', area: 'a4', weight: 2 }),
    mk('統計学の課題を提出する', { due: d(0), time: '23:59', est: 60, kind: 'must', area: 'a1', weight: 3 }),
    mk('Cypher の AI クイズを作って報告する', { pin: 'surface', est: 30, kind: 'must', area: 'a2', weight: 1 }),
    mk('スペイン語の単語を20個', { due: d(0), est: 20, kind: 'self', area: 'a1', repeat: 'daily', weight: 1 }),
    mk('デスクトップを片付ける', { due: d(1), est: 15, kind: 'self', area: 'a4', weight: 1 }),
    mk('英語教材 1-05 の台本を書く', { due: d(2), est: 120, kind: 'self', area: 'a3', weight: 2 }),
    mk('ゼミの発表資料を送る', { due: d(3), est: 60, kind: 'must', area: 'a1', weight: 3 }),
    mk('家賃を振り込む', { due: d(4), est: 10, kind: 'must', area: 'a4', weight: 1 }),
    mk('会員アプリの改善案を3つ出す', { pin: 'shallows', est: 60, kind: 'self', area: 'a2', weight: 2 }),
    mk('ポートフォリオに Umi を載せる', { due: d(20), est: 240, kind: 'self', area: 'a3', weight: 3 }),
    mk('AIで作った人シリーズの題材を10本ためる', { pin: 'depths', kind: 'self', area: 'a3', weight: 1 }),
    mk('夏のインターンを調べる', { due: d(70), est: 180, kind: 'self', area: 'a1', weight: 3 }),
    mk('アンダルシアの白い村を回る', { pin: 'depths', kind: 'self', area: 'a4', weight: 2 }),
    mk('3Dの湖をコミットする', { done: true, doneAt: Date.now() - 3600e3, area: 'a3' }),
    mk('経済学の小テスト', { done: true, doneAt: Date.now() - 86400e3 * 1.2, area: 'a1' })
  ];
  // 見本：過去5週間に終えたタスク（湖底の山の見え方を確かめるため）
  const past = ['洗濯', 'メールの返信', '統計の小テスト', '家計簿をつける', 'ゼミの文献を読む', 'Cypher の連絡', '英単語', '部屋の片付け', 'リールの台本', 'スーパーで買い物'];
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
  for (const t of S.tasks) if (t.weight && !t.w) { t.w = { ...WEIGHT_IP[t.weight] }; delete t.weight; } // 前の3段階を I/P に
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
  if (n < 0) return { text: `${-n}日遅れ`, late: true };
  if (n === 0) return { text: `今日まで${tm}`, soon: true };
  if (n === 1) return { text: `明日まで${tm}`, soon: true };
  if (n < 7) return { text: `${WD[new Date(t.due + 'T00:00').getDay()]}曜まで${tm}` };
  const d = new Date(t.due + 'T00:00');
  return { text: `${d.getMonth() + 1}月${d.getDate()}日まで` };
}
export const estLabel = m => !m ? '' : m < 60 ? `${m}分` : (m % 60 ? `${Math.floor(m / 60)}時間${m % 60}分` : `${m / 60}時間`);

// ---------------------------------------------------------------- 重み付け（前の Umi の式をそのまま使う）
// AI（潮見）が判断するのは4つだけ：I 価値・P 痛手・E 手間・D 待っている人（1〜10）。
// それ以外（余裕・急ぎ・重さ・順番・知らせ）は、ここで毎回計算する。
//   W = ( I^1.2 × aging + P^1.3 ) × D' ÷ h^0.6 × U(s)
//   重さ V = ( I^1.2 × aging + P^1.3 ) × D'      … 横（右ほど重い）
//   急ぎ U(s) = (1 + 2 ÷ (max(0, s) + 0.5))^1.5 … 縦（手前ほど急ぐ）
//   手間 h（時間）                                 … ブイの大きさ
export const K = { alpha: 1.2, beta: 1.3, gamma: 0.6, delta: 1.5, lambda: 2.0, k: 0.15, agingCap: 3 };
export const EFFORT_HOURS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 56, 80];
export const EFFORT_LABEL = ['15分', '30分', '1時間', '2時間', '半日', '1日', '2日', '4日', '1週間', '2週間以上'];
const SHARK_W = 45, SHARK_MAX = 2;
const V_MAX = (Math.pow(10, K.alpha) + Math.pow(10, K.beta)) * 2;           // I=P=D=10 のとき
const U0 = Math.pow(1 + K.lambda / 0.5, K.delta);                            // 余裕 0 日の急ぎ（≈ 11.2）
const clamp10 = v => Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
const has = (s, words) => words.some(w => s.includes(w));

// AI が答えるまで（・答えられないとき）の目安：タイトルの言葉から推測する
export function ruleGuess(t, areaName = '') {
  const s = `${t.title || ''} ${t.notes || ''} ${areaName}`;
  let e = 4;
  if (has(s, ['メール', '返信', '連絡', '送る', '確認', '予約', '払う', '支払', '振り込', '申し込'])) e = 2;
  else if (has(s, ['調べ', '決め', '考え', '読む'])) e = 3;
  else if (has(s, ['動画', 'アプリ', 'サイト', '開発', '構築', '実装', '通しで'])) e = 7;
  else if (has(s, ['資料', 'スライド', '発表', 'レジュメ', 'エッセイ', 'レポート', '論文', '台本'])) e = 6;
  else if (has(s, ['作る', '書く', '準備', 'まとめ', '直す'])) e = 5;
  let p = 2;
  if (has(s, ['提出', '締切', '申請', '支払', '払う', '振り込', '予約', '手続', '単位', '試験', 'チケット', 'フライト', '期限', '家賃'])) p = 7;
  else if (has(s, ['返信', '連絡', '約束', '報告'])) p = 5;
  if (t.due) p = Math.min(10, p + 2);
  let i = 4;
  if (has(s, ['ポートフォリオ', '就活', 'インターン', 'ハッカソン', 'ガクチカ', '練習', '学習', '勉強', '作品', 'WD'])) i = 6;
  let d = 1;
  if (has(s, ['提出', '発表', '送る', '返信', '共有', 'チーム', '運営', 'ゼミ', 'さん', '先生', '報告'])) d = 6;
  return { i, p, e, d };
}

// 4つの値：あなたの指定 > 潮見（AI） > 目安
export function values(t, areaName = '') {
  const r = ruleGuess(t, areaName);
  const ai = t.ai && t.ai.title === t.title ? t.ai : null;
  const w = t.w || {};
  const pick = k => (w[k] != null ? { v: clamp10(w[k]), src: 'you' } : ai && ai[k] != null ? { v: clamp10(ai[k]), src: 'ai' } : { v: r[k], src: 'rule' });
  const p = pick('p');
  // 必須（やらないと実害・取り返しがつかない）か自主（将来のため）か：あなた > 潮見 > P ≥ 6
  const must = t.kind ? { v: t.kind === 'must', src: 'you' } : ai && typeof ai.m === 'boolean' ? { v: ai.m, src: 'ai' } : { v: p.v >= 6, src: p.src };
  return { i: pick('i'), p, e: pick('e'), d: pick('d'), must, why: ai ? ai.why || '' : '' };
}
export const kindOf = (t, areaName) => (values(t, areaName).must.v ? 'must' : 'self');

// 期限までの日数（時刻があればその時刻まで、なければその日の終わりまで）。期限なしは null
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
  const hours = t.est ? t.est / 60 : EFFORT_HOURS[E - 1];       // 見積もりがあればそれを使う
  const workHours = Math.max(0.5, budget / 60);                    // 1日に使える時間（設定）
  const T = daysLeft(t);
  const slack = T == null ? null : T - hours / workHours;
  const touched = t.touchedAt || t.createdAt || Date.now();
  const A = Math.max(0, (Date.now() - touched) / 86400e3);        // 触っていない日数
  const category = v.must.v ? 'MUST' : I >= 5 ? 'SHOULD' : 'NORMAL';
  const aging = category === 'SHOULD' ? Math.min(K.agingCap, 1 + K.k * A) : 1;
  const U = slack == null ? 1 : Math.pow(1 + K.lambda / (Math.max(0, slack) + 0.5), K.delta);
  const dep = 1 + (D - 1) / 9;
  const V = (Math.pow(I, K.alpha) * aging + Math.pow(P, K.beta)) * dep;
  let W = V / Math.pow(hours, K.gamma) * U;
  if (t.pin === 'surface') W *= 3; // 手で「今日」にしたものは、本当の緊急以外より先
  return { W, V, U, I, P, E, D, hours, slack, aging, category, must: v.must.v, src: { i: v.i.src, p: v.p.src, e: v.e.src, d: v.d.src, m: v.must.src }, why: v.why,
    evaluated: !!(t.ai && t.ai.title === t.title) };
}

// 置き場所：u＝重さ（0 左 → 1 右）、v＝急ぎ（0 手前 → 1 奥）、size＝手間（ブイの大きさの倍率）
export function placeOf(t, budget = 300, areaName = '') {
  const c = compute(t, budget, areaName);
  const u = Math.min(1, Math.max(0, Math.log(1 + c.V) / Math.log(1 + V_MAX)));
  const v = c.slack == null ? 0.95 : Math.min(0.93, Math.max(0, 1 - Math.log(c.U) / Math.log(U0)));
  const size = 0.8 + 0.5 * Math.min(1, Math.max(0, Math.log(c.hours / 0.25) / Math.log(80 / 0.25)));
  return { u, v, size };
}

// 今やる順：W の大きい順
export function rank(list, budget = 300, areaOf = () => '') {
  return list.map(t => ({ t, w: compute(t, budget, areaOf(t)).W })).sort((a, b) => b.w - a.w || a.t.ord - b.t.ord).map(x => x.t);
}
// サメ（背びれ）：必須で W ≥ 45 のもの、重い順に最大2件
export function sharkIds(list, budget = 300, areaOf = () => '') {
  return list.map(t => ({ t, c: compute(t, budget, areaOf(t)) }))
    .filter(x => x.c.must && x.c.W >= SHARK_W).sort((a, b) => b.c.W - a.c.W).slice(0, SHARK_MAX).map(x => x.t.id);
}

// 重さの3段階（手で直すとき）：I と P を上書きする
export const WEIGHT = { 1: '軽い', 2: 'ふつう', 3: '重い' };
export const WEIGHT_IP = { 1: { i: 2, p: 2 }, 2: { i: 5, p: 4 }, 3: { i: 8, p: 8 } };
export function weightLevel(t, budget, areaName) {
  const { u } = placeOf(t, budget, areaName);
  return u < 0.5 ? 1 : u < 0.72 ? 2 : 3;
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
