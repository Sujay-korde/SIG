from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_metrics_endpoint_returns_dashboard_payload():
    response = client.get("/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert "metrics" in payload
    assert "graph" in payload


def test_low_confidence_scenario_creates_pending_approval():
    response = client.post("/inject/F3")
    assert response.status_code == 200
    metrics = client.get("/metrics").json()
    assert metrics["pending_approval"] is not None
    assert metrics["pending_approval"]["confidence"] < 0.8


def test_approve_endpoint_resolves_pending_request():
    client.post("/inject/F3")
    response = client.post("/approve")
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"]["requires_approval"] is False
