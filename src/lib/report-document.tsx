import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ============================================================
// Uses @react-pdf/renderer instead of a headless-browser approach
// (Puppeteer/Playwright) deliberately — it's pure JavaScript, works
// reliably in Vercel's serverless functions without needing a Chromium
// binary bundled in, and is fast enough for a weekly report. If you later
// need pixel-perfect fidelity to your dashboard's actual charts, revisit
// a headless-browser screenshot approach — but for a text/table-based
// branded report (what agencies actually forward to clients per
// 04-feature-spec.md's Tier 3), this is the simpler, more reliable choice.
// ============================================================

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  brandName: { fontSize: 22, fontWeight: 700 },
  subtitle: { fontSize: 10, color: "#6B7280", marginTop: 4 },
  logo: { fontSize: 14, fontWeight: 700, color: "#D66A38" },
  scoreRow: { flexDirection: "row", gap: 16, marginBottom: 24 },
  scoreCard: { flex: 1, padding: 14, backgroundColor: "#FAFAFA", borderRadius: 8 },
  scoreLabel: { fontSize: 9, color: "#6B7280", textTransform: "uppercase" },
  scoreValue: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 10 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ECECEC", paddingVertical: 6 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 6, marginBottom: 2 },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "center" },
  col3: { flex: 1, textAlign: "center" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9CA3AF", textAlign: "center" },
  issueRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ECECEC", paddingVertical: 6 },
  issueStatus: { width: 54, fontSize: 9, fontWeight: 700 },
  issueBody: { flex: 1 },
  issueCheck: { fontSize: 10, fontWeight: 700 },
  issueDetail: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  note: { fontSize: 9, color: "#9CA3AF", marginTop: 6 },
});

const STATUS_COLOR: Record<string, string> = { pass: "#059669", warning: "#D97706", fail: "#DC2626" };

type ReportData = {
  brandName: string;
  industry: string | null;
  generatedAt: string;
  visibilityScore: number | null;
  totalRuns: number;
  totalPrompts: number;
  engineBreakdown: { engine: string; total: number; mentioned: number }[];
  topPrompts: { text: string; mentioned: boolean; sentiment: string }[];
  competitors: { name: string; sharePercent: number }[];
  siteAudit?: {
    overallScore: number | null;
    schemaScore: number | null;
    crawlabilityScore: number | null;
    llmsTxtPresent: boolean;
    runAt: string | null;
    topIssues: { check: string; status: "pass" | "warning" | "fail"; detail: string }[];
  } | null;
  citations?: {
    total: number;
    ownDomainCount: number;
    competitorDomainCount: number;
    topDomains: { domain: string; count: number }[];
  } | null;
  geoMetrics?: {
    snapshotDate: string | null;
    visibility_rate: number | null;
    citation_rate: number | null;
    citation_share: number | null;
    avg_rank: number | null;
    model_divergence: number | null;
    recommendation_quality: number | null;
    trend_velocity: number | null;
    sentiment_score: number | null;
    per_engine: { name: string; visibility_rate: number | null; citation_share: number | null; avg_rank: number | null }[];
  } | null;
  agencyLabel?: string; // white-label: shown instead of "AnsarAEO" if set
};

export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{data.brandName}</Text>
            <Text style={styles.subtitle}>AI Visibility Report — {data.generatedAt}</Text>
          </View>
          <Text style={styles.logo}>{data.agencyLabel ?? "AnsarAEO"}</Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Visibility Score</Text>
            <Text style={styles.scoreValue}>{data.visibilityScore ?? "—"}%</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Tracked Prompts</Text>
            <Text style={styles.scoreValue}>{data.totalPrompts}</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Total Runs</Text>
            <Text style={styles.scoreValue}>{data.totalRuns}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Per-Engine Breakdown</Text>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.col1}>Engine</Text>
          <Text style={styles.col2}>Mentioned</Text>
          <Text style={styles.col3}>Total Runs</Text>
        </View>
        {data.engineBreakdown.map((e) => (
          <View key={e.engine} style={styles.tableRow}>
            <Text style={[styles.col1, { textTransform: "capitalize" }]}>{e.engine}</Text>
            <Text style={styles.col2}>{e.mentioned}</Text>
            <Text style={styles.col3}>{e.total}</Text>
          </View>
        ))}

        {data.competitors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Share of Voice</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.col1}>Brand</Text>
              <Text style={styles.col2}>Share</Text>
            </View>
            {data.competitors.map((c) => (
              <View key={c.name} style={styles.tableRow}>
                <Text style={styles.col1}>{c.name}</Text>
                <Text style={styles.col2}>{c.sharePercent}%</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Prompt Results (latest)</Text>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.col1}>Prompt</Text>
          <Text style={styles.col2}>Mentioned</Text>
          <Text style={styles.col3}>Sentiment</Text>
        </View>
        {data.topPrompts.slice(0, 15).map((p, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col1}>{p.text}</Text>
            <Text style={styles.col2}>{p.mentioned ? "Yes" : "No"}</Text>
            <Text style={[styles.col3, { textTransform: "capitalize" }]}>{p.sentiment}</Text>
          </View>
        ))}

        {data.geoMetrics && (
          <>
            <Text style={styles.sectionTitle}>
              Visibility Metrics{data.geoMetrics.snapshotDate ? ` — snapshot ${data.geoMetrics.snapshotDate}` : ""}
            </Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Visibility Rate</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.visibility_rate ?? "—"}%</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Citation Rate</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.citation_rate ?? "—"}%</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Citation Share</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.citation_share ?? "—"}%</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Avg Rank</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.avg_rank ?? "—"}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Model Divergence</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.model_divergence ?? "—"}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Recommendation</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.recommendation_quality ?? "—"}%</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Trend Velocity</Text>
                <Text style={styles.scoreValue}>
                  {data.geoMetrics.trend_velocity === null ? "—" : `${data.geoMetrics.trend_velocity > 0 ? "+" : ""}${data.geoMetrics.trend_velocity}`}
                </Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Sentiment</Text>
                <Text style={styles.scoreValue}>{data.geoMetrics.sentiment_score ?? "—"}%</Text>
              </View>
            </View>
            {data.geoMetrics.per_engine.length > 0 && (
              <>
                <Text style={[styles.scoreLabel, { marginBottom: 4 }]}>By engine</Text>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.col1}>Engine</Text>
                  <Text style={styles.col2}>Vis Rate</Text>
                  <Text style={styles.col3}>Cite Share</Text>
                </View>
                {data.geoMetrics.per_engine.map((e) => (
                  <View key={e.name} style={styles.tableRow}>
                    <Text style={[styles.col1, { textTransform: "capitalize" }]}>{e.name}</Text>
                    <Text style={styles.col2}>{e.visibility_rate ?? "—"}%</Text>
                    <Text style={styles.col3}>{e.citation_share ?? "—"}%</Text>
                  </View>
                ))}
              </>
            )}
            <Text style={styles.note}>
              Metrics derived from recorded visibility runs — never estimated. Recommendation quality is an LLM-judged proxy.
            </Text>
          </>
        )}

        {data.siteAudit && (
          <>
            <Text style={styles.sectionTitle}>
              Site Audit{data.siteAudit.runAt ? ` — last run ${data.siteAudit.runAt}` : ""}
            </Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Overall</Text>
                <Text style={styles.scoreValue}>{data.siteAudit.overallScore ?? "—"}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Schema Markup</Text>
                <Text style={styles.scoreValue}>{data.siteAudit.schemaScore ?? "—"}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Crawlability</Text>
                <Text style={styles.scoreValue}>{data.siteAudit.crawlabilityScore ?? "—"}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>llms.txt</Text>
                <Text style={styles.scoreValue}>{data.siteAudit.llmsTxtPresent ? "Yes" : "No"}</Text>
              </View>
            </View>
            {data.siteAudit.topIssues.length > 0 && (
              <>
                <Text style={[styles.scoreLabel, { marginBottom: 4 }]}>Top issues to fix</Text>
                {data.siteAudit.topIssues.map((issue, i) => (
                  <View key={i} style={styles.issueRow}>
                    <Text style={[styles.issueStatus, { color: STATUS_COLOR[issue.status] ?? "#6B7280" }]}>
                      {issue.status.toUpperCase()}
                    </Text>
                    <View style={styles.issueBody}>
                      <Text style={styles.issueCheck}>{issue.check}</Text>
                      <Text style={styles.issueDetail}>{issue.detail}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {data.citations && (
          <>
            <Text style={styles.sectionTitle}>Citation Landscape</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Total Citations</Text>
                <Text style={styles.scoreValue}>{data.citations.total}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Your Domain</Text>
                <Text style={styles.scoreValue}>{data.citations.ownDomainCount}</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Competitor Domains</Text>
                <Text style={styles.scoreValue}>{data.citations.competitorDomainCount}</Text>
              </View>
            </View>
            {data.citations.topDomains.length > 0 && (
              <>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.col1}>Most-cited domain</Text>
                  <Text style={styles.col2}>Citations</Text>
                </View>
                {data.citations.topDomains.map((d) => (
                  <View key={d.domain} style={styles.tableRow}>
                    <Text style={styles.col1}>{d.domain}</Text>
                    <Text style={styles.col2}>{d.count}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <Text style={styles.footer} fixed>
          Generated automatically — data reflects live AI engine queries as of {data.generatedAt}.
        </Text>
      </Page>
    </Document>
  );
}
