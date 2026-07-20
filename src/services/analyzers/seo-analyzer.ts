// SEOAnalyzer — scores a page for technical + on-page SEO signals.
// Prompt lives in /prompts/seo.md. LLM call routes through ModelRouter.

import type { PageInput, AnalyzerScore } from "./types";
import { runAnalyzerPrompt } from "./dispatch";

export interface SEOAnalyzer {
  analyze(page: PageInput, opts?: { orgId?: string | null }): Promise<AnalyzerScore>;
}

class SEOAnalyzerImpl implements SEOAnalyzer {
  async analyze(page: PageInput, opts?: { orgId?: string | null }): Promise<AnalyzerScore> {
    return runAnalyzerPrompt(
      "seo",
      {
        url: page.url,
        title: page.title,
        meta_description: page.metaDescription ?? "",
        h1: page.h1 ?? "",
        word_count: page.wordCount ?? 0,
        internal_links: page.internalLinks ?? 0,
        external_links: page.externalLinks ?? 0,
        schema_types: (page.schemaTypes ?? []).join(", ") || "(none)",
      },
      { orgId: opts?.orgId ?? null },
    );
  }
}

let _instance: SEOAnalyzer | null = null;
export function getSEOAnalyzer(): SEOAnalyzer {
  if (!_instance) _instance = new SEOAnalyzerImpl();
  return _instance;
}
