import { NextResponse } from "next/server";

import { type ConfidentialReviewDraft } from "@/lib/confidential-review";
import { ShadowPilotRequestAuthError, requirePrivyWallet } from "@/lib/server/privy-auth";
import { sealConfidentialReview } from "@/lib/server/arcium-review-vault";
import { writeConfidentialReviewRecord } from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfidentialReviewDraft;
    await requirePrivyWallet(request, body.buyer);

    const sealed = await sealConfidentialReview(body);
    await writeConfidentialReviewRecord(sealed.record);

    return NextResponse.json({
      nextReputationCommitment: sealed.nextReputationCommitment,
      reviewCommitment: sealed.reviewCommitment,
      reviewId: sealed.reviewId,
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The confidential review package could not be sealed.",
      },
      { status: 500 },
    );
  }
}
