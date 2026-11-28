// Talking to Shiomi, which runs on Cloud Run (Python + Google ADK), over A2A 1.0 with the official JS SDK.
// Nagi's ask_shiomi tool is the only caller. The user's Firebase ID token rides along; Shiomi checks it and
// forwards it to /api/memory, so Shiomi reads only this user's memory.
import { ClientFactory } from "@a2a-js/sdk/client";
import { Role, TaskState } from "@a2a-js/sdk";
import { extractJson, uid } from "./agents.js";

const A2UI_MIME = "application/json+a2ui";
let cached = null; // { url, at, client }: the agent card is read once per isolate and kept for 10 minutes

async function client(url) {
  if (!cached || cached.url !== url || Date.now() - cached.at > 10 * 60e3) {
    cached = { url, at: Date.now(), client: await new ClientFactory().createFromUrl(url) };
  }
  return cached.client;
}

const STATE = { [TaskState.TASK_STATE_COMPLETED]: "completed", [TaskState.TASK_STATE_INPUT_REQUIRED]: "input-required",
  [TaskState.TASK_STATE_FAILED]: "failed", [TaskState.TASK_STATE_REJECTED]: "rejected", [TaskState.TASK_STATE_CANCELED]: "canceled",
  [TaskState.TASK_STATE_WORKING]: "working" };

const dataOf = (p) => (p && p.content && p.content.$case === "data" ? p.content.value : null);
const textOf = (p) => (p && p.content && p.content.$case === "text" ? p.content.value : "");

// What a Shiomi task says: its state; the judgments (completed); or the paused ask_user call and its A2UI card.
function read(task) {
  const state = STATE[task.status && task.status.state] || "unknown";
  const statusParts = (task.status && task.status.message && task.status.message.parts) || [];
  const tools = [];
  for (const m of task.history || []) for (const p of m.parts || []) {
    const d = dataOf(p);
    if (d && d.name && d.args && p.metadata && p.metadata.adk_type === "function_call") tools.push(d.name);
  }
  const out = { state, taskId: task.id, contextId: task.contextId, tools };
  const uniq = () => { out.tools = [...new Set(tools)]; };
  if (state === "input-required") {
    const call = statusParts.map(dataOf).find((d) => d && d.name === "ask_user" && d.args);
    out.ask = call ? { callId: call.id, args: call.args, a2ui: statusParts.filter((p) => p.metadata && p.metadata.mimeType === A2UI_MIME).map(dataOf) } : null;
    if (call) tools.push("ask_user");
  } else {
    const text = [...(task.artifacts || []).flatMap((a) => a.parts || []), ...statusParts].map(textOf).join("");
    out.results = ((extractJson(text) || {}).results || []).filter((r) => r && r.id);
    if (state !== "completed" && !out.results.length) out.error = text.slice(0, 200) || state;
  }
  uniq();
  return out;
}

// New question: { text }.  Answer to Shiomi's question: { taskId, contextId, callId, answer }.
export async function askShiomi(env, token, { text, taskId, contextId, callId, answer, timeoutMs = 45000 }) {
  if (!env.SHIOMI_URL) throw new Error("SHIOMI_URL not set");
  const c = await client(env.SHIOMI_URL);
  const parts = text != null
    ? [{ content: { $case: "text", value: text }, metadata: undefined }]
    : [{ content: { $case: "data", value: { id: callId, name: "ask_user", response: answer } }, metadata: { adk_type: "function_response" } }];
  const res = await c.sendMessage({
    tenant: "", configuration: undefined, metadata: undefined,
    message: { messageId: uid(), contextId: contextId || "", taskId: taskId || "", role: Role.ROLE_USER, parts, metadata: undefined, extensions: [], referenceTaskIds: [] },
  }, { serviceParameters: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res || !res.status) throw new Error("Shiomi answered with a message, not a task");
  return read(res);
}
