// すばやい入力の読み取り：「明日15時 統計の課題 #大学 1時間 必須 毎週」
import * as chrono from 'https://cdn.jsdelivr.net/npm/chrono-node@2.10.3/+esm';

const WD = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function parseQuick(input, now = new Date()) {
  let text = ' ' + input.trim() + ' ';
  const out = { title: '', area: null, est: null, kind: null, repeat: null, due: null, time: null };
  const take = (re, fn) => { text = text.replace(re, (...m) => { fn(...m); return ' '; }); };

  take(/[#＃]([^\s#＃]+)/g, (_, a) => { out.area = a; });
  take(/(^|\s)(必須|!!)(?=\s)/g, () => { out.kind = 'must'; });
  take(/(^|\s)(自主)(?=\s)/g, () => { out.kind = 'self'; });
  take(/(^|\s)(軽い|軽め|かるい)(?=\s)/g, () => { out.weight = 1; });
  take(/(^|\s)(重い|重め|おもい)(?=\s)/g, () => { out.weight = 3; });
  take(/(毎日|平日|毎週|毎月)/g, (_, r) => { out.repeat = { '毎日': 'daily', '平日': 'weekdays', '毎週': 'weekly', '毎月': 'monthly' }[r]; });
  take(/(\d+(?:\.\d+)?)\s*(時間半|時間|h)(?![a-z])/gi, (_, n, u) => { out.est = Math.round(parseFloat(n) * 60 + (u === '時間半' ? 30 : 0)); });
  take(/(?<![時:：\d])(\d+)\s*(分|min)(?!\s*後)/gi, (_, n) => { out.est = (out.est || 0) + parseInt(n, 10); });

  // chrono が苦手な言い方を先に読む
  let date = null;
  take(/来週\s*([日月火水木金土])曜?日?/, (_, w) => {
    const base = addDays(now, 7 - ((now.getDay() + 6) % 7)); // 来週の月曜
    date = addDays(base, (WD[w] + 6) % 7);
  });
  take(/(\d+)\s*日後/, (_, n) => { date = addDays(now, parseInt(n, 10)); });
  take(/明後日|あさって/, () => { date = addDays(now, 2); });
  take(/今週末/, () => { date = addDays(now, (6 - now.getDay() + 7) % 7); });
  take(/(^|\s)いつか(?=\s)/, () => { out.someday = true; });

  const res = chrono.ja.parse(text, now, { forwardDate: true });
  if (res.length) {
    const r = res[0];
    const d = r.start.date();
    if (!date) date = d;
    if (r.start.isCertain('hour')) out.time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    text = text.slice(0, r.index) + ' ' + text.slice(r.index + r.text.length);
  }
  if (date) out.due = ymd(date);
  if (out.repeat && !out.due) out.due = ymd(now);
  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}
