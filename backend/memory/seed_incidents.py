from __future__ import annotations


def synthetic_incidents() -> list[dict[str, str]]:
    base = [
        {
            "id": "incident-db-leak-01",
            "scenario": "F1",
            "summary": "Database pool saturation increased auth latency and threatened payment latency.",
            "root_cause": "db_conn_pool",
        },
        {
            "id": "incident-auth-cpu-01",
            "scenario": "F2",
            "summary": "Authentication CPU contention cascaded into payment errors and notification backlog.",
            "root_cause": "auth_cpu",
        },
        {
            "id": "incident-notif-drift-01",
            "scenario": "F3",
            "summary": "Notification CPU drift remained ambiguous and required operator approval.",
            "root_cause": "notif_cpu",
        },
        {
            "id": "incident-full-cascade-01",
            "scenario": "F4",
            "summary": "Multi-service failure traced back to a shared database connection bottleneck.",
            "root_cause": "db_conn_pool",
        },
    ]
    incidents = []
    for index in range(5):
        for item in base:
            incidents.append(
                {
                    **item,
                    "id": f"{item['id']}-{index + 1}",
                    "summary": f"{item['summary']} Historical replay batch {index + 1}.",
                }
            )
    return incidents[:20]
