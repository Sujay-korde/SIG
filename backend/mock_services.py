from __future__ import annotations

import asyncio
import random
import time
from copy import deepcopy
from dataclasses import dataclass


BASELINE = {
    "db_conn_pool": 42.0,
    "auth_cpu": 28.0,
    "auth_latency_ms": 38.0,
    "payment_latency_ms": 41.0,
    "payment_error_rate": 0.1,
    "notif_queue_depth": 118.0,
    "notif_cpu": 22.0,
}

SERVICE_STATE = dict(BASELINE)
ANOMALY_ONSETS: dict[str, float] = {}


@dataclass(frozen=True)
class ScenarioDefinition:
    code: str
    name: str
    expected_root: str
    description: str
    llm_confidence: float
    rag_similarity: float
    metric_clarity_hint: float
    steps: list[dict[str, float]]


SCENARIO_DEFINITIONS: dict[str, ScenarioDefinition] = {
    "F1": ScenarioDefinition(
        code="F1",
        name="database_pool_pressure",
        expected_root="db_conn_pool",
        description="Slow database pool exhaustion that threatens downstream payment latency.",
        llm_confidence=0.89,
        rag_similarity=0.92,
        metric_clarity_hint=0.82,
        steps=[
            {"db_conn_pool": 65.0},
            {"db_conn_pool": 79.0},
            {"db_conn_pool": 91.0},
            {"db_conn_pool": 96.0, "auth_latency_ms": 520.0},
        ],
    ),
    "F2": ScenarioDefinition(
        code="F2",
        name="auth_cpu_cascade",
        expected_root="auth_cpu",
        description="Authentication compute spike cascading into payment latency and notification pressure.",
        llm_confidence=0.88,
        rag_similarity=0.86,
        metric_clarity_hint=0.74,
        steps=[
            {"auth_cpu": 72.0},
            {"auth_cpu": 89.0, "auth_latency_ms": 320.0},
            {"auth_cpu": 94.0, "auth_latency_ms": 680.0, "payment_latency_ms": 510.0},
            {"payment_error_rate": 8.2, "notif_queue_depth": 920.0},
        ],
    ),
    "F3": ScenarioDefinition(
        code="F3",
        name="ambiguous_notif_drift",
        expected_root="notif_cpu",
        description="Notification service drift with ambiguous evidence that should require human approval.",
        llm_confidence=0.61,
        rag_similarity=0.58,
        metric_clarity_hint=0.36,
        steps=[
            {"notif_cpu": 52.0},
            {"notif_cpu": 63.0},
            {"notif_cpu": 81.0},
        ],
    ),
    "F4": ScenarioDefinition(
        code="F4",
        name="full_service_cascade",
        expected_root="db_conn_pool",
        description="Full multi-service cascade originating in shared database pressure.",
        llm_confidence=0.93,
        rag_similarity=0.94,
        metric_clarity_hint=0.96,
        steps=[
            {"db_conn_pool": 88.0, "auth_cpu": 76.0},
            {"db_conn_pool": 97.0, "auth_cpu": 93.0, "auth_latency_ms": 890.0},
            {"payment_latency_ms": 1240.0, "payment_error_rate": 14.5},
            {"notif_queue_depth": 1850.0, "notif_cpu": 88.0},
        ],
    ),
}

FAULT_SCENARIOS = {
    **SCENARIO_DEFINITIONS,
    "scenario_1": SCENARIO_DEFINITIONS["F1"],
    "scenario_2": SCENARIO_DEFINITIONS["F2"],
    "scenario_3": SCENARIO_DEFINITIONS["F3"],
    "scenario_4": SCENARIO_DEFINITIONS["F4"],
}

_fault_active: ScenarioDefinition | None = None
_fault_step = 0
_tick_count = 0


def get_scenario(name: str) -> ScenarioDefinition:
    if name not in FAULT_SCENARIOS:
        raise KeyError(f"Unknown scenario: {name}")
    return FAULT_SCENARIOS[name]


def inject_fault(scenario: str) -> ScenarioDefinition:
    global _fault_active, _fault_step
    _fault_active = get_scenario(scenario)
    _fault_step = 0
    return _fault_active


def reset_all() -> None:
    global _fault_active, _fault_step, _tick_count
    _fault_active = None
    _fault_step = 0
    _tick_count = 0
    ANOMALY_ONSETS.clear()
    SERVICE_STATE.update(BASELINE)


def current_fault_code() -> str | None:
    return _fault_active.code if _fault_active else None


def snapshot_metrics() -> dict[str, float]:
    return deepcopy(SERVICE_STATE)


def _apply_noise() -> None:
    for key, baseline in BASELINE.items():
        current = SERVICE_STATE[key]
        if _fault_active and key in _fault_active.steps[min(_fault_step, len(_fault_active.steps) - 1)]:
            continue
        drift = random.uniform(-1.5, 1.5)
        SERVICE_STATE[key] = round(max(0.0, current + ((baseline - current) * 0.08) + drift), 1)


def _record_onsets(previous: dict[str, float], now_ts: float) -> None:
    for metric, value in SERVICE_STATE.items():
        if metric not in ANOMALY_ONSETS and value > previous.get(metric, value):
            ANOMALY_ONSETS.setdefault(metric, now_ts)


def metrics_tick_once() -> dict[str, float]:
    global _fault_step, _tick_count
    _tick_count += 1
    previous = snapshot_metrics()
    _apply_noise()

    if _fault_active and _fault_step < len(_fault_active.steps):
        SERVICE_STATE.update(_fault_active.steps[_fault_step])
        _fault_step += 1

    _record_onsets(previous, time.time())
    return snapshot_metrics()


async def metrics_tick(interval_seconds: int = 2):
    while True:
        await asyncio.sleep(interval_seconds)
        yield metrics_tick_once()
