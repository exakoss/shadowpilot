"use client";

import { useEffect, useState } from "react";

import { useShadowPilotAuth } from "@/components/shadowpilot-auth-provider";
import {
  resolveSubmissionManifestUrl,
  type SubmissionManifest,
} from "@/lib/submission-artifacts";

type SubmissionManifestState = {
  error: string | null;
  manifest: SubmissionManifest | null;
  resolvedUrl: string | null;
};

export function useSubmissionManifest(traceUri: string | null | undefined) {
  const manifestUrl = resolveSubmissionManifestUrl(traceUri);
  const { buildApiHeaders, connectedWallet } = useShadowPilotAuth();
  const [state, setState] = useState<SubmissionManifestState>({
    error: null,
    manifest: null,
    resolvedUrl: null,
  });

  useEffect(() => {
    if (!manifestUrl || !connectedWallet) {
      return;
    }

    let cancelled = false;

    async function loadManifest() {
      try {
        const response = await fetch(manifestUrl as string, {
          cache: "no-store",
          headers: buildApiHeaders(),
        });
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(errorPayload?.error ?? "The submission package could not be loaded.");
        }
        const manifest = (await response.json()) as SubmissionManifest;
        if (cancelled) {
          return;
        }
        setState({
          error: null,
          manifest,
          resolvedUrl: manifestUrl,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setState({
          error: error instanceof Error ? error.message : String(error),
          manifest: null,
          resolvedUrl: manifestUrl,
        });
      }
    }

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, [buildApiHeaders, connectedWallet, manifestUrl]);

  if (!manifestUrl) {
    return {
      error: null,
      isLoading: false,
      manifest: null,
      resolvedUrl: null,
    };
  }

  if (!connectedWallet) {
    return {
      error: "Connect the buyer or pilot wallet to open the private submission package.",
      isLoading: false,
      manifest: null,
      resolvedUrl: manifestUrl,
    };
  }

  const isCurrentResult = state.resolvedUrl === manifestUrl;

  return {
    error: isCurrentResult ? state.error : null,
    isLoading: !isCurrentResult,
    manifest: isCurrentResult ? state.manifest : null,
  };
}
