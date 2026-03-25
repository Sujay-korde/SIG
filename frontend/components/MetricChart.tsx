"use client";

type MetricChartProps = {
  label: string;
  value: string;
  icon: string;
  colorClass: string;
  bars: number[];
};

export function MetricChart({ label, value, icon, colorClass, bars }: MetricChartProps) {
  return (
    <div className="bg-surface-container p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="font-headline text-[10px] font-bold uppercase text-zinc-500">{label}</h4>
          <div className={`font-mono text-xl ${colorClass}`}>{value}</div>
        </div>
        <span className={`material-symbols-outlined text-sm ${colorClass}`}>{icon}</span>
      </div>
      <div className="flex h-12 items-end gap-0.5">
        {bars.map((height, index) => (
          <div
            key={`${label}-${index}`}
            className={`flex-1 ${index === bars.length - 1 ? colorClass.replace("text-", "bg-") : colorClass.replace("text-", "bg-") + "/20"}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}
