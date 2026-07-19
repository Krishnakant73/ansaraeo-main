import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateSchemaForBrand,
  getSchemaTemplate,
  listSchemaTemplates,
  validateJsonLd,
  type SchemaType,
} from "@/lib/schema-for-ai";

// POST /api/schema — Body: { action: "list" | "template" | "validate" | "generate", ... }
// Schema-for-AI: list templates, fetch a template, validate JSON-LD, or
// generate a brand-filled template. Validation is deterministic (no key).
// User-facing → cookie client.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const action = body.action ?? "list";

    if (action === "list") {
      return NextResponse.json({ templates: listSchemaTemplates().map((t) => ({ type: t.type, label: t.label, description: t.description })) });
    }

    if (action === "template") {
      const tpl = getSchemaTemplate(body.type as SchemaType);
      if (!tpl) return NextResponse.json({ error: "Unknown schema type." }, { status: 400 });
      return NextResponse.json({ type: tpl.type, label: tpl.label, template: tpl.template, required: tpl.required, recommended: tpl.recommended });
    }

    if (action === "validate") {
      if (typeof body.json !== "string" || !body.json.trim()) {
        return NextResponse.json({ error: "Provide JSON-LD text to validate." }, { status: 400 });
      }
      return NextResponse.json({ result: validateJsonLd(body.json) });
    }

    if (action === "generate") {
      if (!body.type || !body.brandName || !body.domain) {
        return NextResponse.json({ error: "Provide type, brandName, and domain." }, { status: 400 });
      }
      const tpl = getSchemaTemplate(body.type as SchemaType);
      if (!tpl) return NextResponse.json({ error: "Unknown schema type." }, { status: 400 });
      return NextResponse.json({ template: generateSchemaForBrand({ type: body.type, brandName: body.brandName, domain: body.domain }) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("schema error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error in schema tool" },
      { status: 500 }
    );
  }
}
