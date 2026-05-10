import { type LiveMission, type TaskRequestAccount } from "./shadowpilot-program";

export type TaskLaneScope = "public" | "buyer" | "pilot" | "shared";
export type TaskLaneId = "remote_operation" | "humanoid_capture";

export type TaskLaneArtifact = {
  detail: string;
  label: string;
  scope: TaskLaneScope;
};

export type TaskLaneReviewStep = {
  detail: string;
  label: string;
  scope: TaskLaneScope;
};

export type TaskLaneMetric = {
  detail: string;
  label: string;
  value: string;
};

export type TaskLaneStatus = {
  detail: string;
  label: string;
  tone: "active" | "good" | "neutral" | "warning";
};

export type TaskLaneDefinition = {
  accessLinkActionLabel: string;
  accessLinkDescription: string;
  accessLinkLabel: string;
  accessLinkPlaceholder: string;
  artifacts: TaskLaneArtifact[];
  description: string;
  id: TaskLaneId;
  label: string;
  pilotPrivateLocked: string;
  pilotPrivateUnlocked: string;
  publicSummary: string;
  reviewSteps: TaskLaneReviewStep[];
  reviewSummary: string;
  shortLabel: string;
  template: {
    bundleHashHex: string;
    bundleUri: string;
    environment: string;
    payoutLamports: bigint;
    title: string;
  };
};

export const TASK_LANE_ORDER: TaskLaneId[] = ["remote_operation", "humanoid_capture"];

const TASK_LANES: Record<TaskLaneId, TaskLaneDefinition> = {
  humanoid_capture: {
    accessLinkActionLabel: "Open upload destination",
    accessLinkDescription:
      "Buyer provides the shared folder or Drive link where pilots should place raw clips and notes.",
    accessLinkLabel: "Upload destination link",
    accessLinkPlaceholder: "https://drive.google.com/drive/folders/...",
    artifacts: [
      {
        detail:
          "Pose prompts, camera layout, and labeling requirements stay private to the buyer until a pilot claim opens the handoff.",
        label: "Capture brief",
        scope: "buyer",
      },
      {
        detail:
          "The operator stages multi-angle clips, motion notes, and a manifest offchain. Solana only sees the compact pointer and metrics.",
        label: "Video and motion bundle",
        scope: "pilot",
      },
      {
        detail:
          "Accepted sessions anchor provenance and usage rights so the buyer can train or replay against a verifiable receipt.",
        label: "Dataset rights receipt",
        scope: "public",
      },
    ],
    description:
      "A verified operator records a humanoid demonstration package with clip coverage, motion notes, and a compact manifest for buyer review.",
    id: "humanoid_capture",
    label: "Humanoid data collection",
    pilotPrivateLocked:
      "The capture brief and raw clips stay locked until the claiming pilot wallet connects and stages the package.",
    pilotPrivateUnlocked:
      "This pilot wallet can see the capture brief, stage private video bundles, and sign the final dataset manifest.",
    publicSummary:
      "Task title, payout, buyer address, claim state, and final receipt stay public while raw capture assets remain private.",
    reviewSteps: [
      {
        detail:
          "Buyer checks clip completeness, camera coverage, and whether the requested motion set was captured cleanly.",
        label: "Coverage review",
        scope: "buyer",
      },
      {
        detail:
          "Compact scoring uses coverage, retakes, and buyer acceptance before the payout tier is sealed for release.",
        label: "Private quality score",
        scope: "shared",
      },
      {
        detail:
          "Escrow releases to the pilot and the receipt anchors dataset rights once the package is accepted.",
        label: "Payout and receipt",
        scope: "public",
      },
    ],
    reviewSummary:
      "Humanoid capture is rated on clip coverage, retake count, and final buyer acceptance before the rights receipt is minted.",
    shortLabel: "Humanoid capture",
    template: {
      bundleHashHex: "ab0b8e4bca09f064c7e8b8bc0d8c4f6e9e2ca33125e4547c5040b711923a7c51",
      bundleUri: "ar://shadowpilot/task/humanoid/SP-H01.bundle",
      environment: "Capture stage / shelf transfer",
      payoutLamports: 2_200_000_000n,
      title: "Humanoid shelf transfer capture",
    },
  },
  remote_operation: {
    accessLinkActionLabel: "Open robot control link",
    accessLinkDescription:
      "Buyer provides the robot control surface or remote desktop URL the pilot should use during takeover.",
    accessLinkLabel: "Robot control link",
    accessLinkPlaceholder: "https://robot-control.example.com/session/...",
    artifacts: [
      {
        detail:
          "Environment notes, control bindings, and fallback context stay private until a pilot claims the live recovery.",
        label: "Fallback handoff packet",
        scope: "buyer",
      },
      {
        detail:
          "The pilot submits recorded task footage, compact route metrics, and a signed recovery package after completing the handoff.",
        label: "Recorded recovery package",
        scope: "shared",
      },
      {
        detail:
          "Accepted recoveries mint a receipt so the replay can be reused as a verified training and audit artifact.",
        label: "Replay rights receipt",
        scope: "public",
      },
    ],
    description:
      "A verified pilot takes over a stuck robot, completes the recovery, and submits a compact replay package for settlement.",
    id: "remote_operation",
    label: "Remote robot operation",
    pilotPrivateLocked:
      "The handoff packet, live controls, and raw route stay locked until the claiming pilot wallet connects.",
    pilotPrivateUnlocked:
      "This pilot wallet can unlock the handoff packet, drive the robot, and sign the recovery package onchain.",
    publicSummary:
      "Task title, payout, buyer address, claim state, and final receipt stay public while the live route and handoff packet stay private.",
    reviewSteps: [
      {
        detail:
          "Buyer watches the recorded robot session, checks whether the task finished safely, and reviews any incidents privately before accepting.",
        label: "Footage and safety review",
        scope: "buyer",
      },
      {
        detail:
          "Buyer assigns the final score after reviewing the footage, while the compact telemetry supports payout and audit context.",
        label: "Buyer-assigned score",
        scope: "shared",
      },
      {
        detail:
          "Escrow releases to the pilot and the receipt anchors replay and training rights after acceptance.",
        label: "Payout and receipt",
        scope: "public",
      },
    ],
    reviewSummary:
      "Remote ops are rated from recorded footage plus compact telemetry. The buyer score, payout, and cNFT receipt land onchain after acceptance.",
    shortLabel: "Remote op",
    template: {
      bundleHashHex: "4f0b8e4bca09f064c7e8b8bc0d8c4f6e9e2ca33125e4547c5040b711923a7c18",
      bundleUri: "https://example.com/shadowpilot-whiteboard-arm-line-draw",
      environment: "Whiteboard station / robot arm line",
      payoutLamports: 250_000_000n,
      title: "Draw a line on a whiteboard with a robotic arm",
    },
  },
};

function searchableTaskText(task: Pick<TaskRequestAccount, "bundleUri" | "environment" | "title">) {
  return `${task.title} ${task.environment} ${task.bundleUri}`.toLowerCase();
}

function formatDuration(milliseconds: bigint) {
  return `${(Number(milliseconds) / 1000).toFixed(1)}s`;
}

function formatPercent(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function shortenHash(hash: string | null | undefined) {
  if (!hash) {
    return "Pending";
  }

  return `${hash.slice(0, 24)}...`;
}

export function inferTaskLaneId(task: Pick<TaskRequestAccount, "bundleUri" | "environment" | "title">) {
  const haystack = searchableTaskText(task);

  if (
    /(humanoid|capture|motion|mocap|pose|dataset|retarget|clip|skeleton|demonstration)/.test(
      haystack,
    )
  ) {
    return "humanoid_capture";
  }

  return "remote_operation";
}

export function getTaskLaneDefinition(laneId: TaskLaneId) {
  return TASK_LANES[laneId];
}

export function getTaskLaneFromMission(mission: LiveMission) {
  return getTaskLaneDefinition(inferTaskLaneId(mission.task));
}

export function countMissionsByLane(missions: LiveMission[]) {
  return missions.reduce<Record<TaskLaneId, number>>(
    (counts, mission) => {
      counts[inferTaskLaneId(mission.task)] += 1;
      return counts;
    },
    {
      humanoid_capture: 0,
      remote_operation: 0,
    },
  );
}

export function getTaskPackageStatus(mission: LiveMission): TaskLaneStatus {
  const lane = getTaskLaneFromMission(mission);

  if (lane.id === "humanoid_capture") {
    switch (mission.task.status) {
      case "open":
        return {
          detail: "Waiting for a pilot to claim the capture brief and stage the dataset package.",
          label: "Awaiting capture pilot",
          tone: "warning",
        };
      case "claimed":
        return {
          detail: "Pilot is recording clips and staging the private capture bundle.",
          label: "Capture in progress",
          tone: "active",
        };
      case "submitted":
        return {
          detail: "Capture bundle is submitted. Buyer review and compact scoring are next.",
          label: "Awaiting buyer review",
          tone: "active",
        };
      case "scored":
        return {
          detail: "Private score is ready and the accepted payout tier is ready to settle.",
          label: "Score sealed",
          tone: "good",
        };
      case "paid":
      case "closed":
        return {
          detail: "Dataset package is accepted and the rights receipt is anchored onchain.",
          label: "Receipt anchored",
          tone: "good",
        };
    }
  }

  switch (mission.task.status) {
    case "open":
      return {
        detail: "Waiting for a pilot to claim the live recovery and unlock the handoff packet.",
        label: "Awaiting pilot claim",
        tone: "warning",
      };
    case "claimed":
      return {
        detail: "Pilot is driving recovery and staging the replay package for submission.",
        label: "Recovery in progress",
        tone: "active",
      };
    case "submitted":
      return {
        detail: "Recovery package is submitted. Buyer review and compact scoring are next.",
        label: "Awaiting buyer review",
        tone: "active",
      };
    case "scored":
      return {
        detail: "Private score is ready and the accepted payout tier is ready to settle.",
        label: "Score sealed",
        tone: "good",
      };
    case "paid":
    case "closed":
      return {
        detail: "Recovery package is accepted and the replay rights receipt is anchored onchain.",
        label: "Receipt anchored",
        tone: "good",
      };
  }
}

export function getTaskPackageMetrics(mission: LiveMission): TaskLaneMetric[] {
  const lane = getTaskLaneFromMission(mission);
  const claim = mission.claim;

  if (lane.id === "humanoid_capture") {
    return [
      {
        detail: "Signed total duration for the accepted capture package.",
        label: "Capture time",
        value: claim ? formatDuration(claim.interventionMillis) : "Pending",
      },
      {
        detail: "Compact completeness score across requested views and motion coverage.",
        label: "Coverage",
        value: claim ? formatPercent(claim.pathEfficiencyBps) : "Pending",
      },
      {
        detail: "Retakes or unusable takes that the buyer will factor into quality review.",
        label: "Retakes",
        value: claim ? `${claim.collisionCount}` : "Pending",
      },
      {
        detail: "Compact onchain reference to the private dataset package.",
        label: "Package hash",
        value: shortenHash(claim?.traceHash),
      },
    ];
  }

  return [
    {
      detail: "Signed total time from takeover start to recovery completion.",
      label: "Recovery time",
      value: claim ? formatDuration(claim.interventionMillis) : "Pending",
    },
    {
      detail: "Compact route efficiency score that feeds the buyer's private review.",
      label: "Route efficiency",
      value: claim ? formatPercent(claim.pathEfficiencyBps) : "Pending",
    },
    {
      detail: "Blocked moves or collisions recorded before the replay package is accepted.",
      label: "Safety incidents",
      value: claim ? `${claim.collisionCount}` : "Pending",
    },
    {
      detail: "Compact onchain reference to the private replay package.",
      label: "Package hash",
      value: shortenHash(claim?.traceHash),
    },
  ];
}
