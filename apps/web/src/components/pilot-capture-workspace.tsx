"use client";

import { useState } from "react";

import { type MissionSubmission } from "@/hooks/use-shadowpilot-program";
import { compactTaskStatus, type LiveMission } from "@/lib/shadowpilot-program";

import { LocalVideoCapturePanel, type LocalClipState } from "./local-video-capture-panel";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";
import { TaskAccessLinkPanel } from "./task-access-link-panel";

function formatDuration(milliseconds: bigint | number) {
  return `${(Number(milliseconds) / 1000).toFixed(1)}s`;
}

function formatPercent(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function buildCaptureTracePoint(seed: number, index: number, coverage: number) {
  return {
    at: seed + index * 1000,
    x: Math.min(100, Math.max(1, coverage)),
    y: index + 1,
  };
}

export function PilotCaptureWorkspace({
  connectedWallet,
  isSending,
  mission,
  onClaim,
  onSubmit,
  worldIdLinked,
}: {
  connectedWallet: string | null;
  isSending: boolean;
  mission: LiveMission | null;
  onClaim: (taskAddress: string) => Promise<unknown>;
  onSubmit: (mission: LiveMission, submission: MissionSubmission) => Promise<unknown>;
  worldIdLinked: boolean;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [captureClip, setCaptureClip] = useState<LocalClipState | null>(null);
  const [clipCount, setClipCount] = useState(3);
  const [coverageBps, setCoverageBps] = useState(9200);
  const [packageReady, setPackageReady] = useState(false);
  const [retakeCount, setRetakeCount] = useState(1);
  const [takeMillis, setTakeMillis] = useState(24_000);

  const claimOwnedByConnectedWallet = Boolean(
    mission?.claim && connectedWallet && mission.claim.pilot === connectedWallet,
  );
  const claimBlockedByWorldId = Boolean(mission?.accessPolicy?.worldIdRequired && !worldIdLinked);
  const onchainSummary = mission?.claim
    ? {
        coverage: formatPercent(mission.claim.pathEfficiencyBps),
        retakes: `${mission.claim.collisionCount}`,
        score:
          mission.claim.scoreBps > 0
            ? `${(mission.claim.scoreBps / 100).toFixed(0)} / 100`
            : "Pending score",
        takeTime: formatDuration(mission.claim.interventionMillis),
      }
    : null;

  async function handleClaim() {
    if (!mission) {
      return;
    }

    setActionError(null);
    try {
      await onClaim(mission.task.address);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSubmit() {
    if (!mission) {
      return;
    }
    if (!packageReady) {
      setActionError("Stage the local clip package before submitting it onchain.");
      return;
    }
    if (!captureClip) {
      setActionError("Record or upload a local clip before submitting the package.");
      return;
    }

    setActionError(null);

    const seed = Date.now();
    const submission: MissionSubmission = {
      collisionCount: retakeCount,
      interventionMillis: BigInt(takeMillis),
      pathEfficiencyBps: coverageBps,
      trace: Array.from({ length: clipCount }, (_, index) =>
        buildCaptureTracePoint(seed, index, Math.round(coverageBps / 100)),
      ),
    };

    try {
      await onSubmit(mission, submission);
      setPackageReady(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="panel rounded-[26px] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Humanoid capture</p>
            <PrivacyPill scope="pilot" />
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
            Local capture workspace
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Open the buyer-provided upload destination, then record or upload a local clip in the
            browser before staging the compact capture package.
          </p>
        </div>
        <StatusPill
          label={mission ? compactTaskStatus(mission.task.status) : "No task"}
          tone={mission ? "active" : "neutral"}
        />
      </div>

      {mission ? (
        <div className="mt-6 space-y-5">
          <TaskAccessLinkPanel mission={mission} scope="shared" />

          <LocalVideoCapturePanel
            onClipChange={(clip) => {
              setCaptureClip(clip);
              setPackageReady(false);
            }}
          />

          <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr]">
            <div className="space-y-4">
              <div className="panel-muted rounded-[22px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Capture brief</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text)]">
                      {mission.task.title}
                    </h3>
                  </div>
                  <PrivacyPill scope="shared" />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  {mission.task.environment}. Pilots can keep the raw clip local and still submit
                  the compact manifest and metrics onchain.
                </p>
                {mission.accessPolicy?.worldIdRequired ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill
                      label={worldIdLinked ? "World ID linked" : "World ID required"}
                      tone={worldIdLinked ? "good" : "warning"}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Clip count</p>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={clipCount}
                    onChange={(event) => {
                      setClipCount(Number(event.target.value));
                      setPackageReady(false);
                    }}
                    className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                </label>

                <label className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Capture time</p>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={Math.round(takeMillis / 1000)}
                    onChange={(event) => {
                      setTakeMillis(Number(event.target.value) * 1000);
                      setPackageReady(false);
                    }}
                    className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                </label>

                <label className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Coverage</p>
                  <input
                    type="range"
                    min={7000}
                    max={9900}
                    step={50}
                    value={coverageBps}
                    onChange={(event) => {
                      setCoverageBps(Number(event.target.value));
                      setPackageReady(false);
                    }}
                    className="mt-4 w-full accent-[var(--text)]"
                  />
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                    {formatPercent(coverageBps)}
                  </p>
                </label>

                <label className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Retakes</p>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={retakeCount}
                    onChange={(event) => {
                      setRetakeCount(Number(event.target.value));
                      setPackageReady(false);
                    }}
                    className="mt-3 w-full rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Clip source</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                    {captureClip ? (captureClip.source === "recorded" ? "Recorded locally" : "Uploaded locally") : "Pending"}
                  </p>
                </div>
                <div className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Clip file</p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    {captureClip ? captureClip.name : "No local clip selected"}
                  </p>
                </div>
                <div className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Onchain coverage</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {onchainSummary?.coverage ?? formatPercent(coverageBps)}
                  </p>
                </div>
                <div className="panel-muted rounded-[22px] p-4">
                  <p className="eyebrow">Onchain score</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {onchainSummary?.score ?? "Pending"}
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-[var(--line)] bg-[var(--background-muted)] p-4">
                <p className="eyebrow">Package controls</p>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  Claim the task, prepare the local clip, then stage the package before signing the
                  compact submission.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={!connectedWallet || mission.task.status !== "open" || isSending || claimBlockedByWorldId}
                    className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {claimBlockedByWorldId
                      ? "Link World ID to claim"
                      : mission.task.status === "open"
                        ? "Claim capture task"
                        : "Task claimed"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      if (!captureClip) {
                        setActionError("Record or upload a local clip before staging the package.");
                        return;
                      }
                      setPackageReady(true);
                    }}
                    disabled={!claimOwnedByConnectedWallet || mission.claim?.status !== "claimed" || isSending}
                    className="rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Stage local package
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmit();
                    }}
                    disabled={!packageReady || !claimOwnedByConnectedWallet || isSending}
                    className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Submit capture package
                  </button>
                </div>

                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                  {mission.task.status === "open" && claimBlockedByWorldId
                    ? "This capture task is gated behind a linked World ID human proof. Link World ID in settings before claiming."
                    : mission.task.status === "open"
                      ? "The capture task is funded and waiting for a pilot claim."
                    : mission.task.status === "claimed" && !packageReady
                      ? "Claim is recorded. Prepare a local clip and stage the package when ready."
                      : mission.task.status === "claimed" && packageReady
                        ? "Local clip is staged. Submit the compact manifest to hand the task back to the buyer."
                        : mission.task.status === "submitted"
                          ? "The compact capture package is onchain. Buyer settlement is the next live step."
                          : mission.task.status === "closed"
                            ? "The capture package is settled and the receipt is anchored onchain."
                            : "Waiting for the next task transition."}
                </p>

                {actionError ? <p className="mt-4 text-sm text-[var(--critical)]">{actionError}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[22px] border border-[var(--line)] bg-[var(--background-muted)] p-5 text-sm leading-6 text-[var(--text-muted)]">
          No humanoid capture task is available on this cluster yet. Post one from the buyer side,
          then return here to claim it and record or upload a local clip.
        </div>
      )}
    </section>
  );
}
