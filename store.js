// タスクの保存と計算（一覧画面 list.html と同じ保存場所 umi.v1 を使う）
import { ymd } from './parse.js?v=4';

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
  if (!S || !Array.isArray(S.tasks)) S = sample();
  S.settings = { budget: 300, season: 'auto', calm: false, sound: true, ...(S.settings || {}) };
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

// 今やる順：遅れ > 必須 > 今日まで > 時刻が近い > 短い
export function rank(list) {
  const score = t => {
    let s = 0; const dl = t.due ? dayDiff(t.due, todayStr()) : 9;
    if (dl < 0) s += 100 + Math.min(30, -dl * 5);
    if (t.kind === 'must') s += 50;
    if (dl === 0) s += 20; else if (dl === 1) s += 8;
    if (t.time && dl === 0) {
      const [h, m] = t.time.split(':').map(Number);
      const left = h * 60 + m - (new Date().getHours() * 60 + new Date().getMinutes());
      if (left < 180) s += 30 - Math.max(0, left) / 6;
    }
    if (t.est) s += Math.max(0, 8 - t.est / 15);
    s += ((t.weight || 2) - 2) * 14; // 重いほど先に
    return s - t.ord * 0.01;
  };
  return list.slice().sort((a, b) => score(b) - score(a));
}

// 時間の余裕（日）＝ 期限までの日数 − 作業にかかる日数（見積もり ÷ 1日に使える時間）。期限なしは null
export function slackDays(t, budget = 300) {
  let left;
  if (t.due) {
    left = dayDiff(t.due, todayStr());
    if (t.time) { const [h, m] = t.time.split(':').map(Number); left += (h * 60 + m) / 1440; } else left += 1;
    left -= (new Date().getHours() * 60 + new Date().getMinutes()) / 1440;
  } else if (t.pin === 'surface') left = 0.6;
  else if (t.pin === 'shallows') left = 4;
  else return null;
  return left - (t.est || 30) / budget;
}
// 置き場所：u＝重さ（右ほど重い）、v＝余裕（奥ほど余裕がある）
export function placeOf(t, budget = 300) {
  const w = t.weight || 2;
  const ageDays = (Date.now() - (t.createdAt || Date.now())) / 86400e3;
  const aging = t.kind === 'self' ? Math.min(0.15, ageDays / 60) : 0; // 自主は放っておくと少しずつ重くなる
  const u = Math.min(1, Math.max(0, (w - 1) / 2 * 0.82 + (t.kind === 'must' ? 0.12 : 0) + aging));
  const s = slackDays(t, budget);
  const v = s === null ? 0.92 : s <= 0 ? 0 : Math.min(0.85, Math.log1p(s) / Math.log1p(45) * 0.85);
  return { u, v };
}
export const WEIGHT = { 1: '軽い', 2: 'ふつう', 3: '重い' };

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
