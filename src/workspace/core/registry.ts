import type { ObjectKind, WorkspaceDescriptor } from "./types";

// ============================================================
// Workspace registry — the single source of truth for which object
// kinds have workspaces. Explicit registration (not filesystem
// discovery) so we can enumerate for the palette and lint contracts.
//
// The registry is module-scoped: importing this module gives you the
// same map instance across the server request lifecycle. Do NOT rely
// on cross-request identity — Next.js may reload the module per
// isolated request in dev.
// ============================================================

 
const registry = new Map<ObjectKind, WorkspaceDescriptor<any>>();

export function register<T>(descriptor: WorkspaceDescriptor<T>): void {
  registry.set(descriptor.kind, descriptor);
}

export function get(kind: ObjectKind): WorkspaceDescriptor<unknown> | undefined {
  return registry.get(kind);
}

export function list(): WorkspaceDescriptor<unknown>[] {
  return Array.from(registry.values());
}

export function has(kind: ObjectKind): boolean {
  return registry.has(kind);
}
