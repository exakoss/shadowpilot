"use client";

import clsx from "clsx";
import { address, lamports } from "@solana/kit";
import { useClusterState, useSolanaClient, useWalletActions } from "@solana/react-hooks";
import { useEffect, useState } from "react";

import { useShadowPilotProgram } from "@/hooks/use-shadowpilot-program";
import { findClusterOption, formatEndpointHost, clusterOptions } from "@/lib/cluster-options";

import { useShadowPilotAuth } from "./shadowpilot-auth-provider";
import { StatusPill } from "./status-pill";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return error ? String(error) : null;
}

function compactAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatLamports(lamports: bigint | null) {
  if (lamports === null) {
    return null;
  }

  return `${(Number(lamports) / 1_000_000_000).toFixed(2)} SOL`;
}

export function MissionControlStrip() {
  const client = useSolanaClient();
  const cluster = useClusterState();
  const {
    connectedWallet,
    configured,
    login,
    logout,
    logoutActionPending,
    ready,
    walletLabel,
    wallets,
  } =
    useShadowPilotAuth();
  const { deploymentQuery, latestMission, latestReceipt, missionMetrics, resetDemoHistory, stateQuery } =
    useShadowPilotProgram();
  const { setCluster } = useWalletActions();

  const [switchingClusterId, setSwitchingClusterId] = useState<string | null>(null);
  const [airdropState, setAirdropState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [airdropMessage, setAirdropMessage] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<{
    error: string | null;
    fetching: boolean;
    lamports: bigint | null;
  }>({
    error: null,
    fetching: false,
    lamports: null,
  });
  const [demoResetState, setDemoResetState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [demoResetMessage, setDemoResetMessage] = useState<string | null>(null);

  const activeCluster = findClusterOption(cluster.endpoint);
  const clusterError = cluster.status.status === "error" ? formatError(cluster.status.error) : null;
  const liveStateStatus = deploymentQuery.isLoading
    ? "Scanning state"
    : deploymentQuery.data?.deployed
      ? "Program live"
      : "Awaiting deploy";
  const canRequestAirdrop =
    connectedWallet &&
    (activeCluster?.id === "devnet" || activeCluster?.id === "localnet") &&
    airdropState !== "pending";

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      if (!connectedWallet) {
        setBalanceState({
          error: null,
          fetching: false,
          lamports: null,
        });
        return;
      }

      setBalanceState((current) => ({
        ...current,
        error: null,
        fetching: true,
      }));

      try {
        const lamports = await client.actions.fetchBalance(address(connectedWallet));
        if (cancelled) {
          return;
        }

        setBalanceState({
          error: null,
          fetching: false,
          lamports,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBalanceState({
          error: formatError(error),
          fetching: false,
          lamports: null,
        });
      }
    }

    void loadBalance();

    return () => {
      cancelled = true;
    };
  }, [airdropState, client.actions, cluster.endpoint, connectedWallet]);

  async function handleClusterChange(clusterId: "devnet" | "localnet") {
    const nextCluster = clusterOptions.find((option) => option.id === clusterId);
    if (!nextCluster || nextCluster.endpoint === cluster.endpoint) {
      return;
    }

    setSwitchingClusterId(clusterId);
    try {
      await setCluster(nextCluster.endpoint, {
        websocketEndpoint: nextCluster.websocketEndpoint,
      });
      setAirdropState("idle");
      setAirdropMessage(null);
    } finally {
      setSwitchingClusterId(null);
    }
  }

  async function handleAirdrop() {
    if (!connectedWallet) {
      return;
    }

    setAirdropState("pending");
    setAirdropMessage(null);

    try {
      const signature = await client.actions.requestAirdrop(
        address(connectedWallet),
        lamports(1_000_000_000n),
      );
      setAirdropState("done");
      setAirdropMessage(`Airdrop queued: ${String(signature).slice(0, 12)}...`);
    } catch (airdropError) {
      setAirdropState("error");
      setAirdropMessage(formatError(airdropError));
    }
  }

  async function handleDemoReset() {
    setDemoResetState("pending");
    setDemoResetMessage(null);

    try {
      await resetDemoHistory();
      setDemoResetState("done");
      setDemoResetMessage("Demo history cleared for this workspace. New devnet tasks will be shown from this point forward.");
    } catch (error) {
      setDemoResetState("error");
      setDemoResetMessage(formatError(error));
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
      <article className="panel rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">System Status</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Cluster and program state</h2>
          </div>
          <StatusPill
            label={cluster.status.status}
            tone={
              cluster.status.status === "ready"
                ? "good"
                : cluster.status.status === "error"
                  ? "critical"
                  : "warning"
            }
          />
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
          This is the live system panel for ShadowPilot: active cluster, program health, public task
          counts, and the newest receipt activity on the selected network.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {clusterOptions.map((option) => {
            const selected = cluster.endpoint === option.endpoint;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleClusterChange(option.id)}
                disabled={switchingClusterId !== null}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  selected
                    ? "border-[var(--line-strong)] bg-[rgba(218,123,35,0.1)] text-[var(--text)]"
                    : "border-[var(--line)] text-[var(--text-muted)] hover:border-[rgba(23,33,44,0.18)] hover:text-[var(--text)]",
                  switchingClusterId === option.id && "opacity-60",
                )}
              >
                {switchingClusterId === option.id ? `Switching to ${option.label}` : option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Current endpoint</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">
              {activeCluster?.label ?? "Custom RPC"}
            </p>
            <p className="mt-1 font-[var(--font-ibm-plex-mono)] text-xs text-[var(--text-muted)]">
              {formatEndpointHost(cluster.endpoint)}
            </p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Websocket</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">
              {cluster.websocketEndpoint ? formatEndpointHost(cluster.websocketEndpoint) : "Derived"}
            </p>
            <p className="mt-1 font-[var(--font-ibm-plex-mono)] text-xs text-[var(--text-muted)]">
              Commitment follows the provider defaults for the active cluster.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Program</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">{liveStateStatus}</p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Missions</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">{missionMetrics.total}</p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Available tasks</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">{missionMetrics.open}</p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Receipts</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {missionMetrics.receipts}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Latest mission</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">
              {latestMission?.task.title ?? (stateQuery.isLoading ? "Refreshing..." : "No public mission yet")}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {latestMission
                ? `${latestMission.task.environment} • ${latestMission.task.status}`
                : "Create a task and it will appear here."}
            </p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Latest receipt</p>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">
              {latestReceipt?.receiptMint ? compactAddress(latestReceipt.receiptMint) : "No receipt yet"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {latestReceipt
                ? `Minted by ${compactAddress(latestReceipt.buyer)} for ${compactAddress(latestReceipt.pilot)}`
                : "The next settled mission will surface its rights receipt here."}
            </p>
          </div>
        </div>

        {cluster.status.status === "ready" && "latencyMs" in cluster.status ? (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Observed RPC latency: {cluster.status.latencyMs ?? "n/a"} ms
          </p>
        ) : null}

        {clusterError ? <p className="mt-4 text-sm text-[var(--critical)]">{clusterError}</p> : null}
      </article>

      <article className="panel rounded-[28px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Session Settings</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Privy and signer state</h2>
          </div>
          <StatusPill
            label={
              !configured
                ? "Setup required"
                : !ready
                  ? "Preparing"
                  : connectedWallet
                    ? "Wallet live"
                    : "Signed out"
            }
            tone={
              !configured
                ? "critical"
                : connectedWallet
                ? "good"
                : !ready
                    ? "warning"
                    : "neutral"
            }
          />
        </div>

        {!configured ? (
          <div className="mt-5 rounded-[22px] border border-[var(--line)] bg-[rgba(23,33,44,0.03)] px-4 py-6 text-sm text-[var(--text-muted)]">
            Privy is not configured in this workspace yet. Add `NEXT_PUBLIC_PRIVY_APP_ID` and
            `NEXT_PUBLIC_PRIVY_CLIENT_ID` to enable the live buyer and pilot auth flow.
          </div>
        ) : connectedWallet ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Session type</p>
                <p className="mt-2 text-sm font-medium text-[var(--text)]">
                  {walletLabel ?? "Solana wallet"}
                </p>
              </div>
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Wallet</p>
                <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
                  {compactAddress(connectedWallet)}
                </p>
              </div>
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Balance</p>
                <p className="mt-2 text-sm font-medium text-[var(--text)]">
                  {balanceState.lamports !== null
                    ? formatLamports(balanceState.lamports)
                    : balanceState.fetching
                      ? "Refreshing..."
                      : "n/a"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAirdrop}
                disabled={!canRequestAirdrop}
                className="rounded-full border border-[var(--line-strong)] bg-[rgba(218,123,35,0.1)] px-4 py-2 text-sm font-medium text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {airdropState === "pending" ? "Requesting 1 SOL..." : "Request 1 SOL"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDemoReset();
                }}
                disabled={demoResetState === "pending"}
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {demoResetState === "pending" ? "Clearing demo..." : "Clear demo history"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void logout().catch((error: unknown) => {
                    console.warn("ShadowPilot sign out was interrupted.", error);
                  });
                }}
                disabled={logoutActionPending}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[rgba(23,33,44,0.18)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {logoutActionPending ? "Signing out..." : "Sign out"}
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Sign out here any time you need to switch between buyer and pilot wallets.
            </p>

            {airdropMessage ? (
              <p
                className={clsx(
                  "mt-4 text-sm",
                  airdropState === "error" ? "text-[var(--critical)]" : "text-[var(--success)]",
                )}
              >
                {airdropMessage}
              </p>
            ) : null}
            {demoResetMessage ? (
              <p
                className={clsx(
                  "mt-4 text-sm",
                  demoResetState === "error" ? "text-[var(--critical)]" : "text-[var(--success)]",
                )}
              >
                {demoResetMessage}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Continue with Privy to use the standard login popup for email, socials, embedded
              wallets, or Phantom from the same flow.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={login}
                disabled={!ready}
                className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ready ? "Continue with Privy" : "Loading Privy"}
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
              {activeCluster?.id === "localnet"
                ? "Privy-backed signing is only wired for public Solana clusters here. Switch back to devnet to transact."
                : "Use Privy for email, social, or Phantom sign-in, then reconnect as the buyer or pilot account whenever you want to switch roles."}
            </p>
          </>
        )}

        {balanceState.error ? <p className="mt-4 text-sm text-[var(--critical)]">{balanceState.error}</p> : null}
        {wallets.length > 1 ? (
          <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
            {wallets.length} Solana wallets are available in this session. ShadowPilot is using the first wallet for live signing.
          </p>
        ) : null}
      </article>
    </section>
  );
}
