export type MetricSeries = { t: number; actual: number; projected: number };

export type DashboardSnapshot = {
  tick: number;
  scenario: string | null;
  metrics: Record<string, number>;
  anomalous_nodes: string[];
  pending_approval: AgentDecision | null;
  decision: AgentDecision | null;
  graph: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
};

export type AgentDecision = {
  action: string;
  target: string;
  confidence: number;
  reasoning: string;
  requires_approval: boolean;
  root_cause?: string;
  predictions?: Array<Record<string, unknown>>;
  counterfactual?: MetricSeries[];
};

export const defaultSnapshot: DashboardSnapshot = {
  tick: 0,
  scenario: null,
  metrics: {
    db_conn_pool: 82,
    auth_cpu: 14.2,
    auth_latency_ms: 38,
    payment_latency_ms: 422,
    payment_error_rate: 1.2,
    notif_queue_depth: 1200,
    notif_cpu: 22
  },
  anomalous_nodes: ["payment_latency_ms"],
  pending_approval: {
    action: "request_approval",
    target: "service_b",
    confidence: 0.721,
    reasoning: "Agent suggests rerouting 30% of traffic to EDGE_CDN_02 due to local ISP failure.",
    requires_approval: true,
    root_cause: "payment_latency_ms",
    counterfactual: [
      { t: 0, actual: 94, projected: 94 },
      { t: 2, actual: 93, projected: 90 },
      { t: 4, actual: 92, projected: 84 },
      { t: 6, actual: 91, projected: 76 }
    ]
  },
  decision: null,
  graph: { nodes: [], edges: [] }
};

export function shouldShowApprovalModal(snapshot: DashboardSnapshot) {
  return Boolean(snapshot.pending_approval && snapshot.pending_approval.confidence < 0.8);
}

export function formatMetric(metric: string, value: number) {
  if (metric.includes("latency")) {
    return `${Math.round(value)}ms`;
  }
  if (metric.includes("rate") || metric.includes("cpu") || metric.includes("pool")) {
    return `${value}%`;
  }
  if (metric.includes("queue")) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
  }
  return `${value}`;
}
