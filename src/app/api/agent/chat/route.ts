import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildBrandContext } from "@/lib/agent-context";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseJsonBody, agentChatSchema } from "@/lib/validate";

// ============================================================
// POST /api/agent/chat
// Body: { message: string, conversationId?: string }
//
// Every call rebuilds fresh context from real Supabase data (see
// agent-context.ts) and includes it in the system prompt, so the model
// can only answer using what's actually true about this brand right now —
// this is the "never a vague, ungrounded answer" principle from
// 05-ui-ux-design-system.md, Screen D.
// ============================================================

async function callChatGPT(systemPrompt: string, history: { role: string; content: string }[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...history],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

const agentChatLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const parsed = await parseJsonBody(request, agentChatSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { message, conversationId } = parsed.data;

    const { data: brands } = await supabase.from("brands").select("id").limit(1);
    const brand = brands?.[0];
    if (!brand) return NextResponse.json({ error: "No brand found — complete onboarding first" }, { status: 404 });

    const service = createServiceClient();

    // Get or create the conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv } = await supabase
        .from("agent_conversations")
        .insert({ brand_id: brand.id, user_id: user.id, title: message.slice(0, 60) })
        .select()
        .single();
      convId = conv?.id;
    }

    // Load prior messages in this conversation for multi-turn context
    const { data: priorMessages } = await supabase
      .from("agent_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    // Build fresh grounding context from real data every time
    const brandContext = await buildBrandContext(brand.id);

    const systemPrompt = `You are the AnsarAEO Agent — an AI visibility analyst for this specific brand.
Answer ONLY using the real data provided below. If the data doesn't contain the answer,
say so honestly instead of guessing. Cite specific numbers from the data when relevant
(e.g., "based on 14 runs across ChatGPT and Perplexity this week"). Keep answers concise
and actionable — suggest a concrete next step where relevant.

REAL BRAND DATA:
${brandContext}`;

    const history = [...(priorMessages ?? []), { role: "user", content: message }];
    const reply = await callChatGPT(systemPrompt, history);

    // Store both messages
    await supabase.from("agent_messages").insert([
      { conversation_id: convId, role: "user", content: message },
      { conversation_id: convId, role: "assistant", content: reply },
    ]);

    return NextResponse.json({ conversationId: convId, reply });
  } catch (err) {
    console.error("agent chat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
