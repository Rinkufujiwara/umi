// Nagi: the planner behind Nagi mode. See docs/nagi-agent-design.md.
//
// The app builds a ShiomiReport (Shiomi's judgments + the app's own numbers), asks the Nagi agent for a
// NagiPlan, checks the plan against fixed rules, and falls back to the formula (top 3 by W) whenever the
// agent is off, slow, or returns something that breaks a rule. Nagi only proposes; nothing here edits tasks.
import * as St from './store.js?v=48';

export const PLAN_VERSION = 1;
const ACTIONS = new Set(['tomorrow', 'lighter', 'later', 'dive']);
const MAX_WHY = 140, MAX_MSG = 120;

// ---------------------------------------------------------------- the handoff: ShiomiReport
export function buildReport(S, { lang = 'en', areaOf = () => '' } = {}) {
  const budget = S.settings.budget;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const usedMin = S.tasks.filter(t => t.done && t.doneAt >= +t0).reduce((s, t) => s + (t.est || 0), 0);
  const open = S.tasks.filter(t => !t.done && (St.secOf(t) === 'surface' || St.secOf(t) === 'shallows'));
  return {
    version: PLAN_VERSION,
    generatedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang,
    dayBudgetMin: budget,
    usedTodayMin: usedMin,
    tasks: open.map(t => {
      const c = St.compute(t, budget, areaOf(t));
      return {
        id: t.id, title: t.title, section: St.secOf(t),
        due: t.due || null, time: t.time || null,
        estMin: Math.round(c.hours * 60),
        slackDays: c.slack == null ? null : +c.slack.toFixed(2),
        order: +c.W.toFixed(1),
        dives: (t.dives || []).slice(-5).map(d => ({ at: new Date(d.at).toISOString(), min: d.min })),
        judgment: {
          impact: c.I, penalty: c.P, effort: c.E, dependency: c.D, must: c.must,
          source: { impact: c.src.i, penalty: c.src.p, effort: c.src.e, dependency: c.src.d, must: c.src.m }, // you | ai | rule
          reason: c.why || '',
          confidence: t.ai && t.ai.title === t.title ? (typeof t.ai.c === 'number' ? t.ai.c : 0.7) : 0.3
        }
      };
    })
  };
}

// ---------------------------------------------------------------- the formula planner (fallback, and phase 1)
export function formulaPlan(report, { lang = 'en' } = {}) {
  const today = report.tasks.filter(t => t.section === 'surface').sort((a, b) => b.order - a.order);
  const keep = today.slice(0, 3).map(t => ({ id: t.id, why: whyOf(t, lang) }));
  return { version: PLAN_VERSION, source: 'formula', keep, suggest: [], message: '', validUntil: new Date(Date.now() + 30 * 60e3).toISOString() };
}
function whyOf(t, lang) {
  const ja = lang === 'ja', bits = [];
  if (t.slackDays != null && t.slackDays <= 0) bits.push(ja ? '今日やらないと間に合わない' : 'no slack left today');
  else if (t.due) bits.push(ja ? '期限が近い' : 'due soon');
  if (t.judgment.must) bits.push(ja ? '必須' : 'a must');
  if (t.judgment.dependency >= 6) bits.push(ja ? '待っている人がいる' : 'someone is waiting');
  if (!bits.length) bits.push(ja ? '今日の中でいちばん重い' : 'the heaviest for today');
  return bits.join(ja ? '・' : ', ');
}

// ---------------------------------------------------------------- the rules every plan must pass
export function checkPlan(plan, report, S) {
  if (!plan || plan.version !== PLAN_VERSION || !Array.isArray(plan.keep)) return null;
  const open = new Map(report.tasks.map(t => [t.id, t]));
  const seen = new Set();
  const keep = [];
  for (const k of plan.keep) {
    if (!k || !open.has(k.id) || seen.has(k.id)) continue;
    seen.add(k.id); keep.push({ id: k.id, why: clip(k.why, MAX_WHY) });
    if (keep.length === 3) break;
  }
  if (!keep.length) return null;
  // safety: an overdue task that YOU marked must is always kept
  const overdue = S.tasks.filter(t => !t.done && t.kind === 'must' && t.due && t.due < St.todayStr() && open.has(t.id));
  for (const t of overdue) if (!keep.some(k => k.id === t.id)) return null;
  const suggest = (Array.isArray(plan.suggest) ? plan.suggest : [])
    .filter(s => s && open.has(s.id) && ACTIONS.has(s.action) && (s.action === 'dive' || !seen.has(s.id))) // only kept tasks may get a dive
    .slice(0, 4)
    .map(s => ({ id: s.id, action: s.action, minutes: s.action === 'dive' ? clampMin(s.minutes) : undefined, why: clip(s.why, MAX_WHY) }));
  const until = Date.parse(plan.validUntil);
  return {
    version: PLAN_VERSION, source: plan.source === 'formula' ? 'formula' : 'agent', keep, suggest,
    message: clip(plan.message, MAX_MSG),
    validUntil: new Date(isFinite(until) ? Math.min(until, Date.now() + 4 * 3600e3) : Date.now() + 30 * 60e3).toISOString()
  };
}
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const clampMin = m => [25, 50].includes(+m) ? +m : 25;

// ---------------------------------------------------------------- asking the agent
// endpoint: /api/nagi (Vercel), which checks sign-in and forwards to the Nagi agent over A2A.
// Returns a checked plan, or the formula plan when anything goes wrong.
export async function requestPlan(S, { lang, areaOf, token, endpoint = '/api/nagi', timeoutMs = 25000, enabled = true } = {}) {
  const report = buildReport(S, { lang, areaOf });
  const fallback = checkPlan(formulaPlan(report, { lang }), report, S) || formulaPlan(report, { lang });
  if (!enabled || !token || !report.tasks.some(t => t.section === 'surface')) return { plan: fallback, report, why: 'off' };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(endpoint, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ report })
    });
    if (!r.ok) return { plan: fallback, report, why: `http ${r.status}` };
    const d = await r.json();
    const plan = checkPlan({ ...d.plan, source: 'agent' }, report, S);
    return plan ? { plan, report, why: 'agent' } : { plan: fallback, report, why: 'rejected' };
  } catch (e) {
    return { plan: fallback, report, why: e.name === 'AbortError' ? 'timeout' : 'error' };
  } finally { clearTimeout(timer); }
}
