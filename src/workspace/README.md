# Universal Workspace Engine (UWE)

The reusable framework every object workspace inherits. Step 1 is the empty
core — no user-visible changes, but every future workspace lands as a single
descriptor + tab files.

## Adding a workspace

1. Create `src/app/dashboard/w/<kind>/workspace.ts`.
2. Export a descriptor from `defineWorkspace({ … })` — see `core/types.ts`.
3. Import it in `src/workspace/workspaces.ts` and call `register()`.
4. Add tab files that return React nodes (server components by default).

## Contracts

- Loaders MUST use the cookie client (`createClient()`), never the service
  client. Cross-org leaks bypass RLS otherwise.
- Return `null` from the loader → the framework calls `notFound()`.
- Exactly one `<h1>` per workspace (the header). The shell renders it.
- Client-only tabs live in `<file>.client.tsx` and are dynamically imported.

See the full design in `.claude/plans/universal-workspace-engine.md`.
