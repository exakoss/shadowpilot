"use client";

import { compactAddress } from "@shadowpilot/shared";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import {
  type MissionSubmission,
  type MissionSubmissionClip,
} from "@/hooks/use-shadowpilot-program";
import { compactTaskStatus, type LiveMission } from "@/lib/shadowpilot-program";
import { createVideoOnlyMediaRecorder, ensureVideoOnlyStream } from "@/lib/video-only-recording";

import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";
import { TaskAccessLinkPanel } from "./task-access-link-panel";

function formatDuration(milliseconds: bigint | number) {
  return `${(Number(milliseconds) / 1000).toFixed(1)}s`;
}

function formatPathEfficiency(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function formatSol(lamports: bigint | number) {
  const value = (Number(lamports) / 1_000_000_000).toFixed(3).replace(/\.?0+$/u, "");
  return `${value} SOL`;
}

function buildRemoteSessionTrace(startedAt: number, endedAt: number, incidentCount: number) {
  const duration = Math.max(1, endedAt - startedAt);

  return [
    { at: startedAt, x: 12, y: 18 },
    { at: startedAt + Math.round(duration * 0.42), x: 56, y: Math.max(8, 26 - incidentCount) },
    { at: endedAt, x: 92, y: 16 + Math.min(incidentCount, 6) },
  ];
}

function computeRemoteOpEfficiency(durationMillis: number, incidentCount: number) {
  const durationPenalty = Math.max(0, Math.round((durationMillis / 1000 - 18) * 42));
  const incidentPenalty = incidentCount * 420;
  return Math.max(6800, Math.min(9800, 9800 - durationPenalty - incidentPenalty));
}

const RECORDING_COUNTDOWN_SECONDS = 5;
const TARGET_RUN_SECONDS = 60;
const PAYOUT_TARGET = "Payout: one devnet settlement after buyer approval";

type RunStepState = "active" | "done" | "locked";

function runStepClassName(state: RunStepState) {
  switch (state) {
    case "done":
      return "border-[rgba(113,196,156,0.32)] bg-[rgba(113,196,156,0.12)]";
    case "active":
      return "border-[var(--brand-blue)] bg-[var(--brand-blue-soft)]";
    case "locked":
      return "border-[var(--line)] bg-white";
  }
}

export function PilotTeleopWorkspace({
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
  onSubmit: (mission: LiveMission, teleop: MissionSubmission) => Promise<unknown>;
  worldIdLinked: boolean;
}) {
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stopResolveRef = useRef<((clip: MissionSubmissionClip | null) => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [capturedClip, setCapturedClip] = useState<MissionSubmissionClip | null>(null);
  const [clipPreviewUrl, setClipPreviewUrl] = useState<string | null>(null);
  const [incidentCount, setIncidentCount] = useState(0);
  const [isPreparingCamera, setIsPreparingCamera] = useState(false);
  const [isRecordingLive, setIsRecordingLive] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState(RECORDING_COUNTDOWN_SECONDS);
  const [isCameraPreviewReady, setIsCameraPreviewReady] = useState(false);
  const [isPreflightActive, setIsPreflightActive] = useState(false);
  const [liveNow, setLiveNow] = useState(0);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const claimOwnedByConnectedWallet = Boolean(
    mission?.claim && connectedWallet && mission.claim.pilot === connectedWallet,
  );
  const claimStatus = mission?.claim?.status ?? null;
  const isMissionSettled = mission?.task.status === "paid" || mission?.task.status === "closed";
  const settledPayoutLamports =
    mission?.claim && mission.claim.payoutLamports > 0n
      ? mission.claim.payoutLamports
      : mission?.task.payoutLamports ?? 0n;
  const receiptLabel = mission?.receipt?.receiptMint
    ? compactAddress(mission.receipt.receiptMint)
    : "Receipt anchored";
  const claimBlockedByWorldId = Boolean(mission?.accessPolicy?.worldIdRequired && !worldIdLinked);
  const canStartRun = Boolean(
    claimOwnedByConnectedWallet &&
      claimStatus === "claimed" &&
      !isSending &&
      !isPreparingCamera &&
      !isPreflightActive &&
      !isRecordingLive &&
      !capturedClip,
  );
  const elapsedMillis = startedAt && liveNow > 0 ? BigInt(liveNow - startedAt) : 0n;
  const onchainSummary = mission?.claim
    ? {
        collisionCount: mission.claim.collisionCount,
        elapsed: formatDuration(mission.claim.interventionMillis),
        pathEfficiency: formatPathEfficiency(mission.claim.pathEfficiencyBps),
        score:
          mission.claim.scoreBps > 0
            ? `${(mission.claim.scoreBps / 100).toFixed(0)} / 100`
            : "Pending buyer score",
      }
    : null;
  const capturedDurationMillis = capturedClip?.durationMillis ?? null;
  const displayElapsed =
    isRecordingLive
      ? formatDuration(elapsedMillis)
      : capturedDurationMillis
        ? formatDuration(capturedDurationMillis)
        : onchainSummary?.elapsed ?? "0.0s";
  const previewEfficiency = computeRemoteOpEfficiency(Number(elapsedMillis), incidentCount);
  const capturedEfficiency = capturedDurationMillis
    ? computeRemoteOpEfficiency(capturedDurationMillis, incidentCount)
    : null;
  const runSteps: Array<{
    detail: string;
    label: string;
    state: RunStepState;
  }> = [
    {
      detail: "Brief, payout, buyer, and control link are visible on this task screen.",
      label: "1. Task info",
      state: mission ? "done" : "locked",
    },
    {
      detail: `${TARGET_RUN_SECONDS}s target run with a ${RECORDING_COUNTDOWN_SECONDS}s camera countdown.`,
      label: "2. Start window",
      state:
        isPreflightActive || isPreparingCamera || canStartRun
          ? "active"
          : isRecordingLive || capturedClip || mission?.task.status === "submitted" || mission?.task.status === "scored" || mission?.task.status === "paid" || mission?.task.status === "closed"
            ? "done"
            : "locked",
    },
    {
      detail: "Video-only recording captures the pilot run for buyer review.",
      label: "3. Complete run",
      state: isRecordingLive
        ? "active"
        : capturedClip || mission?.task.status === "submitted" || mission?.task.status === "scored" || mission?.task.status === "paid" || mission?.task.status === "closed"
          ? "done"
          : "locked",
    },
    {
      detail: `${PAYOUT_TARGET}. Reputation is assessed inside the sealed Arcium review.`,
      label: "4. Submit and get paid",
      state:
        capturedClip && mission?.task.status === "claimed"
          ? "active"
          : mission?.task.status === "submitted" || mission?.task.status === "scored"
            ? "active"
            : mission?.task.status === "paid" || mission?.task.status === "closed"
              ? "done"
              : "locked",
    },
  ];

  const setLivePreviewRef = useCallback((node: HTMLVideoElement | null) => {
    livePreviewRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!isRecordingLive) {
      return;
    }

    const interval = window.setInterval(() => {
      setLiveNow(Date.now());
    }, 200);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRecordingLive]);

  useEffect(() => {
    return () => {
      if (clipPreviewUrl) {
        URL.revokeObjectURL(clipPreviewUrl);
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, [clipPreviewUrl]);

  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    setCameraDevices(videoDevices);
    setSelectedCameraDeviceId((current) => {
      if (current && videoDevices.some((device) => device.deviceId === current)) {
        return current;
      }

      return videoDevices[0]?.deviceId ?? "";
    });
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshCameraDevices();
    }, 0);

    if (!navigator.mediaDevices?.addEventListener) {
      return () => {
        window.clearTimeout(initialRefresh);
      };
    }

    const handleDeviceChange = () => {
      void refreshCameraDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      window.clearTimeout(initialRefresh);
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshCameraDevices]);

  const triggerRecordingStart = useEffectEvent(() => {
    void startRecordingFromPreparedStream();
  });

  useEffect(() => {
    if (!countdownEndsAt || !isPreflightActive || isRecordingLive) {
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000));
      setCountdownRemaining(remaining);

      if (remaining <= 0) {
        setCountdownEndsAt(null);
        triggerRecordingStart();
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 200);

    return () => {
      window.clearInterval(interval);
    };
  }, [countdownEndsAt, isPreflightActive, isRecordingLive]);

  function revokeCapturedClip() {
    if (clipPreviewUrl) {
      URL.revokeObjectURL(clipPreviewUrl);
    }
    setClipPreviewUrl(null);
    setCapturedClip(null);
  }

  function stopStream() {
    if (!streamRef.current) {
      setIsCameraPreviewReady(false);
      return;
    }

    for (const track of streamRef.current.getTracks()) {
      track.stop();
    }
    streamRef.current = null;

    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }
    setIsCameraPreviewReady(false);
  }

  async function openRobotVideoStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Chrome cannot access a camera stream in this browser session.");
    }

    const video =
      selectedCameraDeviceId.length > 0
        ? { deviceId: { exact: selectedCameraDeviceId } }
        : true;
    const stream = ensureVideoOnlyStream(
      await navigator.mediaDevices.getUserMedia({ audio: false, video }),
    );
    void refreshCameraDevices();
    return stream;
  }

  async function attachStreamToLivePreview(stream: MediaStream) {
    if (!livePreviewRef.current) {
      return;
    }

    livePreviewRef.current.srcObject = stream;
    await livePreviewRef.current.play().catch(() => undefined);
  }

  function persistRecordedClip(blob: Blob, mimeType: string) {
    const previewUrl = URL.createObjectURL(blob);
    setClipPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return previewUrl;
    });

    const recordingStartedAt = startedAtRef.current ?? startedAt;
    const durationMillis = recordingStartedAt
      ? Math.max(1000, Date.now() - recordingStartedAt)
      : undefined;
    const clip: MissionSubmissionClip = {
      blob,
      durationMillis,
      fileName: `shadowpilot-remote-op-${Date.now()}.webm`,
      mimeType,
      source: "recorded",
    };

    setCapturedClip(clip);
    stopResolveRef.current?.(clip);
    stopResolveRef.current = null;
  }

  async function beginRecordingPreflight() {
    setActionError(null);
    setCountdownEndsAt(null);
    setCountdownRemaining(RECORDING_COUNTDOWN_SECONDS);
    setIsCameraPreviewReady(false);
    setIsPreflightActive(true);
    setIsPreparingCamera(true);
    setLiveNow(0);
    setStartedAt(null);
    startedAtRef.current = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support the live recording flow.");
      }

      revokeCapturedClip();
      stopStream();
      const stream = await openRobotVideoStream();
      streamRef.current = stream;
      chunksRef.current = [];

      await attachStreamToLivePreview(stream);
      setIsCameraPreviewReady(true);
      setCountdownEndsAt(Date.now() + RECORDING_COUNTDOWN_SECONDS * 1000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setCountdownEndsAt(null);
      setIsPreflightActive(false);
      stopStream();
    } finally {
      setIsPreparingCamera(false);
    }
  }

  async function startRecordingFromPreparedStream() {
    if (isRecordingLive) {
      return;
    }

    setActionError(null);
    setCountdownEndsAt(null);

    try {
      if (typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support the live recording flow.");
      }

      let stream = streamRef.current;
      if (!stream) {
        setIsPreparingCamera(true);
        stream = await openRobotVideoStream();
        streamRef.current = stream;
      }

      await attachStreamToLivePreview(stream);
      chunksRef.current = [];

      const recorder = createVideoOnlyMediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        persistRecordedClip(blob, mimeType);
        setCountdownRemaining(RECORDING_COUNTDOWN_SECONDS);
        setIsPreflightActive(false);
        setIsRecordingLive(false);
        stopStream();
      };
      recorder.start(1000);
      const now = Date.now();
      startedAtRef.current = now;
      setCountdownRemaining(0);
      setIsCameraPreviewReady(false);
      setIsPreflightActive(false);
      setIsRecordingLive(true);
      setStartedAt(now);
      setLiveNow(now);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setCountdownRemaining(RECORDING_COUNTDOWN_SECONDS);
      setIsPreflightActive(false);
      stopStream();
    } finally {
      setIsPreparingCamera(false);
    }
  }

  async function stopRecordingAndResolveClip() {
    if (!isRecordingLive) {
      if (capturedClip) {
        return capturedClip;
      }
      throw new Error("No recorded task footage is available yet.");
    }

    return new Promise<MissionSubmissionClip | null>((resolve) => {
      stopResolveRef.current = resolve;
      recorderRef.current?.stop();
      recorderRef.current = null;
    });
  }

  async function handleFinishRun() {
    setActionError(null);
    try {
      const clip = await stopRecordingAndResolveClip();
      if (!clip) {
        throw new Error("The live session finished without a recorded clip.");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

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
    if (!startedAt) {
      setActionError("Start the live robot session before submitting it.");
      return;
    }
    if (!capturedClip) {
      setActionError("Finish the recorded run before submitting the package.");
      return;
    }

    setActionError(null);

    try {
      const interventionDuration = capturedClip.durationMillis ?? Date.now() - startedAt;
      const endedAt = startedAt + interventionDuration;
      const interventionMillis = BigInt(interventionDuration);
      await onSubmit(mission, {
        collisionCount: incidentCount,
        interventionMillis,
        notes: sessionNotes,
        pathEfficiencyBps: computeRemoteOpEfficiency(Number(interventionMillis), incidentCount),
        trace: buildRemoteSessionTrace(startedAt, endedAt, incidentCount),
        videoClip: capturedClip,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  const pilotScreen =
    !mission
      ? "empty"
      : isMissionSettled
        ? "settled"
        : mission.task.status === "submitted" || mission.task.status === "scored"
          ? "submitted"
          : capturedClip
            ? "submit"
            : isPreflightActive || isRecordingLive
              ? "record"
              : claimOwnedByConnectedWallet && claimStatus === "claimed"
                ? "ready"
                : "info";

  const pilotScreenTitle =
    pilotScreen === "settled"
      ? "Paid, receipt minted, reputation assessed"
      : pilotScreen === "submitted"
        ? "Submitted for buyer review"
        : pilotScreen === "submit"
          ? "Review and submit the package"
          : pilotScreen === "record"
            ? isRecordingLive
              ? "Complete the live run"
              : "Recording begins after countdown"
            : pilotScreen === "ready"
              ? "Confirm you are ready to record"
              : "Task brief and claim";

  return (
    <section className="panel rounded-[30px] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Remote Operation Surface</p>
            <PrivacyPill scope="pilot" />
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{pilotScreenTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            A pilot moves through one screen at a time: read the brief, confirm readiness, record the
            run, review the clip, submit it for buyer review, then wait for payout and receipt.
          </p>
        </div>
        <StatusPill
          label={mission ? compactTaskStatus(mission.task.status) : "No mission"}
          tone={mission ? "active" : "neutral"}
        />
      </div>

      {mission ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 lg:grid-cols-4">
            {runSteps.map((step) => (
              <div
                key={step.label}
                className={`rounded-[18px] border p-4 ${runStepClassName(step.state)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">{step.label}</p>
                  <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {step.state}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{step.detail}</p>
              </div>
            ))}
          </div>

          {pilotScreen === "info" ? (
            <article className="panel-muted rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Step 1</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                    Read the task and claim it
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    This task is funded at {formatSol(mission.task.payoutLamports)}. Claiming opens
                    the buyer-provided robot control link and moves you to the ready screen.
                  </p>
                </div>
                <StatusPill
                  label={claimOwnedByConnectedWallet ? "Your claim" : "Claim required"}
                  tone={claimOwnedByConnectedWallet ? "good" : "warning"}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Payout</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {formatSol(mission.task.payoutLamports)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Buyer</p>
                  <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
                    {compactAddress(mission.task.buyer)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Recording</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">Video only</p>
                </div>
              </div>

              <TaskAccessLinkPanel mission={mission} scope={claimOwnedByConnectedWallet ? "shared" : "pilot"} />

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={!connectedWallet || mission.task.status !== "open" || isSending || claimBlockedByWorldId}
                  className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending
                    ? "Waiting for wallet"
                    : claimBlockedByWorldId
                      ? "Link World ID to claim"
                      : mission.task.status === "open"
                        ? "Claim task"
                        : "Task already claimed"}
                </button>
              </div>
            </article>
          ) : null}

          {pilotScreen === "ready" ? (
            <article className="panel-muted rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Step 2</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                    Confirm the run window
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    Target run time is {TARGET_RUN_SECONDS}s. Recording does not start until you
                    explicitly confirm that the robot, whiteboard, and camera are ready.
                  </p>
                </div>
                <StatusPill label={`${RECORDING_COUNTDOWN_SECONDS}s countdown`} tone="neutral" />
              </div>

              <TaskAccessLinkPanel mission={mission} scope="shared" />

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <p className="eyebrow">Camera source</p>
                  <select
                    value={selectedCameraDeviceId}
                    onChange={(event) => setSelectedCameraDeviceId(event.target.value)}
                    disabled={isPreparingCamera || isPreflightActive || isRecordingLive}
                    className="mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cameraDevices.length > 0 ? (
                      cameraDevices.map((device, index) => (
                        <option key={device.deviceId || `camera-${index}`} value={device.deviceId}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))
                    ) : (
                      <option value="">Default camera</option>
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void refreshCameraDevices();
                  }}
                  disabled={isPreparingCamera || isPreflightActive || isRecordingLive}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh cameras
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void beginRecordingPreflight();
                  }}
                  disabled={!canStartRun}
                  className="rounded-full border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[var(--brand-blue-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPreparingCamera ? "Preparing camera" : "I am ready, start countdown"}
                </button>
              </div>
            </article>
          ) : null}

          {pilotScreen === "record" ? (
            <article className="panel-muted rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Step 3</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                    Record the whiteboard line draw
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    The browser is saving video only. Finish the run after the robotic arm draws the
                    line and the camera has captured the outcome clearly.
                  </p>
                </div>
                <StatusPill
                  label={isRecordingLive ? formatDuration(elapsedMillis) : `Recording in ${countdownRemaining}s`}
                  tone="active"
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
                {isPreflightActive ? (
                  <div className="relative aspect-video overflow-hidden bg-[#111827]">
                    {isCameraPreviewReady ? (
                      <video
                        ref={setLivePreviewRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full bg-[#111827] object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#111827] px-6 text-center text-sm leading-6 text-white/70">
                        Preparing the camera preview before the countdown starts.
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-6">
                      <div className="w-full max-w-[520px] rounded-[24px] border border-white/20 bg-white/92 p-5 text-center shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur">
                        <p className="eyebrow text-[var(--brand-blue)]">Ready confirmed</p>
                        <h4 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
                          {isCameraPreviewReady
                            ? `Recording starts in ${countdownRemaining}`
                            : "Camera check in progress"}
                        </h4>
                        <p className="mx-auto mt-3 max-w-[420px] text-sm leading-6 text-[var(--text-muted)]">
                          At zero, footage starts saving for buyer review. Audio is disabled for the
                          demo recording.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void startRecordingFromPreparedStream();
                          }}
                          disabled={!isCameraPreviewReady || isSending}
                          className="mt-4 rounded-full border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[var(--brand-blue-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Start recording now
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={setLivePreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-video h-full w-full bg-[#e5e7eb] object-cover"
                  />
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Elapsed</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">{displayElapsed}</p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Compact efficiency</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {formatPathEfficiency(previewEfficiency)}
                  </p>
                </div>
                <label className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Safety incidents</p>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={incidentCount}
                    onChange={(event) => setIncidentCount(Number(event.target.value))}
                    className="mt-3 w-full rounded-[16px] border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleFinishRun();
                  }}
                  disabled={!isRecordingLive}
                  className="rounded-full border border-[rgba(113,196,156,0.28)] bg-[rgba(113,196,156,0.14)] px-4 py-2 text-sm font-medium text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Finish run and review clip
                </button>
              </div>
            </article>
          ) : null}

          {pilotScreen === "submit" ? (
            <article className="panel-muted rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Step 4</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                    Submit the recorded package
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    Review the camera clip, add a note if useful, then submit. Payout and cNFT
                    receipt wait for buyer approval after they review the footage.
                  </p>
                </div>
                <StatusPill label="Clip ready" tone="good" />
              </div>

              {clipPreviewUrl ? (
                <div className="mt-5 overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
                  <video
                    controls
                    src={clipPreviewUrl}
                    className="aspect-video h-full w-full bg-[#e5e7eb] object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Recorded duration</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">{displayElapsed}</p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Compact efficiency</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {capturedEfficiency ? formatPathEfficiency(capturedEfficiency) : "Pending"}
                  </p>
                </div>
                <label className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Safety incidents</p>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={incidentCount}
                    onChange={(event) => setIncidentCount(Number(event.target.value))}
                    className="mt-3 w-full rounded-[16px] border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                  />
                </label>
              </div>

              <label className="mt-4 block rounded-[18px] border border-[var(--line)] bg-white p-4">
                <p className="eyebrow">Pilot note</p>
                <textarea
                  rows={4}
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                  placeholder="Summarize the whiteboard line draw, the robotic arm behavior, and anything the buyer should notice in the footage."
                  className="mt-3 w-full rounded-[16px] border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--line-strong)]"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleSubmit();
                  }}
                  disabled={!claimOwnedByConnectedWallet || !startedAt || !capturedClip || isSending}
                  className="rounded-full border border-[rgba(113,196,156,0.28)] bg-[rgba(113,196,156,0.14)] px-4 py-2 text-sm font-medium text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? "Waiting for wallet" : "Submit for buyer review"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    revokeCapturedClip();
                    setStartedAt(null);
                    setLiveNow(0);
                    void beginRecordingPreflight();
                  }}
                  disabled={isSending || isPreparingCamera}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Record again
                </button>
              </div>
            </article>
          ) : null}

          {pilotScreen === "submitted" ? (
            <article className="panel-muted rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Buyer review</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                    Submitted, waiting for approval
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    The recorded package is onchain and available to the buyer. The pilot is not
                    paid yet; payout, cNFT receipt, and sealed reputation happen after buyer review.
                  </p>
                </div>
                <StatusPill label="Awaiting buyer" tone="warning" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Recovery time</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {onchainSummary?.elapsed ?? displayElapsed}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Efficiency</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {onchainSummary?.pathEfficiency ?? "Pending"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Incidents</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {mission.claim?.collisionCount ?? incidentCount}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Payment</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">Pending buyer review</p>
                </div>
              </div>
            </article>
          ) : null}

          {pilotScreen === "settled" ? (
            <article className="panel-muted rounded-[24px] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="eyebrow">Settlement complete</p>
                    <PrivacyPill scope="shared" />
                  </div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
                    Paid, receipt minted, reputation assessed
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                    The buyer accepted the footage. Devnet payout has been released, the cNFT
                    receipt is anchored, and the reputation-sensitive review is sealed for this
                    buyer and pilot pair.
                  </p>
                </div>
                <StatusPill label="Receipt minted" tone="good" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[18px] border border-[rgba(113,196,156,0.32)] bg-white p-4">
                  <p className="eyebrow">Paid to pilot</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {formatSol(settledPayoutLamports)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Buyer score</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {onchainSummary?.score ?? "Sealed"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">cNFT receipt</p>
                  <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm text-[var(--text)]">
                    {receiptLabel}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
                  <p className="eyebrow">Private reputation</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                    Arcium sealed review ready
                  </p>
                </div>
              </div>
            </article>
          ) : null}

          {actionError ? <p className="text-sm text-[var(--critical)]">{actionError}</p> : null}
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-5 text-sm leading-6 text-[var(--text-muted)]">
          No funded mission is available on this cluster yet. Create one from the buyer page, then
          return here to claim it with the pilot account.
        </div>
      )}
    </section>
  );
}
