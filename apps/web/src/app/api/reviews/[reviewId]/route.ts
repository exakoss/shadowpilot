import { NextResponse } from "next/server";

import {
  ShadowPilotRequestAuthError,
  requireSubmissionViewer,
} from "@/lib/server/privy-auth";
import { openConfidentialReview } from "@/lib/server/arcium-review-vault";
import { readConfidentialReviewRecord } from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { reviewId } = await context.params;
    const record = await readConfidentialReviewRecord(reviewId);
    await requireSubmissionViewer(request, record);
    const payload = await openConfidentialReview(record);

    return NextResponse.json({
      payload,
      record: {
        createdAt: record.createdAt,
        nextReputationCommitment: record.nextReputationCommitment,
        payoutLamports: record.payoutLamports,
        payoutTier: record.payoutTier,
        reviewCommitment: record.reviewCommitment,
        reviewId: record.reviewId,
        score: record.score,
        submissionUrl: record.submissionUrl,
        usageRights: record.usageRights,
      },
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The confidential review package was not found.",
      },
      { status: 404 },
    );
  }
}
