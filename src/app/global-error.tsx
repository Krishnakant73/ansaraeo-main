"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
