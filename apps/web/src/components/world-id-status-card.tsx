"use client";

import { compactAddress } from "@shadowpilot/shared";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { useMemo, useState } from "react";

import { type WorldVerificationAccount } from "@/lib/shadowpilot-program";
import {
  compactWorldNullifier,
  WORLD_APP_ID,
  WORLD_ENVIRONMENT,
  WORLD_ID_CONFIGURED,
  WORLD_PILOT_ACTION,
  WORLD_RP_ID,
} from "@/lib/world-id";

import { IntegrationBadge, IntegrationCard } from "./integration-badge";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill, type Tone } from "./status-pill";

function formatVerifiedAt(timestamp: number) {
  if (!timestamp || timestamp <= 0) {
    return "Pending";
  }

  return new Date(timestamp * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTone({
  connectedWallet,
  verification,
}: {
  connectedWallet: string | null;
  verification: WorldVerificationAccount | null;
}): Tone {
  if (!WORLD_ID_CONFIGURED) {
    return "critical";
  }
  if (verification) {
    return "good";
  }
  if (connectedWallet) {
    return "warning";
  }
  return "neutral";
}

function getLabel({
  connectedWallet,
  verification,
}: {
  connectedWallet: string | null;
  verification: WorldVerificationAccount | null;
}) {
  if (!WORLD_ID_CONFIGURED) {
    return "Setup required";
  }
  if (verification) {
    return "Linked";
  }
  if (connectedWallet) {
    return "Ready";
  }
  return "Connect wallet";
}

export function WorldIdStatusCard({
  connectedWallet,
  isSending,
  onLink,
  verification,
}: {
  connectedWallet: string | null;
  isSending: boolean;
  onLink: (nullifierHashHex: string) => Promise<unknown>;
  verification: WorldVerificationAccount | null;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [worldStep, setWorldStep] = useState<"idle" | "preparing" | "verifying">("idle");

  const widgetPreset = useMemo(() => orbLegacy(), []);

  async function handlePrepareWorldId() {
    if (!connectedWallet) {
      setLocalError("Connect the pilot wallet before linking World ID.");
      return;
    }
    if (!WORLD_ID_CONFIGURED) {
      setLocalError(
        "Add NEXT_PUBLIC_WORLD_APP_ID and NEXT_PUBLIC_WORLD_RP_ID before opening the World ID flow.",
      );
      return;
    }

    setLocalError(null);
    setWorldStep("preparing");

    try {
      const response = await fetch("/api/world/rp-signature", {
        body: JSON.stringify({ action: WORLD_PILOT_ACTION }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as
        | {
            created_at: number;
            error?: string;
            expires_at: number;
            nonce: string;
            sig: string;
          }
        | { error?: string };

      if (!response.ok || !("sig" in payload)) {
        throw new Error(payload.error ?? "Unable to prepare a World ID request.");
      }

      setRpContext({
        created_at: payload.created_at,
        expires_at: payload.expires_at,
        nonce: payload.nonce,
        rp_id: WORLD_RP_ID,
        signature: payload.sig,
      });
      setModalOpen(true);
      setWorldStep("idle");
    } catch (error) {
      setWorldStep("idle");
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleVerify(idkitResponse: IDKitResult) {
    if (!connectedWallet) {
      throw new Error("Connect the pilot wallet before linking World ID.");
    }

    setWorldStep("verifying");
    setLocalError(null);

    const response = await fetch("/api/world/verify", {
      body: JSON.stringify({
        action: WORLD_PILOT_ACTION,
        idkitResponse,
        rp_id: WORLD_RP_ID,
        walletAddress: connectedWallet,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      nullifierHashHex?: string;
    };

    if (!response.ok || typeof payload.nullifierHashHex !== "string") {
      setWorldStep("idle");
      throw new Error(payload.error ?? "World ID verification failed.");
    }

    try {
      await onLink(payload.nullifierHashHex);
      setWorldStep("idle");
    } catch (error) {
      setWorldStep("idle");
      throw error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unable to sync World ID onchain.");
    }
  }

  return (
    <article className="panel rounded-[26px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationBadge kind="world" />
            <PrivacyPill scope="pilot" label="Human gate" />
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
            Human verification
          </h3>
        </div>
        <StatusPill
          label={getLabel({ connectedWallet, verification })}
          tone={getTone({ connectedWallet, verification })}
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
        Buyers can require a linked human proof before a pilot can accept a task. ShadowPilot keeps
        the task gate public, while the World proof itself is reduced to a compact onchain link for
        the connected wallet.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="panel-muted rounded-[20px] p-4">
          <p className="eyebrow">Connected wallet</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text)]">
            {connectedWallet ? compactAddress(connectedWallet) : "Not connected"}
          </p>
        </div>
        <div className="panel-muted rounded-[20px] p-4">
          <p className="eyebrow">Linked nullifier</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text)]">
            {compactWorldNullifier(verification?.nullifierHash)}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {verification ? `Linked ${formatVerifiedAt(verification.verifiedAt)}` : "No onchain World link yet."}
          </p>
        </div>
      </div>

      {!WORLD_ID_CONFIGURED ? (
        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
          Add `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_WORLD_RP_ID`, and `WORLD_RP_SIGNING_KEY`
          to open the live World ID flow.
        </p>
      ) : null}

      <IntegrationCard
        className="mt-5"
        kind="world"
        title="Why World ID shows up here"
        description="Buyer tasks can be marked as human-gated, and this linked World ID state is what unlocks those claims for the connected pilot wallet."
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void handlePrepareWorldId();
          }}
          disabled={!connectedWallet || isSending || worldStep !== "idle" || !WORLD_ID_CONFIGURED}
          className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {worldStep === "preparing"
            ? "Preparing World ID"
            : worldStep === "verifying" || isSending
              ? "Syncing human proof"
              : verification
                ? "Re-verify World ID"
                : "Link World ID"}
        </button>
      </div>

      {localError ? <p className="mt-4 text-sm text-[var(--critical)]">{localError}</p> : null}

      {rpContext ? (
        <IDKitRequestWidget
          action={WORLD_PILOT_ACTION}
          allow_legacy_proofs
          app_id={WORLD_APP_ID as `app_${string}`}
          autoClose={false}
          environment={WORLD_ENVIRONMENT}
          handleVerify={handleVerify}
          onError={(errorCode) => {
            setWorldStep("idle");
            setLocalError(`World ID returned ${errorCode}.`);
          }}
          onOpenChange={(open) => setModalOpen(open)}
          onSuccess={() => {
            setModalOpen(false);
            setWorldStep("idle");
          }}
          open={modalOpen}
          preset={widgetPreset}
          rp_context={rpContext}
        />
      ) : null}
    </article>
  );
}
