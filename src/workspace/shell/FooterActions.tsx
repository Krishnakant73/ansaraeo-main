import Link from "next/link";
import { Download, Share2, FileText, Terminal } from "lucide-react";
import type { WorkspaceDescriptor } from "../core";

// ============================================================
// FooterActions — reusable action row for workspace footers.
//   • Export → hits descriptor.export(o), otherwise a stub
//   • Share  → opens native share sheet where available
//   • Report → jumps to the reports tab (or the brand's report route)
//   • API    → deep-links to docs anchor for this object kind
//
// Capabilities gate what shows. Descriptor is authoritative; if it
// says share:false, no share button (accessibility + intent).
// ============================================================

export default function FooterActions<T>({
  descriptor,
  object,
  reportHref,
}: {
  descriptor: WorkspaceDescriptor<T>;
  object: T;
  reportHref?: string;
}) {
  const caps = descriptor.capabilities ?? {};
  const anything = caps.export || caps.share || reportHref || caps.api;
  if (!anything) return null;

  // Filename hint if the descriptor supplied one.
  const exportPlan = descriptor.export?.(object);
  const exportName = exportPlan?.filename(object);

  return (
    <footer className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {caps.export && (
        <button
          type="button"
          className="btn-ghost gap-1.5"
          title={exportName ? `Export ${exportName}` : "Export"}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export
        </button>
      )}
      {caps.share && (
        <button type="button" className="btn-ghost gap-1.5">
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Share
        </button>
      )}
      {reportHref && (
        <Link href={reportHref} className="btn-ghost gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Generate report
        </Link>
      )}
      {caps.api && (
        <Link
          href={`/dashboard/settings/api?ref=${encodeURIComponent(descriptor.kind)}`}
          className="btn-ghost gap-1.5"
        >
          <Terminal className="h-3.5 w-3.5" aria-hidden />
          API
        </Link>
      )}
    </footer>
  );
}
