// POST /api/nagi — the app's door to Nagi mode's planner (docs/nagi-agent-design.md).
//
//   browser ── /api/nagi ──A2A──▶ /api/agents/shiomi   (judges the tasks the report does not know well)
//                        ──A2A──▶ /api/agents/nagi     (plans from the improved report, with read-only tools)
//
// It checks the sign-in and the allow-list, hands the report to Shiomi and then to Nagi over A2A (JSON-RPC
// "message/send" with data parts, each agent resolved from its agent card), and returns the NagiPlan with a
// trace of what each agent did. The browser checks the plan again and falls back to its formula on any error.
//
// Vercel environment variables: GEMINI_API_KEY, ALLOWED_EMAILS (already set for Shiomi's /api/weigh), GEMINI_MODEL (optional).
const { checkCaller, origin, sendA2A, uid } = require("./_lib/agents.js");

const LOW_CONFIDENCE = 0.5;
const needsJudgment = (t) => {
  const j = t.judgment || {}, src = j.source || {};
  return !Object.values(src).includes("you") && (src.impact === "rule" || (typeof j.confidence === "number" && j.confidence < LOW_CONFIDENCE));
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const who = await checkCaller(req);
  if (who.error) return res.status(who.status).json({ error: who.error });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const report = body.report;
  if (!report || !Array.isArray(report.tasks)) return res.status(400).json({ error: "no report" });
  report.tasks = report.tasks.slice(0, 40);

  const base = `${origin(req)}/api/agents`, contextId = uid();
  const trace = { engine: "vercel-a2a", shiomi: 0, nagi: false, tools: [] };
  try {
    // 1) Shiomi over A2A: judge only what the report does not know well
    const todo = report.tasks.filter(needsJudgment).slice(0, 12);
    if (todo.length) {
      const { data } = await sendA2A(`${base}/shiomi`, {
        lang: report.lang,
        tasks: todo.map((t) => ({ id: t.id, title: t.title, note: "", project: "", hasDue: !!t.due })),
      }, who.token, contextId);
      const byId = new Map((data.results || []).map((r) => [r.id, r]));
      for (const t of report.tasks) {
        const r = byId.get(t.id); if (!r) continue;
        const j = t.judgment = t.judgment || {}; j.source = j.source || {};
        for (const k of ["impact", "penalty", "effort", "dependency"]) if (j.source[k] !== "you") { j[k] = r[k]; j.source[k] = "ai"; }
        if (j.source.must !== "you") { j.must = r.must; j.source.must = "ai"; }
        j.confidence = r.confidence; j.reason = r.reason;
        trace.shiomi++;
      }
    }
    // 2) Nagi over A2A: plan from the improved report
    const { data } = await sendA2A(`${base}/nagi`, report, who.token, contextId);
    trace.nagi = true; trace.tools = data.tools || []; trace.model = data.model;
    return res.status(200).json({ plan: data.plan, trace });
  } catch (e) {
    return res.status(502).json({ error: "agent failed", detail: String(e && e.message || e).slice(0, 200), trace });
  }
};
