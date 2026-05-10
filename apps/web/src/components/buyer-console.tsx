"use client";

import { compactAddress } from "@shadowpilot/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useConfidentialReview } from "@/hooks/use-confidential-review";
import { useSubmissionManifest } from "@/hooks/use-submission-manifest";
import { useSubmissionVideo } from "@/hooks/use-submission-video";
import { useShadowPilotProgram } from "@/hooks/use-shadowpilot-program";
import { type MissionActivity } from "@/lib/mission-activity";
import {
  buildBuyerAuthoredSettlement,
  type LiveMission,
  type ShadowPilotUsageRights,
} from "@/lib/shadowpilot-program";
import {
  getTaskLaneDefinition,
  getTaskLaneFromMission,
  getTaskPackageMetrics,
  getTaskPackageStatus,
  TASK_LANE_ORDER,
  type TaskLaneId,
} from "@/lib/task-lane";

import { IntegrationBadge, IntegrationCard } from "./integration-badge";
import { ConfidentialReviewPanel } from "./confidential-review-panel";
import { MissionActivityFeed } from "./mission-activity-feed";
import { MissionControlStrip } from "./mission-control-strip";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";
import { TaskAccessLinkPanel } from "./task-access-link-panel";
import { TaskFlowPanel } from "./task-flow-panel";
import { TaskLanePill } from "./task-lane-pill";

type BuyerSection = "all-tasks" | "settings" | "task" | "your-tasks";
type BuyerTaskScreen = "overview" | "review" | "settlement" | "receipt";

const LAMPORTS_PER_SOL = 1_000_000_000;
const MIN_TASK_PAYOUT_SOL = 0.25;
const MIN_TASK_PAYOUT_LAMPORTS = BigInt(Math.round(MIN_TASK_PAYOUT_SOL * LAMPORTS_PER_SOL));

function normalizeBuyerSection(value: string | null): BuyerSection {
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

function normalizeBuyerTaskScreen(value: string | null): BuyerTaskScreen | null {
  switch (value) {
    case "overview":
    case "review":
    case "settlement":
    case "receipt":
      return value;
    default:
      return null;
  }
}

const REVIEW_SCORE_PRESETS = [
  {
    detail: "The recovery is valid, but it left some cleanup work for the buyer.",
    label: "Accepted",
    score: 72,
  },
  {
    detail: "The task was completed cleanly with only minor issues.",
    label: "Strong",
    score: 84,
  },
  {
    detail: "The intervention is immediately reusable for replay and training.",
    label: "Excellent",
    score: 92,
  },
  {
    detail: "Best-in-class handoff with near-perfect execution.",
    label: "Elite",
    score: 98,
  },
] as const;

function formatTimestamp(timestamp: number | null) {
  if (!timestamp || timestamp <= 0) {
    return "Pending";
  }

  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSol(lamports: bigint) {
  const value = (Number(lamports) / LAMPORTS_PER_SOL).toFixed(3).replace(/\.?0+$/u, "");
  return `${value} SOL`;
}

function formatUsageRightsLabel(value: ShadowPilotUsageRights) {
  switch (value) {
    case "replay_only":
      return "Replay only";
    case "training_and_replay":
      return "Training and replay";
    case "exclusive_training":
      return "Exclusive training";
  }
}

function missionRankForBuyer(status: LiveMission["task"]["status"]) {
  switch (status) {
    case "submitted":
      return 0;
    case "open":
      return 1;
    case "claimed":
      return 2;
    case "scored":
      return 3;
    case "paid":
      return 4;
    case "closed":
      return 5;
  }
}

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Provide a control or upload link before posting the task.");
  }
  if (/^[a-z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function buildBuyerTitle(laneId: TaskLaneId, value: string) {
  const trimmed = value.trim();
  const prefix = laneId === "remote_operation" ? "Remote op" : "Humanoid capture";
  if (!trimmed) {
    return getTaskLaneDefinition(laneId).template.title;
  }
  return trimmed.toLowerCase().includes(prefix.toLowerCase()) ? trimmed : `${prefix} • ${trimmed}`;
}

function formatPayoutInput(lamports: bigint) {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(2).replace(/\.?0+$/u, "");
}

function buildMissionEvents(mission: LiveMission): MissionActivity[] {
  const lane = getTaskLaneFromMission(mission);
  const submissionLabel =
    lane.id === "remote_operation" ? "Recovery package submitted" : "Capture package submitted";
  const events: MissionActivity[] = [
    {
      id: `${mission.task.address}-created`,
      at: new Date(mission.task.createdAt * 1000).toISOString(),
      detail:
        lane.id === "remote_operation"
          ? "Buyer posted a robot takeover request and attached the control surface link."
          : "Buyer posted a humanoid capture request and attached the upload destination.",
      kind: "buyer",
      label: "Task created",
    },
  ];

  if (mission.claim) {
    events.push({
      id: `${mission.claim.address}-claim`,
      at: new Date(
        mission.claim.submittedAt > 0 ? mission.claim.submittedAt * 1000 : mission.task.createdAt * 1000,
      ).toISOString(),
      detail: `Pilot ${compactAddress(mission.claim.pilot)} accepted the task.`,
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
          ? "Pilot submitted the compact recovery package for buyer review."
          : "Pilot submitted the compact capture package for buyer review.",
      kind: "pilot",
      label: submissionLabel,
    });
  }

  if (mission.claim?.scoreBps) {
    events.push({
      id: `${mission.claim.address}-scored`,
      at: new Date(
        (mission.receipt?.mintedAt ?? mission.claim.submittedAt ?? mission.task.createdAt) * 1000,
      ).toISOString(),
      detail: `Compact review finalized at ${(mission.claim.scoreBps / 100).toFixed(0)} / 100.`,
      kind: "arcium",
      label: "Private score ready",
    });
  }

  if (mission.receipt?.receiptMint) {
    events.push({
      id: `${mission.receipt.address}-receipt`,
      at: new Date(mission.receipt.mintedAt * 1000).toISOString(),
      detail: "cNFT rights receipt minted and task closed onchain.",
      kind: "solana",
      label: "cNFT minted",
    });
  }

  return events;
}

export function BuyerConsole() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    compactTaskStatus,
    connectedWallet,
    createTaskFromTemplate,
    deploymentQuery,
    latestReceipt,
    missionMetrics,
    missions,
    settleMission,
    taskStatusTone,
    transaction,
  } = useShadowPilotProgram();
  const remoteTemplate = getTaskLaneDefinition("remote_operation").template;
  const [composerLane, setComposerLane] = useState<TaskLaneId>("remote_operation");
  const [composerEnvironment, setComposerEnvironment] = useState(remoteTemplate.environment);
  const [composerLink, setComposerLink] = useState(remoteTemplate.bundleUri);
  const [composerPayout, setComposerPayout] = useState(formatPayoutInput(remoteTemplate.payoutLamports));
  const [composerRequiresWorldId, setComposerRequiresWorldId] = useState(false);
  const [composerTitle, setComposerTitle] = useState(remoteTemplate.title);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewNotesByMission, setReviewNotesByMission] = useState<Record<string, string>>({});
  const [reviewScoresByMission, setReviewScoresByMission] = useState<Record<string, number>>({});
  const [reviewUsageRightsByMission, setReviewUsageRightsByMission] = useState<
    Record<string, ShadowPilotUsageRights>
  >({});
  const activeSection = normalizeBuyerSection(searchParams.get("section"));
  const taskAddressParam = searchParams.get("task");
  const requestedTaskScreen = normalizeBuyerTaskScreen(searchParams.get("step"));
  const detailBackSection = searchParams.get("from") === "all-tasks" ? "all-tasks" : "your-tasks";

  const allMissions = [...missions].sort((left, right) => {
    const rankDelta = missionRankForBuyer(left.task.status) - missionRankForBuyer(right.task.status);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return right.task.createdAt - left.task.createdAt;
  });
  const buyerOwnedMissions = connectedWallet
    ? allMissions.filter((mission) => mission.task.buyer === connectedWallet)
    : [];
  const buyerReviewQueue = buyerOwnedMissions.filter((mission) => mission.task.status === "submitted");
  const buyerWorldGatedMissions = buyerOwnedMissions.filter(
    (mission) => mission.accessPolicy?.worldIdRequired,
  );
  const currentBuyerMissions = buyerOwnedMissions.filter(
    (mission) => mission.task.status !== "paid" && mission.task.status !== "closed",
  );
  const completedBuyerMissions = buyerOwnedMissions.filter(
    (mission) => mission.task.status === "paid" || mission.task.status === "closed",
  );
  const detailMission = taskAddressParam
    ? allMissions.find((mission) => mission.task.address === taskAddressParam) ?? null
    : null;
  const selectedBuyerMission =
    activeSection === "task" && detailMission && connectedWallet && detailMission.task.buyer === connectedWallet
      ? detailMission
      : null;
  const selectedBuyerMetrics = selectedBuyerMission ? getTaskPackageMetrics(selectedBuyerMission) : [];
  const selectedReviewMissionKey = selectedBuyerMission?.task.address ?? null;
  const reviewScore =
    selectedReviewMissionKey && selectedBuyerMission
      ? reviewScoresByMission[selectedReviewMissionKey] ??
        (selectedBuyerMission.claim?.scoreBps
          ? Math.round(selectedBuyerMission.claim.scoreBps / 100)
          : REVIEW_SCORE_PRESETS[1].score)
      : REVIEW_SCORE_PRESETS[1].score;
  const reviewNotes =
    selectedReviewMissionKey ? reviewNotesByMission[selectedReviewMissionKey] ?? "" : "";
  const reviewUsageRights =
    selectedReviewMissionKey && selectedBuyerMission
      ? reviewUsageRightsByMission[selectedReviewMissionKey] ??
        (selectedBuyerMission.receipt?.usageRights ?? "training_and_replay")
      : "training_and_replay";
  const submissionManifestState = useSubmissionManifest(selectedBuyerMission?.claim?.traceUri);
  const submissionVideoState = useSubmissionVideo(submissionManifestState.manifest?.video?.url);
  const confidentialReviewState = useConfidentialReview(selectedBuyerMission?.claim?.address);
  const buyerSettlementPreview =
    selectedBuyerMission?.claim
      ? buildBuyerAuthoredSettlement(selectedBuyerMission.task, {
          score: reviewScore,
          usageRights: reviewUsageRights,
        })
      : null;
  const activeReviewPreset = REVIEW_SCORE_PRESETS.reduce((currentBest, preset) => {
    if (Math.abs(preset.score - reviewScore) < Math.abs(currentBest.score - reviewScore)) {
      return preset;
    }
    return currentBest;
  }, REVIEW_SCORE_PRESETS[0]);
  const detailLane = detailMission ? getTaskLaneFromMission(detailMission) : null;
  const detailPackageStatus = detailMission ? getTaskPackageStatus(detailMission) : null;
  const detailEvents = detailMission ? buildMissionEvents(detailMission) : [];
  const detailIsBuyerOwned = Boolean(
    detailMission && connectedWallet && detailMission.task.buyer === connectedWallet,
  );
  const defaultBuyerTaskScreen: BuyerTaskScreen =
    detailMission?.task.status === "paid" || detailMission?.task.status === "closed"
      ? "receipt"
      : "overview";
  const buyerTaskScreen = requestedTaskScreen ?? defaultBuyerTaskScreen;

  function pushBuyerTaskScreen(screen: BuyerTaskScreen) {
    if (!detailMission) {
      return;
    }

    router.push(
      `/buyer?section=task&task=${encodeURIComponent(detailMission.task.address)}&from=${detailBackSection}&step=${screen}`,
    );
  }

  function applyLaneDefaults(laneId: TaskLaneId) {
    const lane = getTaskLaneDefinition(laneId);
    setComposerLane(laneId);
    setComposerTitle(lane.template.title);
    setComposerEnvironment(lane.template.environment);
    setComposerLink(lane.template.bundleUri);
    setComposerPayout(formatPayoutInput(lane.template.payoutLamports));
    setComposerRequiresWorldId(false);
    setActionError(null);
  }

  async function handleCreateTask() {
    setActionError(null);

    try {
      const payoutSol = Number(composerPayout);
      if (!Number.isFinite(payoutSol)) {
        throw new Error("Set a valid SOL payout before posting the task.");
      }

      const payoutLamports = BigInt(Math.round(payoutSol * LAMPORTS_PER_SOL));
      if (payoutLamports < MIN_TASK_PAYOUT_LAMPORTS) {
        throw new Error(`Set a payout of at least ${MIN_TASK_PAYOUT_SOL} SOL before posting the task.`);
      }

      await createTaskFromTemplate(composerLane, {
        bundleUri: normalizeLink(composerLink),
        environment: composerEnvironment.trim() || getTaskLaneDefinition(composerLane).template.environment,
        payoutLamports,
        title: buildBuyerTitle(composerLane, composerTitle),
        worldIdRequired: composerRequiresWorldId,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSettleMission() {
    if (!selectedBuyerMission) {
      return false;
    }

    setActionError(null);
    try {
      await settleMission(selectedBuyerMission, {
        reviewNotes,
        score: reviewScore,
        usageRights: reviewUsageRights,
      });
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  function renderTaskList(missionList: LiveMission[], emptyMessage: string, audience: "buyer" | "public") {
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
          const taskHref = `/buyer?section=task&task=${encodeURIComponent(
            mission.task.address,
          )}&from=${activeSection}&step=overview`;

          return (
            <button
              key={mission.task.address}
              type="button"
              onClick={() => {
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
                <PrivacyPill scope={audience === "buyer" ? "buyer" : "public"} />
                {mission.accessPolicy?.worldIdRequired ? (
                  <StatusPill label="World ID required" tone="warning" />
                ) : null}
              </div>
              <h3 className="mt-3 text-base font-semibold text-[var(--text)]">{mission.task.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{mission.task.environment}</p>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {compactTaskStatus(mission.task.status)}
                  </p>
                  <p className="mt-2 text-sm text-[var(--text)]">{compactAddress(mission.task.buyer)}</p>
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
              Buyer actions unlock when the connected wallet matches the task owner.
            </p>
          </article>
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">Buyer tasks</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
              {buyerOwnedMissions.length}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {buyerReviewQueue.length} waiting for review, {completedBuyerMissions.length} completed.
            </p>
          </article>
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">World ID gate</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
              {buyerWorldGatedMissions.length}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {missionMetrics.gatedTasks} total live tasks currently require a linked human proof.
            </p>
          </article>
          <article className="panel rounded-[24px] p-5">
            <p className="eyebrow">Latest receipt</p>
            <p className="mt-3 font-[var(--font-ibm-plex-mono)] text-xs text-[var(--text)]">
              {latestReceipt?.receiptMint ? compactAddress(latestReceipt.receiptMint) : "Pending"}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {transaction.signature ? "A recent buyer transaction is already onchain." : "No new buyer transaction yet in this session."}
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
                Live public task directory
              </h3>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                Browse the same public tasks that pilots see. Open a task to inspect its lane,
                handoff link, package flow, and privacy boundaries.
              </p>
            </div>
            <StatusPill label={`${missions.length} live`} tone="neutral" />
          </div>

          <div className="mt-6">
            {renderTaskList(allMissions, "No task accounts are visible on this cluster yet.", "public")}
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
                  onClick={() => router.push(`/buyer?section=${detailBackSection}`)}
                  className="rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white"
                >
                  Back to {detailBackSection === "all-tasks" ? "All Tasks" : "Your Tasks"}
                </button>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {detailLane ? <TaskLanePill laneId={detailLane.id} /> : null}
                  {detailIsBuyerOwned ? (
                    <PrivacyPill scope="buyer" label="Buyer-owned" />
                  ) : (
                    <PrivacyPill scope="public" />
                  )}
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
                label={detailPackageStatus?.label ?? "Missing task"}
                tone={detailPackageStatus?.tone ?? "warning"}
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
                  <p className="mt-2 text-sm text-[var(--text)]">{compactAddress(detailMission.task.buyer)}</p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <p className="eyebrow">Pilot</p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {detailMission.claim?.pilot ? compactAddress(detailMission.claim.pilot) : "Unclaimed"}
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <p className="eyebrow">Receipt</p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {detailMission.receipt?.receiptMint
                      ? compactAddress(detailMission.receipt.receiptMint)
                      : "Pending cNFT"}
                  </p>
                </div>
              </div>
            ) : null}
          </article>

          {detailIsBuyerOwned && selectedBuyerMission ? (
            <section className="space-y-6">
              {buyerTaskScreen === "overview" ? (
                <article className="panel rounded-[26px] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="eyebrow">Buyer step 1</p>
                      <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                        Task status and next buyer action
                      </h4>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                        This screen stays focused on where the whiteboard task is in the handoff.
                        Review and settlement controls appear only after the pilot submits footage.
                      </p>
                    </div>
                    <StatusPill label={compactTaskStatus(selectedBuyerMission.task.status)} tone={taskStatusTone(selectedBuyerMission.task.status)} />
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
                    <TaskAccessLinkPanel mission={selectedBuyerMission} scope="buyer" />
                    <TaskFlowPanel
                      mission={selectedBuyerMission}
                      buyerUnlocked
                      pilotUnlocked={selectedBuyerMission.claim?.pilot === connectedWallet}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedBuyerMission.task.status === "submitted" ||
                    selectedBuyerMission.task.status === "scored" ? (
                      <button
                        type="button"
                        onClick={() => pushBuyerTaskScreen("review")}
                        className="rounded-full border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[var(--brand-blue-strong)]"
                      >
                        Review submitted footage
                      </button>
                    ) : selectedBuyerMission.task.status === "paid" || selectedBuyerMission.task.status === "closed" ? (
                      <button
                        type="button"
                        onClick={() => pushBuyerTaskScreen("receipt")}
                        className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)]"
                      >
                        View receipt
                      </button>
                    ) : (
                      <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-muted)]">
                        {selectedBuyerMission.task.status === "open"
                          ? "Waiting for pilot claim"
                          : "Waiting for pilot submission"}
                      </span>
                    )}
                  </div>
                </article>
              ) : null}

              {buyerTaskScreen === "review" ? (
                <article className="panel rounded-[26px] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="eyebrow">Buyer step 2</p>
                      <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                        Watch the pilot footage
                      </h4>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                        Confirm the robotic arm drew the requested whiteboard line before moving to
                        scoring and payout.
                      </p>
                    </div>
                    <PrivacyPill scope="buyer" label="Private review" />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--line)] bg-white">
                    {submissionManifestState.isLoading || submissionVideoState.isLoading ? (
                      <div className="flex aspect-video items-center justify-center bg-[var(--background-muted)] px-6 text-center text-sm leading-6 text-[var(--text-muted)]">
                        Unlocking the pilot submission package...
                      </div>
                    ) : submissionVideoState.objectUrl ? (
                      <video
                        controls
                        preload="metadata"
                        src={submissionVideoState.objectUrl}
                        className="aspect-video h-full w-full bg-[#e5e7eb] object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-[var(--background-muted)] px-6 text-center text-sm leading-6 text-[var(--text-muted)]">
                        This task does not include buyer-playable footage yet. Return once the pilot
                        submits the recorded run.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Submitted at</p>
                      <p className="mt-2 text-sm text-[var(--text)]">
                        {submissionManifestState.manifest
                          ? new Date(submissionManifestState.manifest.submittedAt).toLocaleString()
                          : formatTimestamp(selectedBuyerMission.claim?.submittedAt ?? null)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Clip source</p>
                      <p className="mt-2 text-sm text-[var(--text)]">
                        {submissionManifestState.manifest?.video
                          ? submissionManifestState.manifest.video.source === "recorded"
                            ? "Recorded in workspace"
                            : "Uploaded by pilot"
                          : "Compact trace only"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-4">
                    <p className="eyebrow">Pilot note</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {submissionManifestState.manifest?.notes ||
                        "The pilot did not attach a note to this submission package."}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {selectedBuyerMetrics.map((metric) => (
                      <div key={metric.label} className="panel-muted rounded-[20px] p-4">
                        <p className="eyebrow">{metric.label}</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--text)]">{metric.value}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{metric.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pushBuyerTaskScreen("settlement")}
                      disabled={!submissionVideoState.objectUrl}
                      className="rounded-full border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[var(--brand-blue-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue to score and payout
                    </button>
                    <button
                      type="button"
                      onClick={() => pushBuyerTaskScreen("overview")}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)]"
                    >
                      Back to task status
                    </button>
                  </div>

                  {submissionManifestState.error || submissionVideoState.error ? (
                    <p className="mt-4 text-sm text-[var(--critical)]">
                      {submissionVideoState.error ?? submissionManifestState.error}
                    </p>
                  ) : null}
                </article>
              ) : null}

              {buyerTaskScreen === "settlement" ? (
                <article className="panel rounded-[26px] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="eyebrow">Buyer step 3</p>
                        <IntegrationBadge compact kind="arcium" label="Arcium" />
                      </div>
                      <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                        Score, pay, and mint the receipt
                      </h4>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                        This is the only screen that can release payout and mint the cNFT receipt.
                        It should happen after the footage has been reviewed.
                      </p>
                    </div>
                    <StatusPill label={`${reviewScore} / 100`} tone="good" />
                  </div>

                  <IntegrationCard
                    className="mt-4"
                    kind="arcium"
                    title="Arcium private review lane"
                    description="Buyer scoring, payout shaping, and the reputation-safe settlement package are sealed before the public chain records the outcome."
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {REVIEW_SCORE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (!selectedReviewMissionKey) {
                            return;
                          }
                          setReviewScoresByMission((current) => ({
                            ...current,
                            [selectedReviewMissionKey]: preset.score,
                          }));
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          reviewScore === preset.score
                            ? "border-[var(--line-strong)] bg-white text-[var(--text)]"
                            : "border-[var(--line)] bg-[var(--background-muted)] text-[var(--text-muted)] hover:bg-white hover:text-[var(--text)]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 block">
                    <p className="eyebrow">Fine-tune score</p>
                    <input
                      type="range"
                      min={60}
                      max={99}
                      step={1}
                      value={reviewScore}
                      onChange={(event) => {
                        if (!selectedReviewMissionKey) {
                          return;
                        }
                        setReviewScoresByMission((current) => ({
                          ...current,
                          [selectedReviewMissionKey]: Number(event.target.value),
                        }));
                      }}
                      className="mt-4 w-full accent-[var(--text)]"
                    />
                  </label>

                  <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-4">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {activeReviewPreset.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      {activeReviewPreset.detail}
                    </p>
                  </div>

                  <label className="mt-4 block rounded-[18px] border border-[var(--line)] bg-white p-4">
                    <p className="eyebrow">Usage rights in receipt</p>
                    <select
                      value={reviewUsageRights}
                      onChange={(event) => {
                        if (!selectedReviewMissionKey) {
                          return;
                        }
                        setReviewUsageRightsByMission((current) => ({
                          ...current,
                          [selectedReviewMissionKey]: event.target.value as ShadowPilotUsageRights,
                        }));
                      }}
                      className="mt-3 w-full rounded-[16px] border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
                    >
                      <option value="training_and_replay">Training and replay</option>
                      <option value="replay_only">Replay only</option>
                      <option value="exclusive_training">Exclusive training</option>
                    </select>
                  </label>

                  <label className="mt-4 block rounded-[18px] border border-[var(--line)] bg-white p-4">
                    <p className="eyebrow">Buyer note</p>
                    <textarea
                      rows={4}
                      value={reviewNotes}
                      onChange={(event) => {
                        if (!selectedReviewMissionKey) {
                          return;
                        }
                        setReviewNotesByMission((current) => ({
                          ...current,
                          [selectedReviewMissionKey]: event.target.value,
                        }));
                      }}
                      placeholder="Summarize whether the robotic arm drew the requested whiteboard line cleanly."
                      className="mt-3 w-full rounded-[16px] border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                    />
                  </label>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Payout preview</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                        {buyerSettlementPreview ? formatSol(buyerSettlementPreview.payoutLamports) : "Pending"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Rights bundle</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                        {formatUsageRightsLabel(reviewUsageRights)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          const didSettle = await handleSettleMission();
                          if (didSettle) {
                            pushBuyerTaskScreen("receipt");
                          }
                        })();
                      }}
                      disabled={
                        (selectedBuyerMission.task.status !== "submitted" &&
                          selectedBuyerMission.task.status !== "scored" &&
                          selectedBuyerMission.task.status !== "paid") ||
                        transaction.isSending
                      }
                      className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {transaction.isSending
                        ? "Waiting for wallet"
                        : selectedBuyerMission.task.status === "paid"
                          ? "Mint final cNFT receipt"
                          : selectedBuyerMission.task.status === "scored"
                            ? "Release payout, then mint cNFT"
                            : "Approve, pay, then mint cNFT"}
                    </button>
                    <button
                      type="button"
                      onClick={() => pushBuyerTaskScreen("review")}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)]"
                    >
                      Back to footage
                    </button>
                  </div>

                  {actionError ? <p className="mt-4 text-sm text-[var(--critical)]">{actionError}</p> : null}
                </article>
              ) : null}

              {buyerTaskScreen === "receipt" ? (
                <article className="panel rounded-[26px] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="eyebrow">Buyer step 4</p>
                      <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                        Settlement and cNFT receipt
                      </h4>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                        This is the final buyer screen. The pilot is paid only after this buyer
                        approval path, and the cNFT receipt appears after settlement.
                      </p>
                    </div>
                    <StatusPill
                      label={selectedBuyerMission.receipt?.receiptMint ? "Receipt minted" : "Receipt pending"}
                      tone={selectedBuyerMission.receipt?.receiptMint ? "good" : "warning"}
                    />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Score</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                        {selectedBuyerMission.claim?.scoreBps
                          ? `${(selectedBuyerMission.claim.scoreBps / 100).toFixed(0)} / 100`
                          : `${reviewScore} / 100`}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Payout</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                        {selectedBuyerMission.claim?.payoutLamports
                          ? formatSol(selectedBuyerMission.claim.payoutLamports)
                          : buyerSettlementPreview
                            ? formatSol(buyerSettlementPreview.payoutLamports)
                            : "Pending"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Receipt</p>
                      <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
                        {selectedBuyerMission.receipt?.receiptMint
                          ? compactAddress(selectedBuyerMission.receipt.receiptMint)
                          : "Pending cNFT"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                      <p className="eyebrow">Rights</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                        {formatUsageRightsLabel(reviewUsageRights)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <ConfidentialReviewPanel
                      error={confidentialReviewState.error}
                      isLoading={confidentialReviewState.isLoading}
                      payload={confidentialReviewState.payload}
                      record={confidentialReviewState.record}
                    />
                  </div>
                </article>
              ) : null}
            </section>
          ) : detailMission ? (
            <article className="panel rounded-[26px] p-5">
              <p className="eyebrow">Buyer review locked</p>
              <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                Connect the buyer wallet to review this task
              </h4>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Public task details are visible here. Playback, scoring, payout release, and cNFT
                receipt controls unlock only for the wallet that posted the task.
              </p>
            </article>
          ) : null}

          {detailMission ? (
            <MissionActivityFeed events={detailEvents} scope="public" title="Task timeline" />
          ) : null}
        </section>
      ) : null}

      {activeSection === "your-tasks" ? (
        <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
          <article className="panel rounded-[26px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">New task</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                  Post a robotics task
                </h3>
              </div>
              <StatusPill
                label={connectedWallet ? "Ready to post" : "Sign in to post"}
                tone={connectedWallet ? "good" : "warning"}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Every buyer task must include a live access link. Remote ops require a control surface
              link, and humanoid capture requires an upload destination or shared folder link. You
              can also require pilots to link World ID before they are allowed to claim the task.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {TASK_LANE_ORDER.map((laneId) => {
                const lane = getTaskLaneDefinition(laneId);
                const selected = laneId === composerLane;

                return (
                  <button
                    key={laneId}
                    type="button"
                    onClick={() => applyLaneDefaults(laneId)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-[var(--line-strong)] bg-[var(--background-muted)] text-[var(--text)]"
                        : "border-[var(--line)] bg-white text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {lane.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="panel-muted rounded-[20px] p-4 sm:col-span-2">
                <p className="eyebrow">Task title</p>
                <input
                  value={composerTitle}
                  onChange={(event) => setComposerTitle(event.target.value)}
                  className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                />
              </label>

              <label className="panel-muted rounded-[20px] p-4 sm:col-span-2">
                <p className="eyebrow">Environment or scenario</p>
                <input
                  value={composerEnvironment}
                  onChange={(event) => setComposerEnvironment(event.target.value)}
                  className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                />
              </label>

              <label className="panel-muted rounded-[20px] p-4 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="eyebrow">{getTaskLaneDefinition(composerLane).accessLinkLabel}</p>
                  <PrivacyPill scope="shared" />
                </div>
                <input
                  value={composerLink}
                  onChange={(event) => setComposerLink(event.target.value)}
                  placeholder={getTaskLaneDefinition(composerLane).accessLinkPlaceholder}
                  className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                />
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  {getTaskLaneDefinition(composerLane).accessLinkDescription}
                </p>
              </label>

              <label className="panel-muted rounded-[20px] p-4">
                <p className="eyebrow">Payout (SOL)</p>
                <input
                  value={composerPayout}
                  onChange={(event) => setComposerPayout(event.target.value)}
                  min={MIN_TASK_PAYOUT_SOL}
                  step="0.01"
                  type="number"
                  className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                />
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  Minimum payout is {MIN_TASK_PAYOUT_SOL} SOL for devnet demo tasks.
                </p>
              </label>

              <div className="panel-muted rounded-[20px] p-4">
                <p className="eyebrow">Posting summary</p>
                <p className="mt-3 text-sm font-semibold text-[var(--text)]">
                  {connectedWallet ? compactAddress(connectedWallet) : "No buyer wallet connected"}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  The task shell, payout, and final receipt will be public; the link usage stays contextual to buyer and pilot workspaces.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill
                    label={composerRequiresWorldId ? "World ID required" : "Open to all pilots"}
                    tone={composerRequiresWorldId ? "warning" : "neutral"}
                  />
                </div>
              </div>

              <label className="panel-muted rounded-[20px] p-4 sm:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Pilot eligibility</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                      Require World ID human proof
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      Turn this on for tasks that should only be claimable by pilots who linked World
                      ID to their wallet in ShadowPilot settings.
                    </p>
                  </div>
                  <input
                    checked={composerRequiresWorldId}
                    onChange={(event) => setComposerRequiresWorldId(event.target.checked)}
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded accent-[var(--text)]"
                  />
                </div>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCreateTask();
                }}
                disabled={!connectedWallet || !deploymentQuery.data?.deployed || transaction.isSending}
                className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Post task
              </button>
              <button
                type="button"
                onClick={() => applyLaneDefaults(composerLane)}
                className="rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition"
              >
                Reset lane defaults
              </button>
            </div>

            {actionError ? <p className="mt-4 text-sm text-[var(--critical)]">{actionError}</p> : null}
            {transaction.error ? (
              <p className="mt-4 text-sm text-[var(--critical)]">
                {transaction.error instanceof Error ? transaction.error.message : String(transaction.error)}
              </p>
            ) : null}
          </article>

          <div className="space-y-6">
            <article className="panel rounded-[26px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Lane preview</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                    {getTaskLaneDefinition(composerLane).label}
                  </h3>
                </div>
                <TaskLanePill laneId={composerLane} />
              </div>

              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                {getTaskLaneDefinition(composerLane).description}
              </p>

              <div className="mt-5 space-y-3">
                {getTaskLaneDefinition(composerLane).reviewSteps.map((step, index) => (
                  <div key={step.label} className="panel-muted rounded-[20px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {index + 1}. {step.label}
                      </p>
                      <PrivacyPill scope={step.scope} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{step.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel rounded-[26px] p-5">
              <p className="eyebrow">What pilots receive</p>
              <div className="mt-4 space-y-3">
                {getTaskLaneDefinition(composerLane).artifacts.map((artifact) => (
                  <div key={artifact.label} className="panel-muted rounded-[20px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text)]">{artifact.label}</p>
                      <PrivacyPill scope={artifact.scope} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{artifact.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeSection === "your-tasks" ? (
        <section className="panel rounded-[26px] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Your posted tasks</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                Buyer-owned work
              </h3>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                Keep this tab for scanning posted work. Open a task to review footage, score the
                submission, release payout, and mint the final cNFT receipt.
              </p>
            </div>
            <StatusPill label={`${buyerReviewQueue.length} waiting`} tone="warning" />
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="eyebrow">Active tasks</p>
                <StatusPill label={`${currentBuyerMissions.length} active`} tone="neutral" />
              </div>
              {renderTaskList(
                currentBuyerMissions,
                connectedWallet
                  ? "This wallet has no active buyer tasks right now."
                  : "Connect the buyer wallet to see its active tasks.",
                "buyer",
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="eyebrow">Completed tasks</p>
                <StatusPill label={`${completedBuyerMissions.length} closed`} tone="good" />
              </div>
              {renderTaskList(
                completedBuyerMissions,
                connectedWallet
                  ? "No completed tasks are tied to this buyer wallet yet."
                  : "Connect the buyer wallet to separate completed work from the public board.",
                "buyer",
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === "settings" ? (
        <div className="space-y-6">
          <MissionControlStrip />
          <section className="grid gap-6 xl:grid-cols-2">
            <article className="panel rounded-[26px] p-5">
              <p className="eyebrow">Buyer access</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                What stays private
              </h3>

              <div className="mt-5 space-y-3">
                <div className="panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">Buyer-only brief</p>
                    <PrivacyPill scope="buyer" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    The buyer controls the live link, acceptance context, and final approval for any task it posts.
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">Shared handoff</p>
                    <PrivacyPill scope="shared" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    The control or upload link is operationally shared with the pilot, but the buyer still decides what becomes accepted and paid.
                  </p>
                </div>
                <div className="panel-muted rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text)]">World ID task gate</p>
                    <PrivacyPill scope="public" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    The requirement itself is public onchain so pilots know whether they need a linked
                    human proof before claiming.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <IntegrationCard
                  kind="world"
                  title="World ID marks who can claim"
                  description="Use the World gate when a robotics task should only be accepted by a pilot who proved they are a unique human."
                />
                <IntegrationCard
                  kind="arcium"
                  title="Arcium marks how the review settles"
                  description="Use the Arcium-branded review lane to explain why scoring, payout tiering, and the final settlement memo stay more private than the public task shell."
                />
              </div>
            </article>

            <article className="panel rounded-[26px] p-5">
              <p className="eyebrow">Workspace state</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                Buyer runbook
              </h3>
              <ol className="mt-5 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
                <li>1. Choose the lane and provide the required access link.</li>
                <li>2. Decide whether the task should be gated behind a linked World ID human proof.</li>
                <li>3. Post the task on devnet with escrow attached.</li>
                <li>4. Review the submitted footage or capture package when the pilot submits it.</li>
                <li>5. Assign the final score to release payout and mint the cNFT receipt.</li>
              </ol>
            </article>
          </section>
        </div>
      ) : null}
    </div>
  );
}
