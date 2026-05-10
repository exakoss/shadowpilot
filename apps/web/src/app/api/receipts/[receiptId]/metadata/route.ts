import { NextResponse } from "next/server";

import { readReceiptRecord } from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ receiptId: string }> },
) {
  try {
    const { receiptId } = await context.params;
    const record = await readReceiptRecord(receiptId);

    return NextResponse.json({
      attributes: [
        {
          trait_type: "Task",
          value: record.taskTitle,
        },
        {
          trait_type: "Score",
          value: record.score,
        },
        {
          trait_type: "Usage Rights",
          value: record.usageRights,
        },
        {
          trait_type: "Rights Holder",
          value: record.assetOwner ?? record.buyer,
        },
        {
          trait_type: "Pilot",
          value: record.pilot,
        },
        {
          trait_type: "Payout Lamports",
          value: record.payoutLamports,
        },
        {
          trait_type: "Confidential Review Commitment",
          value: record.reviewCommitment,
        },
      ],
      description:
        "ShadowPilot mission receipt for a reviewed robotics task. This compressed NFT anchors payout, acceptance, and reuse rights for the submitted intervention footage.",
      image: record.artworkUrl,
      name: `ShadowPilot Receipt ${receiptId.slice(-6).toUpperCase()}`,
      properties: {
        category: "image",
      },
      symbol: "SPREC",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Receipt metadata not found.",
      },
      { status: 404 },
    );
  }
}
