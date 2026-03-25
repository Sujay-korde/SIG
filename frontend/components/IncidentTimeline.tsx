"use client";

const items = [
  { title: "ANOMALY_DETECTED", time: "14:01:00", copy: "Service B throughput dropped by 42%.", color: "bg-tertiary text-tertiary", muted: false },
  { title: "SCALE_UP_SUCCESS", time: "14:02:15", copy: "Deployed +2 pods to service-b-replicas.", color: "bg-primary text-primary", muted: false },
  { title: "HEALTH_RESTORED", time: "14:04:30", copy: "Latency returned to baseline < 50ms.", color: "bg-secondary text-secondary", muted: true }
];

export function IncidentTimeline() {
  return (
    <section className="col-span-12 bg-surface-container p-6 lg:col-span-5">
      <h3 className="mb-6 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">INCIDENT_TIMELINE</h3>
      <div className="relative space-y-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-outline-variant/20">
        {items.map((item) => (
          <div key={item.title} className={`relative pl-8 ${item.muted ? "opacity-40" : ""}`}>
            <span className={`absolute left-0 top-1 h-4 w-4 rounded-full border-4 border-surface ${item.color.split(" ")[0]}`} />
            <div className="flex justify-between">
              <span className={`font-mono text-xs font-bold ${item.color.split(" ")[1]}`}>{item.title}</span>
              <span className="font-mono text-[10px] text-zinc-600">{item.time}</span>
            </div>
            <p className="mt-1 text-xs italic text-zinc-400">{item.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
