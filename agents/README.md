# Umi agents (Shiomi and Nagi)

Two ADK agents served over A2A from one Cloud Run service. Design: `../docs/nagi-agent-design.md`.

| Agent | Job | A2A card |
|---|---|---|
| **Shiomi** (`umi_agents/shiomi.py`) | Judges each task: value, cost of missing it, effort, who waits, must, confidence | `/shiomi/.well-known/agent-card.json` |
| **Nagi** (`umi_agents/nagi.py`) | Plans Nagi mode: three tasks to keep afloat now, with reasons; read-only tools | `/nagi/.well-known/agent-card.json` |

`POST /plan` (`umi_agents/orchestrator.py`) is the app's entry point. It receives the app's **ShiomiReport**, sends the tasks Shiomi has not judged well to **Shiomi over A2A**, merges the answers, hands the report to **Nagi over A2A**, and returns a **NagiPlan** (`umi_agents/contract.py`). The app checks the plan again and falls back to its formula on any error.

```
browser ── /api/nagi (Vercel: sign-in + allow-list) ── POST /plan ──┬─ A2A → Shiomi
                                                                    └─ A2A → Nagi ─ tools: day budget, dive history, task, free time
```

## Run locally

```
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env      # then fill in GOOGLE_API_KEY and NAGI_SECRET
.venv\Scripts\python server.py
```

## Deploy (Cloud Run)

```
gcloud run deploy umi-agents --source . --region europe-west1 --allow-unauthenticated \
  --set-env-vars NAGI_SECRET=...,PUBLIC_URL=https://<service-url> --set-secrets GOOGLE_API_KEY=gemini-key:latest
```

Then set `NAGI_URL` (the service URL) and `NAGI_SECRET` on Vercel. Every route except `/health` and the agent cards requires the `X-Umi-Secret` header.
