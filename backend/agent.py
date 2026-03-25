from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Any

from backend.causal_graph import build_causal_graph
from backend.inference import (
    AUTONOMY_THRESHOLD,
    backward_inference,
    compute_confidence,
    detect_anomalies,
    forward_inference,
    metric_clarity,
    simulate_counterfactual,
)
from backend.memory.chroma_client import ChromaIncidentStore
from backend.mock_services import ANOMALY_ONSETS, SERVICE_STATE, current_fault_code, get_scenario

AgentExecutor = None
create_react_agent = None
PromptTemplate = None
ChatOllama = None

if os.getenv("SRE_ENABLE_LANGCHAIN", "0") == "1":  # pragma: no cover
    try:
        from langchain.agents import AgentExecutor, create_react_agent
        from langchain.prompts import PromptTemplate
        from langchain.tools import tool
        from langchain_ollama import ChatOllama
    except Exception:
        AgentExecutor = None
        create_react_agent = None
        PromptTemplate = None
        ChatOllama = None

if PromptTemplate is None:
    def tool(func):
        return func


GRAPH = build_causal_graph()
MEMORY = ChromaIncidentStore()
MEMORY.seed()

SYSTEM_PROMPT = """You are an autonomous SRE agent.
Observe metrics, infer root cause, predict cascades, and return ONLY valid JSON.
Output schema:
{"action": str, "target": str, "confidence": number, "reasoning": str, "predictions": [], "requires_approval": bool}
Never use markdown fences or prose outside the JSON object.
"""


def sanitize_json_output(output: str) -> dict[str, Any]:
    if isinstance(output, dict):
        return output
    match = re.search(r"\{.*\}", output, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in agent output.")
    return json.loads(match.group(0))


@tool
@lru_cache(maxsize=8)
def get_metrics(_: str = "all") -> str:
    """Get current metrics for all services."""
    return json.dumps(SERVICE_STATE)


@tool
def causal_forward(root_node: str) -> str:
    """Predict downstream impacts from an anomalous root node."""
    return json.dumps(forward_inference(GRAPH, root_node, SERVICE_STATE))


@tool
def causal_backward(anomalous_csv: str) -> str:
    """Find likely root causes from a comma-separated list of anomalous nodes."""
    nodes = [part.strip() for part in anomalous_csv.split(",") if part.strip()]
    return json.dumps(backward_inference(GRAPH, nodes, ANOMALY_ONSETS)[:3])


@tool
def restart_service(service: str) -> str:
    """Simulate restarting a service."""
    return json.dumps({"status": "restarted", "service": service, "latency_ms": 3200})


@tool
def scale_service(service: str, factor: float = 1.2) -> str:
    """Simulate scaling service resources."""
    return json.dumps({"status": "scaled", "service": service, "factor": factor})


def _build_langchain_executor():
    if not (AgentExecutor and create_react_agent and PromptTemplate and ChatOllama):
        return None

    llm = ChatOllama(model="mistral:instruct", temperature=0.1, format="json", num_predict=128)
    prompt = PromptTemplate.from_template(
        "System: " + SYSTEM_PROMPT + "\n\nTools: {tools}\nTool names: {tool_names}\nScratchpad: {agent_scratchpad}\nQuestion: {input}"
    )
    tools = [get_metrics, causal_forward, causal_backward, restart_service, scale_service]
    agent = create_react_agent(llm, tools, prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools,
        max_iterations=5,
        max_execution_time=15,
        handle_parsing_errors=True,
        verbose=False,
    )


EXECUTOR = _build_langchain_executor()


def _deterministic_agent(query: str) -> dict[str, Any]:
    anomalous = detect_anomalies(GRAPH, SERVICE_STATE)
    if not anomalous:
        return {
            "action": "observe",
            "target": "system",
            "confidence": 0.95,
            "reasoning": "No anomalies detected; system remains healthy.",
            "predictions": [],
            "requires_approval": False,
            "counterfactual": [],
            "rag_matches": [],
        }

    root_candidates = backward_inference(GRAPH, anomalous, ANOMALY_ONSETS)
    root = root_candidates[0]
    root_metric = root["node"]
    predicted = forward_inference(GRAPH, root_metric, SERVICE_STATE)
    rag_matches = MEMORY.query(query or ",".join(anomalous))

    scenario_code = current_fault_code()
    scenario = get_scenario(scenario_code) if scenario_code else None
    rag_similarity = scenario.rag_similarity if scenario else max(0.0, min(1.0, 1.0 - rag_matches[0]["distance"])) if rag_matches else 0.0
    llm_signal = scenario.llm_confidence if scenario else 0.82
    metric_signal = scenario.metric_clarity_hint if scenario else metric_clarity(SERVICE_STATE[root_metric], GRAPH.nodes[root_metric]["threshold"])
    confidence = compute_confidence(rag_similarity, metric_signal, llm_signal)
    requires_approval = confidence < AUTONOMY_THRESHOLD
    action = "request_approval" if requires_approval else "scale_service"
    target = GRAPH.nodes[root_metric]["service"]

    return {
        "action": action,
        "target": target,
        "confidence": confidence,
        "reasoning": f"Root cause {root_metric} explains {root['explains_count']} anomalies via {root['path']}.",
        "predictions": predicted,
        "requires_approval": requires_approval,
        "root_cause": root_metric,
        "anomalous_nodes": anomalous,
        "counterfactual": simulate_counterfactual(GRAPH, SERVICE_STATE, root_metric),
        "rag_matches": rag_matches,
    }


def run_agent(query: str) -> dict[str, Any]:
    if EXECUTOR is None:
        return _deterministic_agent(query)

    try:  # pragma: no cover
        result = EXECUTOR.invoke({"input": query})
        payload = sanitize_json_output(result["output"])
        payload.setdefault("requires_approval", payload.get("confidence", 0.0) < AUTONOMY_THRESHOLD)
        return payload
    except Exception:
        return _deterministic_agent(query)
