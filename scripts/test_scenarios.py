from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.agent import run_agent
from backend.causal_graph import build_causal_graph
from backend.inference import backward_inference, detect_anomalies
from backend.mock_services import ANOMALY_ONSETS, SCENARIO_DEFINITIONS, inject_fault, metrics_tick_once, reset_all, snapshot_metrics


def run_fault(code: str) -> tuple[str, dict]:
    graph = build_causal_graph()
    reset_all()
    inject_fault(code)
    scenario = SCENARIO_DEFINITIONS[code]

    for _ in scenario.steps:
        metrics_tick_once()

    metrics = snapshot_metrics()
    anomalous = detect_anomalies(graph, metrics)
    ranked = backward_inference(graph, anomalous, ANOMALY_ONSETS)
    decision = run_agent(f"Validate fault scenario {code}")
    return ranked[0]["node"], decision


def main() -> None:
    failures = []
    for code, scenario in SCENARIO_DEFINITIONS.items():
        root, decision = run_fault(code)
        print(f"{code}: predicted={root} expected={scenario.expected_root} confidence={decision['confidence']}")
        if root != scenario.expected_root:
            failures.append(code)

    if failures:
        raise SystemExit(f"Scenario validation failed: {', '.join(failures)}")

    print("All demo scenarios passed.")


if __name__ == "__main__":
    main()
