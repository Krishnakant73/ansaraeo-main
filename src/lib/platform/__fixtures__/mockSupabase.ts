import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// In-memory Supabase stand-in for platform unit tests.
// Implements just the chainable query-builder surface the platform lib uses
// (select/insert/update/delete + eq/in/contains/lte/lt/order/limit/single/
// maybeSingle). State lives in `tables` so tests can seed + assert. This is a
// TEST-ONLY file (not matched by vitest include `*.test.ts`).
//
// Note: `.select()` after an insert/update/delete is a "returning" modifier,
// NOT a switch back to a read — matching real supabase-js semantics.
// ============================================================

type Row = Record<string, any>;

export interface MockSupabase {
  client: SupabaseClient;
  tables: Record<string, Row[]>;
}

export function createMockSupabase(): MockSupabase {
  const tables: Record<string, Row[]> = {};
  let counter = 0;

  const makeBuilder = (table: string) => {
    let writeOp: "insert" | "update" | "delete" | null = null;
    let payload: any = null;
    let filters: Array<(r: Row) => boolean> = [];
    let orderCol: string | null = null;
    let orderAsc = true;
    let limitN = Infinity;
    let singleRow = false;
    let maybeMode = false; // maybeSingle() must NOT error on zero rows (matches real supabase-js)

    const run = (): { data: any; error: any } => {
      const rows = (tables[table] ??= []);
      if (writeOp === "insert") {
        const inserted = Array.isArray(payload) ? payload : [payload];
        const withIds = inserted.map((p) => ({ id: `gen-${counter++}`, ...p }));
        rows.push(...withIds);
        return { data: singleRow ? withIds[0] : withIds, error: null };
      }
      if (writeOp === "update") {
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        matched.forEach((r) => Object.assign(r, payload));
        const out = singleRow ? (matched[0] ?? null) : matched;
        return { data: out, error: null };
      }
      if (writeOp === "delete") {
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        tables[table] = rows.filter((r) => !matched.includes(r));
        return { data: matched, error: null };
      }
      // read (return copies so callers can't alias/mutate table rows — matches
      // real Postgres, which returns fresh rows, not references)
      let out = rows.filter((r) => filters.every((f) => f(r)));
      if (orderCol) {
        const col = orderCol;
        out = [...out].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av < bv) return orderAsc ? -1 : 1;
          if (av > bv) return orderAsc ? 1 : -1;
          return 0;
        });
      }
      if (limitN !== Infinity) out = out.slice(0, limitN);
      if (singleRow) {
        const found = out[0];
        if (!found) {
          // .single() errors on zero rows (PGRST116); .maybeSingle() returns
          // null data + null error. This distinction matters: callers check
          // `if (error)` to detect real failures, so maybeSingle must be clean.
          return maybeMode
            ? { data: null, error: null }
            : { data: null, error: { code: "PGRST116", message: "not found" } };
        }
        return { data: { ...found }, error: null };
      }
      return { data: out.map((r) => ({ ...r })), error: null };
    };

    const builder: any = {
      select: () => builder,
      insert: (obj: any) => {
        writeOp = "insert";
        payload = obj;
        return builder;
      },
      update: (patch: any) => {
        writeOp = "update";
        payload = patch;
        return builder;
      },
      delete: () => {
        writeOp = "delete";
        return builder;
      },
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      contains: (col: string, vals: any[]) => {
        filters.push((r) => Array.isArray(r[col]) && vals.every((v) => r[col].includes(v)));
        return builder;
      },
      lte: (col: string, val: any) => {
        filters.push((r) => new Date(r[col]) <= new Date(val));
        return builder;
      },
      lt: (col: string, val: any) => {
        filters.push((r) => new Date(r[col]) < new Date(val));
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      limit: (n: number) => {
        limitN = n;
        return builder;
      },
      single: () => {
        singleRow = true;
        return builder;
      },
      maybeSingle: () => {
        singleRow = true;
        maybeMode = true;
        return builder;
      },
      then: (resolve: any) => Promise.resolve().then(() => resolve(run())),
    };
    return builder;
  };

  const client = { from: (table: string) => makeBuilder(table) } as unknown as SupabaseClient;
  return { client, tables };
}
