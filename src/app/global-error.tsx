"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Capture the root-level error to Sentry the moment the boundary mounts.
  // Wizard's default boundary only reports; we keep the branded fallback UI
  // below so users see something usable instead of Next's default 500 page.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-surface px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Application error</h1>
          <p className="mt-3 text-sm text-muted">
            A critical error occurred while rendering this page. Please try again.
          </p>
          <button onClick={reset} className="btn-primary mt-6">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
