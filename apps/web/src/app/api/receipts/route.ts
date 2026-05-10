import { NextResponse } from "next/server";

import { mintReceiptCnft } from "@/lib/server/bubblegum-receipts";
import { ShadowPilotRequestAuthError, requirePrivyWallet } from "@/lib/server/privy-auth";
import {
  buildReceiptArtworkUrl,
  buildReceiptMetadataUrl,
  readConfidentialReviewRecord,
  readReceiptRecord,
  type ReceiptRecord,
  writeReceiptRecord,
} from "@/lib/server/shadowpilot-storage";
import { type ShadowPilotUsageRights } from "@/lib/shadowpilot-program";

export const runtime = "nodejs";

type ReceiptRequest = {
  buyer: string;
  claimAddress: string;
  environment: string;
  payoutLamports: string;
  pilot: string;
  reviewCommitment: string;
  reviewId: string;
  reviewNotes?: string;
  score: number;
  submissionUrl?: string | null;
  taskAddress: string;
  taskTitle: string;
  usageRights: ShadowPilotUsageRights;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReceiptRequest;
    await requirePrivyWallet(request, body.buyer);
    const origin = new URL(request.url).origin;
    const receiptId = `receipt-${body.claimAddress}`;
    const reviewRecord = await readConfidentialReviewRecord(body.reviewId);

    if (
      reviewRecord.claimAddress !== body.claimAddress ||
      reviewRecord.buyer !== body.buyer ||
      reviewRecord.reviewCommitment !== body.reviewCommitment
    ) {
      return NextResponse.json(
        {
          error: "The receipt request does not match the sealed Arcium review package.",
        },
        { status: 400 },
      );
    }

    const existingRecord = await readReceiptRecord(receiptId).catch(() => null);
    if (existingRecord && existingRecord.buyer !== body.buyer) {
      return NextResponse.json(
        {
          error: "This receipt is already bound to a different buyer wallet.",
        },
        { status: 403 },
      );
    }
    if (
      existingRecord?.assetId &&
      existingRecord.buyer === body.buyer &&
      existingRecord.assetOwner === body.buyer
    ) {
      return NextResponse.json({
        assetId: existingRecord.assetId,
        metadataUrl: existingRecord.metadataUrl,
        receiptId,
        signature: existingRecord.signature,
        treeAddress: existingRecord.treeAddress,
      });
    }

    const record: ReceiptRecord = {
      artworkUrl: buildReceiptArtworkUrl(origin, receiptId),
      assetId: null,
      assetOwner: body.buyer,
      buyer: body.buyer,
      claimAddress: body.claimAddress,
      createdAt: new Date().toISOString(),
      environment: body.environment,
      metadataUrl: buildReceiptMetadataUrl(origin, receiptId),
      payoutLamports: body.payoutLamports,
      pilot: body.pilot,
      receiptId,
      reviewCommitment: body.reviewCommitment,
      reviewId: body.reviewId,
      reviewNotes: body.reviewNotes?.trim() ?? "",
      score: body.score,
      signature: null,
      submissionUrl: body.submissionUrl ?? null,
      taskAddress: body.taskAddress,
      taskTitle: body.taskTitle,
      treeAddress: null,
      usageRights: body.usageRights,
    };

    await writeReceiptRecord(record);

    const minted = await mintReceiptCnft(record);
    const completedRecord: ReceiptRecord = {
      ...record,
      assetId: minted.assetId,
      signature: String(minted.signature),
      treeAddress: minted.merkleTree,
    };

    await writeReceiptRecord(completedRecord);

    return NextResponse.json({
      assetId: completedRecord.assetId,
      metadataUrl: completedRecord.metadataUrl,
      receiptId,
      signature: completedRecord.signature,
      treeAddress: completedRecord.treeAddress,
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The cNFT receipt could not be prepared.",
      },
      { status: 500 },
    );
  }
}
