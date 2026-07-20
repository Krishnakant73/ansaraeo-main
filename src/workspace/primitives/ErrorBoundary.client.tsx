"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// ============================================================
// ErrorBoundary — client-side crash net for a single workspace
// region (main body, sidebar block, timeline). Never wrap the
// whole shell in one boundary; that hides errors from Next.js's
// route-level error.tsx. Meant to be composed at slot granularity.
// ============================================================

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
};
type State = { error: Error | null };

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Best-effort telemetry; do not throw from a catch.
    if (typeof window !== "undefined" && "console" in window) {
       
      console.error("[workspace]", this.props.label ?? "region", error);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 text-sm text-rose-700"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <span className="font-semibold">
            {this.props.label ? `${this.props.label} failed to render` : "Section failed to render"}
          </span>
        </div>
        <p className="text-xs text-rose-700/80">{this.state.error.message}</p>
        <button
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      </div>
    );
  }
}
