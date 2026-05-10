import { signRequest } from "@worldcoin/idkit/signing";
import { NextResponse } from "next/server";

import { WORLD_PILOT_ACTION, WORLD_RP_ID } from "@/lib/world-id";

export async function POST(request: Request) {
  const signingKeyHex = process.env.WORLD_RP_SIGNING_KEY;
  if (!signingKeyHex || !WORLD_RP_ID) {
    return NextResponse.json(
      {
        error:
          "World ID signing is not configured. Add NEXT_PUBLIC_WORLD_RP_ID and WORLD_RP_SIGNING_KEY.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { action?: string };
  const action = payload.action?.trim() || WORLD_PILOT_ACTION;
  if (action !== WORLD_PILOT_ACTION) {
    return NextResponse.json(
      { error: "This server only signs the ShadowPilot pilot-verification action." },
      { status: 400 },
    );
  }

  const signature = signRequest({
    action,
    signingKeyHex,
  });

  return NextResponse.json({
    created_at: signature.createdAt,
    expires_at: signature.expiresAt,
    nonce: signature.nonce,
    sig: signature.sig,
  });
}
