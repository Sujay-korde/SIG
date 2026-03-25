from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.agent import run_agent
from backend.causal_graph import build_causal_graph
from backend.inference import AUTONOMY_THRESHOLD, detect_anomalies
from backend.mock_services import ANOMALY_ONSETS, BASELINE, FAULT_SCENARIOS, SERVICE_STATE, current_fault_code, inject_fault, metrics_tick_once, reset_all, snapshot_metrics

app = FastAPI(title="SRE Whisperer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GRAPH = build_causal_graph()
sse_clients: list[asyncio.Queue[str]] = []
app_state: dict[str, Any] = {
    "latest_decision": None,
    "pending_approval": None,
    "last_event": None,
    "tick": 0,
}


async def broadcast(event: dict[str, Any]) -> None:
    app_state["last_event"] = event
    dead: list[asyncio.Queue[str]] = []
    payload = json.dumps(event)
    for queue in sse_clients:
        try:
            await queue.put(payload)
        except Exception:
            dead.append(queue)
    for queue in dead:
        with suppress(ValueError):
            sse_clients.remove(queue)


def build_dashboard_payload() -> dict[str, Any]:
    metrics = snapshot_metrics()
    anomalous = detect_anomalies(GRAPH, metrics)
    decision = app_state["latest_decision"]
    return {
        "type": "dashboard_state",
        "tick": app_state["tick"],
        "scenario": current_fault_code(),
        "metrics": metrics,
        "anomalous_nodes": anomalous,
        "anomaly_onsets": ANOMALY_ONSETS,
        "decision": decision,
        "pending_approval": app_state["pending_approval"],
        "graph": {
            "nodes": [{"id": node, **attrs} for node, attrs in GRAPH.nodes(data=True)],
            "edges": [{"source": source, "target": target, **attrs} for source, target, attrs in GRAPH.edges(data=True)],
        },
        "autonomy_threshold": AUTONOMY_THRESHOLD,
    }


async def evaluate_agent() -> dict[str, Any]:
    scenario = current_fault_code() or "steady_state"
    decision = run_agent(f"Evaluate live incident state for scenario {scenario}.")
    app_state["latest_decision"] = decision
    app_state["pending_approval"] = decision if decision.get("requires_approval") else None
    return decision


async def metrics_loop() -> None:
    while True:
        await asyncio.sleep(2)
        metrics_tick_once()
        app_state["tick"] += 1
        decision = await evaluate_agent()
        await broadcast(build_dashboard_payload())
        await broadcast({"type": "agent_decision", "decision": decision})


@app.on_event("startup")
async def on_startup() -> None:
    app.state.metrics_task = asyncio.create_task(metrics_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "metrics_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics")
async def get_metrics() -> dict[str, Any]:
    return build_dashboard_payload()


@app.post("/inject/{scenario}")
async def inject(scenario: str) -> dict[str, Any]:
    if scenario not in FAULT_SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Unknown scenario {scenario}")
    definition = inject_fault(scenario)
    for _ in definition.steps:
        metrics_tick_once()
        if detect_anomalies(GRAPH, snapshot_metrics()):
            break
    decision = await evaluate_agent()
    payload = build_dashboard_payload()
    await broadcast({"type": "fault_injected", "scenario": scenario})
    await broadcast(payload)
    return {"status": "injected", "scenario": scenario, "decision": decision}


@app.post("/reset")
async def reset() -> dict[str, Any]:
    reset_all()
    decision = await evaluate_agent()
    payload = build_dashboard_payload()
    await broadcast({"type": "reset"})
    await broadcast(payload)
    return {"status": "reset", "decision": decision}


@app.post("/approve")
async def approve() -> dict[str, Any]:
    pending = app_state.get("pending_approval")
    if not pending:
        raise HTTPException(status_code=400, detail="No pending approval request.")

    root_cause = pending.get("root_cause")
    if root_cause in SERVICE_STATE:
        baseline = BASELINE.get(root_cause, SERVICE_STATE[root_cause])
        SERVICE_STATE[root_cause] = round(max(baseline, baseline + ((SERVICE_STATE[root_cause] - baseline) * 0.35)), 1)

    if root_cause == "notif_cpu":
        SERVICE_STATE["notif_queue_depth"] = round(max(BASELINE["notif_queue_depth"], BASELINE["notif_queue_depth"] + 160), 1)

    pending["requires_approval"] = False
    pending["action"] = "approved_action"
    pending["reasoning"] = f"Operator approved mitigation for {root_cause}. Target metric is stabilizing."
    app_state["latest_decision"] = pending
    app_state["pending_approval"] = None
    await broadcast({"type": "approval_granted", "decision": pending})
    await broadcast(build_dashboard_payload())
    return {"status": "approved", "decision": pending}


@app.get("/agent")
async def get_agent_decision() -> dict[str, Any]:
    decision = await evaluate_agent()
    await broadcast({"type": "agent_decision", "decision": decision})
    return decision


@app.get("/stream")
async def stream() -> StreamingResponse:
    queue: asyncio.Queue[str] = asyncio.Queue()
    sse_clients.append(queue)

    async def generator():
        yield "retry: 1000\n\n"
        await queue.put(json.dumps(build_dashboard_payload()))
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {event}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            with suppress(ValueError):
                sse_clients.remove(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")
