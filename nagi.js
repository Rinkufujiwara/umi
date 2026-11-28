// Nagi: the planner behind Nagi mode. See docs/nagi-agent-design.md.
//
// The app builds a ShiomiReport (Shiomi's judgments + the app's own numbers), asks the Nagi agent for a
// NagiPlan, checks the plan against fixed rules, and falls back to the formula (top 3 by W) whenever the
// agent is off, slow, or returns something that breaks a rule. Nagi only proposes; nothing here edits tasks.
import * as St from './store.js?v=50';

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
        id: t.id, title: t.title, section: St.secOf(t), area: areaOf(t) || null,
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
    .filter(s => s && open.has(s.id) && ACTIONS.has(s.action) && (s.action === 'dive' ? seen.has(s.id) : !seen.has(s.id))) // a dive only for a kept task; the other actions only for the rest
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
// endpoint: /api/nagi (Cloudflare Pages Function), which checks sign-in and forwards to the Nagi agent over A2A.
// Nagi may consult Shiomi; if Shiomi needs the user's answer, the reply is { ask } and the plan waits:
// show the question, then call answerAsk(). Otherwise returns a checked plan, or the formula plan on any failure.
async function post(endpoint, token, body, timeoutMs) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(endpoint, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    return r.ok ? { d: await r.json() } : { why: `http ${r.status}` };
  } catch (e) {
    return { why: e.name === 'AbortError' ? 'timeout' : 'error' };
  } finally { clearTimeout(timer); }
}
function settle(res, report, S, fallback) {
  if (!res.d) return { plan: fallback, report, why: res.why };
  const d = res.d;
  if (d.ask && d.ask.nagiTask && Array.isArray(d.ask.a2ui)) return { plan: null, ask: d.ask, report, trace: d.trace, why: 'ask' };
  const plan = checkPlan({ ...d.plan, source: 'agent' }, report, S);
  return plan ? { plan, report, judged: judgedOf(d), trace: d.trace, why: 'agent' } : { plan: fallback, report, trace: d.trace, why: 'rejected' };
}
// Shiomi's new judgments from this plan's consultations: [{ id, impact, penalty, effort, dependency, must, confidence, reason }]
function judgedOf(d) {
  const ids = new Set(((d.trace && d.trace.calls) || []).flatMap(c => (c.judged || []).map(j => j.id)));
  return ((d.report && d.report.tasks) || []).filter(t => ids.has(t.id)).map(t => ({ id: t.id, title: t.title, ...t.judgment }));
}

// ---------------------------------------------------------------- not asking again for what has not changed
// A plan remembers what the tasks looked like when it was made (its basis). Next time, only what changed is weighed:
//   nothing changed, or only tasks Nagi had not kept were removed  → the same three, no call
//   kept tasks were removed (done or deleted)                       → the others stay; Nagi fills only the empty
//                                                                     places, from the tasks it did not keep
//   tasks were added or changed                                     → Nagi weighs only those against the kept three
// A new day, a new day budget, or a plan that was not Nagi's own means a full plan.
const fp = t => { const j = t.judgment || {}; return [t.title, t.section, t.due, t.time, t.estMin, j.impact, j.penalty, j.effort, j.dependency, j.must].join('|'); };
export function basisOf(report) {
  return { day: St.todayStr(), budget: report.dayBudgetMin, tasks: Object.fromEntries(report.tasks.map(t => [t.id, fp(t)])) };
}
export function scopeOf(last, report) {
  const b = last && last.basis;
  if (!b || last.source !== 'agent' || b.day !== St.todayStr() || b.budget !== report.dayBudgetMin) return { mode: 'full' };
  const surf = report.tasks.filter(t => t.section === 'surface'), ids = new Set(surf.map(t => t.id));
  const fresh = surf.filter(t => b.tasks[t.id] !== fp(t)).map(t => t.id);
  const kept = last.keep.map(k => k.id).filter(id => ids.has(id) && !fresh.includes(id));
  const others = surf.map(t => t.id).filter(id => !fresh.includes(id) && !kept.includes(id));
  const today = St.todayStr();
  if (surf.some(t => t.judgment && t.judgment.must && t.due && t.due < today && !kept.includes(t.id) && !fresh.includes(t.id))) return { mode: 'full' };
  let fixed, pool;
  if (!fresh.length) { fixed = kept; pool = kept.length < 3 ? others : []; }            // only removals
  else if (kept.length === 3) { fixed = []; pool = [...kept, ...fresh]; }              // new or changed vs the kept three
  else { fixed = []; pool = [...kept, ...fresh, ...others]; }
  if (fixed.length + pool.length <= 3) return { mode: 'local', fixed, pool, removed: last.keep.length - kept.length }; // everything fits: no choice to make
  if (!fixed.length && pool.length === surf.length) return { mode: 'full' };
  return { mode: 'partial', fixed, pool };
}

export async function requestPlan(S, { lang, areaOf, token, endpoint = '/api/nagi', timeoutMs = 75000, enabled = true, last = null } = {}) {
  const report = buildReport(S, { lang, areaOf });
  const fallback = checkPlan(formulaPlan(report, { lang }), report, S) || formulaPlan(report, { lang });
  if (!enabled || !token || !report.tasks.some(t => t.section === 'surface')) return { plan: fallback, report, why: 'off' };
  const sc = scopeOf(last, report);
  if (sc.mode !== 'full') {
    const byId = new Map(report.tasks.map(t => [t.id, t])), whys = new Map(last.keep.map(k => [k.id, k.why]));
    const kept = id => ({ id, why: whys.get(id) || whyOf(byId.get(id), lang) });
    const fixed = sc.fixed.map(kept);
    if (sc.mode === 'local') {
      const was = sc.pool.filter(id => whys.has(id)), rest = sc.pool.filter(id => !whys.has(id)).sort((a, b) => byId.get(b).order - byId.get(a).order);
      const plan = checkPlan({ ...last, keep: [...fixed, ...[...was, ...rest].map(kept)], validUntil: new Date(Date.now() + 3 * 3600e3).toISOString() }, report, S);
      if (plan) return { plan, report, why: 'reused' };
    } else {
      const only = new Set([...sc.fixed, ...sc.pool]);
      const part = { ...report, tasks: report.tasks.filter(t => only.has(t.id)), fixed: sc.fixed, slots: 3 - sc.fixed.length };
      const res = await post(endpoint, token, { report: part }, timeoutMs);
      if (res.d && res.d.plan && Array.isArray(res.d.plan.keep)) {
        const p = res.d.plan;
        p.keep = [...fixed, ...p.keep.filter(k => k && !sc.fixed.includes(k.id))];
        p.suggest = [...(Array.isArray(p.suggest) ? p.suggest : []), ...(last.suggest || []).filter(s => sc.fixed.includes(s.id))];
        if (!p.message) p.message = last.message;
      }
      const out = settle(res, report, S, fallback);
      return out.why === 'agent' ? { ...out, why: 'partial' } : out;
    }
  }
  return settle(await post(endpoint, token, { report }, timeoutMs), report, S, fallback);
}

// The user answered Shiomi's question (answer: { for, deadline, date, note }) or let Shiomi guess ({ skipped: true }).
export async function answerAsk(S, ask, answer, { lang, areaOf, token, endpoint = '/api/nagi', timeoutMs = 75000 } = {}) {
  const report = buildReport(S, { lang, areaOf });
  const fallback = checkPlan(formulaPlan(report, { lang }), report, S) || formulaPlan(report, { lang });
  if (!token) return { plan: fallback, report, why: 'off' };
  return settle(await post(endpoint, token, { resume: { taskId: ask.nagiTask, contextId: ask.contextId, answer } }, timeoutMs), report, S, fallback);
}
