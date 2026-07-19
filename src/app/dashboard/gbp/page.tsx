import { PageHeader } from "@/components/dashboard/page-header";
import GbpClient from "./GbpClient";

export default function GbpPage() {
  return (
    <div>
      <PageHeader
        title="Local SEO — Google Business Profile"
        subtitle='Check whether your business profile is claimed and well-maintained — a key local-SEO signal for AI maps and "near me" answers.'
      />
      <div className="mt-6">
        <GbpClient />
      </div>
    </div>
  );
}
