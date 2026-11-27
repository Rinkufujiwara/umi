// Nagi — the planner, as an A2A agent.
//   GET  /api/agents/nagi → agent card
//   POST /api/agents/nagi → JSON-RPC "message/send", data: a ShiomiReport (docs/nagi-agent-design.md §4)
//                            reply data: { plan: NagiPlan, tools: [names of the tools it called], model }
// Nagi calls read-only tools (Gemini function calling) and only proposes; the app checks the plan.
const { serveAgent, gemini, extractJson } = require("../_lib/agents.js");

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

async function plan(report) {
  if (!report || !Array.isArray(report.tasks)) throw new Error("expected a ShiomiReport");
  report.tasks = report.tasks.slice(0, 40);
  const contents = [{ role: "user", parts: [{ text: JSON.stringify(report) }] }];
  const tools = [];
  for (let round = 0; round < 6; round++) {
    const { parts, model } = await gemini({ systemInstruction: { parts: [{ text: INSTRUCTION }] }, contents, tools: TOOLS, generationConfig: { temperature: 0.3 } });
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length) {
      contents.push({ role: "model", parts });
      contents.push({ role: "user", parts: calls.map((c) => {
        tools.push(c.functionCall.name);
        return { functionResponse: { name: c.functionCall.name, response: runTool(c.functionCall.name, c.functionCall.args, report) } };
      }) });
      continue;
    }
    const p = extractJson(parts.map((x) => x.text || "").join(""));
    if (!p) throw new Error("no plan in the answer");
    return { plan: { version: 1, ...p }, tools, model };
  }
  throw new Error("too many tool rounds");
}

module.exports = serveAgent({
  name: "nagi",
  description: "Plans Umi's Nagi mode: picks the three tasks to keep afloat now, with reasons, from Shiomi's report.",
  skill: { id: "plan-nagi", name: "Plan Nagi mode", description: "From a ShiomiReport, chooses up to three tasks to keep, with reasons and optional suggestions.", tags: ["planning", "focus"] },
}, plan);
