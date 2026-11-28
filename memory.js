// Shiomi's memory, from the app's side: tells /api/memory (Cloudflare D1) when you correct one of Shiomi's
// values by hand, and how long a Dive really took. Shiomi reads these back through its own tools.
// Fire and forget: signed out or offline, nothing is sent and nothing breaks.
import * as St from './store.js?v=50';
import { Cloud } from './cloud.js?v=50';

const FIELD = { i: 'impact', p: 'penalty', e: 'effort', d: 'dependency', must: 'must' };

async function post(path, body) {
  try {
    const token = await Cloud.token();
    if (!token) return;
    await fetch(`/api/memory/${path}`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } catch (_) { /* memory is a nice-to-have */ }
}

// Call before you change a task's values; call the returned function after. It sends one row per value that moved.
export function watchEdit(t, areaName = '') {
  const before = St.values(t, areaName);
  return () => {
    const after = St.values(t, areaName);
    const ai = t.ai && t.ai.title === t.title ? t.ai : null;
    for (const k of Object.keys(FIELD)) {
      if (after[k].src !== 'you' || after[k].v === before[k].v) continue;
      const shiomi = k === 'must' ? (ai && typeof ai.m === 'boolean' ? ai.m : before.must.v) : (ai && ai[k] != null ? ai[k] : before[k].v);
      post('corrections', { task_id: t.id, title: t.title, field: FIELD[k], shiomi: String(shiomi), user: String(after[k].v) });
    }
  };
}

// A Dive ended after `min` minutes on task t.
export function noteDive(t, min, budget, areaName = '') {
  const c = St.compute(t, budget, areaName);
  post('actuals', {
    task_id: t.id, title: t.title,
    shiomi_effort: c.src.e === 'ai' ? c.E : null,
    est_min: Math.round(c.hours * 60), actual_min: min
  });
}
