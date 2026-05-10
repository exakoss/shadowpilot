"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEMO_STORAGE_KEY,
  buildReceiptMint,
  buildTraceUri,
  computeMissionScore,
  computePathEfficiency,
  createInitialMissionState,
  formatDuration,
  hashMissionTrace,
  movePoint,
  type DemoMissionState,
} from "@/lib/demo-mission";

type MoveDirection = "up" | "down" | "left" | "right";

type DemoMissionContextValue = {
  beginTeleop: () => void;
  claimMission: (pilotWallet?: string) => void;
  fundMission: (buyerWallet?: string) => void;
  hydrated: boolean;
  mission: DemoMissionState;
  moveRover: (direction: MoveDirection) => void;
  resetMission: () => void;
  setWorldVerification: (verified: boolean) => void;
  submitMission: () => Promise<void>;
};

const DemoMissionContext = createContext<DemoMissionContextValue | null>(null);

const DEFAULT_PILOT_WALLET = "8uAt9YtE6eHc4Aq3u7w3a7iG6wxxwFv3nS1mX7Q9z4kr";

function readStoredMission() {
  const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as DemoMissionState;
  } catch {
    return null;
  }
}

function isBlockedCell(mission: DemoMissionState, x: number, y: number) {
  return mission.blockedCells.some((cell) => cell.x === x && cell.y === y);
}

function isInBounds(mission: DemoMissionState, x: number, y: number) {
  return x >= 0 && x < mission.gridWidth && y >= 0 && y < mission.gridHeight;
}

export function DemoMissionProvider({ children }: { children: ReactNode }) {
  const [mission, setMission] = useState(() => {
    if (typeof window === "undefined") {
      return createInitialMissionState();
    }

    return readStoredMission() ?? createInitialMissionState();
  });
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const pendingTimeouts = useRef<number[]>([]);

  function clearPendingTransitions() {
    for (const timeoutId of pendingTimeouts.current) {
      window.clearTimeout(timeoutId);
    }
    pendingTimeouts.current = [];
  }

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== DEMO_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        setMission(JSON.parse(event.newValue) as DemoMissionState);
      } catch {
        setMission(createInitialMissionState());
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      clearPendingTransitions();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(mission));
  }, [hydrated, mission]);

  function fundMission(buyerWallet?: string) {
    setMission((current) => {
      if (current.stage !== "awaiting_escrow") {
        return current;
      }

      return {
        ...current,
        buyerWallet: buyerWallet ?? current.buyerWallet,
        events: [
          ...current.events,
          {
            id: `buyer-funded-${Date.now()}`,
            at: new Date().toISOString(),
            detail: `${current.payoutSol.toFixed(1)} SOL escrow locked for ${current.title}.`,
            kind: "solana",
            label: "Escrow funded",
          },
        ],
        stage: "open",
      };
    });
  }

  function setWorldVerification(verified: boolean) {
    setMission((current) => {
      if (current.stage !== "open" && current.stage !== "claimed") {
        return {
          ...current,
          worldVerified: verified,
        };
      }

      return {
        ...current,
        events:
          verified && !current.worldVerified
            ? [
                ...current.events,
                {
                  id: `world-verified-${Date.now()}`,
                  at: new Date().toISOString(),
                  detail: "Pilot passed the simulated World ID uniqueness gate.",
                  kind: "pilot",
                  label: "Human proof ready",
                },
              ]
            : current.events,
        worldVerified: verified,
      };
    });
  }

  function claimMission(pilotWallet?: string) {
    setMission((current) => {
      if (current.stage !== "open" || !current.worldVerified) {
        return current;
      }

      return {
        ...current,
        events: [
          ...current.events,
          {
            id: `pilot-claim-${Date.now()}`,
            at: new Date().toISOString(),
            detail: "Verified pilot accepted the fallback request and loaded the mission packet.",
            kind: "pilot",
            label: "Mission claimed",
          },
        ],
        pilotWallet: pilotWallet ?? current.pilotWallet ?? DEFAULT_PILOT_WALLET,
        stage: "claimed",
      };
    });
  }

  function beginTeleop() {
    setMission((current) => {
      if (current.stage !== "claimed") {
        return current;
      }

      return {
        ...current,
        events: [
          ...current.events,
          {
            id: `teleop-start-${Date.now()}`,
            at: new Date().toISOString(),
            detail: "Pilot took manual control and started recording the recovery trace.",
            kind: "system",
            label: "Takeover live",
          },
        ],
        interventionStartedAt: Date.now(),
        settlementStatus: "idle",
        stage: "in_progress",
      };
    });
  }

  function moveRover(direction: MoveDirection) {
    setMission((current) => {
      if (current.stage !== "in_progress") {
        return current;
      }

      const nextPoint = movePoint(current.roverPosition, direction);
      const timestamp = Date.now();
      const nextInterventionMillis = current.interventionStartedAt
        ? timestamp - current.interventionStartedAt
        : current.interventionMillis;

      if (!isInBounds(current, nextPoint.x, nextPoint.y) || isBlockedCell(current, nextPoint.x, nextPoint.y)) {
        return {
          ...current,
          collisionCount: current.collisionCount + 1,
          interventionMillis: nextInterventionMillis,
        };
      }

      const nextStepCount = current.stepCount + 1;
      const nextTrace = [...current.trace, { ...nextPoint, at: timestamp }];
      const reachedGoal =
        nextPoint.x === current.goalPosition.x && nextPoint.y === current.goalPosition.y;

      return {
        ...current,
        events:
          reachedGoal &&
          !(current.roverPosition.x === current.goalPosition.x && current.roverPosition.y === current.goalPosition.y)
            ? [
                ...current.events,
                {
                  id: `goal-reached-${Date.now()}`,
                  at: new Date().toISOString(),
                  detail: "Rover cleared the pallet breach and reached the target handoff zone.",
                  kind: "system",
                  label: "Goal reached",
                },
              ]
            : current.events,
        interventionMillis: nextInterventionMillis,
        pathEfficiencyBps: computePathEfficiency(nextStepCount),
        roverPosition: nextPoint,
        stepCount: nextStepCount,
        trace: nextTrace,
      };
    });
  }

  async function submitMission() {
    const current = mission;
    const reachedGoal =
      current.roverPosition.x === current.goalPosition.x &&
      current.roverPosition.y === current.goalPosition.y;

    if (current.stage !== "in_progress" || !reachedGoal) {
      return;
    }

    clearPendingTransitions();

    const interventionMillis = current.interventionStartedAt
      ? Date.now() - current.interventionStartedAt
      : current.interventionMillis;
    const pathEfficiencyBps = computePathEfficiency(current.stepCount);
    const traceHash = await hashMissionTrace({
      missionId: current.missionId,
      trace: current.trace,
      collisionCount: current.collisionCount,
      pathEfficiencyBps,
      interventionMillis,
    });
    const traceUri = buildTraceUri(current.missionId);
    const scoreSummary = computeMissionScore({
      collisionCount: current.collisionCount,
      interventionMillis,
      pathEfficiencyBps,
      payoutLamports: current.payoutLamports,
      success: true,
    });

    setMission((latest) => ({
      ...latest,
      events: [
        ...latest.events,
        {
          id: `submit-trace-${Date.now()}`,
          at: new Date().toISOString(),
          detail: `Trace submitted with ${latest.collisionCount} collisions, ${latest.stepCount} steps, and ${formatDuration(interventionMillis)} intervention time.`,
          kind: "pilot",
          label: "Trace submitted",
        },
      ],
      interventionMillis,
      pathEfficiencyBps,
      score: scoreSummary.score,
      scoreBand: scoreSummary.scoreBand,
      settlementStatus: "scoring",
      stage: "submitted",
      submittedAt: new Date().toISOString(),
      traceHash,
      traceUri,
    }));

    pendingTimeouts.current.push(
      window.setTimeout(() => {
        setMission((latest) => ({
          ...latest,
          events: [
            ...latest.events,
            {
              id: `arcium-score-${Date.now()}`,
              at: new Date().toISOString(),
              detail: `Arcium-style confidential scoring returned ${scoreSummary.scoreBand} and ${scoreSummary.payoutTier}.`,
              kind: "arcium",
              label: "Private score ready",
            },
          ],
          reputationDelta: scoreSummary.reputationDelta,
          score: scoreSummary.score,
          scoreBand: scoreSummary.scoreBand,
          settlementStatus: "settling",
          stage: "scored",
        }));
      }, 1000),
    );

    pendingTimeouts.current.push(
      window.setTimeout(() => {
        setMission((latest) => ({
          ...latest,
          events: [
            ...latest.events,
            {
              id: `payout-release-${Date.now()}`,
              at: new Date().toISOString(),
              detail: `${(scoreSummary.payoutLamports / 1_000_000_000).toFixed(2)} SOL released from escrow to the pilot.`,
              kind: "solana",
              label: "Payout released",
            },
          ],
          payoutReleasedLamports: scoreSummary.payoutLamports,
          settlementStatus: "minting",
          stage: "paid",
        }));
      }, 2000),
    );

    pendingTimeouts.current.push(
      window.setTimeout(() => {
        setMission((latest) => ({
          ...latest,
          events: [
            ...latest.events,
            {
              id: `receipt-mint-${Date.now()}`,
              at: new Date().toISOString(),
              detail: "Rights receipt minted for buyer training and replay usage.",
              kind: "solana",
              label: "Receipt minted",
            },
          ],
          receiptMint: buildReceiptMint(latest.missionId),
          receiptRights: "Buyer receives training and replay rights for the accepted trace.",
          settlementStatus: "complete",
          stage: "closed",
        }));
      }, 3000),
    );
  }

  function resetMission() {
    clearPendingTransitions();
    setMission(createInitialMissionState());
  }

  return (
    <DemoMissionContext.Provider
      value={{
        beginTeleop,
        claimMission,
        fundMission,
        hydrated,
        mission,
        moveRover,
        resetMission,
        setWorldVerification,
        submitMission,
      }}
    >
      {children}
    </DemoMissionContext.Provider>
  );
}

export function useShadowPilotDemo() {
  const context = useContext(DemoMissionContext);
  if (!context) {
    throw new Error("useShadowPilotDemo must be used within a DemoMissionProvider.");
  }

  return context;
}
