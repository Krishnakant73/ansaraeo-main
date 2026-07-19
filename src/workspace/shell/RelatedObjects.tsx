import type { RelatedGraphSource } from "../core";
import RelatedGraph from "./RelatedGraph.client";

// ============================================================
// RelatedObjects — server wrapper that fetches the descriptor's
// related nodes and delegates rendering to the client-side
// RelatedGraph. RelatedGraph offers both a list view (default,
// accessible) and a radial SVG graph view (visual overview).
//
// `centerKind` and `centerLabel` describe the workspace's own
// object so the graph can draw the center node. When they're not
// supplied (older callers), we fall back to a neutral center.
// ============================================================

export default async function RelatedObjects({
  source,
  title = "Related",
  centerKind = "workspace",
  centerLabel = "This",
}: {
  source: RelatedGraphSource;
  title?: string;
  centerKind?: string;
  centerLabel?: string;
}) {
  let nodes: Awaited<ReturnType<RelatedGraphSource["nodes"]>> = [];
  try {
    nodes = await source.nodes();
  } catch {
    nodes = [];
  }
  if (nodes.length === 0) return null;

  return (
    <RelatedGraph
      nodes={nodes}
      centerKind={centerKind}
      centerLabel={centerLabel}
      title={title}
    />
  );
}
