"use client";

import "reactflow/dist/style.css";

import { useMemo } from "react";
import ReactFlow, { Background, BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Node, type Edge } from "reactflow";

type CausalGraphProps = {
  graph: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  anomalousNodes: string[];
};

function AnimatedEdge(props: EdgeProps) {
  const [path] = getBezierPath(props);
  return (
    <>
      <BaseEdge path={path} style={{ stroke: "#3adffa", strokeWidth: 2, strokeDasharray: 4, opacity: 0.4 }} />
      <EdgeLabelRenderer />
    </>
  );
}

export function CausalGraph({ graph, anomalousNodes }: CausalGraphProps) {
  const nodes = useMemo<Node[]>(
    () =>
      (graph.nodes.length ? graph.nodes : [
        { id: "db_conn_pool", label: "AUTH_SVC", position: { x: 100, y: 180 } },
        { id: "auth_latency_ms", label: "REDIS_P1", position: { x: 350, y: 130 } },
        { id: "payment_latency_ms", label: "PAY_GW", position: { x: 350, y: 230 } },
        { id: "payment_error_rate", label: "POSTGRES", position: { x: 600, y: 180 } }
      ]).map((node) => {
        const id = String(node.id);
        const isAnomalous = anomalousNodes.includes(id);
        return {
          id,
          position: (node.position as { x: number; y: number }) ?? { x: 0, y: 0 },
          data: { label: node.label ?? id.toUpperCase() },
          style: {
            width: 96,
            height: 48,
            borderRadius: 0,
            borderLeft: `2px solid ${isAnomalous ? "#ff716a" : "#69f6b8"}`,
            color: isAnomalous ? "#ff716a" : "#69f6b8",
            background: "#262626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: isAnomalous ? "0 0 12px rgba(255,113,106,0.28)" : "0 0 8px rgba(105,246,184,0.18)"
          }
        };
      }),
    [anomalousNodes, graph.nodes]
  );

  const edges = useMemo<Edge[]>(
    () =>
      (graph.edges.length ? graph.edges : [
        { source: "db_conn_pool", target: "auth_latency_ms" },
        { source: "db_conn_pool", target: "payment_latency_ms" },
        { source: "auth_latency_ms", target: "payment_error_rate" },
        { source: "payment_latency_ms", target: "payment_error_rate" }
      ]).map((edge, index) => ({
        id: `${edge.source}-${edge.target}-${index}`,
        source: String(edge.source),
        target: String(edge.target),
        type: "animatedEdge"
      })),
    [graph.edges]
  );

  return (
    <section className="col-span-12 flex h-[500px] flex-col overflow-hidden bg-surface-container lg:col-span-8">
      <div className="flex items-center justify-between border-b border-outline-variant/10 p-4">
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">CAUSAL_DEPENDENCY_GRAPH</h3>
        <span className="font-mono text-[10px] text-primary">NODES: {nodes.length} | EDGES: {edges.length}</span>
      </div>
      <div className="relative flex-1 bg-surface-container-lowest">
        <ReactFlow
          fitView
          nodes={nodes}
          edges={edges}
          edgeTypes={{ animatedEdge: AnimatedEdge }}
          minZoom={0.6}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          className="!bg-surface-container-lowest"
        >
          <Background gap={30} color="#262626" />
        </ReactFlow>
        <div className="absolute bottom-4 left-4 flex gap-2">
          <div className="border border-outline-variant/20 bg-surface-container-highest p-2">
            <span className="material-symbols-outlined text-sm text-zinc-500">zoom_in</span>
          </div>
          <div className="border border-outline-variant/20 bg-surface-container-highest p-2">
            <span className="material-symbols-outlined text-sm text-zinc-500">zoom_out</span>
          </div>
        </div>
      </div>
    </section>
  );
}
