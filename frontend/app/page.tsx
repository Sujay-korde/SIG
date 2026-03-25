"use client";

import { useCallback, useMemo, useState } from "react";

import { AgentReasonTrace } from "../components/AgentReasonTrace";
import { CausalGraph } from "../components/CausalGraph";
import { CounterfactualPanel } from "../components/CounterfactualPanel";
import { HumanApprovalModal } from "../components/HumanApprovalModal";
import { IncidentTimeline } from "../components/IncidentTimeline";
import { MetricChart } from "../components/MetricChart";
import { useSSE } from "../hooks/useSSE";
import { defaultSnapshot, formatMetric, shouldShowApprovalModal, type DashboardSnapshot } from "../lib/dashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function Page() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(defaultSnapshot);

  const handleEvent = useCallback((event: DashboardSnapshot | { type?: string; decision?: DashboardSnapshot["decision"] }) => {
    if ("metrics" in event) {
      setSnapshot(event);
      return;
    }

    if (event.type === "agent_decision" && event.decision) {
      setSnapshot((current) => ({ ...current, decision: event.decision }));
    }
  }, []);

  const { status } = useSSE(`${API_BASE}/stream`, handleEvent);

  const metricCards = useMemo(
    () => [
      { key: "db_conn_pool", label: "DB_CONN_POOL", icon: "database", color: "text-primary", bars: [40, 60, 55, 80, 82, 85] },
      { key: "auth_cpu", label: "AUTH_CPU_LOAD", icon: "memory", color: "text-secondary", bars: [10, 12, 15, 18, 12, 14] },
      { key: "payment_latency_ms", label: "PAYMENT_LATENCY", icon: "timer", color: "text-tertiary", bars: [20, 40, 90, 85, 60, 75] },
      { key: "notif_queue_depth", label: "NOTIF_QUEUE", icon: "stacks", color: "text-zinc-300", bars: [30, 35, 40, 45, 50, 55] }
    ],
    []
  );

  const approvalDecision = snapshot.pending_approval;
  const counterfactual = snapshot.decision?.counterfactual ?? approvalDecision?.counterfactual ?? defaultSnapshot.pending_approval?.counterfactual ?? [];

  async function approveAction() {
    await fetch(`${API_BASE}/approve`, { method: "POST" });
    const response = await fetch(`${API_BASE}/metrics`);
    const payload = (await response.json()) as DashboardSnapshot;
    setSnapshot(payload);
  }

  return (
    <div className="overflow-hidden bg-surface text-on-surface font-body">
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-[#0e0e0e] px-6 shadow-[0_0_20px_rgba(58,223,250,0.06)]">
        <div className="flex items-center gap-6">
          <span className="font-headline text-xl font-bold tracking-tighter text-cyan-400">SRE WHISPERER: AUTONOMOUS IT ENGINE</span>
          <div className="ml-8 hidden items-center gap-4 md:flex">
            <div className="flex items-center gap-2 border-b-2 border-secondary bg-secondary/10 px-3 py-1">
              <span className="glow-secondary h-2 w-2 rounded-full bg-secondary" />
              <span className="font-headline text-[10px] font-bold uppercase tracking-wider text-secondary">SYSTEM_HEALTH_STABLE</span>
            </div>
            <div className="sse-pulse flex items-center gap-2 bg-primary/5 px-3 py-1">
              <span className="material-symbols-outlined text-sm text-primary">podcasts</span>
              <span className="font-headline text-[10px] font-bold uppercase tracking-wider text-primary">
                {status === "connected" ? "SSE_ACTIVE" : "SSE_RECONNECTING"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-zinc-500 transition-colors hover:text-cyan-300">sensors</button>
          <button className="material-symbols-outlined text-zinc-500 transition-colors hover:text-cyan-300">memory</button>
          <button className="material-symbols-outlined text-zinc-500 transition-colors hover:text-cyan-300">account_tree</button>
        </div>
      </header>

      <aside className="fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] w-64 flex-col bg-[#1a1919] pt-4">
        <div className="mb-6 px-6">
          <h2 className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">AGENT REASONING</h2>
          <p className="font-mono text-[10px] text-zinc-500">LOGIC_TRACE_ACTIVE</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          <a className="flex items-center gap-3 border-l-4 border-cyan-400 bg-[#262626] px-4 py-3 font-mono text-xs uppercase text-cyan-400 transition-all" href="#">
            <span className="material-symbols-outlined text-sm">terminal</span>
            Logic Trace
          </a>
          <a className="flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase text-zinc-500 transition-all hover:bg-[#201f1f] hover:text-cyan-200" href="#">
            <span className="material-symbols-outlined text-sm">hub</span>
            Neural Map
          </a>
          <a className="flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase text-zinc-500 transition-all hover:bg-[#201f1f] hover:text-cyan-200" href="#">
            <span className="material-symbols-outlined text-sm">insights</span>
            Metric Streams
          </a>
          <a className="flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase text-zinc-500 transition-all hover:bg-[#201f1f] hover:text-cyan-200" href="#">
            <span className="material-symbols-outlined text-sm">history</span>
            History
          </a>
          <a className="flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase text-zinc-500 transition-all hover:bg-[#201f1f] hover:text-cyan-200" href="#">
            <span className="material-symbols-outlined text-sm">settings</span>
            Settings
          </a>
        </nav>
        <div className="mt-auto bg-[#201f1f] p-4">
          <button className="w-full bg-gradient-to-br from-primary to-primary-container py-3 font-headline text-[10px] font-bold uppercase tracking-widest text-on-primary transition-all hover:brightness-110">
            REQUEST_INTERVENTION
          </button>
        </div>
      </aside>

      <main className="ml-64 mt-16 grid h-[calc(100vh-64px)] grid-cols-12 gap-6 overflow-y-auto p-6 pb-20">
        <CausalGraph graph={snapshot.graph} anomalousNodes={snapshot.anomalous_nodes} />
        <AgentReasonTrace decision={snapshot.decision} />

        <section className="col-span-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric) => (
            <MetricChart
              key={metric.key}
              label={metric.label}
              value={formatMetric(metric.key, snapshot.metrics[metric.key] ?? 0)}
              icon={metric.icon}
              colorClass={metric.color}
              bars={metric.bars}
            />
          ))}
        </section>

        <CounterfactualPanel data={counterfactual} />
        <IncidentTimeline />
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex h-12 w-full items-center justify-around border-t border-[#494847]/15 bg-[#000000] px-4 md:hidden">
        {[
          ["event_note", "Events", "text-cyan-400 bg-cyan-900/20"],
          ["query_stats", "Stats", "text-zinc-600 hover:text-cyan-400"],
          ["podcasts", "SSE", "text-zinc-600 hover:text-cyan-400"],
          ["lan", "Network", "text-zinc-600 hover:text-cyan-400"]
        ].map(([icon, label, className]) => (
          <a key={label} className={`flex h-full flex-col justify-center px-4 ${className}`} href="#">
            <span className="material-symbols-outlined text-sm">{icon}</span>
            <span className="font-headline text-[8px] font-bold uppercase">{label}</span>
          </a>
        ))}
      </nav>

      {shouldShowApprovalModal(snapshot) && <HumanApprovalModal decision={approvalDecision} onApprove={approveAction} />}
    </div>
  );
}
