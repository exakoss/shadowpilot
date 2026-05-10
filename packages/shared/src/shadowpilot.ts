export type TaskStatus = "open" | "claimed" | "submitted" | "scored" | "paid" | "closed";
export type Priority = "critical" | "high" | "medium";
export type TimelineStatus = "complete" | "active" | "upcoming";

export type TaskRequest = {
  id: string;
  title: string;
  summary: string;
  environment: string;
  site: string;
  priority: Priority;
  payoutSol: number;
  status: TaskStatus;
  createdAt: string;
  buyerWallet: string;
  encryptedBundleUri: string;
  taskBundleHash: string;
};

export type MetricCard = {
  label: string;
  value: string;
  detail: string;
};

export type MissionStep = {
  title: string;
  detail: string;
  status: TimelineStatus;
};

export type BuyerReceipt = {
  taskId: string;
  pilotWallet: string;
  scoreBand: string;
  payoutSol: number;
  rights: string;
  traceHash: string;
  receiptMint: string;
};

export type PilotScorecard = {
  verification: string;
  reputationBand: string;
  successfulInterventions: number;
  averageClaimTimeSeconds: number;
  encryptedReputationRef: string;
};

export const platformHighlights: MetricCard[] = [
  {
    label: "Fallback claim time",
    value: "< 45s",
    detail: "Verified pilots see funded missions immediately instead of waiting on manual routing.",
  },
  {
    label: "Private scoring layer",
    value: "6 inputs",
    detail: "Only compact metrics and encrypted commitments enter the confidential decision path.",
  },
  {
    label: "Training-rights receipt",
    value: "1 cNFT",
    detail: "Accepted intervention traces become provable assets rather than disappearing into ops logs.",
  },
];

export const missionTimeline: MissionStep[] = [
  {
    title: "Autonomy flags the blocker",
    detail: "A warehouse rover deadlocks after a pallet partially breaches the planned aisle boundary.",
    status: "complete",
  },
  {
    title: "Pilot claims the fallback",
    detail: "A verified operator accepts the mission after escrow and human proof checks succeed.",
    status: "active",
  },
  {
    title: "Private score lands",
    detail: "Compact task metrics feed the confidential score and reputation update before payout.",
    status: "upcoming",
  },
];

export const demoTasks: TaskRequest[] = [
  {
    id: "SP-014",
    title: "Rover aisle recovery",
    summary: "Drive the rover around an ambiguous pallet encroachment and resume the delivery lane.",
    environment: "Warehouse grid / aisle 14",
    site: "Brooklyn micro-fulfillment pod",
    priority: "critical",
    payoutSol: 0.25,
    status: "claimed",
    createdAt: "2026-04-24T14:20:00Z",
    buyerWallet: "5iLx8b4k9VnP2rC3c8D8V7hQ9zaPi9hVn1aW3Q2k9mzN",
    encryptedBundleUri: "ar://shadowpilot/task/SP-014.bundle",
    taskBundleHash: "4f0b8e4bca09f064c7e8b8bc0d8c4f6e9e2ca33125e4547c5040b711923a7c18",
  },
  {
    id: "SP-011",
    title: "Dock alignment fallback",
    summary: "Recover a failed dock alignment after a reflective floor patch breaks localization confidence.",
    environment: "Inbound dock 03",
    site: "Queens sorting corridor",
    priority: "high",
    payoutSol: 1.1,
    status: "open",
    createdAt: "2026-04-24T13:54:00Z",
    buyerWallet: "3BQ7wWL47G3YGoaQnSbZMYsZMuN7n7zr7dUDNHw7UZ2p",
    encryptedBundleUri: "ar://shadowpilot/task/SP-011.bundle",
    taskBundleHash: "871302226d5135375346df4f5fbb10c7bb0fd4089ae4d2fb8e5fbc74efab1f09",
  },
];

export const sampleReceipt: BuyerReceipt = {
  taskId: "SP-014",
  pilotWallet: "8uAt9YtE6eHc4Aq3u7w3a7iG6wxxwFv3nS1mX7Q9z4kr",
  scoreBand: "92 / 100",
  payoutSol: 0.25,
  rights: "Buyer receives training and replay rights for the accepted trace.",
  traceHash: "6b4f77d7a1355fa75a60f78dc54c381fa0c62cc0e6f938c3d30d438dd2a95f8f",
  receiptMint: "CNFT-REC-014",
};

export const pilotScorecard: PilotScorecard = {
  verification: "World-verified human",
  reputationBand: "Gold / private commitment synced",
  successfulInterventions: 31,
  averageClaimTimeSeconds: 27,
  encryptedReputationRef: "0x8f0d...9a43",
};

export const protocolRails = [
  "Phantom and Solana wallet routing",
  "World ID uniqueness gate",
  "Arcium private score + reputation update",
  "Anchor escrow, payout, and receipt state",
  "cNFT provenance for accepted traces",
];

export function compactAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
