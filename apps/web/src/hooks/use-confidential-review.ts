"use client";

import { useEffect, useState } from "react";

import { useShadowPilotAuth } from "@/components/shadowpilot-auth-provider";
import {
  buildConfidentialReviewId,
  type ConfidentialReviewPayload,
} from "@/lib/confidential-review";

type ConfidentialReviewState = {
  error: string | null;
  payload: ConfidentialReviewPayload | null;
  record:
    | {
        createdAt: string;
        nextReputationCommitment: string;
        payoutLamports: string;
        payoutTier: number;
        reviewCommitment: string;
        reviewId: string;
        score: number;
        submissionUrl: string | null;
        usageRights: string;
      }
    | null;
  reviewId: string | null;
};

export function useConfidentialReview(claimAddress: string | null | undefined) {
  const { buildApiHeaders, connectedWallet } = useShadowPilotAuth();
  const reviewId = claimAddress ? buildConfidentialReviewId(claimAddress) : null;
  const [state, setState] = useState<ConfidentialReviewState>({
    error: null,
    payload: null,
    record: null,
    reviewId: null,
  });

  useEffect(() => {
    if (!reviewId || !connectedWallet) {
      return;
    }

    let cancelled = false;

    async function loadReview() {
      try {
        const response = await fetch(`/api/reviews/${reviewId}`, {
          cache: "no-store",
          headers: buildApiHeaders(),
        });
        if (!response.ok) {
          if (response.status === 404) {
            if (cancelled) {
              return;
            }

            setState({
              error: null,
              payload: null,
              record: null,
              reviewId,
            });
            return;
          }

          const errorPayload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorPayload?.error ?? "The confidential review package could not be opened.",
          );
        }

        const payload = (await response.json()) as ConfidentialReviewState;
        if (cancelled) {
          return;
        }

        setState({
          error: null,
          payload: payload.payload,
          record: payload.record,
          reviewId,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          error: error instanceof Error ? error.message : String(error),
          payload: null,
          record: null,
          reviewId,
        });
      }
    }

    void loadReview();

    return () => {
      cancelled = true;
    };
  }, [buildApiHeaders, connectedWallet, reviewId]);

  if (!reviewId) {
    return {
      error: null,
      isLoading: false,
      payload: null,
      record: null,
    };
  }

  if (!connectedWallet) {
    return {
      error: "Connect the buyer or pilot wallet to open the confidential review package.",
      isLoading: false,
      payload: null,
      record: null,
    };
  }

  const isCurrentResult = state.reviewId === reviewId;

  return {
    error: isCurrentResult ? state.error : null,
    isLoading: !isCurrentResult,
    payload: isCurrentResult ? state.payload : null,
    record: isCurrentResult ? state.record : null,
  };
}
