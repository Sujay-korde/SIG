from __future__ import annotations

import networkx as nx


def build_causal_graph() -> nx.DiGraph:
    """Build the directed dependency graph used by the demo."""
    graph = nx.DiGraph()

    nodes = [
        (
            "db_conn_pool",
            {
                "service": "service_a",
                "label": "DB_CONN_POOL",
                "threshold": 80.0,
                "unit": "%",
                "position": {"x": 90, "y": 190},
                "dashboard_group": "database",
            },
        ),
        (
            "auth_cpu",
            {
                "service": "service_a",
                "label": "AUTH_CPU",
                "threshold": 85.0,
                "unit": "%",
                "position": {"x": 90, "y": 90},
                "dashboard_group": "auth",
            },
        ),
        (
            "auth_latency_ms",
            {
                "service": "service_a",
                "label": "AUTH_LATENCY",
                "threshold": 500.0,
                "unit": "ms",
                "position": {"x": 340, "y": 90},
                "dashboard_group": "auth",
            },
        ),
        (
            "payment_latency_ms",
            {
                "service": "service_b",
                "label": "PAYMENT_LATENCY",
                "threshold": 400.0,
                "unit": "ms",
                "position": {"x": 340, "y": 230},
                "dashboard_group": "payment",
            },
        ),
        (
            "payment_error_rate",
            {
                "service": "service_b",
                "label": "PAYMENT_ERRORS",
                "threshold": 5.0,
                "unit": "%",
                "position": {"x": 600, "y": 190},
                "dashboard_group": "payment",
            },
        ),
        (
            "notif_queue_depth",
            {
                "service": "service_c",
                "label": "NOTIF_QUEUE",
                "threshold": 800.0,
                "unit": "items",
                "position": {"x": 600, "y": 300},
                "dashboard_group": "notification",
            },
        ),
        (
            "notif_cpu",
            {
                "service": "service_c",
                "label": "NOTIF_CPU",
                "threshold": 80.0,
                "unit": "%",
                "position": {"x": 600, "y": 70},
                "dashboard_group": "notification",
            },
        ),
    ]
    graph.add_nodes_from(nodes)

    edges = [
        ("db_conn_pool", "auth_latency_ms", 15, 0.85),
        ("db_conn_pool", "payment_latency_ms", 22, 0.70),
        ("auth_cpu", "auth_latency_ms", 8, 0.90),
        ("auth_latency_ms", "payment_latency_ms", 12, 0.75),
        ("payment_latency_ms", "payment_error_rate", 18, 0.80),
        ("payment_error_rate", "notif_queue_depth", 25, 0.60),
        ("auth_cpu", "notif_cpu", 30, 0.50),
    ]

    for source, target, delay, weight in edges:
        graph.add_edge(
            source,
            target,
            delay=delay,
            weight=weight,
            label=f"{delay}s / {weight:.2f}",
        )

    return graph
