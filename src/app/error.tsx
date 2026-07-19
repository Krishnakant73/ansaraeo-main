"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest, where: "app-error-boundary" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-24 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted">
          An unexpected error occurred. Our team has been notified. You can try again, or head back to
          your dashboard.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <a href="/dashboard" className="text-sm font-medium text-accent underline">
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
