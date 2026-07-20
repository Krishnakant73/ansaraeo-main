// Analyzer shared types. Every analyzer emits the same shape so the
// RecommendationEngine + ReportGenerator can consume them uniformly.
//
// Constitution: "Every score must include Reason, Evidence, Recommendation, Priority."

export type Severity = "high" | "medium" | "low";

export type AnalyzerFinding = {
  signal: string;
  severity: Severity;
  evidence: string;
  recommendation: string;
};

export type AnalyzerScore = {
  score: number; // 0-100
  signals: Record<string, number>;
  findings: AnalyzerFinding[];
  // Attribution + audit metadata surfaced by the router.
  model: string;
  latencyMs: number;
  costMicroUsd: number;
};

export type PageInput = {
  url: string;
  title: string;
  metaDescription?: string;
  h1?: string;
  html?: string;
  markdown?: string;
  wordCount?: number;
  internalLinks?: number;
  externalLinks?: number;
  schemaTypes?: string[];
  answerBlocks?: number;
  citationsOutbound?: number;
  authorBio?: boolean;
  publishedDate?: string | null;
  firstParagraph?: string;
  faqBlocks?: number;
  statsPresent?: boolean;
  readingGrade?: number;
};
