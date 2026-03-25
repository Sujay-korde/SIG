# SRE Whisperer Build Plan

## Milestone 1: Backend Skeleton & Causal Logic
- Create the exact Section 8 project structure from the blueprint.
- Implement `backend/causal_graph.py` with the directed infrastructure graph and UI metadata.
- Implement `backend/inference.py` for forward inference, backward inference, confidence scoring, anomaly detection, and counterfactual simulation.
- Add pytest coverage for graph construction and the four demo fault scenarios.

## Milestone 2: SSE Stream & Mock Services
- Implement `backend/mock_services.py` with baseline metrics, scripted fault scenarios `F1`-`F4`, manual tick helpers, and reset/injection controls.
- Implement `backend/main.py` FastAPI endpoints for `/metrics`, `/inject/{scenario}`, `/reset`, `/approve`, `/agent`, and `/stream`.
- Add background metric ticking, agent evaluation, SSE broadcasting, and keepalive/reconnect behavior.
- Add tests for route behavior and human approval gating.

## Milestone 3: Frontend Setup & Component Migration
- Set up a Next.js 14 App Router project in `frontend/` with Tailwind theme tokens matching the provided design.
- Convert the supplied Stitch HTML into reusable React components that preserve the exact layout, typography, and visual treatment.
- Implement `useSSE` to stream backend updates into dashboard state.
- Add component-level vitest coverage for deterministic UI helpers.

## Milestone 4: Integration & Event Wiring
- Bind live metrics to Recharts mini-panels and the counterfactual chart.
- Bind causal traversal and anomaly highlighting to `reactflow`.
- Wire the hidden control panel with fault shortcuts `F1`-`F5`, approval actions, and reset handling.
- Ensure low-confidence agent decisions trigger the human approval modal.

## Milestone 5: Final E2E Tests
- Run the scripted backend scenario validator for the four demo faults.
- Run pytest for backend logic and API behavior.
- Prepare frontend test commands and document any environment prerequisites.
- Finalize `README.md`, pinned dependency files, and local run instructions.
