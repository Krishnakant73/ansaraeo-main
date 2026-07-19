// ============================================================
// Thin wrapper around Meta's WhatsApp Business Cloud API.
//
// IMPORTANT — WhatsApp Business API rules (see BATCH13_SETUP_NOTES.md
// for full setup): outside a 24-hour window since the customer last
// messaged you, you can ONLY send pre-approved "template" messages, not
// free-form text. sendTemplateMessage() is what you'll use for
// unprompted alerts/digests (the common case for this feature).
// sendTextMessage() only works within 24 hours of an inbound message
// from that number (e.g., replying to their "APPROVE" message).
// ============================================================

const GRAPH_API_VERSION = "v21.0";

async function callWhatsAppAPI(body: Record<string, unknown>) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WhatsApp API error: ${res.status} ${await res.text()}`);
  return res.json();
}

// For sending an APPROVED TEMPLATE message (required for the first
// message / any message outside the 24-hour customer-service window).
// You must create and get this template approved in Meta Business
// Manager first — see setup notes. `params` fills the template's {{1}},
// {{2}}, etc. placeholders in order.
export async function sendTemplateMessage(to: string, templateName: string, params: string[]) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}

// For free-form replies WITHIN 24 hours of the customer's last inbound
// message (e.g., confirming "Got it, publishing now" after they reply
// APPROVE). Will fail outside that window — use sendTemplateMessage instead.
export async function sendTextMessage(to: string, text: string) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}
