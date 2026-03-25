from __future__ import annotations

from collections import defaultdict
from typing import Any

import networkx as nx

AUTONOMY_THRESHOLD = 0.80


def metric_clarity(value: float, threshold: float) -> float:
    if threshold <= 0:
        return 0.0
    return max(0.0, min(1.0, (value - threshold) / threshold))


def detect_anomalies(graph: nx.DiGraph, metrics: dict[str, float]) -> list[str]:
    anomalous = []
    for node, attrs in graph.nodes(data=True):
        if metrics.get(node, 0.0) >= attrs["threshold"]:
            anomalous.append(node)
    return anomalous


def forward_inference(
    graph: nx.DiGraph,
    root_node: str,
    current_metrics: dict[str, float],
    max_depth: int = 4,
) -> list[dict[str, Any]]:
    aggregated: dict[str, dict[str, Any]] = {}

    for target in graph.nodes:
        if target == root_node:
            continue
        for path in nx.all_simple_paths(graph, root_node, target, cutoff=max_depth):
            if len(path) < 2:
                continue
            cumulative_delay = 0
            cumulative_prob = 1.0
            traversed_edges = []
            for index in range(len(path) - 1):
                edge = graph.edges[path[index], path[index + 1]]
                traversed_edges.append(
                    {"source": path[index], "target": path[index + 1], "delay": edge["delay"], "weight": edge["weight"]}
                )
                cumulative_delay += edge["delay"]
                cumulative_prob *= edge["weight"]

            existing = aggregated.get(target)
            candidate = {
                "node": target,
                "service": graph.nodes[target]["service"],
                "eta_seconds": cumulative_delay,
                "probability": round(cumulative_prob, 3),
                "current_value": current_metrics.get(target, 0.0),
                "threshold": graph.nodes[target]["threshold"],
                "path": path,
                "traversed_edges": traversed_edges,
            }
            if existing is None or candidate["eta_seconds"] < existing["eta_seconds"]:
                aggregated[target] = candidate

    return sorted(aggregated.values(), key=lambda item: (item["eta_seconds"], -item["probability"]))


def backward_inference(
    graph: nx.DiGraph,
    anomalous_nodes: list[str],
    anomaly_onsets: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    anomaly_onsets = anomaly_onsets or {}
    if not anomalous_nodes:
        return []

    earliest_onset = min((anomaly_onsets.get(node, float("inf")) for node in anomalous_nodes), default=float("inf"))
    candidates: list[dict[str, Any]] = []

    for node in graph.nodes():
        reachable = nx.descendants(graph, node) | {node}
        explained = [anomaly for anomaly in anomalous_nodes if anomaly in reachable]
        if not explained:
            continue

        coverage = len(explained) / max(len(anomalous_nodes), 1)
        path_scores = []
        best_path = None
        best_path_len = None

        for anomaly in explained:
            try:
                path = nx.shortest_path(graph, node, anomaly)
            except nx.NetworkXNoPath:
                continue

            weights = [graph.edges[path[i], path[i + 1]]["weight"] for i in range(len(path) - 1)]
            score = sum(weights) / len(weights) if weights else 1.0
            path_scores.append(score)

            if best_path is None or len(path) < best_path_len:
                best_path = path
                best_path_len = len(path)

        avg_weight = sum(path_scores) / max(len(path_scores), 1)
        confidence = coverage * avg_weight

        if graph.in_degree(node) == 0:
            confidence *= 1.2

        if anomaly_onsets:
            node_onset = anomaly_onsets.get(node)
            if node_onset is not None and node_onset <= earliest_onset:
                confidence *= 1.3

        candidates.append(
            {
                "node": node,
                "service": graph.nodes[node]["service"],
                "confidence": round(min(confidence, 0.999), 3),
                "explains_count": len(explained),
                "explains": explained,
                "path": best_path or [node],
                "is_root": graph.in_degree(node) == 0,
            }
        )

    return sorted(candidates, key=lambda item: (-item["confidence"], -item["explains_count"], len(item["path"])))


def compute_confidence(rag_similarity: float, metric_signal: float, llm_confidence: float) -> float:
    llm_confidence = max(0.50, min(0.95, llm_confidence))
    score = (0.40 * rag_similarity) + (0.40 * metric_signal) + (0.20 * llm_confidence)
    return round(score, 3)


def simulate_counterfactual(
    graph: nx.DiGraph,
    metrics: dict[str, float],
    root_node: str,
    steps: int = 12,
    step_seconds: int = 2,
) -> list[dict[str, float]]:
    active = defaultdict(float)
    active[root_node] = max(metrics.get(root_node, 0.0), graph.nodes[root_node]["threshold"])
    series = []

    for tick in range(steps):
        next_active = defaultdict(float)
        aggregate_health = 100.0

        for node, value in active.items():
            attrs = graph.nodes[node]
            threshold = attrs["threshold"]
            capped = min(value, threshold * 1.5)
            overshoot = max(0.0, capped - threshold)
            aggregate_health -= min(overshoot / max(threshold, 1.0) * 18.0, 22.0)

            for _, target, edge in graph.out_edges(node, data=True):
                if tick * step_seconds >= edge["delay"]:
                    propagated = capped * edge["weight"] * 0.95
                    next_active[target] = max(next_active[target], propagated)

        series.append(
            {
                "t": tick * step_seconds,
                "actual": max(45.0, 95.0 - (tick * 1.1)),
                "projected": round(max(5.0, aggregate_health), 2),
            }
        )

        for node, value in active.items():
            next_active[node] = max(next_active[node], value * 0.97)
        active = next_active

    return series
