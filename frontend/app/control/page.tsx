"use client";

import { useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const actions = [
  { key: "F1", label: "Trigger F1", endpoint: "/inject/F1" },
  { key: "F2", label: "Trigger F2", endpoint: "/inject/F2" },
  { key: "F3", label: "Trigger F3", endpoint: "/inject/F3" },
  { key: "F4", label: "Trigger F4", endpoint: "/inject/F4" },
  { key: "F5", label: "Reset", endpoint: "/reset" }
];

export default function ControlPage() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = actions.find((item) => item.key === event.key);
      if (action) {
        fetch(`${API_BASE}${action.endpoint}`, { method: "POST" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="min-h-screen bg-surface p-10 text-on-surface">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-headline text-3xl font-bold uppercase tracking-tight text-primary">Demo Control Panel</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Hidden operator console for the scripted demo. Keyboard shortcuts follow the blueprint: F1-F4 inject faults and F5 resets the environment.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={() => fetch(`${API_BASE}${action.endpoint}`, { method: "POST" })}
              className="flex items-center justify-between border border-outline-variant/20 bg-surface-container p-5 text-left"
            >
              <span className="font-headline text-sm font-bold uppercase tracking-widest">{action.label}</span>
              <span className="font-mono text-xs text-primary">{action.key}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
