"use client";

import { useCallback, useRef, useState } from "react";

import { AgentReasonTrace } from "../components/AgentReasonTrace";
import { CausalGraph } from "../components/CausalGraph";
import { CounterfactualPanel } from "../components/CounterfactualPanel";
import { HumanApprovalModal } from "../components/HumanApprovalModal";
import { IncidentTimeline } from "../components/IncidentTimeline";
import { MetricChart } from "../components/MetricChart";
import { useSSE } from "../hooks/useSSE";
import {
  defaultSnapshot,
  formatMetric,
  shouldShowApprovalModal,
  type DashboardSnapshot,
  type MetricSeries,
} from "../lib/dashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// Thresholds mirror causal_graph.py so bar heights are meaningful
const METRIC_THRESHOLDS: Record<string, number> = {
  db_conn_pool: 80,
  auth_cpu: 85,
  auth_latency_ms: 500,
  payment_latency_ms: 400,
  payment_error_rate: 5,
  notif_queue_depth: 800,
  notif_cpu: 80,
};

const METRIC_CARDS = [
  { key: "db_conn_pool",       label: "DB_CONN_POOL",     icon: "database", color: "text-primary" },
  { key: "auth_cpu",           label: "AUTH_CPU_LOAD",    icon: "memory",   color: "text-secondary" },
  { key: "payment_latency_ms", label: "PAYMENT_LATENCY",  icon: "timer",    color: "text-tertiary" },
  { key: "notif_queue_depth",  label: "NOTIF_QUEUE",      icon: "stacks",   color: "text-zinc-300" },
];

type TimelineItem = {
  title: string;
  time: string;
  copy: string;
  color: string;
};

// Shape of raw SSE events that are NOT full dashboard snapshots
type SseEvent =
  | { type: "agent_decision"; decision: DashboardSnapshot["decision"] }
  | { type: "fault_injected"; scenario: string }
  | { type: "approval_granted"; decision: DashboardSnapshot["decision"] }
  | { type: "reset" }
  | { type: string };

function nowHHMMSS() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export default function Page() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(defaultSnapshot);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [activeTab, setActiveTab] = useState<"logic" | "neural" | "metrics" | "history" | "settings">("logic");

  // Rolling metric history — 10 ticks per metric, stored in a ref so updates
  // don't trigger re-renders on their own; snapshot state drives renders.
  const metricHistory = useRef<Record<string, number[]>>({});

  const pushTimeline = useCallback((item: TimelineItem) => {
    setTimeline((prev) => [item, ...prev].slice(0, 12));
  }, []);

  const handleEvent = useCallback(
    (raw: DashboardSnapshot | SseEvent) => {
      // Full dashboard snapshot — the most common event
      if ("metrics" in raw) {
        const snap = raw as DashboardSnapshot;

        // Update rolling history for every metric
        Object.entries(snap.metrics).forEach(([key, value]) => {
          const prev = metricHistory.current[key] ?? [];
          metricHistory.current[key] = [...prev, value].slice(-10);
        });

        setSnapshot(snap);
        return;
      }

      const event = raw as SseEvent;

      if (event.type === "fault_injected") {
        const fe = event as { type: "fault_injected"; scenario: string };
        pushTimeline({
          title: "FAULT_INJECTED",
          time: nowHHMMSS(),
          copy: `Scenario ${fe.scenario} triggered — causal analysis running.`,
          color: "bg-tertiary text-tertiary",
        });
        return;
      }

      if (event.type === "agent_decision") {
        const ae = event as { type: "agent_decision"; decision: DashboardSnapshot["decision"] };
        if (ae.decision) {
          setSnapshot((current) => ({ ...current, decision: ae.decision }));
          pushTimeline({
            title: ae.decision.requires_approval ? "APPROVAL_REQUIRED" : "AUTO_RESOLVED",
            time: nowHHMMSS(),
            copy: ae.decision.reasoning.slice(0, 90),
            color: ae.decision.requires_approval
              ? "bg-tertiary text-tertiary"
              : "bg-secondary text-secondary",
          });
        }
        return;
      }

      if (event.type === "approval_granted") {
        const ag = event as { type: "approval_granted"; decision: DashboardSnapshot["decision"] };
        if (ag.decision) {
          setSnapshot((current) => ({ ...current, decision: ag.decision, pending_approval: null }));
          pushTimeline({
            title: "APPROVAL_GRANTED",
            time: nowHHMMSS(),
            copy: ag.decision.reasoning.slice(0, 90),
            color: "bg-primary text-primary",
          });
        }
        return;
      }

      if (event.type === "reset") {
        // Clear all incident state so modal and incident badge reset immediately
        setSnapshot((current) => ({
          ...current,
          pending_approval: null,
          decision: null,
          anomalous_nodes: [],
          scenario: null,
        }));
        metricHistory.current = {};
        pushTimeline({
          title: "SYSTEM_RESET",
          time: nowHHMMSS(),
          copy: "All metrics returned to baseline. Environment clean.",
          color: "bg-secondary text-secondary",
        });
      }
    },
    [pushTimeline]
  );

  const { status } = useSSE(`${API_BASE}/stream`, handleEvent);

  // Counterfactual: prefer live decision data, fall back to pending approval,
  // show empty state if neither has data yet.
  const counterfactual: MetricSeries[] =
    snapshot.decision?.counterfactual?.length
      ? (snapshot.decision.counterfactual as MetricSeries[])
      : snapshot.pending_approval?.counterfactual?.length
      ? (snapshot.pending_approval.counterfactual as MetricSeries[])
      : [];

  const isIncident = snapshot.anomalous_nodes.length > 0;

  async function approveAction() {
    await fetch(`${API_BASE}/approve`, { method: "POST" });
    const response = await fetch(`${API_BASE}/metrics`);
    const payload = (await response.json()) as DashboardSnapshot;
    setSnapshot(payload);
  }

  return (
    <div className="overflow-hidden bg-surface text-on-surface font-body">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-[#0e0e0e] px-6 shadow-[0_0_20px_rgba(58,223,250,0.06)]">
        <div className="flex items-center gap-6">
          <span className="font-headline text-xl font-bold tracking-tighter text-cyan-400">
            SRE WHISPERER: AUTONOMOUS IT ENGINE
          </span>

          <div className="ml-8 hidden items-center gap-4 md:flex">
            {/* Step 4 — dynamic health badge */}
            <div
              className={`flex items-center gap-2 border-b-2 px-3 py-1 transition-colors duration-500 ${
                isIncident
                  ? "border-red-500 bg-red-500/10"
                  : "border-secondary bg-secondary/10"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                  isIncident ? "animate-pulse bg-red-500" : "bg-secondary"
                }`}
              />
              <span
                className={`font-headline text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ${
                  isIncident ? "text-red-400" : "text-secondary"
                }`}
              >
                {isIncident
                  ? `INCIDENT_DETECTED — ${snapshot.anomalous_nodes.length} NODE${
                      snapshot.anomalous_nodes.length > 1 ? "S" : ""
                    } ANOMALOUS`
                  : "SYSTEM_HEALTH_STABLE"}
              </span>
            </div>

            {/* SSE connection status */}
            <div className="sse-pulse flex items-center gap-2 bg-primary/5 px-3 py-1">
              <span className="material-symbols-outlined text-sm text-primary">podcasts</span>
              <span className="font-headline text-[10px] font-bold uppercase tracking-wider text-primary">
                {status === "connected" ? "SSE_ACTIVE" : "SSE_RECONNECTING"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-zinc-500 transition-colors hover:text-cyan-300">
            sensors
          </button>
          <button className="material-symbols-outlined text-zinc-500 transition-colors hover:text-cyan-300">
            memory
          </button>
          <button className="material-symbols-outlined text-zinc-500 transition-colors hover:text-cyan-300">
            account_tree
          </button>
        </div>
      </header>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] w-64 flex-col bg-[#1a1919] pt-4">
        <div className="mb-6 px-6">
          <h2 className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
            AGENT REASONING
          </h2>
          <p className="font-mono text-[10px] text-zinc-500">LOGIC_TRACE_ACTIVE</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {(
            [
              ["logic",   "terminal", "Logic Trace"],
              ["neural",  "hub",      "Neural Map"],
              ["metrics", "insights", "Metric Streams"],
              ["history", "history",  "History"],
              ["settings","settings", "Settings"],
            ] as ["logic"|"neural"|"metrics"|"history"|"settings", string, string][]
          ).map(([tab, icon, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex w-full items-center gap-3 px-4 py-3 font-mono text-xs uppercase transition-all text-left ${
                activeTab === tab
                  ? "border-l-4 border-cyan-400 bg-[#262626] text-cyan-400"
                  : "border-l-4 border-transparent text-zinc-500 hover:bg-[#201f1f] hover:text-cyan-200"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto bg-[#201f1f] p-4">
          <button className="w-full bg-gradient-to-br from-primary to-primary-container py-3 font-headline text-[10px] font-bold uppercase tracking-widest text-on-primary transition-all hover:brightness-110">
            REQUEST_INTERVENTION
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="ml-64 mt-16 grid h-[calc(100vh-64px)] grid-cols-12 gap-6 overflow-y-auto p-6 pb-20">

        {/* ── LOGIC TRACE tab (default) ── */}
        {activeTab === "logic" && (
          <>
            <CausalGraph graph={snapshot.graph} anomalousNodes={snapshot.anomalous_nodes} />
            <AgentReasonTrace decision={snapshot.decision} />
            <section className="col-span-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {METRIC_CARDS.map((metric) => {
                const history = metricHistory.current[metric.key] ?? [];
                const threshold = METRIC_THRESHOLDS[metric.key] ?? 100;
                const bars =
                  history.length > 0
                    ? history.map((v) => Math.min(110, Math.round((v / threshold) * 100)))
                    : [0, 0, 0, 0, 0, 0];
                return (
                  <MetricChart
                    key={metric.key}
                    label={metric.label}
                    value={formatMetric(metric.key, snapshot.metrics[metric.key] ?? 0)}
                    icon={metric.icon}
                    colorClass={metric.color}
                    bars={bars}
                  />
                );
              })}
            </section>
            <CounterfactualPanel data={counterfactual} />
            <IncidentTimeline items={timeline} />
          </>
        )}

        {/* ── NEURAL MAP tab ── */}
        {activeTab === "neural" && (
          <section className="col-span-12 flex flex-col gap-6">
            <div className="border border-outline-variant/10 bg-surface-container p-6">
              <h3 className="mb-2 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">NEURAL_MAP</h3>
              <p className="mb-6 font-mono text-[11px] text-zinc-500">Live causal dependency topology — full screen view</p>
              <div className="h-[600px]">
                <CausalGraph graph={snapshot.graph} anomalousNodes={snapshot.anomalous_nodes} />
              </div>
            </div>
          </section>
        )}

        {/* ── METRIC STREAMS tab ── */}
        {activeTab === "metrics" && (
          <section className="col-span-12 flex flex-col gap-6">
            <div className="border border-outline-variant/10 bg-surface-container p-6">
              <h3 className="mb-6 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">METRIC_STREAMS — ALL NODES</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Object.entries(METRIC_THRESHOLDS).map(([key, threshold]) => {
                  const history = metricHistory.current[key] ?? [];
                  const bars =
                    history.length > 0
                      ? history.map((v) => Math.min(110, Math.round((v / threshold) * 100)))
                      : [0, 0, 0, 0, 0, 0];
                  const label = key.replace(/_/g, " ").toUpperCase();
                  return (
                    <MetricChart
                      key={key}
                      label={label}
                      value={formatMetric(key, snapshot.metrics[key] ?? 0)}
                      icon="insights"
                      colorClass={snapshot.anomalous_nodes.includes(key) ? "text-red-400" : "text-primary"}
                      bars={bars}
                    />
                  );
                })}
              </div>
            </div>
            <CounterfactualPanel data={counterfactual} />
          </section>
        )}

        {/* ── HISTORY tab ── */}
        {activeTab === "history" && (
          <section className="col-span-12 flex flex-col gap-6">
            <div className="border border-outline-variant/10 bg-surface-container p-6">
              <h3 className="mb-6 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">INCIDENT_HISTORY</h3>
              {timeline.length === 0 ? (
                <div className="flex h-48 items-center justify-center border border-outline-variant/5 bg-surface-container-lowest">
                  <span className="font-mono text-xs text-zinc-600">NO_INCIDENTS_RECORDED — inject a scenario to populate history</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((item, i) => (
                    <div key={i} className="flex items-start gap-4 border-l-2 border-outline-variant/20 pl-4">
                      <div className="min-w-[120px]">
                        <span className="font-mono text-[10px] text-zinc-600">{item.time}</span>
                      </div>
                      <div>
                        <span className={`font-mono text-xs font-bold ${item.color.split(" ")[1] ?? "text-zinc-400"}`}>{item.title}</span>
                        <p className="mt-1 font-mono text-[11px] text-zinc-500">{item.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── SETTINGS tab ── */}
        {activeTab === "settings" && (
          <section className="col-span-12 flex flex-col gap-6">
            <div className="border border-outline-variant/10 bg-surface-container p-6">
              <h3 className="mb-6 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">SYSTEM_CONFIGURATION</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { label: "API_ENDPOINT", value: API_BASE },
                  { label: "SSE_STREAM", value: `${API_BASE}/stream` },
                  { label: "AUTO_EXEC_THRESHOLD", value: "80% confidence" },
                  { label: "APPROVAL_TIMEOUT", value: "30s" },
                  { label: "TICK_INTERVAL", value: "2000ms" },
                  { label: "SCENARIO", value: snapshot.scenario ?? "NONE" },
                  { label: "TICK", value: String(snapshot.tick) },
                  { label: "ANOMALOUS_NODES", value: snapshot.anomalous_nodes.join(", ") || "NONE" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between border border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
                    <span className="font-mono text-[11px] text-zinc-500">{label}</span>
                    <span className="font-mono text-[11px] text-cyan-400">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ── Mobile bottom nav ──────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 z-50 flex h-12 w-full items-center justify-around border-t border-[#494847]/15 bg-[#000000] px-4 md:hidden">
        {(
          [
            ["event_note", "Events", "text-cyan-400 bg-cyan-900/20"],
            ["query_stats", "Stats", "text-zinc-600 hover:text-cyan-400"],
            ["podcasts", "SSE", "text-zinc-600 hover:text-cyan-400"],
            ["lan", "Network", "text-zinc-600 hover:text-cyan-400"],
          ] as [string, string, string][]
        ).map(([icon, label, className]) => (
          <a
            key={label}
            className={`flex h-full flex-col justify-center px-4 ${className}`}
            href="#"
          >
            <span className="material-symbols-outlined text-sm">{icon}</span>
            <span className="font-headline text-[8px] font-bold uppercase">{label}</span>
          </a>
        ))}
      </nav>

      {/* Human approval modal — shown when confidence < 0.8 */}
      {shouldShowApprovalModal(snapshot) && (
        <HumanApprovalModal decision={snapshot.pending_approval} onApprove={approveAction} />
      )}
    </div>
  );
}
