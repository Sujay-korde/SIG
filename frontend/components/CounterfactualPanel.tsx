"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MetricSeries } from "../lib/dashboard";

export function CounterfactualPanel({ data }: { data: MetricSeries[] }) {
  return (
    <section className="col-span-12 bg-surface-container p-6 lg:col-span-7">
      <h3 className="mb-6 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">COUNTERFACTUAL_HEALTH_ANALYSIS</h3>
      <div className="relative h-64 border border-outline-variant/5 bg-surface-container-lowest">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 24, bottom: 24, left: 8 }}>
            <XAxis dataKey="t" tick={{ fill: "#777575", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#777575", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#131313", border: "1px solid rgba(73,72,71,0.2)", color: "#fff" }}
              labelStyle={{ color: "#fff" }}
            />
            <Line type="monotone" dataKey="projected" stroke="#ff716a" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="actual" stroke="#69f6b8" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 bg-secondary" />
            <span className="font-mono text-[9px] text-secondary">ACTUAL_SYSTEM_HEALTH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 border-t border-dashed border-tertiary" />
            <span className="font-mono text-[9px] text-tertiary">PROJECTED_WITHOUT_INTERVENTION</span>
          </div>
        </div>
      </div>
    </section>
  );
}
