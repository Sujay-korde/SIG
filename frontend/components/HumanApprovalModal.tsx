"use client";

import type { AgentDecision } from "../lib/dashboard";

type HumanApprovalModalProps = {
  decision: AgentDecision | null;
  onApprove: () => Promise<void> | void;
};

export function HumanApprovalModal({ decision, onApprove }: HumanApprovalModalProps) {
  if (!decision || !decision.requires_approval) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface/80 p-6 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden border-l-4 border-tertiary bg-surface-container p-8 shadow-2xl">
        <div className="absolute -right-10 -top-10 opacity-10">
          <span className="material-symbols-outlined text-[120px] text-tertiary">warning</span>
        </div>
        <header className="mb-6">
          <h2 className="mb-1 font-headline text-xl font-bold uppercase tracking-tighter text-tertiary">Human Approval Required</h2>
          <p className="font-mono text-[10px] uppercase text-zinc-500">REQUEST_ID: AUTH_ROUTING_MOD_229</p>
        </header>
        <div className="mb-8 space-y-4">
          <div className="border border-outline-variant/10 bg-surface-container-lowest p-4">
            <p className="font-mono text-xs text-zinc-300">
              {decision.reasoning} Confidence level <span className="text-tertiary">{(decision.confidence * 100).toFixed(1)}%</span> is below auto-execution threshold.
            </p>
          </div>
          <div className="flex items-center gap-4 font-headline text-[10px] font-bold uppercase">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" />
              <span className="text-tertiary">WAITING_RESPONSE...</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-surface-container-highest py-4 font-headline text-xs font-bold uppercase tracking-widest text-zinc-300 transition-all hover:bg-zinc-800">
            Deny Action
          </button>
          <button
            onClick={() => onApprove()}
            className="bg-gradient-to-br from-primary to-primary-container py-4 font-headline text-xs font-bold uppercase tracking-widest text-on-primary transition-all hover:brightness-110"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
