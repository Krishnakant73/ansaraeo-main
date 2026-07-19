import Link from "next/link";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { providerHelpUrl, providerLabel, type Integration } from "@/lib/integration-workspace";

// ============================================================
// Integration › Credentials — shape only, never values. If the
// credential blob is in the encrypted-envelope shape, we surface
// that fact + which encryption is used (from crypto.ts docs). If
// it's plaintext (legacy row), we surface the top-level keys but
// still not their values. Reconnect is the only remediation.
// ============================================================

export default function CredentialsBody({ integration: i }: { integration: Integration }) {
  const settingsUrl = providerHelpUrl(i.provider, i.brand.slug);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Credentials</h2>
        <p className="mt-1 text-sm text-muted">
          Shape only — this workspace never decrypts secrets. To change credentials, reconnect the
          integration on its settings page.
        </p>
      </div>

      {i.stats.isEncrypted ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800">Encrypted at rest</p>
              <p className="mt-1 text-xs text-emerald-700">
                Credentials are stored inside an AES-256-GCM envelope (see{" "}
                <code className="rounded bg-white/60 px-1 py-0.5 text-[11px]">src/lib/crypto.ts</code>).
                The encrypted blob lives in a single{" "}
                <code className="rounded bg-white/60 px-1 py-0.5 text-[11px]">credentials.data</code>{" "}
                field. Decryption requires the server-side{" "}
                <code className="rounded bg-white/60 px-1 py-0.5 text-[11px]">ENCRYPTION_KEY</code>{" "}
                and only happens in trusted request handlers.
              </p>
            </div>
          </div>
        </section>
      ) : i.stats.credentialKeyCount === 0 ? (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-ink">Credentials row is empty.</p>
          <p className="mt-1 text-xs text-muted">This shouldn&rsquo;t happen — reconnect to fix.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-800">Legacy row (plaintext)</p>
              <p className="mt-1 text-xs text-rose-700">
                This row has {i.stats.credentialKeyCount} top-level key
                {i.stats.credentialKeyCount === 1 ? "" : "s"} and no encrypted envelope. That means
                the credentials were saved before the encryption path was in place. Reconnect on
                the settings page to migrate this row to encrypted storage — the reconnect flow
                will overwrite the plaintext values with the encrypted envelope.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Provider</p>
        <p className="mt-1 text-sm text-ink">
          {providerLabel(i.provider)}{" "}
          <code className="ml-1 rounded bg-surface px-1.5 py-0.5 text-[11px]">{i.provider}</code>
        </p>
      </section>

      <div className="flex items-center gap-2">
        <Link href={settingsUrl} className="btn-sm">
          Reconnect
        </Link>
        <p className="text-xs text-muted">Opens the provider&rsquo;s settings page.</p>
      </div>
    </div>
  );
}
