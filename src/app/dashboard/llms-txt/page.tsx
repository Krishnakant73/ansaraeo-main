import { PageHeader } from "@/components/dashboard/page-header";
import LlmsTxtValidatorClient from "./LlmsTxtValidatorClient";

export default function LlmsTxtValidatorPage() {
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
