// Quick-entry parsing, in English or Japanese:
//   "tomorrow 3pm stats homework #school 1h must weekly"
//   「明日15時 統計の課題 #大学 1時間 必須 毎週」
import * as chrono from 'https://cdn.jsdelivr.net/npm/chrono-node@2.10.3/+esm';

const WD = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const REPEAT = { '毎日': 'daily', '平日': 'weekdays', '毎週': 'weekly', '毎月': 'monthly',
  daily: 'daily', 'every day': 'daily', weekdays: 'weekdays', 'every weekday': 'weekdays', weekly: 'weekly', 'every week': 'weekly', monthly: 'monthly', 'every month': 'monthly' };

export function parseQuick(input, now = new Date()) {
  let text = ' ' + input.trim() + ' ';
  const out = { title: '', area: null, est: null, kind: null, repeat: null, due: null, time: null };
  const take = (re, fn) => { text = text.replace(re, (...m) => { fn(...m); return ' '; }); };

  take(/[#＃]([^\s#＃]+)/g, (_, a) => { out.area = a; });
  take(/(^|\s)(必須|!!|must)(?=\s)/gi, () => { out.kind = 'must'; });
  take(/(^|\s)(自主|own|optional)(?=\s)/gi, () => { out.kind = 'self'; });
  take(/(^|\s)(軽い|軽め|かるい|light)(?=\s)/gi, () => { out.weight = 1; });
  take(/(^|\s)(重い|重め|おもい|heavy)(?=\s)/gi, () => { out.weight = 3; });
  take(/(毎日|平日|毎週|毎月|(?<=\s)(?:every\s+(?:day|weekday|week|month)|daily|weekdays|weekly|monthly)(?=\s))/gi, (_, r) => { out.repeat = REPEAT[r.toLowerCase().replace(/\s+/g, ' ')]; });
  // durations: 1時間 / 1時間半 / 1h / 1.5h / 2 hours ; 30分 / 30m / 30 min / 30 minutes
  take(/(\d+(?:\.\d+)?)\s*(時間半|時間|hours?|hrs?|h)(?![a-z])/gi, (_, n, u) => { out.est = Math.round(parseFloat(n) * 60 + (u === '時間半' ? 30 : 0)); });
  take(/(?<![時:：\d])(\d+)\s*(分|minutes?|mins?|m)(?![a-z])(?!\s*後)/gi, (_, n) => { out.est = (out.est || 0) + parseInt(n, 10); });

  // phrases chrono handles poorly, read first
  let date = null;
  take(/来週\s*([日月火水木金土])曜?日?/, (_, w) => {
    const base = addDays(now, 7 - ((now.getDay() + 6) % 7)); // next week's Monday
    date = addDays(base, (WD[w] + 6) % 7);
  });
  take(/(\d+)\s*日後/, (_, n) => { date = addDays(now, parseInt(n, 10)); });
  take(/明後日|あさって/, () => { date = addDays(now, 2); });
  take(/今週末/, () => { date = addDays(now, (6 - now.getDay() + 7) % 7); });
  take(/(^|\s)(いつか|someday)(?=\s)/i, () => { out.someday = true; });

  // dates and times: Japanese first, then English ("tomorrow 3pm", "next mon", "in 3 days", "Dec 5")
  const res = [...chrono.ja.parse(text, now, { forwardDate: true }), ...chrono.en.parse(text, now, { forwardDate: true })];
  if (res.length) {
    const r = res.sort((a, b) => b.text.length - a.text.length)[0];
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
