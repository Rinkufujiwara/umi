// Shared pieces for Umi's server side on Cloudflare Pages Functions (docs/nagi-agent-design.md).
//
// Shiomi (judge) and Nagi (planner) are separate A2A agents, each its own Pages Function with an agent card (GET)
// and a JSON-RPC endpoint (POST, method "message/send"). /api/nagi hands a report from one to the other over A2A,
// as real HTTP requests. Every call carries the user's Firebase ID token, and every endpoint checks it against
// ALLOWED_EMAILS, so no extra secret is needed and nobody else can spend the Gemini key.
//
// This folder is outside functions/, so it is not a route; Wrangler bundles it into the functions that import it.
// Pages environment variables (set in the Cloudflare dashboard or with `wrangler pages secret put`, never in the repo):
//   GEMINI_API_KEY  (secret)   ALLOWED_EMAILS  (comma-separated Google accounts)   GEMINI_MODEL  (optional)

const FIREBASE_WEB_KEY = "AIzaSyAWZAOK24ufgVlRy4aZb6nE-8rv_HIt8jA"; // public web key (see firebase-config.js)
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const A2A_VERSION = "0.3.0";

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

// ---------------------------------------------------------------- sign-in check
async function whoIs(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const u = d.users && d.users[0];
  return u && u.email && u.emailVerified !== false ? u.email.toLowerCase() : null;
}
export async function checkCaller(request, env) {
  const allowed = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !env.GEMINI_API_KEY) return { status: 503, error: "not configured" };
  const m = /^Bearer (.+)$/.exec(request.headers.get("Authorization") || "");
  const email = m ? await whoIs(m[1]).catch(() => null) : null;
  if (!email) return { status: 401, error: "sign in first" };
  if (!allowed.includes(email)) return { status: 403, error: "not allowed" };
  return { email, token: m[1] };
}

// ---------------------------------------------------------------- Gemini
// Tries GEMINI_MODEL first, then the defaults; only an unknown model name (404) moves on to the next one.
export async function gemini(env, body) {
  const models = [env.GEMINI_MODEL, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let r = null, used = "";
  for (const model of models) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify(body),
    }).catch(() => null);
    used = model;
    if (!r || r.status !== 404) break;
  }
  if (!r || !r.ok) throw new Error(`gemini ${r ? r.status : 0}`);
  const d = await r.json();
  const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
  return { parts, model: used };
}
export function extractJson(text) {
  if (!text) return null;
  const m = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/.exec(text);
  const raw = m ? m[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { return null; }
}

// ---------------------------------------------------------------- A2A (JSON-RPC over HTTP, data parts)
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function agentCard({ name, description, url, skill }) {
  return {
    protocolVersion: A2A_VERSION, name, description, url, version: "1.0.0",
    preferredTransport: "JSONRPC",
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"],
    securitySchemes: { firebase: { type: "http", scheme: "bearer", bearerFormat: "Firebase ID token" } },
    security: [{ firebase: [] }],
    skills: [skill],
  };
}

// Serve one agent: GET → agent card (public); POST → JSON-RPC "message/send" with a data part → handler(data, env) → data part back.
export function serveAgent(card, handler) {
  return async ({ request, env }) => {
    const url = new URL(request.url);
    if (request.method === "GET") return json(agentCard({ ...card, url: url.origin + url.pathname }));
    if (request.method !== "POST") return json({ error: "GET or POST" }, 405);
    const body = await readJson(request);
    const id = body.id ?? null;
    const fail = (code, message, status = 200) => json({ jsonrpc: "2.0", id, error: { code, message } }, status);
    const who = await checkCaller(request, env);
    if (who.error) return fail(-32001, who.error, who.status);
    if (body.jsonrpc !== "2.0" || body.method !== "message/send") return fail(-32601, "method not found");
    const msg = body.params && body.params.message;
    const data = msg && Array.isArray(msg.parts) ? (msg.parts.find((p) => p.kind === "data") || {}).data : null;
    if (!data) return fail(-32602, "expected a data part");
    try {
      const out = await handler(data, env);
      return json({
        jsonrpc: "2.0", id,
        result: { kind: "message", role: "agent", messageId: uid(), contextId: msg.contextId, parts: [{ kind: "data", data: out }] },
      });
    } catch (e) {
      return fail(-32603, String((e && e.message) || e).slice(0, 200));
    }
  };
}

// A2A client: resolve the agent card, then send one message with a data part and return the reply's data part.
export async function sendA2A(agentUrl, data, token, contextId) {
  const auth = { Authorization: `Bearer ${token}` };
  const card = await (await fetch(agentUrl, { headers: auth })).json();
  // use the card's endpoint only when it is on the same origin as the card; otherwise the card's own address
  let target = agentUrl;
  try { if (card.url && new URL(card.url).origin === new URL(agentUrl).origin) target = card.url; } catch {}
  const r = await fetch(target, {
    method: "POST", headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      jsonrpc: "2.0", id: uid(), method: "message/send",
      params: { message: { kind: "message", role: "user", messageId: uid(), contextId, parts: [{ kind: "data", data }] } },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(`${card.name || agentUrl}: ${d.error.message}`);
  const part = d.result && Array.isArray(d.result.parts) ? d.result.parts.find((p) => p.kind === "data") : null;
  if (!part) throw new Error(`${card.name || agentUrl}: no data in reply`);
  return { data: part.data, card };
}
