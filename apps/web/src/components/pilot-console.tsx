"use client";

import { compactAddress } from "@shadowpilot/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useConfidentialReview } from "@/hooks/use-confidential-review";
import { useShadowPilotProgram } from "@/hooks/use-shadowpilot-program";
import { type MissionActivity } from "@/lib/mission-activity";
import { type LiveMission } from "@/lib/shadowpilot-program";
import {
  countMissionsByLane,
  getTaskLaneFromMission,
  getTaskPackageStatus,
} from "@/lib/task-lane";

import { IntegrationCard } from "./integration-badge";
import { ConfidentialReviewPanel } from "./confidential-review-panel";
import { MissionActivityFeed } from "./mission-activity-feed";
import { MissionControlStrip } from "./mission-control-strip";
import { PilotCaptureWorkspace } from "./pilot-capture-workspace";
import { PilotTeleopWorkspace } from "./pilot-teleop-workspace";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";
import { TaskAccessLinkPanel } from "./task-access-link-panel";
import { TaskFlowPanel } from "./task-flow-panel";
import { TaskLanePill } from "./task-lane-pill";
import { WorldIdStatusCard } from "./world-id-status-card";

type PilotSection = "all-tasks" | "settings" | "task" | "your-tasks";

function normalizePilotSection(value: string | null): PilotSection {
  switch (value) {
    case "task":
      return "task";
    case "your-tasks":
      return "your-tasks";
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

function missionRankForPilot(status: LiveMission["task"]["status"]) {
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

function buildPilotEvents(mission: LiveMission): MissionActivity[] {
  const lane = getTaskLaneFromMission(mission);
  const submissionLabel =
    lane.id === "remote_operation" ? "Recovery package submitted" : "Capture package submitted";

  const events: MissionActivity[] = [
    {
      id: `${mission.task.address}-task-created`,
      at: new Date(mission.task.createdAt * 1000).toISOString(),
      detail:
        lane.id === "remote_operation"
          ? "Buyer posted a task with a robot control link for live takeover."
          : "Buyer posted a task with an upload destination for local clip capture.",
      kind: "buyer",
      label: "Task posted",
    },
  ];

  if (mission.claim) {
    events.push({
      id: `${mission.claim.address}-claim`,
      at: new Date(
        mission.claim.submittedAt > 0 ? mission.claim.submittedAt * 1000 : mission.task.createdAt * 1000,
      ).toISOString(),
      detail: `Pilot ${compactAddress(mission.claim.pilot)} owns the active claim PDA.`,
      kind: "pilot",
      label: "Claim accepted",
    });
  }

  if (mission.claim?.submittedAt) {
    events.push({
      id: `${mission.claim.address}-submitted`,
      at: new Date(mission.claim.submittedAt * 1000).toISOString(),
      detail:
        lane.id === "remote_operation"
          ? "Pilot submitted the compact replay package back to the buyer."
          : "Pilot submitted the compact capture package back to the buyer.",
      kind: "pilot",
      label: submissionLabel,
    });
  }

  if (mission.receipt?.receiptMint) {
    events.push({
      id: `${mission.receipt.address}-receipt`,
      at: new Date(mission.receipt.mintedAt * 1000).toISOString(),
      detail: "The task is settled and the cNFT receipt is now public onchain.",
      kind: "solana",
      label: "cNFT minted",
    });
  }

  return events;
}

export function PilotConsole() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    claimTask,
    compactTaskStatus,
    connectedWorldVerification,
    connectedWallet,
    latestMission,
    linkWorldIdVerification,
    missionMetrics,
    missions,
    submitMission,
    taskStatusTone,
    transaction,
  } = useShadowPilotProgram();
  const [selectedMissionAddress, setSelectedMissionAddress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const activeSection = normalizePilotSection(searchParams.get("section"));
  const taskAddressParam = searchParams.get("task");
  const detailBackSection = searchParams.get("from") === "your-tasks" ? "your-tasks" : "all-tasks";

  const allMissions = [...missions].sort((left, right) => {
    const rankDelta = missionRankForPilot(left.task.status) - missionRankForPilot(right.task.status);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return right.task.createdAt - left.task.createdAt;
  });
  const laneCounts = countMissionsByLane(allMissions);
  const openMissions = allMissions.filter((mission) => mission.task.status === "open");
  const connectedPilotMissions = connectedWallet
    ? allMissions.filter((mission) => mission.claim?.pilot === connectedWallet)
    : [];
  const currentPilotMissions = connectedPilotMissions.filter(
    (mission) => mission.task.status !== "paid" && mission.task.status !== "closed",
  );
  const completedPilotMissions = connectedPilotMissions.filter(
    (mission) => mission.task.status === "paid" || mission.task.status === "closed",
  );
  const claimableMission = allMissions.find((mission) => mission.task.status === "open") ?? null;
  const defaultMission =
    currentPilotMissions[0] ?? claimableMission ?? latestMission ?? allMissions[0] ?? null;
  const detailMission = taskAddressParam
    ? allMissions.find((mission) => mission.task.address === taskAddressParam) ?? null
    : null;
  const selectedMission = taskAddressParam
    ? detailMission
    : allMissions.find((mission) => mission.task.address === selectedMissionAddress) ?? defaultMission;
  const worldIdLinked = Boolean(connectedWorldVerification);
  const hasPilotControl = Boolean(
    selectedMission && connectedWallet && selectedMission.claim?.pilot === connectedWallet,
  );
  const canClaimSelectedMission = Boolean(
    selectedMission &&
      connectedWallet &&
      selectedMission.task.status === "open" &&
      (!selectedMission.accessPolicy?.worldIdRequired || connectedWorldVerification),
  );
  const selectedOwnedMission =
    taskAddressParam
      ? connectedPilotMissions.find((mission) => mission.task.address === taskAddressParam) ?? null
      : currentPilotMissions.find((mission) => mission.task.address === selectedMissionAddress) ??
        currentPilotMissions[0] ??
        null;
  const selectedOwnedLane = selectedOwnedMission ? getTaskLaneFromMission(selectedOwnedMission) : null;
  const confidentialReviewState = useConfidentialReview(selectedOwnedMission?.claim?.address);
  const detailLane = detailMission ? getTaskLaneFromMission(detailMission) : null;
  const detailPackageStatus = detailMission ? getTaskPackageStatus(detailMission) : null;
  const detailEvents = detailMission ? buildPilotEvents(detailMission) : [];

  async function handleClaimSelectedMission() {
    if (!selectedMission) {
      return;
    }

    setActionError(null);
    try {
      await claimTask(selectedMission.task.address);
      router.push(
        `/pilot?section=task&task=${encodeURIComponent(selectedMission.task.address)}&from=your-tasks`,
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  function renderTaskList(
    missionList: LiveMission[],
    emptyMessage: string,
    audience: "pilot" | "public",
  ) {
    if (missionList.length === 0) {
      return (
        <div className="panel-muted rounded-[22px] p-5 text-sm leading-6 text-[var(--text-muted)]">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {missionList.map((mission) => {
          const selected = taskAddressParam === mission.task.address;
          const lane = getTaskLaneFromMission(mission);
          const packageStatus = getTaskPackageStatus(mission);
          const claimedByConnectedPilot = connectedWallet && mission.claim?.pilot === connectedWallet;
          const taskHref = `/pilot?section=task&task=${encodeURIComponent(
            mission.task.address,
          )}&from=${activeSection}`;

          return (
            <button
              key={mission.task.address}
              type="button"
              onClick={() => {
                setSelectedMissionAddress(mission.task.address);
                router.push(taskHref);
              }}
              className={`w-full rounded-[22px] border p-4 text-left transition ${
                selected
                  ? "border-[var(--line-strong)] bg-white"
                  : "border-[var(--line)] bg-[var(--background-muted)] hover:bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <TaskLanePill compact laneId={lane.id} />
                <PrivacyPill
                  scope={audience === "pilot" || claimedByConnectedPilot ? "pilot" : "public"}
                  label={claimedByConnectedPilot ? "Claimed" : audience === "pilot" ? "Pilot lane" : undefined}
                />
                {mission.accessPolicy?.worldIdRequired ? (
                  <StatusPill label="World ID required" tone="warning" />
                ) : null}
              </div>
              <h3 className="mt-3 text-base font-semibold text-[var(--text)]">{mission.task.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{mission.task.environment}</p>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {packageStatus.label}
                  </p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {mission.claim?.pilot ? compactAddress(mission.claim.pilot) : "Unclaimed"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {formatSol(mission.task.payoutLamports)}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)]">
                  Open task
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {activeSection === "your-tasks" ? (
        <section className="grid gap-4 xl:grid-cols-4">
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">Connected wallet</p>
            <p className="mt-3 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
              {connectedWallet ? compactAddress(connectedWallet) : "Not connected"}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Claiming and submission unlock when the pilot wallet is connected.
            </p>
          </article>
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">World ID</p>
            <p className="mt-3 text-sm font-semibold text-[var(--text)]">
              {worldIdLinked ? "Linked onchain" : "Not linked"}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {worldIdLinked
                ? "This wallet can accept tasks that require a live human-proof link."
                : "Link World ID in settings to unlock tasks that are gated for verified humans."}
            </p>
          </article>
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">Claimable tasks</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
              {missionMetrics.open}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {currentPilotMissions.length} active claims, {completedPilotMissions.length} completed.
            </p>
          </article>
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">World-gated tasks</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
              {missionMetrics.gatedTasks}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {laneCounts.remote_operation} remote ops, {laneCounts.humanoid_capture} humanoid capture.
            </p>
          </article>
        </section>
      ) : null}

      {activeSection === "all-tasks" ? (
        <section className="panel rounded-[26px] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Task board</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                Claimable public work
              </h3>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                Browse every public task. Open a task to inspect the access link, package flow,
                pilot eligibility, and claim controls on its own screen.
              </p>
            </div>
            <StatusPill label={`${openMissions.length} open`} tone="neutral" />
          </div>

          <div className="mt-6">
            {renderTaskList(openMissions, "No claimable public tasks are available on this cluster yet.", "public")}
          </div>
        </section>
      ) : null}

      {activeSection === "task" ? (
        <section className="space-y-6">
          <article className="panel rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => router.push(`/pilot?section=${detailBackSection}`)}
                  className="rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white"
                >
                  Back to {detailBackSection === "your-tasks" ? "Your Tasks" : "All Tasks"}
                </button>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {detailLane ? <TaskLanePill laneId={detailLane.id} /> : null}
                  <PrivacyPill
                    scope={hasPilotControl ? "pilot" : "public"}
                    label={hasPilotControl ? "Your claim" : undefined}
                  />
                  {detailMission?.accessPolicy?.worldIdRequired ? (
                    <StatusPill label="World ID required" tone="warning" />
                  ) : null}
                </div>
                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text)]">
                  {detailMission?.task.title ?? "Task not found"}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                  {detailMission
                    ? detailMission.task.environment
                    : "This task is no longer visible on the current devnet program state."}
                </p>
              </div>
              <StatusPill
                label={detailMission ? compactTaskStatus(detailMission.task.status) : "Missing task"}
                tone={detailMission ? taskStatusTone(detailMission.task.status) : "warning"}
              />
            </div>

            {detailMission ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="panel-muted rounded-[20px] p-4">
                  <p className="eyebrow">Escrow</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                    {formatSol(detailMission.task.payoutLamports)}
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <p className="eyebrow">Buyer</p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {compactAddress(detailMission.task.buyer)}
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <p className="eyebrow">Pilot</p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {detailMission.claim?.pilot ? compactAddress(detailMission.claim.pilot) : "Unclaimed"}
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <p className="eyebrow">Package</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                    {detailPackageStatus?.label ?? "Awaiting task"}
                  </p>
                </div>
              </div>
            ) : null}
          </article>

          {detailMission && !hasPilotControl ? (
            <>
              <TaskAccessLinkPanel
                mission={detailMission}
                scope={hasPilotControl ? "pilot" : "shared"}
              />
              <TaskFlowPanel
                mission={detailMission}
                buyerUnlocked={detailMission.task.buyer === connectedWallet}
                pilotUnlocked={hasPilotControl}
              />
            </>
          ) : null}

          {detailMission ? (
            <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
              <div className="space-y-6">
                {hasPilotControl && selectedOwnedMission ? (
                  selectedOwnedLane?.id === "humanoid_capture" ? (
                    <PilotCaptureWorkspace
                      key={`${selectedOwnedMission.task.address}:${selectedOwnedMission.claim?.address ?? "none"}`}
                      connectedWallet={connectedWallet}
                      isSending={transaction.isSending}
                      mission={selectedOwnedMission}
                      onClaim={claimTask}
                      onSubmit={submitMission}
                      worldIdLinked={worldIdLinked}
                    />
                  ) : (
                    <PilotTeleopWorkspace
                      key={`${selectedOwnedMission.task.address}:${selectedOwnedMission.claim?.address ?? "none"}`}
                      connectedWallet={connectedWallet}
                      isSending={transaction.isSending}
                      mission={selectedOwnedMission}
                      onClaim={claimTask}
                      onSubmit={submitMission}
                      worldIdLinked={worldIdLinked}
                    />
                  )
                ) : (
                  <article className="panel rounded-[26px] p-5">
                    <p className="eyebrow">Pilot action</p>
                    <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                      {detailMission.task.status === "open"
                        ? "Claim this task to begin"
                        : "Completion controls are locked"}
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {detailMission.task.status === "open"
                        ? "Once claimed, this screen becomes the run workspace for the connected pilot wallet."
                        : "Only the pilot wallet that owns the claim can record, submit, or inspect the private completion workspace."}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleClaimSelectedMission();
                        }}
                        disabled={!canClaimSelectedMission || transaction.isSending}
                        className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {detailMission.accessPolicy?.worldIdRequired && !worldIdLinked
                          ? "Link World ID to claim"
                          : "Claim task"}
                      </button>
                      {detailMission.accessPolicy?.worldIdRequired && !worldIdLinked ? (
                        <button
                          type="button"
                          onClick={() => router.push("/pilot?section=settings")}
                          className="rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white"
                        >
                          Open Settings
                        </button>
                      ) : null}
                    </div>
                    {actionError ? (
                      <p className="mt-4 text-sm text-[var(--critical)]">{actionError}</p>
                    ) : null}
                  </article>
                )}

                {hasPilotControl && selectedOwnedMission ? (
                  <ConfidentialReviewPanel
                    error={confidentialReviewState.error}
                    isLoading={confidentialReviewState.isLoading}
                    payload={confidentialReviewState.payload}
                    record={confidentialReviewState.record}
                  />
                ) : null}
              </div>

              <MissionActivityFeed events={detailEvents} scope="public" title="Task timeline" />
            </section>
          ) : null}
        </section>
      ) : null}

      {activeSection === "your-tasks" ? (
        <section className="grid gap-6">
          <article className="panel rounded-[26px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Your tasks</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                  Claimed pilot work
                </h3>
              </div>
              <StatusPill label={`${currentPilotMissions.length} active`} tone="neutral" />
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Your connected wallet owns these tasks. Open any task to launch its run workspace,
              submit the package, and follow the buyer review timeline.
            </p>

            <div className="mt-6 space-y-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="eyebrow">Current tasks</p>
                  <StatusPill label={`${currentPilotMissions.length} active`} tone="warning" />
                </div>
                {currentPilotMissions.length > 0 ? (
                  renderTaskList(
                    currentPilotMissions,
                    connectedWallet
                      ? "This wallet has not claimed any active tasks yet."
                      : "Connect the pilot wallet to load its claimed work.",
                    "pilot",
                  )
                ) : (
                  <div className="rounded-[22px] border border-[var(--brand-blue)] bg-[var(--brand-blue-soft)] p-5">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {connectedWallet ? "No active pilot tasks" : "Connect a pilot wallet"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {connectedWallet
                        ? "Your active work queue is empty. Pick an open task from All Tasks to start a new run."
                        : "Connect the pilot wallet, then browse All Tasks to claim available work."}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/pilot?section=all-tasks")}
                      className="mt-4 rounded-full border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[var(--brand-blue-strong)]"
                    >
                      Browse All Tasks
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="eyebrow">Completed tasks</p>
                  <StatusPill label={`${completedPilotMissions.length} closed`} tone="good" />
                </div>
                {renderTaskList(
                  completedPilotMissions,
                  connectedWallet
                    ? "No completed tasks are tied to this pilot wallet yet."
                    : "Connect the pilot wallet to separate completed work from the public board.",
                  "pilot",
                )}
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeSection === "settings" ? (
        <div className="space-y-6">
          <MissionControlStrip />
          <section className="grid gap-6 xl:grid-cols-2">
            <WorldIdStatusCard
              connectedWallet={connectedWallet}
              isSending={transaction.isSending}
              onLink={linkWorldIdVerification}
              verification={connectedWorldVerification}
            />
            <article className="panel rounded-[26px] p-5">
              <p className="eyebrow">Pilot access</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                What stays local or private
              </h3>

              <div className="mt-5 space-y-3">
                <div className="panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">Claimed control lane</p>
                    <PrivacyPill scope="pilot" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    The pilot wallet unlocks the buyer-provided link and owns the compact submission.
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">Private media lane</p>
                    <PrivacyPill scope="pilot" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Humanoid capture clips can stay local until the pilot decides to upload them.
                    Remote-op sessions attach a buyer-reviewable recording to the submitted task
                    package automatically.
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">World link record</p>
                    <PrivacyPill scope="pilot" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    ShadowPilot stores a compact wallet-linked human-proof record onchain so buyers
                    can gate claims without exposing the underlying World credential.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <IntegrationCard
                  kind="world"
                  title="World ID unlocks gated task claims"
                  description="When a buyer marks a task as human-gated, this World-linked wallet state is what opens that claim path for the pilot."
                />
                <IntegrationCard
                  kind="arcium"
                  title="Arcium seals the review package"
                  description="After submission, ShadowPilot presents the score, payout tier, and reputation-safe outcome through an Arcium-backed sealed review package."
                />
              </div>
            </article>

            <article className="panel rounded-[26px] p-5">
              <p className="eyebrow">Pilot runbook</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                Pilot flow
              </h3>
              <ol className="mt-5 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
                <li>1. Link World ID once if you want to access human-gated tasks.</li>
                <li>2. Browse the task board and claim a remote-op or capture task.</li>
                <li>3. Open the buyer-provided control or upload link from the workspace.</li>
                <li>4. Run the live robot session or capture the local clip inside the browser.</li>
                <li>5. Submit the recorded package and hand the task back to the buyer for review and settlement.</li>
              </ol>
            </article>
          </section>
        </div>
      ) : null}
    </div>
  );
}
