export type DemoMissionStage =
  | "awaiting_escrow"
  | "open"
  | "claimed"
  | "in_progress"
  | "submitted"
  | "scored"
  | "paid"
  | "closed";

export type GridPoint = {
  x: number;
  y: number;
};

export type TracePoint = GridPoint & {
  at: number;
};

export type DemoActivityKind = "buyer" | "pilot" | "system" | "arcium" | "solana";

export type DemoActivity = {
  id: string;
  at: string;
  detail: string;
  kind: DemoActivityKind;
  label: string;
};

export type DemoSettlementStatus = "idle" | "scoring" | "settling" | "minting" | "complete";

export type DemoMissionState = {
  bestPathSteps: number;
  blockedCells: GridPoint[];
  bundleHash: string;
  bundleUri: string;
  buyerWallet: string;
  collisionCount: number;
  environment: string;
  events: DemoActivity[];
  goalPosition: GridPoint;
  gridHeight: number;
  gridWidth: number;
  interventionMillis: number;
  interventionStartedAt: number | null;
  missionId: string;
  pathEfficiencyBps: number;
  payoutLamports: number;
  payoutReleasedLamports: number | null;
  payoutSol: number;
  pilotWallet: string | null;
  priority: "critical" | "high" | "medium";
  receiptMint: string | null;
  receiptRights: string | null;
  reputationDelta: string | null;
  roverPosition: GridPoint;
  score: number | null;
  scoreBand: string | null;
  settlementStatus: DemoSettlementStatus;
  site: string;
  stage: DemoMissionStage;
  stepCount: number;
  submittedAt: string | null;
  summary: string;
  title: string;
  trace: TracePoint[];
  traceHash: string | null;
  traceUri: string | null;
  worldVerified: boolean;
};

export type MissionScoreSummary = {
  payoutLamports: number;
  payoutTier: string;
  reputationDelta: string;
  score: number;
  scoreBand: string;
};

export const DEMO_STORAGE_KEY = "shadowpilot:demo-mission:v1";

const GRID_WIDTH = 12;
const GRID_HEIGHT = 8;
const START_POSITION: GridPoint = { x: 1, y: 6 };
const GOAL_POSITION: GridPoint = { x: 10, y: 1 };
const BLOCKED_CELLS: GridPoint[] = [
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 3, y: 4 },
  { x: 3, y: 5 },
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 4 },
  { x: 6, y: 5 },
  { x: 5, y: 4 },
  { x: 7, y: 4 },
  { x: 8, y: 4 },
];

const DEFAULT_BUYER_WALLET = "5iLx8b4k9VnP2rC3c8D8V7hQ9zaPi9hVn1aW3Q2k9mzN";

function createEvent(label: string, detail: string, kind: DemoActivityKind): DemoActivity {
  return {
    id: `${kind}-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    at: new Date().toISOString(),
    detail,
    kind,
    label,
  };
}

function pointKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

function isBlocked(point: GridPoint) {
  return BLOCKED_CELLS.some((cell) => cell.x === point.x && cell.y === point.y);
}

function isInBounds(point: GridPoint) {
  return point.x >= 0 && point.x < GRID_WIDTH && point.y >= 0 && point.y < GRID_HEIGHT;
}

function findBestPathSteps() {
  const startKey = pointKey(START_POSITION);
  const queue: Array<{ point: GridPoint; steps: number }> = [{ point: START_POSITION, steps: 0 }];
  const visited = new Set<string>([startKey]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.point.x === GOAL_POSITION.x && current.point.y === GOAL_POSITION.y) {
      return current.steps;
    }

    const neighbors = [
      { x: current.point.x + 1, y: current.point.y },
      { x: current.point.x - 1, y: current.point.y },
      { x: current.point.x, y: current.point.y + 1 },
      { x: current.point.x, y: current.point.y - 1 },
    ];

    for (const neighbor of neighbors) {
      const key = pointKey(neighbor);
      if (!isInBounds(neighbor) || isBlocked(neighbor) || visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({ point: neighbor, steps: current.steps + 1 });
    }
  }

  return 0;
}

export const BEST_PATH_STEPS = findBestPathSteps();

export function stageLabel(stage: DemoMissionStage) {
  switch (stage) {
    case "awaiting_escrow":
      return "Awaiting escrow";
    case "open":
      return "Funded and open";
    case "claimed":
      return "Pilot claimed";
    case "in_progress":
      return "Teleop in progress";
    case "submitted":
      return "Trace submitted";
    case "scored":
      return "Private score ready";
    case "paid":
      return "Payout released";
    case "closed":
      return "Receipt minted";
  }
}

export function stageTone(stage: DemoMissionStage) {
  switch (stage) {
    case "awaiting_escrow":
      return "warning";
    case "open":
      return "active";
    case "claimed":
      return "active";
    case "in_progress":
      return "critical";
    case "submitted":
      return "warning";
    case "scored":
      return "good";
    case "paid":
      return "good";
    case "closed":
      return "good";
  }
}

export function formatDuration(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPathEfficiency(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

export function createInitialMissionState(): DemoMissionState {
  return {
    bestPathSteps: BEST_PATH_STEPS,
    blockedCells: BLOCKED_CELLS,
    bundleHash: "4f0b8e4bca09f064c7e8b8bc0d8c4f6e9e2ca33125e4547c5040b711923a7c18",
    bundleUri: "ar://shadowpilot/task/SP-014.bundle",
    buyerWallet: DEFAULT_BUYER_WALLET,
    collisionCount: 0,
    environment: "Warehouse grid / aisle 14",
    events: [
      createEvent(
        "Autonomy fault detected",
        "Rover deadlocked after a pallet partially breached the aisle boundary.",
        "system",
      ),
      createEvent(
        "Mission packet prepared",
        "Encrypted task bundle is staged and waiting for buyer escrow.",
        "buyer",
      ),
    ],
    goalPosition: GOAL_POSITION,
    gridHeight: GRID_HEIGHT,
    gridWidth: GRID_WIDTH,
    interventionMillis: 0,
    interventionStartedAt: null,
    missionId: "SP-014",
    pathEfficiencyBps: 0,
    payoutLamports: 250_000_000,
    payoutReleasedLamports: null,
    payoutSol: 0.25,
    pilotWallet: null,
    priority: "critical",
    receiptMint: null,
    receiptRights: null,
    reputationDelta: null,
    roverPosition: START_POSITION,
    score: null,
    scoreBand: null,
    settlementStatus: "idle",
    site: "Brooklyn micro-fulfillment pod",
    stage: "awaiting_escrow",
    stepCount: 0,
    submittedAt: null,
    summary: "Drive the rover around the pallet breach and resume the delivery lane.",
    title: "Rover aisle recovery",
    trace: [{ ...START_POSITION, at: Date.now() }],
    traceHash: null,
    traceUri: null,
    worldVerified: false,
  };
}

export function movePoint(point: GridPoint, direction: "up" | "down" | "left" | "right"): GridPoint {
  switch (direction) {
    case "up":
      return { x: point.x, y: point.y - 1 };
    case "down":
      return { x: point.x, y: point.y + 1 };
    case "left":
      return { x: point.x - 1, y: point.y };
    case "right":
      return { x: point.x + 1, y: point.y };
  }
}

export function computePathEfficiency(stepCount: number) {
  if (stepCount <= 0 || BEST_PATH_STEPS <= 0) {
    return 0;
  }

  const ratio = BEST_PATH_STEPS / Math.max(stepCount, BEST_PATH_STEPS);
  return Math.max(0, Math.min(10000, Math.round(ratio * 10000)));
}

export function computeMissionScore(input: {
  collisionCount: number;
  interventionMillis: number;
  pathEfficiencyBps: number;
  payoutLamports: number;
  success: boolean;
}): MissionScoreSummary {
  const durationSeconds = input.interventionMillis / 1000;
  const collisionPenalty = input.collisionCount * 9;
  const durationPenalty = Math.max(0, Math.round(durationSeconds - 12));
  const efficiencyBonus = Math.round((input.pathEfficiencyBps - 7000) / 300);
  const successBase = input.success ? 82 : 28;

  const score = Math.max(
    0,
    Math.min(99, successBase + efficiencyBonus - collisionPenalty - durationPenalty),
  );

  let payoutBps = 6500;
  let payoutTier = "Tier C";
  let reputationDelta = "+1 calibration";

  if (score >= 92) {
    payoutBps = 10000;
    payoutTier = "Tier S";
    reputationDelta = "+3 private rep";
  } else if (score >= 84) {
    payoutBps = 9400;
    payoutTier = "Tier A";
    reputationDelta = "+2 private rep";
  } else if (score >= 74) {
    payoutBps = 8600;
    payoutTier = "Tier B";
    reputationDelta = "+1 private rep";
  }

  return {
    payoutLamports: Math.round((input.payoutLamports * payoutBps) / 10000),
    payoutTier,
    reputationDelta,
    score,
    scoreBand: `${score} / 100`,
  };
}

export async function hashMissionTrace(input: {
  missionId: string;
  trace: TracePoint[];
  collisionCount: number;
  pathEfficiencyBps: number;
  interventionMillis: number;
}) {
  const payload = JSON.stringify(input);
  const bytes = new TextEncoder().encode(payload);

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (const byte of bytes) {
    hash = (hash * 31 + byte) >>> 0;
  }

  return hash.toString(16).padStart(64, "0");
}

export function buildTraceUri(missionId: string) {
  return `ar://shadowpilot/session/${missionId.toLowerCase()}-${Date.now()}.trace`;
}

export function buildReceiptMint(missionId: string) {
  return `CNFT-${missionId}-${Date.now().toString().slice(-4)}`;
}
