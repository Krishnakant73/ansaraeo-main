import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateReportBuffer } from "@/lib/reports";

// GET /api/reports/generate?brandId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  try {
    const { buffer, brandName } = await generateReportBuffer(brandId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${brandName.replace(/\s+/g, "_")}_visibility_report.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate report" }, { status: 500 });
  }
}
