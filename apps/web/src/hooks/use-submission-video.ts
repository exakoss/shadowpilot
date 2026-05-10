"use client";

import { useEffect, useState } from "react";

import { useShadowPilotAuth } from "@/components/shadowpilot-auth-provider";

type SubmissionVideoState = {
  error: string | null;
  objectUrl: string | null;
  resolvedUrl: string | null;
};

function normalizeVideoBlobType(contentType: string) {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("webm")) {
    return "video/webm";
  }
  if (normalized.includes("mp4")) {
    return "video/mp4";
  }
  if (normalized.includes("quicktime") || normalized.includes("mov")) {
    return "video/quicktime";
  }

  return contentType || "application/octet-stream";
}

export function useSubmissionVideo(videoUrl: string | null | undefined) {
  const { buildApiHeaders, connectedWallet } = useShadowPilotAuth();
  const resolvedVideoUrl = videoUrl ?? null;
  const [state, setState] = useState<SubmissionVideoState>({
    error: null,
    objectUrl: null,
    resolvedUrl: null,
  });

  useEffect(() => {
    if (!resolvedVideoUrl) {
      return;
    }
    if (!connectedWallet) {
      return;
    }
    const nextVideoUrl = resolvedVideoUrl;

    let cancelled = false;
    let nextObjectUrl: string | null = null;

    async function loadVideo() {
      try {
        const response = await fetch(nextVideoUrl, {
          // This footage route is private to the buyer + pilot pair.
          cache: "no-store",
          headers: buildApiHeaders(),
        });
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(errorPayload?.error ?? "The private task footage could not be loaded.");
        }

        const blob = await response.blob();
        const playableBlob = new Blob([blob], {
          type: normalizeVideoBlobType(blob.type),
        });
        nextObjectUrl = URL.createObjectURL(playableBlob);
        if (cancelled) {
          if (nextObjectUrl) {
            URL.revokeObjectURL(nextObjectUrl);
          }
          return;
        }

        setState((current) => {
          if (current.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }

          return {
            error: null,
            objectUrl: nextObjectUrl,
            resolvedUrl: nextVideoUrl,
          };
        });
      } catch (error) {
        if (cancelled) {
          if (nextObjectUrl) {
            URL.revokeObjectURL(nextObjectUrl);
          }
          return;
        }

        setState((current) => {
          if (current.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }

          return {
            error: error instanceof Error ? error.message : String(error),
            objectUrl: null,
            resolvedUrl: nextVideoUrl,
          };
        });
      }
    }

    void loadVideo();

    return () => {
      cancelled = true;
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [buildApiHeaders, connectedWallet, resolvedVideoUrl]);

  if (!resolvedVideoUrl) {
    return {
      error: null,
      isLoading: false,
      objectUrl: null,
    };
  }

  if (!connectedWallet) {
    return {
      error: "Connect the buyer or pilot wallet to load the private task footage.",
      isLoading: false,
      objectUrl: null,
    };
  }

  const isCurrentResult = state.resolvedUrl === resolvedVideoUrl;

  return {
    error: isCurrentResult ? state.error : null,
    isLoading: !isCurrentResult,
    objectUrl: isCurrentResult ? state.objectUrl : null,
  };
}
