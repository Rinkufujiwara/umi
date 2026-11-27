// POST /api/nagi — the app's door to the Nagi agent (docs/nagi-agent-design.md).
// Checks the Firebase sign-in and the allow-list (same as /api/weigh), then:
//   • if NAGI_URL is set: forwards the ShiomiReport to the agents service on Cloud Run (agents/server.py, POST /plan),
//     where Shiomi and Nagi run as ADK agents and hand off over A2A;
//   • otherwise: runs a built-in Nagi here, with Gemini function calling over the same read-only tools.
// The plan is checked again in the browser (nagi.js), and the app falls back to its formula on any error.
//
// Vercel environment variables:
//   ALLOWED_EMAILS   comma-separated Google accounts allowed to use it
//   GEMINI_API_KEY   used by the built-in Nagi (already set for Shiomi's /api/weigh)
//   NAGI_URL         optional: base URL of the agents service on Cloud Run
//   NAGI_SECRET      required with NAGI_URL: shared secret, the same value as on Cloud Run
//   GEMINI_MODEL     optional model override

const FIREBASE_WEB_KEY = "AIzaSyAWZAOK24ufgVlRy4aZb6nE-8rv_HIt8jA"; // public web key (see firebase-config.js)
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

async function whoIs(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const u = d.users && d.users[0];
  return u && u.email && u.emailVerified !== false ? u.email.toLowerCase() : null;
}

// ---------------------------------------------------------------- the built-in Nagi
const INSTRUCTION = `You are Nagi, the planner in a task manager called Umi. The app shows tasks as buoys on a lake;
"Nagi mode" keeps only three tasks afloat so the user can focus.

The user message is a JSON ShiomiReport: today's open tasks with due dates, slack in days (days left minus days of work),
the app's own order score, and Shiomi's judgment of each task (impact, penalty, effort, dependency, must, a reason,
a confidence, and "source" saying who set each value: "you" = the user, "ai" = Shiomi, "rule" = a keyword guess).

Plan what to keep afloat now:
1. Call get_day_budget. Call get_free_time. Call get_task or get_dive_history only if you need them.
2. Choose up to three tasks from section "surface" to keep, in the order to do them.
   - Values with source "you" are fixed: never argue with them.
   - Overdue must tasks always stay.
   - Prefer little slack, must, high penalty, someone waiting; fit the minutes left.
   - When Shiomi's confidence is low, rely more on the due date and the app's order.
3. Optionally suggest for other tasks: "tomorrow", "lighter" (lower its weight), "later" (+3 days), or "dive"
   (a 25 or 50 minute focus session, only for a kept task). Suggest little; the user decides.
4. Write one calm sentence for the day as "message". No pressure, no exclamation marks.
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
  ],
}];

function runTool(name, args, report) {
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

function extractJson(text) {
  if (!text) return null;
  const m = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/.exec(text);
  const raw = m ? m[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { return null; }
}

async function builtinNagi(report, key) {
  const models = [process.env.GEMINI_MODEL, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  const contents = [{ role: "user", parts: [{ text: JSON.stringify(report) }] }];
  const trace = { engine: "vercel", tools: [] };
  let model = models[0];
  for (let round = 0; round < 6; round++) {
    let r = null;
    for (const m of models) {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: INSTRUCTION }] }, contents, tools: TOOLS, generationConfig: { temperature: 0.3 } }),
      }).catch(() => null);
      model = m;
      if (!r || r.status !== 404) break;
    }
    if (!r || !r.ok) return { plan: null, trace: { ...trace, error: `gemini ${r ? r.status : 0}`, model } };
    const d = await r.json();
    const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length) {
      contents.push({ role: "model", parts });
      contents.push({ role: "user", parts: calls.map((c) => {
        trace.tools.push(c.functionCall.name);
        return { functionResponse: { name: c.functionCall.name, response: runTool(c.functionCall.name, c.functionCall.args, report) } };
      }) });
      continue;
    }
    const plan = extractJson(parts.map((p) => p.text || "").join(""));
    return { plan, trace: { ...trace, model } };
  }
  return { plan: null, trace: { ...trace, error: "too many rounds" } };
}

// ---------------------------------------------------------------- the endpoint
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const base = (process.env.NAGI_URL || "").replace(/\/+$/, "");
  const secret = process.env.NAGI_SECRET || "";
  const key = process.env.GEMINI_API_KEY || "";
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || (!(base && secret) && !key)) return res.status(503).json({ error: "not configured" });

  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  const email = m ? await whoIs(m[1]).catch(() => null) : null;
  if (!email) return res.status(401).json({ error: "sign in first" });
  if (!allowed.includes(email)) return res.status(403).json({ error: "not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const report = body.report;
  if (!report || !Array.isArray(report.tasks)) return res.status(400).json({ error: "no report" });
  report.tasks = report.tasks.slice(0, 40); // keep the request small

  if (!(base && secret)) {
    const { plan, trace } = await builtinNagi(report, key).catch((e) => ({ plan: null, trace: { engine: "vercel", error: String(e).slice(0, 120) } }));
    if (!plan) return res.status(502).json({ error: "agent failed", trace });
    return res.status(200).json({ plan: { version: 1, ...plan }, trace });
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(`${base}/plan`, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "X-Umi-Secret": secret },
      body: JSON.stringify({ report }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.plan) return res.status(502).json({ error: "agent failed", status: r.status, trace: d.trace });
    return res.status(200).json({ plan: d.plan, trace: { engine: "cloud-run", ...(d.trace || {}) } });
  } catch (e) {
    return res.status(504).json({ error: e.name === "AbortError" ? "agent timeout" : "agent unreachable" });
  } finally {
    clearTimeout(timer);
  }
};
