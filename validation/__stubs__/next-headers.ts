// Stub for next/headers used only by the deterministic e2e validation run.
// The real functions require a request context; in a Node test we never call
// them, so a no-op stub is sufficient and keeps server-module imports clean.
export function cookies() {
  return {
    getAll: () => [],
    get: () => undefined,
    set: () => {},
    delete: () => {},
    setAll: () => {},
  } as any;
}
export function headers() {
  return new Map() as any;
}
