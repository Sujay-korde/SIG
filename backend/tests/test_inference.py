from backend.agent import sanitize_json_output
from backend.causal_graph import build_causal_graph
from backend.inference import AUTONOMY_THRESHOLD, backward_inference, compute_confidence, detect_anomalies, forward_inference
from backend.mock_services import BASELINE, SCENARIO_DEFINITIONS


def test_forward_inference_from_db_pool_reaches_payment_latency():
    graph = build_causal_graph()
    predictions = forward_inference(graph, "db_conn_pool", BASELINE)
    nodes = [item["node"] for item in predictions]
    assert "payment_latency_ms" in nodes
    assert predictions[0]["eta_seconds"] <= predictions[-1]["eta_seconds"]


def test_sanitize_json_output_strips_prose_wrappers():
    payload = sanitize_json_output("Agent reply ```json\n{\"action\":\"observe\",\"confidence\":0.7}\n``` trailing")
    assert payload["action"] == "observe"
    assert payload["confidence"] == 0.7


def test_confidence_below_threshold_requires_human_gate():
    score = compute_confidence(0.58, 0.02, 0.61)
    assert score < AUTONOMY_THRESHOLD


def test_backward_inference_identifies_expected_root_across_faults():
    graph = build_causal_graph()
    cases = {
        "F1": {"db_conn_pool": 96.0, "auth_latency_ms": 520.0},
        "F2": {"auth_cpu": 94.0, "auth_latency_ms": 680.0, "payment_latency_ms": 510.0, "payment_error_rate": 8.2, "notif_queue_depth": 920.0},
        "F3": {"notif_cpu": 81.0},
        "F4": {"db_conn_pool": 97.0, "auth_cpu": 93.0, "auth_latency_ms": 890.0, "payment_latency_ms": 1240.0, "payment_error_rate": 14.5, "notif_queue_depth": 1850.0, "notif_cpu": 88.0},
    }
    onsets = {
        "db_conn_pool": 1.0,
        "auth_cpu": 2.0,
        "auth_latency_ms": 3.0,
        "payment_latency_ms": 4.0,
        "payment_error_rate": 5.0,
        "notif_queue_depth": 6.0,
        "notif_cpu": 1.0,
    }
    for code, metrics in cases.items():
        anomalous = detect_anomalies(graph, metrics)
        ranked = backward_inference(graph, anomalous, onsets)
        assert ranked[0]["node"] == SCENARIO_DEFINITIONS[code].expected_root
