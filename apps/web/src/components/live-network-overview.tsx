"use client";

import { compactAddress } from "@shadowpilot/shared";

import { useShadowPilotProgram } from "@/hooks/use-shadowpilot-program";

import { StatusPill } from "./status-pill";

function formatSol(lamports: bigint) {
  const value = (Number(lamports) / 1_000_000_000).toFixed(2).replace(/\.?0+$/u, "");
  return `${value} SOL`;
}

export function LiveNetworkOverview() {
  const {
    compactTaskStatus,
    deploymentQuery,
    latestMission,
    latestReceipt,
    missionMetrics,
    taskStatusTone,
  } = useShadowPilotProgram();

  return (
    <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="panel rounded-[30px] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Public Cluster Snapshot</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Public network status</h3>
          </div>
          <StatusPill
            label={
              deploymentQuery.isLoading
                ? "Checking cluster"
                : deploymentQuery.data?.deployed
                  ? "Program live"
                  : "Awaiting deploy"
            }
            tone={
              deploymentQuery.isLoading
                ? "warning"
                : deploymentQuery.data?.deployed
                  ? "good"
                  : "critical"
            }
          />
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
          This panel hydrates from the active RPC after the page loads. It reflects the deployment
          state of the `shadowpilot` program and the live public task, claim, profile, and receipt
          accounts it owns.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="panel-muted rounded-[22px] p-4">
            <dt className="eyebrow">Program</dt>
            <dd className="mt-2 font-[var(--font-ibm-plex-mono)] text-xs text-[var(--text)]">
              6XrFsCQR...ZSdUs
            </dd>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <dt className="eyebrow">Mission accounts</dt>
            <dd className="mt-2 text-lg font-semibold">
              {missionMetrics.total}
            </dd>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <dt className="eyebrow">Available tasks</dt>
            <dd className="mt-2 text-lg font-semibold">{missionMetrics.open}</dd>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <dt className="eyebrow">Pilot profiles</dt>
            <dd className="mt-2 text-lg font-semibold">{missionMetrics.pilotProfiles}</dd>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <dt className="eyebrow">Receipts</dt>
            <dd className="mt-2 text-lg font-semibold">{missionMetrics.receipts}</dd>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <dt className="eyebrow">Settlement in flight</dt>
            <dd className="mt-2 text-lg font-semibold">
              {missionMetrics.submitted + missionMetrics.scored + missionMetrics.paid}
            </dd>
          </div>
        </dl>

        {deploymentQuery.data?.deployed ? (
          <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">
            The read path is live. Buyer and pilot screens are reading the same public state and
            reacting to the same mission transitions.
          </p>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[var(--critical)]">
            The cluster currently returns no executable account for the program ID, so the app can
            read RPC health but cannot yet surface live mission state.
          </p>
        )}
      </div>

      <div className="panel rounded-[30px] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Latest Public Mission</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {latestMission?.task.title ?? "No public task account yet"}
            </h3>
          </div>
          <StatusPill
            label={
              latestMission
                ? compactTaskStatus(latestMission.task.status)
                : deploymentQuery.data?.deployed
                  ? "Waiting for task"
                  : "Blocked on deploy"
            }
            tone={latestMission ? taskStatusTone(latestMission.task.status) : "neutral"}
          />
        </div>

        {latestMission ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Buyer</p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {compactAddress(latestMission.task.buyer)}
                </p>
              </div>
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Escrow target</p>
                <p className="mt-2 text-lg font-semibold">
                  {formatSol(latestMission.task.payoutLamports)}
                </p>
              </div>
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Environment</p>
                <p className="mt-2 text-sm text-[var(--text)]">{latestMission.task.environment}</p>
              </div>
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Pilot</p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {latestMission.claim ? compactAddress(latestMission.claim.pilot) : "Unclaimed"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Receipt state</p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {latestMission.receipt?.receiptMint
                    ? compactAddress(latestMission.receipt.receiptMint)
                    : "No receipt minted yet"}
                </p>
              </div>
              <div className="panel-muted rounded-[22px] p-4">
                <p className="eyebrow">Latest minted receipt</p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {latestReceipt?.receiptMint ? compactAddress(latestReceipt.receiptMint) : "Pending"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[24px] border border-[var(--line)] p-4 text-sm leading-6 text-[var(--text-muted)]">
            Publish the program on the selected cluster, then create a funded task from the buyer
            console. This card will switch over to live mission state as soon as the account lands.
          </div>
        )}
      </div>
    </section>
  );
}
