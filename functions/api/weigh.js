// POST /api/weigh — Shiomi's quick judgment when a task is added or renamed: four values per task
// (impact, penalty, effort, dependency, 1–10) plus must. Everything else (deadline, slack, order, alerts)
// is computed in the browser (store.js). Sign-in, allow-list and Gemini calls: server/agents.js.
import { checkCaller, gemini, json, readJson } from "../../server/agents.js";

const PROMPT = `You are the evaluator in a task manager. For each of the user's tasks, judge the four values below as integers from 1 to 10.
Do not judge deadlines, days left or ordering: the system computes those.

- impact (value): how much finishing it helps studies, career, skills or life goals. Plain chores 1–3; self-investment or important projects 7–10.
- penalty (cost of missing it): the real harm of skipping or being late. Official procedures, credits, money and promises to others 7–10; optional study or hobbies 1–2.
- effort (time it takes): 1=15 min 2=30 min 3=1 h 4=2 h 5=half a day 6=1 day 7=2 days 8=4 days 9=1 week 10=2 weeks or more. For something very large, estimate the first meaningful chunk.
- dependency (is someone waiting): 1 if it is entirely your own; 6–10 for promises involving others, or when stopping it blocks other people or later work.
- must (required or not): true or false. true when skipping it causes real harm or cannot be undone, even if it only concerns the user (e.g. bookings, applications and procedures, payments, submissions with a deadline, course credits). false when nobody is hurt by skipping it but the user does it for their own future or goals (e.g. practice, making things, a portfolio, preparing for a hackathon). Do not decide this from whether someone is waiting.
- must_reason: one short sentence on why it is must or not (about 15 words at most).
- reason: one short sentence on why you chose the four values (about 20 words at most).

Write must_reason and reason in the language given as "lang" in the input ("en" = English, "ja" = Japanese).
If the user's goals or project names are given, rate tasks that serve them directly with a higher impact.
If "examples" corrected by the user are given, they are this person's yardstick: match them.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          impact: { type: "INTEGER" },
          penalty: { type: "INTEGER" },
          effort: { type: "INTEGER" },
          dependency: { type: "INTEGER" },
          must: { type: "BOOLEAN" },
          must_reason: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["id", "impact", "penalty", "effort", "dependency", "must", "must_reason", "reason"],
      },
    },
  },
  required: ["results"],
};

const clamp = (v) => Math.max(1, Math.min(10, Math.round(Number(v) || 1)));
const str = (v, n) => String(v == null ? "" : v).slice(0, n);

export async function onRequestPost({ request, env }) {
  const who = await checkCaller(request, env);
  if (who.error) return json({ error: who.error }, who.status);

  const body = await readJson(request);
  const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 12).map((t) => ({
    id: str(t.id, 40), title: str(t.title, 200), note: str(t.note, 300),
    project: str(t.project, 80), goal: str(t.goal, 120), hasDue: !!t.hasDue,
  })).filter((t) => t.id && t.title);
  if (!tasks.length) return json({ results: [] });
  const goals = (Array.isArray(body.goals) ? body.goals : []).slice(0, 12).map((g) => str(g, 120));
  const examples = (Array.isArray(body.examples) ? body.examples : []).slice(0, 6).map((e) => ({
    title: str(e.title, 120), impact: clamp(e.impact), penalty: clamp(e.penalty), effort: clamp(e.effort), dependency: clamp(e.dependency),
    must: e.must === true,
  }));

  const lang = body.lang === "ja" ? "ja" : "en";
  const input = { today: new Date().toISOString().slice(0, 10), lang, goals, examples, tasks };
  let parts, model;
  try {
    ({ parts, model } = await gemini(env, {
      systemInstruction: { parts: [{ text: PROMPT }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
    }));
  } catch (e) { return json({ error: "gemini failed", detail: String((e && e.message) || e) }, 502); }

  let parsed = {};
  try { parsed = JSON.parse(parts[0].text); } catch { return json({ error: "bad answer" }, 502); }
  const ids = new Set(tasks.map((t) => t.id));
  const results = (parsed.results || []).filter((x) => ids.has(x.id)).map((x) => ({
    id: x.id, impact: clamp(x.impact), penalty: clamp(x.penalty), effort: clamp(x.effort), dependency: clamp(x.dependency),
    must: x.must === true, must_reason: str(x.must_reason, 80), reason: str(x.reason, 120),
  }));
  return json({ results, model });
}

export const onRequest = () => json({ error: "POST only" }, 405);
