import type { IDKitResult } from "@worldcoin/idkit";
import { createSolanaRpc } from "@solana/kit";
import { NextResponse } from "next/server";

import {
  decodeShadowPilotProgramState,
  SHADOWPILOT_PROGRAM_ID,
  type EncodedProgramAccount,
} from "@/lib/shadowpilot-program";
import { WORLD_PILOT_ACTION, WORLD_RP_ID } from "@/lib/world-id";

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function normalizeNullifier(value: string) {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

function getNullifierFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    nullifier?: unknown;
    results?: Array<{ nullifier?: unknown; success?: unknown }>;
  };

  if (typeof record.nullifier === "string") {
    return record.nullifier;
  }

  if (Array.isArray(record.results)) {
    const match = record.results.find(
      (candidate) => candidate?.success === true && typeof candidate.nullifier === "string",
    );
    if (match && typeof match.nullifier === "string") {
      return match.nullifier;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        action?: string;
        idkitResponse?: IDKitResult;
        rp_id?: string;
        walletAddress?: string;
      }
    | null;

  if (!payload?.idkitResponse) {
    return NextResponse.json({ error: "Missing World ID proof payload." }, { status: 400 });
  }
  if ((payload.action ?? WORLD_PILOT_ACTION) !== WORLD_PILOT_ACTION) {
    return NextResponse.json(
      { error: "This verifier only accepts the ShadowPilot pilot-verification action." },
      { status: 400 },
    );
  }

  const rpId = payload.rp_id?.trim() || WORLD_RP_ID;
  if (!rpId) {
    return NextResponse.json(
      { error: "World ID RP ID is not configured on the server." },
      { status: 500 },
    );
  }

  const verifyResponse = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    body: JSON.stringify(payload.idkitResponse),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as {
    action?: string;
    error?: string;
    message?: string;
    nullifier?: string;
    results?: Array<{ nullifier?: string; success?: boolean }>;
    success?: boolean;
  };

  if (!verifyResponse.ok || verifyPayload.success !== true) {
    return NextResponse.json(
      { error: verifyPayload.message ?? verifyPayload.error ?? "World ID verification failed." },
      { status: 400 },
    );
  }
  if (verifyPayload.action && verifyPayload.action !== WORLD_PILOT_ACTION) {
    return NextResponse.json(
      { error: "World ID proof action does not match ShadowPilot's pilot-verification action." },
      { status: 400 },
    );
  }

  const nullifierHashHex = getNullifierFromPayload(verifyPayload);
  if (!nullifierHashHex) {
    return NextResponse.json(
      { error: "World ID verification succeeded but no nullifier was returned." },
      { status: 400 },
    );
  }

  if (payload.walletAddress) {
    const rpc = createSolanaRpc(SOLANA_RPC_URL);
    const accounts = await rpc
      .getProgramAccounts(SHADOWPILOT_PROGRAM_ID, {
        encoding: "base64",
      })
      .send();
    const programState = decodeShadowPilotProgramState(
      true,
      accounts as readonly EncodedProgramAccount[],
    );

    const normalized = normalizeNullifier(nullifierHashHex);
    const duplicate = programState.worldVerifications.find(
      (candidate) =>
        normalizeNullifier(candidate.nullifierHash) === normalized &&
        candidate.wallet !== payload.walletAddress,
    );

    if (duplicate) {
      return NextResponse.json(
        { error: "This World ID proof is already linked to a different pilot wallet." },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({
    nullifierHashHex,
  });
}
