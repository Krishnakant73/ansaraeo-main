import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import LlmsTxtValidatorClient from "@/app/dashboard/llms-txt/LlmsTxtValidatorClient";

export const dynamic = "force-dynamic";

export default async function LlmsTxtValidatorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return (
    <div>
      <PageHeader
        title="llms.txt Validator"
        subtitle={
          <>
            A deterministic grammar check of an{" "}
            <a className="underline" href="https://llmstxt.org" target="_blank" rel="noreferrer">
              llms.txt
            </a>{" "}
            file against the spec — single H1, blockquote summary, H2 link-list sections, no stray prose, fetchable
            links, and (when validating a live URL) the discovery headers agents look for. No API key; results are
            reproducible.
          </>
        }
      />
      <div className="mt-6">
        <LlmsTxtValidatorClient />
      </div>
    </div>
  );
}
