import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as "summon" | "reset" | undefined;

    // NOTE: MVP bridge. In production wire this to real OpenClaw gateway endpoints
    // with token auth via env vars and audited action allowlist.
    if (!action) {
      return NextResponse.json({ ok: false, message: "Missing action" }, { status: 400 });
    }

    if (action === "summon") {
      return NextResponse.json({ ok: true, message: "Summon signal queued (MVP bridge)." });
    }

    if (action === "reset") {
      return NextResponse.json({ ok: true, message: "Reset context signal queued (MVP bridge)." });
    }

    return NextResponse.json({ ok: false, message: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }
}
