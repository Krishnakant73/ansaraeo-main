// FilesystemPromptLibrary — the default PromptLibrary impl.
// Reads from /prompts/*.md via the loader. Caches parsed templates in prod;
// re-reads on every access in dev so template edits show up instantly.

import { getEnv } from "@/config/env";
import { loadPromptFile, loadAllPromptFiles } from "./loader";
import type { PromptLibrary, PromptTemplate, RenderedPrompt } from "./types";

export class FilesystemPromptLibrary implements PromptLibrary {
  private cache = new Map<string, PromptTemplate>();

  private shouldCache(): boolean {
    return getEnv().NODE_ENV !== "development";
  }

  async get(id: string): Promise<PromptTemplate | null> {
    if (this.shouldCache() && this.cache.has(id)) {
      return this.cache.get(id) ?? null;
    }
    const tpl = await loadPromptFile(id);
    if (tpl && this.shouldCache()) this.cache.set(id, tpl);
    return tpl;
  }

  async list(): Promise<PromptTemplate[]> {
    const all = await loadAllPromptFiles();
    if (this.shouldCache()) {
      for (const t of all) this.cache.set(t.id, t);
    }
    return all;
  }

  async render(id: string, variables: Record<string, unknown>): Promise<RenderedPrompt> {
    const tpl = await this.get(id);
    if (!tpl) throw new Error(`Prompt template not found: ${id}`);

    // Best-effort validation — warn if the caller omitted a declared variable.
    // Never throws: a template can legitimately reference a variable that's
    // optional in some flows. Loud console warning is enough friction.
    for (const v of tpl.variables) {
      if (!(v in variables)) {
        console.warn(`[prompt-library] ${id}: missing variable "${v}"`);
      }
    }

    return {
      id: tpl.id,
      version: tpl.version,
      capability: tpl.capability,
      json: tpl.json,
      system: interpolate(tpl.system, variables),
      user: interpolate(tpl.user, variables),
    };
  }
}

function interpolate(text: string, vars: Record<string, unknown>): string {
  // {{ name }} — trimmed identifier only. Any missing var becomes an empty
  // string (caller decides whether that's fatal via the warn above).
  return text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value == null) return "";
    if (typeof value === "string") return value;
    return String(value);
  });
}

let _instance: FilesystemPromptLibrary | null = null;
export function getPromptLibrary(): PromptLibrary {
  if (!_instance) _instance = new FilesystemPromptLibrary();
  return _instance;
}
