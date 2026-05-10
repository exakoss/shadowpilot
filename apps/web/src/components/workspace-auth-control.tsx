"use client";

import clsx from "clsx";
import { compactAddress } from "@shadowpilot/shared";

import { useWalletBalance } from "@/hooks/use-wallet-balance";

import { AuthIdentityAvatar } from "./auth-identity-avatar";
import { useShadowPilotAuth } from "./shadowpilot-auth-provider";

export function WorkspaceAuthControl({ className }: { className?: string }) {
  const {
    authActionPending,
    configured,
    connectedWallet,
    login,
    profileDisplayName,
    profileImageUrl,
    ready,
    walletLabel,
  } = useShadowPilotAuth();
  const { balanceLabel, fetching } = useWalletBalance(connectedWallet);

  if (!connectedWallet) {
    return (
      <button
        type="button"
        onClick={login}
        disabled={!configured || !ready || authActionPending}
        className={clsx(
          "inline-flex min-w-[8.75rem] items-center justify-center rounded-[18px] border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-[var(--brand-blue-strong)] disabled:cursor-not-allowed disabled:opacity-55",
          className,
        )}
      >
        {authActionPending ? "Connecting" : ready ? "Connect" : "Loading"}
      </button>
    );
  }

  const identityLabel = profileDisplayName?.trim() || walletLabel || "Connected wallet";

  return (
    <div
      className={clsx(
        "flex min-w-[11rem] max-w-[14rem] items-center gap-3 rounded-[22px] border border-[var(--line)] bg-white px-3 py-2 shadow-[0_8px_22px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <AuthIdentityAvatar
        address={connectedWallet}
        imageUrl={profileImageUrl}
        name={identityLabel}
        size="sm"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text)]">
          {compactAddress(connectedWallet)}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
          {balanceLabel ?? (fetching ? "Loading balance" : "Balance unavailable")}
        </p>
      </div>
    </div>
  );
}
