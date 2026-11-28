// Nagi — the planner, as an A2A agent on Cloudflare (JavaScript).
//   GET  /api/agents/nagi → agent card
//   POST /api/agents/nagi → JSON-RPC "message/send"
//        new task:    data { report: ShiomiReport }                 (docs/nagi-agent-design.md §4)
//        resume task: same taskId, data { answer } or { answer: { skipped: true } }
//   The reply is an A2A Task:
//        completed       artifact data { plan: NagiPlan, trace }
//        input-required  status data { ask: { taskId, title, question, a2ui }, trace } + the A2UI parts
//
// Nagi decides on its own whether to consult Shiomi (Cloud Run, Python + ADK): its tool ask_shiomi sends doubtful
// tasks to Shiomi over A2A. If Shiomi asks the user a question, Nagi passes the question up and waits; the paused
// plan is kept in D1 (pending_tasks, as "nagi:<taskId>") until the answer comes back.
import { serveAgent, gemini, extractJson } from "../../../server/agents.js";
import { askShiomi } from "../../../server/shiomi-client.js";

const MAX_CONSULTS = 2, MAX_PER_CONSULT = 4, MAX_ROUNDS = 8;

const INSTRUCTION = `You are Nagi, the planner in a task manager called Umi. The app shows tasks as buoys on a lake;
"Nagi mode" keeps only three tasks afloat so the user can focus.

The user message is a JSON ShiomiReport: today's open tasks with due dates, slack in days (days left minus days of work),
the app's own order score, and a judgment of each task (impact, penalty, effort, dependency, must, a reason, a confidence,
and "source" saying who set each value: "you" = the user, "ai" = Shiomi, "rule" = a keyword guess).

Plan what to keep afloat now:
1. Call get_day_budget. Call get_free_time. Call get_task or get_dive_history only if you need them.
2. Check the judgments before you trust them. Shiomi, the judge, is another agent you can consult with ask_shiomi.
   A judgment is doubtful when its impact or effort source is "rule" (only a keyword guess), its confidence is
   below 0.5, or its numbers do not fit (e.g. a tiny effort but almost no slack, a vague title rated as a must).
   If any task in section "surface" is doubtful, you must call ask_shiomi before choosing, with those task ids
   (up to ${MAX_PER_CONSULT}) and one sentence on why. Never consult about values the user set ("you").
   At most ${MAX_CONSULTS} calls per plan. If nothing is doubtful, do not consult.
3. Choose up to three tasks from section "surface" to keep, in the order to do them.
   - Values with source "you" are fixed: never argue with them.
   - Overdue must tasks always stay.
   - Prefer little slack, must, high penalty, someone waiting; fit the minutes left.
4. Optionally suggest for other tasks: "tomorrow", "lighter" (lower its weight), "later" (+3 days), or "dive"
   (a 25 or 50 minute focus session, only for a kept task). Suggest little; the user decides.
5. Write one calm sentence for the day as "message".
If the report has "fixed" (task ids) and "slots" (a number), this is a refill: the fixed tasks are already kept and stay.
Do not consult about them or suggest for them; choose only "slots" more tasks from the other surface tasks.
If "fixed" is empty and "slots" is 3, the report holds only the tasks that matter: the ones kept last time and the
new or changed ones; choose three of them. No pressure, no exclamation marks.
Write every "why" and the message in the report's "lang" ("en" English, "ja" Japanese), one short sentence each.

When you are done, answer with JSON only:
{"version": 1, "keep": [{"id": "...", "why": "..."}], "suggest": [{"id": "...", "action": "tomorrow", "minutes": null, "why": "..."}],
 "message": "...", "validUntil": "<ISO time about 3 hours from now>"}`;

const TOOLS = [{
  functionDeclarations: [
    { name: "get_day_budget", description: "Minutes the user can work today, minutes already used, minutes left, and minutes planned for today." },
    { name: "get_free_time", description: "Free blocks in the user's calendar today (the calendar may not be connected)." },
    { name: "get_task", description: "Everything the report holds about one task.", parameters: { type: "OBJECT", properties: { task_id: { type: "STRING" } }, required: ["task_id"] } },
    { name: "get_dive_history", description: "Recent focus sessions (Dives) per task." },
    {
      name: "ask_shiomi",
      description: "Ask Shiomi, the judge (a separate agent), to judge these tasks again using this user's memory. It may ask the user a question first; then the plan waits for the answer. Returns new judgments.",
      parameters: {
        type: "OBJECT",
        properties: {
          task_ids: { type: "ARRAY", items: { type: "STRING" }, description: `ids of the doubtful tasks, at most ${MAX_PER_CONSULT}` },
          why: { type: "STRING", description: "one sentence: why these judgments look doubtful" },
        },
        required: ["task_ids", "why"],
      },
    },
  ],
}];

function localTool(name, args, report) {
  const tasks = report.tasks || [];
  if (name === "get_day_budget") {
    const planned = tasks.filter((t) => t.section === "surface").reduce((s, t) => s + (t.estMin || 0), 0);
    return { budgetMin: report.dayBudgetMin, usedMin: report.usedTodayMin || 0, leftMin: Math.max(0, report.dayBudgetMin - (report.usedTodayMin || 0)), plannedTodayMin: planned };
  }
  if (name === "get_free_time") return { connected: false, note: "Calendar not connected; plan from the day budget only." };
  if (name === "get_task") return tasks.find((t) => t.id === (args && args.task_id)) || { error: "no such task" };
  if (name === "get_dive_history") return { dives: tasks.filter((t) => t.dives && t.dives.length).map((t) => ({ id: t.id, title: t.title, dives: t.dives })) };
  return { error: `unknown tool ${name}` };
}

// Shiomi's new judgments go into the report (never over a value the user set), so the plan and the app see them.
function applyJudgments(report, results) {
  const byId = new Map(report.tasks.map((t) => [t.id, t]));
  const clamp = (v) => Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
  const out = [];
  for (const r of results) {
    const t = byId.get(r.id); if (!t) continue;
    const j = t.judgment = t.judgment || {}; j.source = j.source || {};
    for (const k of ["impact", "penalty", "effort", "dependency"]) if (j.source[k] !== "you" && r[k] != null) { j[k] = clamp(r[k]); j.source[k] = "ai"; }
    if (j.source.must !== "you" && typeof r.must === "boolean") { j.must = r.must; j.source.must = "ai"; }
    j.confidence = Math.max(0, Math.min(1, Number(r.confidence) || 0.5));
    j.reason = String(r.reason || "").slice(0, 160);
    out.push({ id: t.id, impact: j.impact, penalty: j.penalty, effort: j.effort, dependency: j.dependency, must: j.must, confidence: j.confidence, reason: j.reason, memory: String(r.memory || "").slice(0, 160) });
  }
  return out;
}

const doubtful = (t) => {
  const s = (t.judgment && t.judgment.source) || {};
  return !Object.values(s).every((v) => v === "you");
};

// ---------------------------------------------------------------- one consultation
async function consult(st, args, ctx, env) {
  if (st.consults >= MAX_CONSULTS) return { result: { error: `limit of ${MAX_CONSULTS} consultations reached; plan with what you have` } };
  const ids = [...new Set(Array.isArray(args.task_ids) ? args.task_ids : [])];
  const fixed = new Set(st.report.fixed || []); // a refill: the tasks already kept are not judged again
  const tasks = st.report.tasks.filter((t) => ids.includes(t.id) && !fixed.has(t.id) && doubtful(t)).slice(0, MAX_PER_CONSULT);
  if (!tasks.length) return { result: { error: "none of these tasks can be judged again (unknown ids, or the user set every value)" } };
  st.consults++;
  const why = String(args.why || "").slice(0, 200), askAllowed = !st.asked, t0 = Date.now();
  const entry = { from: "nagi", to: "shiomi", why, tasks: tasks.map((t) => t.id), askAllowed };
  st.trace.calls.push(entry);
  const input = {
    lang: st.report.lang, askAllowed, why,
    areas: [...new Set(st.report.tasks.map((t) => t.area).filter(Boolean))].slice(0, 8),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, area: t.area || null, due: t.due, slackDays: t.slackDays, estMin: t.estMin, now: t.judgment })),
  };
  let r;
  try { r = await askShiomi(env, ctx.who.token, { text: JSON.stringify(input) }); }
  catch (e) { entry.ms = Date.now() - t0; entry.state = "error"; entry.error = String((e && e.message) || e).slice(0, 160); return { result: { error: "Shiomi is unavailable; plan without it" } }; }
  Object.assign(entry, { ms: Date.now() - t0, state: r.state, shiomiTask: r.taskId, shiomiTools: r.tools });
  if (r.state === "input-required" && r.ask) {
    st.asked = true;
    return { ask: { shiomi: { taskId: r.taskId, contextId: r.contextId, callId: r.ask.callId }, args: r.ask.args, a2ui: r.ask.a2ui } };
  }
  if (r.error) return { result: { error: `Shiomi could not judge: ${r.error}` } };
  const judged = applyJudgments(st.report, r.results);
  entry.judged = judged.map((j) => ({ id: j.id, confidence: j.confidence, memory: j.memory }));
  return { result: { results: judged } };
}

// ---------------------------------------------------------------- the planning loop (can pause and resume)
async function run(st, ctx, env) {
  while (st.round < MAX_ROUNDS) {
    st.round++;
    const { parts, model } = await gemini(env, { systemInstruction: { parts: [{ text: INSTRUCTION }] }, contents: st.contents, tools: TOOLS, generationConfig: { temperature: 0.3 } }, { prefer: env.NAGI_MODEL || "gemini-2.5-flash" });
    st.trace.model = model;
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const p = extractJson(parts.map((x) => x.text || "").join(""));
      if (!p) throw new Error("no plan in the answer");
      st.trace.ms = Date.now() - st.started;
      return { state: "completed", data: { plan: { version: 1, ...p }, report: st.report, trace: st.trace } };
    }
    st.contents.push({ role: "model", parts });
    const responses = [];
    let ask = null;
    for (const c of calls) {
      const name = c.functionCall.name, args = c.functionCall.args || {};
      st.trace.tools.push(name);
      if (name !== "ask_shiomi") { responses.push({ functionResponse: { name, response: localTool(name, args, st.report) } }); continue; }
      if (ask) { responses.push({ functionResponse: { name, response: { error: "one question to the user at a time; call again after this one is answered" } } }); continue; }
      const out = await consult(st, args, ctx, env);
      if (out.ask) { ask = out.ask; responses.push(null); continue; } // filled in when the user answers
      responses.push({ functionResponse: { name, response: out.result } });
    }
    if (ask) {
      st.waiting = { ...ask.shiomi, at: responses.indexOf(null), responses };
      st.trace.ms = Date.now() - st.started;
      await save(env, ctx, st);
      const a = ask.args || {};
      return {
        state: "input-required",
        data: { ask: { taskId: a.task_id, title: a.title, question: a.question, a2ui: ask.a2ui }, trace: st.trace },
        parts: ask.a2ui.map((m) => ({ kind: "data", data: m, metadata: { mimeType: "application/json+a2ui" } })),
      };
    }
    st.contents.push({ role: "user", parts: responses });
  }
  throw new Error("too many tool rounds");
}

// The paused plan lives in D1 while the user thinks (the same table Shiomi uses, keyed "nagi:<taskId>").
async function save(env, ctx, st) {
  if (!env.MEMORY) throw new Error("memory not configured");
  await env.MEMORY.prepare("INSERT INTO pending_tasks (uid, task_id, context_id, body, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (uid, task_id) DO UPDATE SET body = excluded.body, at = excluded.at")
    .bind(ctx.who.uid, `nagi:${ctx.taskId}`, ctx.contextId, JSON.stringify(st), Date.now()).run();
}
async function load(env, ctx) {
  const r = env.MEMORY && await env.MEMORY.prepare("SELECT body FROM pending_tasks WHERE uid = ? AND task_id = ?").bind(ctx.who.uid, `nagi:${ctx.taskId}`).first();
  return r ? JSON.parse(r.body) : null;
}
async function drop(env, ctx) {
  if (env.MEMORY) await env.MEMORY.prepare("DELETE FROM pending_tasks WHERE uid = ? AND task_id = ?").bind(ctx.who.uid, `nagi:${ctx.taskId}`).run();
}

async function handle(data, env, ctx) {
  let st;
  if (ctx.resuming) {
    st = await load(env, ctx);
    if (!st || !st.waiting) throw new Error("no paused plan for this task");
    const w = st.waiting, t0 = Date.now();
    const answer = data.answer && typeof data.answer === "object" ? data.answer : { skipped: true };
    const entry = { from: "nagi", to: "shiomi", why: answer.skipped ? "the user let Shiomi guess" : "passing on the user's answer", tasks: [], resumes: w.taskId };
    st.trace.calls.push(entry);
    let result;
    try {
      const r = await askShiomi(env, ctx.who.token, { taskId: w.taskId, contextId: w.contextId, callId: w.callId, answer });
      Object.assign(entry, { ms: Date.now() - t0, state: r.state, shiomiTask: r.taskId, shiomiTools: r.tools });
      if (r.state === "completed" && r.results.length) {
        const judged = applyJudgments(st.report, r.results);
        entry.tasks = judged.map((j) => j.id);
        entry.judged = judged.map((j) => ({ id: j.id, confidence: j.confidence, memory: j.memory }));
        result = { results: judged, userAnswered: !answer.skipped };
      } else result = { error: `Shiomi could not finish: ${r.error || r.state}` };
    } catch (e) {
      Object.assign(entry, { ms: Date.now() - t0, state: "error", error: String((e && e.message) || e).slice(0, 160) });
      result = { error: "Shiomi is unavailable; plan without it" };
    }
    w.responses[w.at] = { functionResponse: { name: "ask_shiomi", response: result } };
    st.contents.push({ role: "user", parts: w.responses });
    st.waiting = null;
    st.started = Date.now() - (st.trace.ms || 0);
  } else {
    const report = data.report;
    if (!report || !Array.isArray(report.tasks)) throw new Error("expected { report: ShiomiReport }");
    report.tasks = report.tasks.slice(0, 40);
    if (report.fixed != null) { report.fixed = (Array.isArray(report.fixed) ? report.fixed : []).map(String).slice(0, 3); report.slots = Math.max(1, Math.min(3, 3 - report.fixed.length)); }
    st = {
      report, round: 0, consults: 0, asked: false, started: Date.now(),
      contents: [{ role: "user", parts: [{ text: JSON.stringify(report) }] }],
      trace: { engine: "cloudflare-a2a", calls: [{ from: "app", to: "nagi", why: report.fixed ? (report.fixed.length ? `fill ${report.slots} place(s); ${report.fixed.length} kept` : "weigh new or changed tasks against the kept ones") : "plan Nagi mode", tasks: report.tasks.length }], tools: [] },
    };
  }
  const out = await run(st, ctx, env);
  if (out.state === "completed" && ctx.resuming) await drop(env, ctx);
  return out;
}

export const onRequest = serveAgent({
  name: "nagi",
  description: "Plans Umi's Nagi mode: picks the three tasks to keep afloat now, with reasons. Consults Shiomi (a separate A2A agent) when a judgment looks doubtful, and waits (input-required) when Shiomi needs the user's answer.",
  skill: { id: "plan-nagi", name: "Plan Nagi mode", description: "From a ShiomiReport, chooses up to three tasks to keep, with reasons and optional suggestions. May consult Shiomi and ask the user one question.", tags: ["planning", "focus"] },
}, handle);
