import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildBrandContext } from "@/lib/agent-context";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseJsonBody, agentChatSchema } from "@/lib/validate";

// ============================================================
// POST /api/agent/chat
// Body: { message: string, conversationId?: string, stream?: boolean }
//
// Every call rebuilds fresh context from real Supabase data (see
// agent-context.ts) and includes it in the system prompt, so the model
// can only answer using what's actually true about this brand right now —
// this is the "never a vague, ungrounded answer" principle from
// 05-ui-ux-design-system.md, Screen D.
//
// Two response shapes:
//   • Default (JSON):    { conversationId, reply }             — batch
//   • With `Accept: text/event-stream` OR `?stream=1`:  SSE     — streaming
//     Events:
//       event: meta   data: {"conversationId": "..."}
//       event: token  data: {"delta": "..."}
//       event: done   data: {"ok": true}
//     The stream persists the final assistant message to Supabase after
//     the model finishes; on stream error, an `event: error` frame is
//     emitted before close.
// ============================================================

const agentChatLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

type ChatMsg = { role: string; content: string };

async function callChatGPT(systemPrompt: string, history: ChatMsg[]) {
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

// Stream-mode OpenAI call. Yields token deltas as they arrive; the caller
// forwards each yield to the SSE stream. Returns the fully concatenated
// reply for persistence.
async function* streamChatGPT(
  systemPrompt: string,
  history: ChatMsg[],
): AsyncGenerator<string, string, void> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, ...history],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenAI error: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";

  // OpenAI sends SSE frames delimited by "\n\n"; each frame is
  //   data: {json}\n
  // ending with `data: [DONE]`. Anything else we ignore.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!frame.startsWith("data:")) continue;
      const payload = frame.slice(5).trim();
      if (payload === "[DONE]") return full;
      try {
        const obj = JSON.parse(payload);
        const delta: string | undefined = obj?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          yield delta;
        }
      } catch {
        /* swallow malformed frame */
      }
    }
  }
  return full;
}

// SSE frame helper — write from inside a ReadableStream controller.
function sseFrame(event: string, data: unknown): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const rl = agentChatLimiter(user.id);
    if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

    const parsed = await parseJsonBody(request, agentChatSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { message, conversationId } = parsed.data;

    const { data: brands } = await supabase.from("brands").select("id").limit(1);
    const brand = brands?.[0];
    if (!brand) return NextResponse.json({ error: "No brand found — complete onboarding first" }, { status: 404 });

    const service = createServiceClient();
    void service; // reserved for future service-scoped writes

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

    // Voice — senior AEO consultant, not a chatbot. Direct, quantitative,
    // opinionated. Answer with observation + next action, not questions
    // without defaults. This ships alongside the insight-first onboarding
    // so Copilot speaks the same voice from the first message.
    const systemPrompt = `You are the AnsarAEO Copilot — a senior AEO consultant for this specific brand.

VOICE RULES (strict):
- Direct, quantitative, opinionated. No emoji. No "Great question!" No "As an AI".
- Every reply is observation + a concrete next action. Never end with an open question if you can propose a specific default instead.
- Cite the exact numbers you're standing on (e.g., "based on 14 runs across ChatGPT and Perplexity this week").
- If the data doesn't answer the question, say so plainly and propose the smallest next step to unblock it.
- Never invent a mention, a competitor move, or a citation. If it isn't in the data below, it didn't happen.
- Drafts include \`[ADD …]\` placeholders for owner-only facts. Never fill them for the user.

REAL BRAND DATA:
${brandContext}`;

    const history = [...(priorMessages ?? []), { role: "user", content: message }];

    // ── Decide response shape.
    const wantsStream =
      request.headers.get("accept")?.includes("text/event-stream") ||
      new URL(request.url).searchParams.get("stream") === "1";

    // Always persist the user turn immediately so refresh mid-stream
    // doesn't lose it. Assistant turn is persisted once the stream
    // completes (or the batch call returns).
    await supabase
      .from("agent_messages")
      .insert({ conversation_id: convId, role: "user", content: message });

    if (!wantsStream) {
      const reply = await callChatGPT(systemPrompt, history);
      await supabase
        .from("agent_messages")
        .insert({ conversation_id: convId, role: "assistant", content: reply });
      return NextResponse.json({ conversationId: convId, reply });
    }

    // ── Streaming path.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sseFrame("meta", { conversationId: convId }));
        let full = "";
        try {
          for await (const delta of streamChatGPT(systemPrompt, history)) {
            full += delta;
            controller.enqueue(sseFrame("token", { delta }));
          }
          // Persist the assistant turn. If this fails we still emit `done`
          // so the client renders the reply — losing the write is better
          // than showing a broken UI mid-stream.
          try {
            await supabase
              .from("agent_messages")
              .insert({ conversation_id: convId, role: "assistant", content: full });
          } catch (e) {
            console.error("agent_messages insert failed after stream:", e);
          }
          controller.enqueue(sseFrame("done", { ok: true }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "stream_error";
          controller.enqueue(sseFrame("error", { error: msg }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("agent chat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
