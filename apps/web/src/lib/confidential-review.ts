import { type ShadowPilotUsageRights } from "@/lib/shadowpilot-program";

export const SHADOWPILOT_CONFIDENTIAL_REVIEW_SCHEMA = "shadowpilot_confidential_review_v1";
export const SHADOWPILOT_CONFIDENTIAL_REVIEW_ALGORITHM = "arcium_x25519_aes256ctr_v1";

export type ConfidentialReviewDraft = {
  buyer: string;
  claimAddress: string;
  currentReputationCommitment: string;
  environment: string;
  pilot: string;
  payoutLamports: string;
  payoutTier: number;
  reviewNotes: string;
  score: number;
  submissionUrl?: string | null;
  taskAddress: string;
  taskTitle: string;
  traceHash: string;
  usageRights: ShadowPilotUsageRights;
};

export type ConfidentialReviewPayload = ConfidentialReviewDraft & {
  createdAt: string;
  reputationDeltaLabel: string;
  reviewId: string;
  schema: typeof SHADOWPILOT_CONFIDENTIAL_REVIEW_SCHEMA;
};

export type SealedConfidentialReview = {
  algorithm: typeof SHADOWPILOT_CONFIDENTIAL_REVIEW_ALGORITHM;
  ciphertext: string;
  ephemeralPublicKey: string;
  nonce: string;
  sdk: "@arcium-hq/client";
  vaultPublicKey: string;
};

export type ConfidentialReviewRecord = {
  buyer: string;
  claimAddress: string;
  createdAt: string;
  environment: string;
  nextReputationCommitment: string;
  pilot: string;
  payoutLamports: string;
  payoutTier: number;
  reviewCommitment: string;
  reviewId: string;
  score: number;
  sealed: SealedConfidentialReview;
  submissionUrl: string | null;
  taskAddress: string;
  taskTitle: string;
  traceHash: string;
  usageRights: ShadowPilotUsageRights;
};

export function buildConfidentialReviewId(claimAddress: string) {
  return `review-${claimAddress}`;
}

export function buildConfidentialReviewUrl(origin: string, reviewId: string) {
  return `${origin}/api/reviews/${reviewId}`;
}
