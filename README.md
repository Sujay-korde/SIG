# SRE Whisperer

SRE Whisperer is a full-stack demo system for autonomous IT operations. A FastAPI backend simulates faults, performs causal inference with `networkx`, emits live SSE updates, and drives an SRE agent. A Next.js 14 frontend renders the war-room dashboard, live metric charts, a causal dependency graph, agent reasoning, and the human approval flow.

## Repository Layout

- `backend/` FastAPI app, causal engine, agent loop, mock services, and Chroma helpers
- `frontend/` Next.js 14 App Router dashboard and hidden control panel
- `scripts/` seeding and scenario validation scripts
- `PLANS.md` milestone plan derived from the blueprint

## Quick Start

### Backend

1. Create a virtual environment and install the backend requirements:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   ```
2. Optional LLM setup for the LangChain path:
   ```powershell
   ollama pull mistral:instruct
   ```
3. Start the backend:
   ```powershell
   uvicorn backend.main:app --reload --port 8000
   ```

### Frontend

1. Install dependencies:
   ```powershell
   Set-Location frontend
   npm.cmd install
   ```
2. Start the dashboard:
   ```powershell
   npm.cmd run dev
   ```
3. Open `http://localhost:3000`.

## Validation

### Backend tests

```powershell
python -m pytest backend/tests -q
python scripts/test_scenarios.py
```

### Frontend tests

```powershell
Set-Location frontend
npm.cmd run test
```

## Notes

- `sentence-transformers` is intentionally configured with `device='cpu'` to avoid RTX 4050 VRAM pressure and match the blueprint guidance.
- If `langchain_ollama` or Ollama is unavailable, the agent falls back to a deterministic local reasoning path so the demo remains runnable.
