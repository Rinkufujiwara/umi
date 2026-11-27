// POST /api/nagi — the app's door to the Nagi agent (docs/nagi-agent-design.md).
// Checks the Firebase sign-in and the allow-list (same as /api/weigh), then forwards the ShiomiReport to the
// agents service on Cloud Run (agents/server.py, POST /plan) with a shared secret. The plan is checked again
// in the browser (nagi.js), and the app falls back to its formula on any error here.
//
// Vercel environment variables:
//   NAGI_URL         base URL of the agents service, e.g. https://umi-agents-xxxx.a.run.app (unset = Nagi agent off)
//   NAGI_SECRET      shared secret, the same value as on Cloud Run
//   ALLOWED_EMAILS   comma-separated Google accounts allowed to use it

const FIREBASE_WEB_KEY = "AIzaSyAWZAOK24ufgVlRy4aZb6nE-8rv_HIt8jA"; // public web key (see firebase-config.js)

async function whoIs(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const u = d.users && d.users[0];
  return u && u.email && u.emailVerified !== false ? u.email.toLowerCase() : null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const base = (process.env.NAGI_URL || "").replace(/\/+$/, "");
  const secret = process.env.NAGI_SECRET || "";
  const allowed = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!base || !secret || !allowed.length) return res.status(503).json({ error: "not configured" });

  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  const email = m ? await whoIs(m[1]).catch(() => null) : null;
  if (!email) return res.status(401).json({ error: "sign in first" });
  if (!allowed.includes(email)) return res.status(403).json({ error: "not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const report = body.report;
  if (!report || !Array.isArray(report.tasks)) return res.status(400).json({ error: "no report" });
  report.tasks = report.tasks.slice(0, 40); // keep the request small

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
    return res.status(200).json({ plan: d.plan, trace: d.trace });
  } catch (e) {
    return res.status(504).json({ error: e.name === "AbortError" ? "agent timeout" : "agent unreachable" });
  } finally {
    clearTimeout(timer);
  }
};
