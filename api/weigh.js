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

const PROMPT = `あなたはタスク管理の評価係です。ユーザーのタスクそれぞれについて、次の4つを1〜10の整数で判断してください。
締切・残り日数・並び順はシステムが計算するので、判断しないでください。

- impact（価値）: 完了したとき、学業・キャリア・スキル・人生の目標にどれだけプラスになるか。単なる事務は1〜3、自己投資や重要なプロジェクトは7〜10。
- penalty（未達時の痛手）: やらない・遅れたときの実害。公的手続き・単位・お金・他人との約束は7〜10、自主的な学習や趣味は1〜2。
- effort（かかる時間）: 1=15分 2=30分 3=1時間 4=2時間 5=半日 6=1日 7=2日 8=4日 9=1週間 10=2週間以上。大きすぎるものは、最初のひと区切り分で見積もる。
- dependency（誰かが待っているか）: 自分ひとりで完結なら1、相手がいる約束や、止めると他の人・後の作業が止まるなら6〜10。
- must（必須かどうか）: true か false。やらないと実害が出る・取り返しがつかないなら true（必須）。自分ひとりのことでもよい（例：予約、申請・手続き、支払い、期限のある提出、単位）。やらなくても誰も困らないが、自分の将来や目標のために自主的にやることなら false（自主。例：練習、作品づくり、ポートフォリオ、ハッカソンの準備）。「誰かが待っているか」では決めないこと。
- must_reason: 必須／自主と判断した理由を日本語で短く1文（30字以内）。
- reason: 4つの値をなぜそう判断したかを日本語で短く1文（40字以内）。

ユーザーの目標・プロジェクト名が添えてあれば、それに直結するタスクは impact を高めにしてください。
「ユーザーが直した例」があれば、それがこの人の物差しです。それに合わせてください。`;

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

  const input = { today: new Date().toISOString().slice(0, 10), goals, examples, tasks };
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
