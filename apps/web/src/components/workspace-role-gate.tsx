"use client";

import { compactAddress } from "@shadowpilot/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type WorkspaceRole = "buyer" | "pilot";

const ROLE_STORAGE_PREFIX = "shadowpilot:workspace-role:";
const ROLE_STORAGE_EVENT = "shadowpilot:workspace-role-change";

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "buyer" || value === "pilot";
}

function roleStorageKey(wallet: string) {
  return `${ROLE_STORAGE_PREFIX}${wallet}`;
}

function readStoredRole(connectedWallet: string | null) {
  if (!connectedWallet || typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(roleStorageKey(connectedWallet)) ?? "";
}

function subscribeToRoleChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ROLE_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ROLE_STORAGE_EVENT, onStoreChange);
  };
}

function missingBuildApiHeaders(): HeadersInit {
  throw new Error("ShadowPilot profile auth is not ready.");
}

type RemoteRoleSnapshot = {
  ready: boolean;
  role: WorkspaceRole | null;
  wallet: string | null;
};

export function useWorkspaceRolePreference(input: {
  buildApiHeaders: (headers?: HeadersInit) => HeadersInit;
  connectedWallet: string | null;
  identityToken: string | null;
} | null) {
  const buildApiHeaders = input?.buildApiHeaders ?? missingBuildApiHeaders;
  const connectedWallet = input?.connectedWallet ?? null;
  const identityToken = input?.identityToken ?? null;
  const [remoteSnapshot, setRemoteSnapshot] = useState<RemoteRoleSnapshot>({
    ready: false,
    role: null,
    wallet: null,
  });
  const storedRole = useSyncExternalStore(
    subscribeToRoleChanges,
    () => readStoredRole(connectedWallet),
    () => "",
  );
  const localRole = isWorkspaceRole(storedRole) ? storedRole : null;

  useEffect(() => {
    if (!connectedWallet) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/profile", {
          headers: buildApiHeaders(),
        });
        const payload = (await response.json().catch(() => null)) as {
          role?: unknown;
        } | null;

        if (cancelled) {
          return;
        }

        const role = isWorkspaceRole(payload?.role) ? payload.role : null;
        if (role) {
          window.localStorage.setItem(roleStorageKey(connectedWallet), role);
          window.dispatchEvent(new Event(ROLE_STORAGE_EVENT));
        }

        setRemoteSnapshot({
          ready: true,
          role,
          wallet: connectedWallet,
        });
      } catch (error) {
        console.warn("ShadowPilot profile could not be loaded.", error);
        if (!cancelled) {
          setRemoteSnapshot({
            ready: true,
            role: null,
            wallet: connectedWallet,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buildApiHeaders, connectedWallet, identityToken]);

  const saveRemoteRole = useCallback(
    async (nextRole: WorkspaceRole) => {
      if (!connectedWallet) {
        return;
      }

      const response = await fetch("/api/profile", {
        body: JSON.stringify({ role: nextRole }),
        headers: buildApiHeaders({
          "content-type": "application/json",
        }),
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`Profile save failed with HTTP ${response.status}.`);
      }
    },
    [buildApiHeaders, connectedWallet],
  );

  useEffect(() => {
    if (!connectedWallet || !localRole) {
      return;
    }

    void saveRemoteRole(localRole).catch((error: unknown) => {
      console.warn("ShadowPilot profile could not be saved.", error);
    });
  }, [connectedWallet, identityToken, localRole, saveRemoteRole]);

  const chooseRole = useCallback(
    (nextRole: WorkspaceRole) => {
      if (!connectedWallet) {
        return;
      }

      window.localStorage.setItem(roleStorageKey(connectedWallet), nextRole);
      window.dispatchEvent(new Event(ROLE_STORAGE_EVENT));

      void saveRemoteRole(nextRole)
        .catch((error: unknown) => {
          console.warn("ShadowPilot profile could not be saved.", error);
        });
    },
    [connectedWallet, saveRemoteRole],
  );
  const remoteRole =
    remoteSnapshot.wallet === connectedWallet && remoteSnapshot.ready ? remoteSnapshot.role : null;
  const remoteReady = remoteSnapshot.wallet === connectedWallet && remoteSnapshot.ready;

  return {
    chooseRole,
    ready: !connectedWallet || Boolean(localRole) || !identityToken || remoteReady,
    role: localRole ?? remoteRole,
  };
}

export function WorkspaceRoleGate({
  connectedWallet,
  onChooseRole,
}: {
  connectedWallet: string;
  onChooseRole: (role: WorkspaceRole) => void;
}) {
  const router = useRouter();

  function choose(role: WorkspaceRole) {
    onChooseRole(role);
    router.push(role === "buyer" ? "/buyer?section=all-tasks" : "/pilot?section=all-tasks");
  }

  return (
    <section className="panel rounded-[34px] p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Choose workspace</p>
          <h3 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[var(--text)]">
            How do you want to enter ShadowPilot?
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Wallet connected: {compactAddress(connectedWallet)}
          </p>
        </div>
        <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
          World ID off for this run
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => choose("buyer")}
          className="rounded-[24px] border border-[var(--line)] bg-white p-5 text-left transition hover:border-[var(--line-strong)] hover:bg-[var(--background-muted)]"
        >
          <p className="eyebrow">Buyer</p>
          <h4 className="mt-3 text-xl font-semibold text-[var(--text)]">Post and review tasks</h4>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Fund escrow, inspect pilot submissions, release payout, and mint the buyer-held cNFT.
          </p>
        </button>

        <button
          type="button"
          onClick={() => choose("pilot")}
          className="rounded-[24px] border border-[var(--line)] bg-white p-5 text-left transition hover:border-[var(--line-strong)] hover:bg-[var(--background-muted)]"
        >
          <p className="eyebrow">Pilot</p>
          <h4 className="mt-3 text-xl font-semibold text-[var(--text)]">Claim and submit work</h4>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Browse open missions, claim one with this wallet, complete the run, and submit the package.
          </p>
        </button>
      </div>
    </section>
  );
}
