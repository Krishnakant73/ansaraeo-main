import type { WorkspaceDescriptor } from "./types";

// ============================================================
// defineWorkspace — identity function that types a descriptor.
//
// Descriptors are declared via this helper (instead of a bare object
// literal) so TypeScript can infer TObject from `loader` and check
// header/summary/tabs against it. There's no runtime side-effect —
// registration happens explicitly via registry.register().
// ============================================================

export function defineWorkspace<TObject>(
  descriptor: WorkspaceDescriptor<TObject>,
): WorkspaceDescriptor<TObject> {
  return descriptor;
}
