// Shiomi — the judge, as an A2A agent.
//   GET  /api/agents/shiomi → agent card
//   POST /api/agents/shiomi → JSON-RPC "message/send", data: { lang, tasks: [{ id, title, note, project, hasDue }] }
//                              reply data: { results: [{ id, impact, penalty, effort, dependency, must, confidence, reason }] }
import { serveAgent, gemini, extractJson } from "../../../server/agents.js";

const INSTRUCTION = `You are Shiomi, the evaluator in a task manager called Umi. For each task, judge as integers from 1 to 10:
- impact (value): how much finishing it helps studies, career, skills or life goals. Plain chores 1-3; self-investment or important projects 7-10.
- penalty (cost of missing it): official procedures, credits, money and promises to others 7-10; optional study or hobbies 1-2.
- effort: 1=15 min 2=30 min 3=1 h 4=2 h 5=half a day 6=1 day 7=2 days 8=4 days 9=1 week 10=2 weeks or more.
- dependency: 1 if it is entirely the user's own; 6-10 when others wait on it or it blocks later work.
Also:
- must (true/false): true when skipping it causes real harm or cannot be undone (bookings, procedures, payments, submissions with a deadline, credits). Do not decide this from whether someone is waiting.
- confidence (0-1): how sure you are, given how clear the title is. A vague title ("prep", "stuff") is below 0.5.
- reason: one short sentence (about 20 words) in the language "lang" of the input ("en" English, "ja" Japanese).
Do not judge deadlines or order; the app computes those.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" }, impact: { type: "INTEGER" }, penalty: { type: "INTEGER" }, effort: { type: "INTEGER" },
          dependency: { type: "INTEGER" }, must: { type: "BOOLEAN" }, confidence: { type: "NUMBER" }, reason: { type: "STRING" },
        },
        required: ["id", "impact", "penalty", "effort", "dependency", "must", "confidence", "reason"],
      },
    },
  },
  required: ["results"],
};

const clamp = (v) => Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
const str = (v, n) => String(v == null ? "" : v).slice(0, n);

async function judge(data, env) {
  const lang = data.lang === "ja" ? "ja" : "en";
  const tasks = (Array.isArray(data.tasks) ? data.tasks : []).slice(0, 12)
    .map((t) => ({ id: str(t.id, 40), title: str(t.title, 200), note: str(t.note, 300), project: str(t.project, 80), hasDue: !!t.hasDue }))
    .filter((t) => t.id && t.title);
  if (!tasks.length) return { results: [] };
  const { parts, model } = await gemini(env, {
    systemInstruction: { parts: [{ text: INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ lang, tasks }) }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
  });
  const parsed = extractJson(parts.map((p) => p.text || "").join("")) || {};
  const ids = new Set(tasks.map((t) => t.id));
  const results = (parsed.results || []).filter((x) => ids.has(x.id)).map((x) => ({
    id: x.id, impact: clamp(x.impact), penalty: clamp(x.penalty), effort: clamp(x.effort), dependency: clamp(x.dependency),
    must: x.must === true, confidence: Math.max(0, Math.min(1, Number(x.confidence) || 0.5)), reason: str(x.reason, 160),
  }));
  return { results, model };
}

export const onRequest = serveAgent({
  name: "shiomi",
  description: "Judges each Umi task: value, cost of missing it, effort, who waits, whether it is a must, and how sure it is.",
  skill: { id: "judge-tasks", name: "Judge tasks", description: "Scores tasks 1-10 on impact, penalty, effort and dependency, plus must and confidence.", tags: ["tasks", "prioritization"] },
}, judge);
