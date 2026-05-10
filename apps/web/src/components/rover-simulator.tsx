"use client";

import { compactAddress } from "@shadowpilot/shared";
import { useEffect, useEffectEvent, useState } from "react";

import { useShadowPilotAuth } from "./shadowpilot-auth-provider";
import {
  formatDuration,
  formatPathEfficiency,
  stageLabel,
  stageTone,
} from "@/lib/demo-mission";

import { useShadowPilotDemo } from "./demo-mission-provider";
import { RoverGrid } from "./rover-grid";
import { StatusPill } from "./status-pill";

export function RoverSimulator() {
  const { beginTeleop, mission, moveRover, resetMission, submitMission } = useShadowPilotDemo();
  const { connectedWallet: walletAddress } = useShadowPilotAuth();
  const [liveNow, setLiveNow] = useState(0);

  const reachedGoal =
    mission.roverPosition.x === mission.goalPosition.x &&
    mission.roverPosition.y === mission.goalPosition.y;
  const liveDuration =
    mission.stage === "in_progress" && mission.interventionStartedAt && liveNow > 0
      ? liveNow - mission.interventionStartedAt
      : mission.interventionMillis;

  useEffect(() => {
    if (mission.stage !== "in_progress") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLiveNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mission.stage]);

  const handleKeydown = useEffectEvent((event: KeyboardEvent) => {
    if (mission.stage !== "in_progress") {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement) {
      const tagName = target.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
        return;
      }
    }

    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      event.preventDefault();
      moveRover("up");
    } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
      event.preventDefault();
      moveRover("down");
    } else if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      event.preventDefault();
      moveRover("left");
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      event.preventDefault();
      moveRover("right");
    }
  });

  useEffect(() => {
    if (mission.stage !== "in_progress") {
      return;
    }

    function onKeydown(event: KeyboardEvent) {
      handleKeydown(event);
    }

    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [mission.stage]);

  return (
    <section className="panel rounded-[30px] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Pilot Takeover Surface</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Manual recovery simulator</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            This is the live demo loop: claim the mission, take keyboard control, reach the handoff
            zone, and then watch the private score, payout, and rights receipt land automatically.
          </p>
        </div>
        <StatusPill label={stageLabel(mission.stage)} tone={stageTone(mission.stage)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RoverGrid mission={mission} />

        <div className="space-y-4">
          <div className="panel-muted rounded-[24px] p-4">
            <p className="eyebrow">Pilot route</p>
            <p className="mt-2 text-sm text-[var(--text)]">
              {mission.pilotWallet
                ? compactAddress(mission.pilotWallet)
                : walletAddress
                  ? compactAddress(walletAddress)
                  : "Demo pilot wallet fallback"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {walletAddress
                ? "The connected Privy or Phantom wallet is the pilot signer for the live handoff."
                : "Sign in with Privy or Phantom before using this simulator for the live demo path."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel-muted rounded-[24px] p-4">
              <p className="eyebrow">Elapsed</p>
              <p className="mt-2 text-xl font-semibold">{formatDuration(liveDuration)}</p>
            </div>
            <div className="panel-muted rounded-[24px] p-4">
              <p className="eyebrow">Efficiency</p>
              <p className="mt-2 text-xl font-semibold">
                {mission.pathEfficiencyBps > 0 ? formatPathEfficiency(mission.pathEfficiencyBps) : "Pending"}
              </p>
            </div>
            <div className="panel-muted rounded-[24px] p-4">
              <p className="eyebrow">Collisions</p>
              <p className="mt-2 text-xl font-semibold">{mission.collisionCount}</p>
            </div>
            <div className="panel-muted rounded-[24px] p-4">
              <p className="eyebrow">Steps</p>
              <p className="mt-2 text-xl font-semibold">{mission.stepCount}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className="eyebrow">Controls</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Use <span className="font-[var(--font-ibm-plex-mono)] text-[var(--text)]">WASD</span> or the arrow keys to move one cell at a time.
              Hitting blocked cells counts as a collision but does not move the rover.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={beginTeleop}
                disabled={mission.stage !== "claimed"}
                className="rounded-full border border-[var(--line-strong)] bg-[rgba(240,166,72,0.14)] px-4 py-2 text-sm font-medium text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mission.stage === "claimed" ? "Begin takeover" : "Takeover armed"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitMission();
                }}
                disabled={mission.stage !== "in_progress" || !reachedGoal}
                className="rounded-full border border-[rgba(113,196,156,0.28)] bg-[rgba(113,196,156,0.14)] px-4 py-2 text-sm font-medium text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit successful trace
              </button>
              <button
                type="button"
                onClick={resetMission}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[rgba(255,255,255,0.22)] hover:text-[var(--text)]"
              >
                Reset demo
              </button>
            </div>

            <p className="mt-4 text-sm text-[var(--text-muted)]">
              {mission.stage === "claimed"
                ? "Claim is live. Start takeover when you are ready to drive."
                : mission.stage === "in_progress" && !reachedGoal
                  ? "Guide the rover around the pallet block to the green goal zone."
                  : mission.stage === "in_progress" && reachedGoal
                    ? "Recovery complete. Submit the trace to trigger scoring and settlement."
                    : mission.stage === "submitted"
                      ? "Compact mission metrics are being prepared for confidential scoring."
                      : mission.stage === "scored"
                        ? "Private scoring is complete. Escrow release is next."
                        : mission.stage === "paid"
                          ? "Payout is released. Rights receipt minting is underway."
                          : mission.stage === "closed"
                            ? "Mission closed. Buyer receipt and pilot payout are both ready."
                            : "Fund and claim the mission first, then this simulator becomes active."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
