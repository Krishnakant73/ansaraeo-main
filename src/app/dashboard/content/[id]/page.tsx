import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import ContentEditor from "./ContentEditor";

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase.from("content_items").select("*").eq("id", id).single();
  if (!item) notFound();

  return (
    <div>
      <Link href="/dashboard/content" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to Content Studio
      </Link>
      <PageHeader title={item.title} />
      <div className="mt-6">
        <ContentEditor item={item} />
      </div>
    </div>
  );
}
