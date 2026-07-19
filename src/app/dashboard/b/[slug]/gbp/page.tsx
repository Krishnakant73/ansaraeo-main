import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import GbpClient from "@/app/dashboard/gbp/GbpClient";

export const dynamic = "force-dynamic";

export default async function GbpPage({
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
        title="Local SEO — Google Business Profile"
        subtitle='Check whether your business profile is claimed and well-maintained — a key local-SEO signal for AI maps and "near me" answers.'
      />
      <div className="mt-6">
        <GbpClient />
      </div>
    </div>
  );
}
