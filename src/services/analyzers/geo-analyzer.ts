// GEOAnalyzer — scores a page for Generative Engine Optimization signals.
// Prompt: /prompts/geo.md.

import type { PageInput, AnalyzerScore } from "./types";
import { runAnalyzerPrompt } from "./dispatch";

export interface GEOAnalyzer {
  analyze(page: PageInput, opts?: { orgId?: string | null }): Promise<AnalyzerScore>;
}

class GEOAnalyzerImpl implements GEOAnalyzer {
  async analyze(page: PageInput, opts?: { orgId?: string | null }): Promise<AnalyzerScore> {
    return runAnalyzerPrompt(
      "geo",
      {
        url: page.url,
        title: page.title,
        h1: page.h1 ?? "",
        answer_blocks: page.answerBlocks ?? 0,
        citations_outbound: page.citationsOutbound ?? 0,
        author_bio: page.authorBio ? "yes" : "no",
        published_date: page.publishedDate ?? "unknown",
        schema_types: (page.schemaTypes ?? []).join(", ") || "(none)",
      },
      { orgId: opts?.orgId ?? null },
    );
  }
}

let _instance: GEOAnalyzer | null = null;
export function getGEOAnalyzer(): GEOAnalyzer {
  if (!_instance) _instance = new GEOAnalyzerImpl();
  return _instance;
}
