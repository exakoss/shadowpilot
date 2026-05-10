"use client";

import { compactAddress } from "@shadowpilot/shared";

import { AuthIdentityAvatar } from "./auth-identity-avatar";
import { useShadowPilotAuth } from "./shadowpilot-auth-provider";

export function AuthSessionCard() {
  const {
    authActionPending,
    configured,
    connectedWallet,
    login,
    logout,
    logoutActionPending,
    profileDisplayName,
    profileImageUrl,
    ready,
    walletLabel,
  } = useShadowPilotAuth();

  const identityLabel = profileDisplayName?.trim() || walletLabel || "Connected wallet";

  return (
    <div className="mt-4 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      {connectedWallet ? (
        <div className="rounded-[18px] border border-[var(--line)] bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center gap-3">
            <AuthIdentityAvatar
              address={connectedWallet}
              imageUrl={profileImageUrl}
              name={identityLabel}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{identityLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {compactAddress(connectedWallet)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void logout().catch((error: unknown) => {
                  console.warn("ShadowPilot sign out was interrupted.", error);
                });
              }}
              disabled={logoutActionPending}
              className="shrink-0 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {logoutActionPending ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={login}
            disabled={!configured || !ready || authActionPending}
            className="w-full rounded-[18px] border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[var(--brand-blue-strong)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {authActionPending ? "Connecting" : "Connect"}
          </button>
          <p className="mt-2.5 text-xs leading-5 text-[var(--text-muted)]">
            {configured
              ? "Email, socials, and Phantom all flow through the same Privy popup."
              : "Add NEXT_PUBLIC_PRIVY_APP_ID to enable the Privy login popup."}
          </p>
        </>
      )}
    </div>
  );
}
