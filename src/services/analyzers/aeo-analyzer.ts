// AEOAnalyzer — scores a page for Answer Engine Optimization.
// Distinct from GEO: AEO measures likelihood the page IS the source of an
// AI-generated answer, not just cited.
// Prompt: /prompts/aeo.md.

import type { PageInput, AnalyzerScore } from "./types";
import { runAnalyzerPrompt } from "./dispatch";

export interface AEOAnalyzer {
  analyze(page: PageInput, opts?: { orgId?: string | null }): Promise<AnalyzerScore>;
}

class AEOAnalyzerImpl implements AEOAnalyzer {
  async analyze(page: PageInput, opts?: { orgId?: string | null }): Promise<AnalyzerScore> {
    return runAnalyzerPrompt(
      "aeo",
      {
        url: page.url,
        title: page.title,
        h1: page.h1 ?? "",
        first_paragraph: page.firstParagraph ?? "",
        faq_blocks: page.faqBlocks ?? 0,
        stats_present: page.statsPresent ? "yes" : "no",
        reading_grade: page.readingGrade ?? "unknown",
      },
      { orgId: opts?.orgId ?? null },
    );
  }
}

let _instance: AEOAnalyzer | null = null;
export function getAEOAnalyzer(): AEOAnalyzer {
  if (!_instance) _instance = new AEOAnalyzerImpl();
  return _instance;
}
