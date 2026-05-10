"use client";

import { compactAddress } from "@shadowpilot/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useShadowPilotProgram } from "@/hooks/use-shadowpilot-program";
import { type LiveMission } from "@/lib/shadowpilot-program";
import {
  countMissionsByLane,
  getTaskLaneFromMission,
  getTaskPackageStatus,
} from "@/lib/task-lane";

import { LiveNetworkOverview } from "./live-network-overview";
import { MissionControlStrip } from "./mission-control-strip";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";
import { TaskFlowPanel } from "./task-flow-panel";
import { TaskLanePill } from "./task-lane-pill";

type OverviewSection = "all-tasks" | "network-activity" | "settings";

function normalizeOverviewSection(value: string | null): OverviewSection {
  switch (value) {
    case "network-activity":
      return "network-activity";
    case "settings":
      return "settings";
    case "all-tasks":
    default:
      return "all-tasks";
  }
}

function formatSol(lamports: bigint) {
  const value = (Number(lamports) / 1_000_000_000).toFixed(2).replace(/\.?0+$/u, "");
  return `${value} SOL`;
}

function missionRank(status: LiveMission["task"]["status"]) {
  switch (status) {
    case "open":
      return 0;
    case "claimed":
      return 1;
    case "submitted":
      return 2;
    case "scored":
      return 3;
    case "paid":
      return 4;
    case "closed":
      return 5;
  }
}

export function OverviewConsole() {
  const searchParams = useSearchParams();
  const {
    compactTaskStatus,
    connectedWallet,
    latestReceipt,
    missionMetrics,
    missions,
    taskStatusTone,
  } = useShadowPilotProgram();
  const [selectedMissionAddress, setSelectedMissionAddress] = useState<string | null>(null);
  const activeSection = normalizeOverviewSection(searchParams.get("section"));

  const allMissions = [...missions].sort((left, right) => {
    const rankDelta = missionRank(left.task.status) - missionRank(right.task.status);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return right.task.createdAt - left.task.createdAt;
  });
  const buyerActive = allMissions.filter(
    (mission) => mission.task.status !== "paid" && mission.task.status !== "closed",
  );
  const buyerCompleted = allMissions.filter(
    (mission) => mission.task.status === "paid" || mission.task.status === "closed",
  );
  const pilotActive = allMissions.filter(
    (mission) =>
      mission.claim !== null && mission.task.status !== "paid" && mission.task.status !== "closed",
  );
  const pilotCompleted = allMissions.filter(
    (mission) =>
      mission.claim !== null && (mission.task.status === "paid" || mission.task.status === "closed"),
  );
  const selectedMission =
    allMissions.find((mission) => mission.task.address === selectedMissionAddress) ??
    allMissions[0] ??
    null;
  const laneCounts = countMissionsByLane(allMissions);
  const viewerState = !connectedWallet
    ? { label: "Disconnected", tone: "warning" as const }
    : { label: "Wallet connected", tone: "good" as const };

  function renderTaskList(missionList: LiveMission[], emptyMessage: string) {
    if (missionList.length === 0) {
      return (
        <div className="panel-muted rounded-[24px] p-5 text-sm leading-6 text-[var(--text-muted)]">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {missionList.map((mission) => {
          const selected = selectedMission?.task.address === mission.task.address;
          const lane = getTaskLaneFromMission(mission);
          const packageStatus = getTaskPackageStatus(mission);

          return (
            <button
              key={mission.task.address}
              type="button"
              onClick={() => setSelectedMissionAddress(mission.task.address)}
              className={`w-full rounded-[24px] border p-4 text-left transition ${
                selected
                  ? "border-[var(--line-strong)] bg-[rgba(218,123,35,0.08)]"
                  : "border-[var(--line)] bg-[rgba(23,33,44,0.02)] hover:border-[rgba(23,33,44,0.18)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="eyebrow">{mission.task.address.slice(0, 6)}</p>
                    <TaskLanePill compact laneId={lane.id} />
                    <PrivacyPill scope="public" label="Public task" />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">{mission.task.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{mission.task.environment}</p>
                </div>
                <div className="text-left sm:text-right">
                  <StatusPill
                    label={compactTaskStatus(mission.task.status)}
                    tone={taskStatusTone(mission.task.status)}
                  />
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                    {formatSol(mission.task.payoutLamports)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.55)] px-3 py-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Buyer
                  </p>
                  <p className="mt-2 text-sm text-[var(--text)]">{compactAddress(mission.task.buyer)}</p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.55)] px-3 py-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Package state
                  </p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {packageStatus.label}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="panel rounded-[32px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Operations Surface</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Run robotics work through two lanes: live remote ops and humanoid capture.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              This shared ShadowPilot dashboard is now explicitly robotics-first. Buyers can post
              either remote robot operation or humanoid data collection tasks, pilots can browse
              the live pricing for both lanes, and the detail panel keeps the private submission and
              rating flow visible.
            </p>
          </div>
          <StatusPill label={viewerState.label} tone={viewerState.tone} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Connected wallet</p>
            <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
              {connectedWallet ? compactAddress(connectedWallet) : "Not connected"}
            </p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">All tasks</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{missionMetrics.total}</p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Remote ops</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{laneCounts.remote_operation}</p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Humanoid capture</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{laneCounts.humanoid_capture}</p>
          </div>
          <div className="panel-muted rounded-[22px] p-4">
            <p className="eyebrow">Latest receipt</p>
            <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
              {latestReceipt?.receiptMint ? compactAddress(latestReceipt.receiptMint) : "Pending"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/buyer"
            className="rounded-full border border-[var(--line-strong)] bg-[rgba(218,123,35,0.1)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:translate-y-[-1px]"
          >
            Open buyer workspace
          </Link>
          <Link
            href="/pilot"
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[rgba(23,33,44,0.18)]"
          >
            Open pilot workspace
          </Link>
        </div>
      </section>

      {activeSection === "all-tasks" ? (
        <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
          <article className="panel rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow">All Tasks</p>
                  <PrivacyPill scope="public" />
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Public task directory</h3>
              </div>
              <StatusPill label={`${missions.length} visible`} tone="neutral" />
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Every task below is live on the active cluster. Remote robot operations are the
              default task lane, and humanoid capture tasks use the same public market plus private
              package flow.
            </p>

            <div className="mt-6">
              {renderTaskList(allMissions, "No task accounts are visible on this cluster yet.")}
            </div>
          </article>

          <article className="panel rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow">Selected Task</p>
                  <PrivacyPill scope="public" />
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {selectedMission?.task.title ?? "No live task selected"}
                </h3>
              </div>
              <StatusPill
                label={selectedMission ? compactTaskStatus(selectedMission.task.status) : "Awaiting task"}
                tone={selectedMission ? taskStatusTone(selectedMission.task.status) : "neutral"}
              />
            </div>

            {selectedMission ? (
              <>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                  The selected task shows which robotics lane it belongs to, what remains private,
                  and how the submission package will be reviewed before payout and receipt minting.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="panel-muted rounded-[22px] p-4">
                    <p className="eyebrow">Escrow</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                      {formatSol(selectedMission.task.payoutLamports)}
                    </p>
                  </div>
                  <div className="panel-muted rounded-[22px] p-4">
                    <p className="eyebrow">Environment</p>
                    <p className="mt-2 text-sm text-[var(--text)]">{selectedMission.task.environment}</p>
                  </div>
                  <div className="panel-muted rounded-[22px] p-4">
                    <p className="eyebrow">Buyer</p>
                    <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
                      {compactAddress(selectedMission.task.buyer)}
                    </p>
                  </div>
                  <div className="panel-muted rounded-[22px] p-4">
                    <p className="eyebrow">Pilot</p>
                    <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
                      {selectedMission.claim?.pilot ? compactAddress(selectedMission.claim.pilot) : "Unclaimed"}
                    </p>
                  </div>
                </div>

                <TaskFlowPanel
                  className="mt-6"
                  mission={selectedMission}
                  buyerUnlocked={selectedMission.task.buyer === connectedWallet}
                  pilotUnlocked={selectedMission.claim?.pilot === connectedWallet}
                />
              </>
            ) : (
              <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-[rgba(23,33,44,0.03)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                Create a task and it will appear here automatically.
              </div>
            )}
          </article>
        </section>
      ) : null}

      {activeSection === "network-activity" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <article className="panel rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow">Buyer Activity</p>
                  <PrivacyPill scope="buyer" />
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Posted and completed by buyers</h3>
              </div>
              <StatusPill label={`${buyerActive.length} active`} tone="neutral" />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="eyebrow">In flight</p>
                <div className="mt-3">
                  {renderTaskList(
                    buyerActive,
                    "No buyer-posted active tasks are visible on this cluster right now.",
                  )}
                </div>
              </div>
              <div>
                <p className="eyebrow">Completed</p>
                <div className="mt-3">
                  {renderTaskList(
                    buyerCompleted,
                    "No buyer-completed tasks are visible on this cluster yet.",
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="panel rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow">Pilot Activity</p>
                  <PrivacyPill scope="pilot" />
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Taken and completed by pilots</h3>
              </div>
              <StatusPill label={`${pilotActive.length} active`} tone="neutral" />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="eyebrow">In flight</p>
                <div className="mt-3">
                  {renderTaskList(
                    pilotActive,
                    "No pilot-claimed active tasks are visible on this cluster right now.",
                  )}
                </div>
              </div>
              <div>
                <p className="eyebrow">Completed</p>
                <div className="mt-3">
                  {renderTaskList(
                    pilotCompleted,
                    "No pilot-completed tasks are visible on this cluster yet.",
                  )}
                </div>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeSection === "settings" ? (
        <div className="space-y-6">
          <MissionControlStrip />
          <LiveNetworkOverview />
        </div>
      ) : null}
    </div>
  );
}
