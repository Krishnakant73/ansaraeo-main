// Prompt file loader. Reads /prompts/*.md, parses YAML frontmatter + splits
// on the `## User` marker so each file cleanly yields a system+user pair.
//
// Runs at Node startup — files ship in the deploy bundle. In dev, prompts
// are re-read on every request so edits show up without a restart.

import { readFile, readdir } from "fs/promises";
import { join, resolve } from "path";
import type { PromptTemplate } from "./types";

const PROMPTS_DIR = resolve(process.cwd(), "prompts");
const USER_MARKER = /^##\s+User\s*$/m;

// Very small YAML parser — accepts the subset we use in frontmatter:
// `key: value`, `key:` followed by `  - item` list lines.
// Deliberately not depending on gray-matter or js-yaml (~200KB avoided).
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };
  const yaml = match[1];
  const body = raw.slice(match[0].length);
  const meta: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  let currentList: string | null = null;
  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentList) {
      (meta[currentList] as string[]).push(listItem[1].trim());
      continue;
    }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === "") {
      meta[key] = [];
      currentList = key;
    } else {
      currentList = null;
      const v = value.trim();
      if (v === "true") meta[key] = true;
      else if (v === "false") meta[key] = false;
      else if (/^-?\d+$/.test(v)) meta[key] = Number(v);
      else meta[key] = v;
    }
  }
  return { meta, body };
}

function parseFile(source: string, filename: string): PromptTemplate {
  const { meta, body } = parseFrontmatter(source);
  const splitIdx = body.search(USER_MARKER);
  let systemBody = body;
  let userBody = "";
  if (splitIdx !== -1) {
    systemBody = body.slice(0, splitIdx);
    userBody = body.slice(splitIdx).replace(USER_MARKER, "").trim();
  }
  return {
    id: (meta.id as string) ?? filename.replace(/\.md$/, ""),
    version: (meta.version as number) ?? 1,
    capability: (meta.capability as PromptTemplate["capability"]) ?? "DEFAULT",
    description: (meta.description as string) ?? "",
    variables: (meta.variables as string[]) ?? [],
    json: (meta.json as boolean) ?? false,
    system: systemBody.trim(),
    user: userBody,
  };
}

export async function loadPromptFile(id: string): Promise<PromptTemplate | null> {
  try {
    const source = await readFile(join(PROMPTS_DIR, `${id}.md`), "utf8");
    return parseFile(source, `${id}.md`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function loadAllPromptFiles(): Promise<PromptTemplate[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(PROMPTS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const files = entries.filter((f) => f.endsWith(".md"));
  const templates = await Promise.all(
    files.map(async (f) => {
      const source = await readFile(join(PROMPTS_DIR, f), "utf8");
      return parseFile(source, f);
    }),
  );
  return templates;
}
