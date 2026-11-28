// /api/memory/* — Shiomi's memory in Cloudflare D1 (binding MEMORY; schema in migrations/).
//
// The app writes: a hand correction of one of Shiomi's values, and the real minutes when a Dive ends.
// Shiomi (on Cloud Run) reads through its tools, forwarding the user's Firebase token: no new secret, and the
// uid always comes from the verified token, so each person only ever reads and writes their own rows.
//
//   POST   /api/memory/corrections     { task_id, title, field, shiomi, user }
//   POST   /api/memory/actuals         { task_id, title, shiomi_effort, est_min, actual_min }
//   POST   /api/memory/clarifications  { task_id, title, question, answer }
//   GET    /api/memory/recall?title=   past corrections and answers for tasks whose titles share words with this one
//   GET    /api/memory/effort-bias     how far the estimates were from the real minutes
//   GET    /api/memory/summary         row counts
//   PUT    /api/memory/pending/:id     an A2A task waiting for the user's answer   { context_id, body }
//   GET    /api/memory/pending/:id
//   DELETE /api/memory/pending/:id
import { checkCaller, json, readJson } from "../../../server/agents.js";

const FIELDS = new Set(["impact", "penalty", "effort", "dependency", "must"]);
const str = (v, n) => String(v == null ? "" : v).slice(0, n);
const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : null);

// words for a rough "is this the same kind of task" match: latin words, and pairs of characters for Japanese
export function keywords(title) {
  const t = String(title || "").toLowerCase();
  const out = new Set();
  for (const w of t.match(/[a-z0-9]{2,}/g) || []) out.add(w);
  for (const run of t.match(/[぀-ヿ㐀-鿿]+/g) || []) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
  }
  return out;
}
const overlap = (a, b) => { let n = 0; for (const k of a) if (b.has(k)) n++; return n; };

async function recall(db, uid, title) {
  const want = keywords(title);
  if (!want.size) return { corrections: [], clarifications: [] };
  const [c, q] = await Promise.all([
    db.prepare("SELECT title, field, shiomi_value, user_value, at FROM corrections WHERE uid = ? ORDER BY at DESC LIMIT 300").bind(uid).all(),
    db.prepare("SELECT title, question, answer, at FROM clarifications WHERE uid = ? ORDER BY at DESC LIMIT 200").bind(uid).all(),
  ]);
  const rank = (rows) => rows
    .map((r) => ({ r, s: overlap(want, keywords(r.title)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.r.at - a.r.at)
    .slice(0, 8)
    .map((x) => ({ ...x.r, at: new Date(x.r.at).toISOString(), match: x.s }));
  return {
    corrections: rank(c.results || []).map((r) => ({ title: r.title, field: r.field, shiomi: r.shiomi_value, user: r.user_value, at: r.at, match: r.match })),
    clarifications: rank(q.results || []).map((r) => ({ title: r.title, question: r.question, answer: safeJson(r.answer), at: r.at, match: r.match })),
  };
}
const safeJson = (s) => { try { return JSON.parse(s); } catch { return s; } };

async function effortBias(db, uid) {
  // one row per task: all its Dives added up, against the latest estimate
  const { results = [] } = await db.prepare(
    `SELECT task_id, MAX(title) AS title, MAX(shiomi_effort) AS shiomi_effort, MAX(est_min) AS est_min, SUM(actual_min) AS actual_min, MAX(at) AS at
     FROM actuals WHERE uid = ? AND est_min > 0 GROUP BY task_id ORDER BY at DESC LIMIT 60`).bind(uid).all();
  if (!results.length) return { samples: 0, note: "no finished Dives yet" };
  const ratios = results.map((r) => r.actual_min / r.est_min).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const byEffort = {};
  for (const r of results) {
    if (r.shiomi_effort == null) continue;
    const b = (byEffort[r.shiomi_effort] = byEffort[r.shiomi_effort] || { n: 0, estMin: 0, actualMin: 0 });
    b.n++; b.estMin += r.est_min; b.actualMin += r.actual_min;
  }
  return {
    samples: results.length,
    medianActualOverEstimate: +median.toFixed(2), // 1.5 = things take 1.5x the estimate
    byEffort,
    recent: results.slice(0, 5).map((r) => ({ title: r.title, estMin: r.est_min, actualMin: r.actual_min })),
  };
}

export async function onRequest({ request, env, params }) {
  if (!env.MEMORY) return json({ error: "memory not configured" }, 503);
  const who = await checkCaller(request, env, { needsGemini: false });
  if (who.error) return json({ error: who.error }, who.status);
  const db = env.MEMORY, uid = who.uid, now = Date.now();
  const path = [].concat(params.path || []);
  const [what, id] = path, method = request.method;

  if (method === "POST" && what === "corrections") {
    const b = await readJson(request);
    if (!FIELDS.has(b.field) || !b.task_id || b.user == null) return json({ error: "need task_id, field, user" }, 400);
    await db.prepare("INSERT INTO corrections (uid, task_id, title, field, shiomi_value, user_value, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(uid, str(b.task_id, 60), str(b.title, 200), b.field, b.shiomi == null ? null : str(b.shiomi, 20), str(b.user, 20), now).run();
    return json({ ok: true });
  }
  if (method === "POST" && what === "actuals") {
    const b = await readJson(request);
    const actual = int(b.actual_min);
    if (!b.task_id || !actual || actual < 1) return json({ error: "need task_id, actual_min" }, 400);
    await db.prepare("INSERT INTO actuals (uid, task_id, title, shiomi_effort, est_min, actual_min, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(uid, str(b.task_id, 60), str(b.title, 200), int(b.shiomi_effort), int(b.est_min), Math.min(actual, 24 * 60), now).run();
    return json({ ok: true });
  }
  if (method === "POST" && what === "clarifications") {
    const b = await readJson(request);
    if (!b.task_id || !b.question || b.answer == null) return json({ error: "need task_id, question, answer" }, 400);
    await db.prepare("INSERT INTO clarifications (uid, task_id, title, question, answer, at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(uid, str(b.task_id, 60), str(b.title, 200), str(b.question, 300), str(JSON.stringify(b.answer), 1000), now).run();
    return json({ ok: true });
  }
  if (method === "GET" && what === "recall") return json(await recall(db, uid, new URL(request.url).searchParams.get("title")));
  if (method === "GET" && what === "effort-bias") return json(await effortBias(db, uid));
  if (method === "GET" && what === "summary") {
    const n = async (t) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE uid = ?`).bind(uid).first()).n;
    return json({ corrections: await n("corrections"), actuals: await n("actuals"), clarifications: await n("clarifications"), pending: await n("pending_tasks") });
  }
  if (what === "pending" && id) {
    const tid = str(id, 80);
    if (method === "PUT") {
      const b = await readJson(request);
      const body = JSON.stringify(b.body || null);
      if (!b.context_id || body.length > 500000) return json({ error: "need context_id and a body under 500 kB" }, 400);
      await db.prepare("INSERT INTO pending_tasks (uid, task_id, context_id, body, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (uid, task_id) DO UPDATE SET context_id = excluded.context_id, body = excluded.body, at = excluded.at")
        .bind(uid, tid, str(b.context_id, 80), body, now).run();
      // pending answers older than a week are dropped
      await db.prepare("DELETE FROM pending_tasks WHERE uid = ? AND at < ?").bind(uid, now - 7 * 864e5).run();
      return json({ ok: true });
    }
    if (method === "GET") {
      const r = await db.prepare("SELECT context_id, body, at FROM pending_tasks WHERE uid = ? AND task_id = ?").bind(uid, tid).first();
      return r ? json({ task_id: tid, context_id: r.context_id, body: JSON.parse(r.body), at: r.at }) : json({ error: "not found" }, 404);
    }
    if (method === "DELETE") {
      await db.prepare("DELETE FROM pending_tasks WHERE uid = ? AND task_id = ?").bind(uid, tid).run();
      return json({ ok: true });
    }
  }
  return json({ error: "unknown memory route" }, 404);
}
