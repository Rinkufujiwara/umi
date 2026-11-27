// POST /api/weigh — ask Gemini for four values per task (impact, penalty, effort, dependency, 1–10).
// Everything else (deadline, slack, order, alerts) is computed in the browser (store.js).
// Same as Life Dashboard's api/weigh.js; Umi sends the area name as the project.
//
// Vercel environment variables (set in the Vercel dashboard, never in the repo):
//   GEMINI_API_KEY   the Gemini API key (required)
//   ALLOWED_EMAILS   comma-separated Google accounts allowed to use it (required; empty = nobody)
//   GEMINI_MODEL     optional, default below
//
// The caller must send a Firebase ID token (Authorization: Bearer …); we check it with Google
// (accounts:lookup) so only signed-in, allowed people can spend the key.

const FIREBASE_WEB_KEY = "AIzaSyAWZAOK24ufgVlRy4aZb6nE-8rv_HIt8jA"; // public web key (see firebase-config.js)
// Light and cheap is enough for this judgement. If a model name is not available any more (404),
// the next one is tried. GEMINI_MODEL in Vercel, if set, is tried first.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

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

async function whoIs(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const u = d.users && d.users[0];
  return u && u.email && u.emailVerified !== false ? u.email.toLowerCase() : null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!key || !allowed.length) return res.status(503).json({ error: "not configured" });

  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  const email = m ? await whoIs(m[1]).catch(() => null) : null;
  if (!email) return res.status(401).json({ error: "sign in first" });
  if (!allowed.includes(email)) return res.status(403).json({ error: "not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 12).map((t) => ({
    id: str(t.id, 40), title: str(t.title, 200), note: str(t.note, 300),
    project: str(t.project, 80), goal: str(t.goal, 120), hasDue: !!t.hasDue,
  })).filter((t) => t.id && t.title);
  if (!tasks.length) return res.status(200).json({ results: [] });
  const goals = (Array.isArray(body.goals) ? body.goals : []).slice(0, 12).map((g) => str(g, 120));
  const examples = (Array.isArray(body.examples) ? body.examples : []).slice(0, 6).map((e) => ({
    title: str(e.title, 120), impact: clamp(e.impact), penalty: clamp(e.penalty), effort: clamp(e.effort), dependency: clamp(e.dependency),
    must: e.must === true,
  }));

  const lang = body.lang === "ja" ? "ja" : "en";
  const input = { today: new Date().toISOString().slice(0, 10), lang, goals, examples, tasks };
  const models = [process.env.GEMINI_MODEL, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let r = null, used = "";
  for (const model of models) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
      }),
    }).catch(() => null);
    used = model;
    if (!r || r.status !== 404) break; // only an unknown model name moves on to the next one
  }
  if (!r || !r.ok) return res.status(502).json({ error: "gemini failed", status: r ? r.status : 0, model: used });

  let parsed = {};
  try {
    const d = await r.json();
    parsed = JSON.parse(d.candidates[0].content.parts[0].text);
  } catch { return res.status(502).json({ error: "bad answer" }); }
  const ids = new Set(tasks.map((t) => t.id));
  const results = (parsed.results || []).filter((x) => ids.has(x.id)).map((x) => ({
    id: x.id, impact: clamp(x.impact), penalty: clamp(x.penalty), effort: clamp(x.effort), dependency: clamp(x.dependency),
    must: x.must === true, must_reason: str(x.must_reason, 80), reason: str(x.reason, 120),
  }));
  return res.status(200).json({ results, model: used });
};
