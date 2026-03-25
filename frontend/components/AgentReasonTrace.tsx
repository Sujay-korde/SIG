"use client";

import type { AgentDecision } from "../lib/dashboard";

const defaultFeed = [
  {
    title: "[ACTION] ANALYZE_LATENCY",
    timestamp: "14:02:11",
    target: "pay-gateway-svc",
    body: "P99 latency spiking to 450ms. Tracing dependencies... Found Auth DB lock contention.",
    accent: "border-primary text-primary",
    footer: "CONFIDENCE: 94.2%"
  },
  {
    title: "[ACTION] AUTO_RECOVERY",
    timestamp: "14:03:05",
    target: "auth-db-replica-01",
    body: "Flushing idle connection pool. Re-balancing node-04 traffic.",
    accent: "border-secondary text-secondary",
    footer: "OUTCOME: SUCCESS"
  },
  {
    title: "[ACTION] ESCALATION_REQ",
    timestamp: "14:05:22",
    target: "human-operator",
    body: "Anomaly detected in encrypted payload header. Logic threshold < 80%. Awaiting approval.",
    accent: "border-tertiary text-tertiary",
    footer: "CONFIDENCE: 72.1%"
  }
];

export function AgentReasonTrace({ decision }: { decision: AgentDecision | null }) {
  const feed = decision
    ? [
        {
          title: `[ACTION] ${decision.action.toUpperCase()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          target: decision.target,
          body: decision.reasoning,
          accent: decision.requires_approval ? "border-tertiary text-tertiary" : "border-primary text-primary",
          footer: `CONFIDENCE: ${(decision.confidence * 100).toFixed(1)}%`
        },
        ...defaultFeed.slice(0, 2)
      ]
    : defaultFeed;

  return (
    <section className="col-span-12 flex h-[500px] flex-col bg-surface-container lg:col-span-4">
      <div className="border-b border-outline-variant/10 p-4">
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">AGENT_LOGIC_FEED</h3>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 font-mono text-[11px]">
        {feed.map((item) => (
          <div key={`${item.title}-${item.timestamp}`} className={`border-l-2 bg-surface-container-low p-3 ${item.accent}`}>
            <div className="mb-1 flex justify-between">
              <span>{item.title}</span>
              <span className="text-zinc-600">{item.timestamp}</span>
            </div>
            <p className="mb-2 text-zinc-400">TARGET: {item.target}</p>
            <div className="bg-surface-container-highest p-2 text-zinc-300">{item.body}</div>
            <div className="mt-2 font-bold">{item.footer}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
