import { NextResponse } from "next/server";

// Health-check endpoint for uptime monitors / load balancers.
// No auth, no DB — intentionally cheap so it stays a reliable liveness probe.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ansar-aeo",
    uptime: process.uptime(),
  });
}
