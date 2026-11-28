// POST /api/nagi — the app's door to Nagi mode's planner (docs/nagi-agent-design.md).
//
//   browser ── /api/nagi ──A2A──▶ Nagi (/api/agents/nagi, Cloudflare)
//                                   └─ ask_shiomi, when Nagi doubts a judgment ──A2A──▶ Shiomi (Cloud Run, ADK)
//                                                                                          └─ /api/memory (D1)
//
// The app only calls Nagi; Nagi decides whether to consult Shiomi. Body:
//   { report }                         plan anew
//   { resume: { taskId, answer } }     the user answered Shiomi's question (answer { skipped: true } = let Shiomi guess)
// Reply:
//   { plan, report, trace }            a plan (the browser checks it again and falls back to its formula on any error)
//   { ask: { nagiTask, taskId, title, question, a2ui }, trace }   Shiomi asked the user; the plan waits
import { checkCaller, json, readJson, sendA2A } from "../../server/agents.js";

export async function onRequestPost({ request, env }) {
  const who = await checkCaller(request, env);
  if (who.error) return json({ error: who.error }, who.status);

  const body = await readJson(request);
  const nagi = `${new URL(request.url).origin}/api/agents/nagi`;
  try {
    let r;
    if (body.resume && body.resume.taskId) {
      r = await sendA2A(nagi, { answer: body.resume.answer || { skipped: true } }, who.token, { taskId: String(body.resume.taskId), contextId: body.resume.contextId });
    } else {
      if (!body.report || !Array.isArray(body.report.tasks)) return json({ error: "no report" }, 400);
      r = await sendA2A(nagi, { report: body.report }, who.token);
    }
    if (r.state === "input-required") return json({ ask: { ...r.data.ask, nagiTask: r.taskId, contextId: r.contextId }, trace: r.data.trace });
    return json({ plan: r.data.plan, report: r.data.report, trace: r.data.trace });
  } catch (e) {
    return json({ error: "agent failed", detail: String((e && e.message) || e).slice(0, 200) }, 502);
  }
}

export const onRequest = () => json({ error: "POST only" }, 405);
