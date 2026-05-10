import {
  AccountRole,
  address,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
} from "@solana/kit";

export const SHADOWPILOT_PROGRAM_ID = address("4pPWvEnHLd2MRCW67nS7uZViBiyxo3M51S65NoFc7fiB");
export const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");

const ACCOUNT_DISCRIMINATORS = {
  pilotProfile: Uint8Array.from([63, 74, 121, 245, 58, 223, 187, 218]),
  sessionReceipt: Uint8Array.from([128, 186, 81, 26, 194, 186, 2, 191]),
  taskAccessPolicy: Uint8Array.from([241, 79, 41, 56, 207, 188, 74, 224]),
  taskClaim: Uint8Array.from([115, 77, 242, 98, 7, 81, 209, 137]),
  taskRequest: Uint8Array.from([82, 205, 229, 255, 36, 209, 160, 79]),
  worldVerification: Uint8Array.from([178, 108, 108, 206, 107, 74, 208, 219]),
} as const;

const INSTRUCTION_DISCRIMINATORS = {
  claimTask: Uint8Array.from([49, 222, 219, 238, 155, 68, 221, 136]),
  configureTaskAccess: Uint8Array.from([112, 75, 137, 145, 65, 128, 4, 182]),
  createTask: Uint8Array.from([194, 80, 6, 180, 232, 127, 48, 171]),
  finalizeSession: Uint8Array.from([34, 148, 144, 47, 37, 130, 206, 161]),
  fundTask: Uint8Array.from([188, 87, 71, 120, 11, 238, 84, 232]),
  linkWorldVerification: Uint8Array.from([101, 245, 63, 120, 131, 94, 110, 2]),
  mintReceipt: Uint8Array.from([235, 43, 192, 89, 68, 47, 73, 50]),
  releasePayout: Uint8Array.from([181, 87, 198, 92, 64, 3, 24, 155]),
  submitSession: Uint8Array.from([244, 89, 207, 96, 127, 33, 231, 244]),
} as const;

const addressEncoder = getAddressEncoder();
const addressDecoder = getAddressDecoder();
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type ShadowPilotTaskStatus = "open" | "claimed" | "submitted" | "scored" | "paid" | "closed";
export type ShadowPilotClaimStatus = "claimed" | "submitted" | "finalized" | "paid";
export type ShadowPilotUsageRights = "replay_only" | "training_and_replay" | "exclusive_training";

export type TaskRequestAccount = {
  address: Address;
  assignedPilot: Address | null;
  blockhashPointer: string;
  bundleHash: string;
  bundleUri: string;
  buyer: Address;
  createdAt: number;
  fundedLamports: bigint;
  payoutLamports: bigint;
  status: ShadowPilotTaskStatus;
  taskSeed: bigint;
  title: string;
  environment: string;
};

export type PilotProfileAccount = {
  address: Address;
  encryptedReputationCommitment: string;
  interventionsCompleted: number;
  lastActiveAt: number;
  skillBand: number;
  wallet: Address;
  worldVerified: boolean;
};

export type TaskAccessPolicyAccount = {
  address: Address;
  buyer: Address;
  taskRequest: Address;
  updatedAt: number;
  worldIdRequired: boolean;
};

export type TaskClaimAccount = {
  address: Address;
  collisionCount: number;
  interventionMillis: bigint;
  pathEfficiencyBps: number;
  pilot: Address;
  payoutLamports: bigint;
  scoreBps: number;
  status: ShadowPilotClaimStatus;
  submittedAt: number;
  success: boolean;
  taskRequest: Address;
  traceHash: string;
  traceUri: string;
};

export type SessionReceiptAccount = {
  acceptedScoreBand: number;
  address: Address;
  buyer: Address;
  mintedAt: number;
  payoutTier: number;
  pilot: Address;
  reviewCommitment: string;
  receiptMint: Address | null;
  taskClaim: Address;
  taskRequest: Address;
  traceHash: string;
  usageRights: ShadowPilotUsageRights;
};

export type WorldVerificationAccount = {
  address: Address;
  nullifierHash: string;
  verifiedAt: number;
  wallet: Address;
};

export type ShadowPilotProgramState = {
  deployed: boolean;
  pilotProfiles: PilotProfileAccount[];
  sessionReceipts: SessionReceiptAccount[];
  taskAccessPolicies: TaskAccessPolicyAccount[];
  taskClaims: TaskClaimAccount[];
  taskRequests: TaskRequestAccount[];
  worldVerifications: WorldVerificationAccount[];
};

export type MissionSettlement = {
  acceptedScoreBand: number;
  payoutLamports: bigint;
  payoutTier: number;
  receiptMint: Address;
  reputationDeltaLabel: string;
  score: number;
  scoreBand: string;
  scoreBps: number;
  usageRights: ShadowPilotUsageRights;
};

export type LiveMission = {
  accessPolicy: TaskAccessPolicyAccount | null;
  claim: TaskClaimAccount | null;
  pilotProfile: PilotProfileAccount | null;
  pilotWorldVerification: WorldVerificationAccount | null;
  receipt: SessionReceiptAccount | null;
  task: TaskRequestAccount;
};

export type EncodedProgramAccount = {
  account: {
    data: readonly [string, "base64"];
    executable: boolean;
    lamports: bigint;
    owner: Address;
    space: bigint;
  };
  pubkey: Address;
};

const TASK_STATUS_VALUES: ShadowPilotTaskStatus[] = [
  "open",
  "claimed",
  "submitted",
  "scored",
  "paid",
  "closed",
];

const CLAIM_STATUS_VALUES: ShadowPilotClaimStatus[] = [
  "claimed",
  "submitted",
  "finalized",
  "paid",
];

const USAGE_RIGHTS_VALUES: ShadowPilotUsageRights[] = [
  "replay_only",
  "training_and_replay",
  "exclusive_training",
];

class BorshReader {
  private view: DataView;
  private offset = 0;
  private bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  skip(size: number) {
    this.offset += size;
  }

  readBool() {
    return this.readU8() === 1;
  }

  readBytes(length: number) {
    const chunk = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return chunk;
  }

  readI64() {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readPubkey() {
    return addressDecoder.decode(this.readBytes(32));
  }

  readString() {
    const length = this.readU32();
    return textDecoder.decode(this.readBytes(length));
  }

  readU16() {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readU32() {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readU64() {
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readU8() {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function bytesFromBase64(value: string) {
  if (typeof atob === "function") {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(value, "base64"));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function encodeBool(value: boolean) {
  return Uint8Array.of(value ? 1 : 0);
}

function encodeBytes(value: Uint8Array) {
  return value;
}

function encodeString(value: string) {
  const bytes = textEncoder.encode(value);
  return concatBytes(encodeU32(bytes.length), bytes);
}

function encodeU16(value: number) {
  const output = new Uint8Array(2);
  const view = new DataView(output.buffer);
  view.setUint16(0, value, true);
  return output;
}

function encodeU32(value: number) {
  const output = new Uint8Array(4);
  const view = new DataView(output.buffer);
  view.setUint32(0, value, true);
  return output;
}

function encodeU64(value: bigint | number) {
  const output = new Uint8Array(8);
  const view = new DataView(output.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return output;
}

function encodeU8(value: number) {
  return Uint8Array.of(value);
}

function concatBytes(...segments: Uint8Array[]) {
  const size = segments.reduce((total, segment) => total + segment.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;

  for (const segment of segments) {
    output.set(segment, offset);
    offset += segment.length;
  }

  return output;
}

function parseTaskStatus(value: number): ShadowPilotTaskStatus {
  return TASK_STATUS_VALUES[value] ?? "open";
}

function parseClaimStatus(value: number): ShadowPilotClaimStatus {
  return CLAIM_STATUS_VALUES[value] ?? "claimed";
}

function parseUsageRights(value: number): ShadowPilotUsageRights {
  return USAGE_RIGHTS_VALUES[value] ?? "training_and_replay";
}

export function lamportsToSolNumber(value: bigint) {
  return Number(value) / 1_000_000_000;
}

export function compactTaskStatus(status: ShadowPilotTaskStatus) {
  switch (status) {
    case "open":
      return "Funded and open";
    case "claimed":
      return "Pilot claimed";
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

export function taskStatusTone(status: ShadowPilotTaskStatus) {
  switch (status) {
    case "open":
      return "active";
    case "claimed":
      return "warning";
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

export function getTaskRequestDiscriminatorFilter() {
  return bytesToHex(ACCOUNT_DISCRIMINATORS.taskRequest);
}

export function buildTracePointer(taskAddress: string, traceHashHex: string) {
  return `ar://shadowpilot/trace/${taskAddress.slice(0, 8)}-${traceHashHex.slice(0, 16)}`;
}

export async function deriveTaskRequestAddress(buyer: string, taskSeed: bigint | number) {
  const [taskRequest] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["task", addressEncoder.encode(address(buyer)), encodeU64(taskSeed)],
  });

  return taskRequest;
}

export async function derivePilotProfileAddress(pilot: string) {
  const [pilotProfile] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["pilot", addressEncoder.encode(address(pilot))],
  });

  return pilotProfile;
}

export async function deriveTaskAccessPolicyAddress(taskRequest: string) {
  const [taskAccessPolicy] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["policy", addressEncoder.encode(address(taskRequest))],
  });

  return taskAccessPolicy;
}

export async function deriveTaskClaimAddress(taskRequest: string, pilot: string) {
  const [taskClaim] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["claim", addressEncoder.encode(address(taskRequest)), addressEncoder.encode(address(pilot))],
  });

  return taskClaim;
}

export async function deriveSessionReceiptAddress(taskClaim: string) {
  const [sessionReceipt] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["receipt", addressEncoder.encode(address(taskClaim))],
  });

  return sessionReceipt;
}

export async function deriveReceiptMintReference(taskClaim: string) {
  const [receiptMint] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["receipt-mint", addressEncoder.encode(address(taskClaim))],
  });

  return receiptMint;
}

export async function deriveWorldVerificationAddress(wallet: string) {
  const [worldVerification] = await getProgramDerivedAddress({
    programAddress: SHADOWPILOT_PROGRAM_ID,
    seeds: ["world", addressEncoder.encode(address(wallet))],
  });

  return worldVerification;
}

function decodeTaskRequest(addressValue: Address, bytes: Uint8Array): TaskRequestAccount {
  const reader = new BorshReader(bytes);
  reader.skip(8);

  const buyer = reader.readPubkey();
  const assignedPilot = reader.readPubkey();
  const taskSeed = reader.readU64();
  const payoutLamports = reader.readU64();
  const fundedLamports = reader.readU64();
  const bundleHash = bytesToHex(reader.readBytes(32));
  const status = parseTaskStatus(reader.readU8());
  reader.readU8();
  const createdAt = Number(reader.readI64());
  const title = reader.readString();
  const environment = reader.readString();
  const bundleUri = reader.readString();

  return {
    address: addressValue,
    assignedPilot:
      assignedPilot === address("11111111111111111111111111111111") ? null : assignedPilot,
    blockhashPointer: bundleHash.slice(0, 16),
    bundleHash,
    bundleUri,
    buyer,
    createdAt,
    environment,
    fundedLamports,
    payoutLamports,
    status,
    taskSeed,
    title,
  };
}

function decodePilotProfile(addressValue: Address, bytes: Uint8Array): PilotProfileAccount {
  const reader = new BorshReader(bytes);
  reader.skip(8);
  const wallet = reader.readPubkey();
  const worldVerified = reader.readBool();
  const skillBand = reader.readU8();
  const interventionsCompleted = reader.readU32();
  const encryptedReputationCommitment = bytesToHex(reader.readBytes(32));
  const lastActiveAt = Number(reader.readI64());

  return {
    address: addressValue,
    encryptedReputationCommitment,
    interventionsCompleted,
    lastActiveAt,
    skillBand,
    wallet,
    worldVerified,
  };
}

function decodeTaskAccessPolicy(addressValue: Address, bytes: Uint8Array): TaskAccessPolicyAccount {
  const reader = new BorshReader(bytes);
  reader.skip(8);

  const taskRequest = reader.readPubkey();
  const buyer = reader.readPubkey();
  const worldIdRequired = reader.readBool();
  const updatedAt = Number(reader.readI64());

  return {
    address: addressValue,
    buyer,
    taskRequest,
    updatedAt,
    worldIdRequired,
  };
}

function decodeTaskClaim(addressValue: Address, bytes: Uint8Array): TaskClaimAccount {
  const reader = new BorshReader(bytes);
  reader.skip(8);

  const taskRequest = reader.readPubkey();
  const pilot = reader.readPubkey();
  const traceHash = bytesToHex(reader.readBytes(32));
  const traceUri = reader.readString();
  const success = reader.readBool();
  const collisionCount = reader.readU16();
  const interventionMillis = reader.readU64();
  const pathEfficiencyBps = reader.readU16();
  const scoreBps = reader.readU16();
  const payoutLamports = reader.readU64();
  const submittedAt = Number(reader.readI64());
  const status = parseClaimStatus(reader.readU8());

  return {
    address: addressValue,
    collisionCount,
    interventionMillis,
    pathEfficiencyBps,
    pilot,
    payoutLamports,
    scoreBps,
    status,
    submittedAt,
    success,
    taskRequest,
    traceHash,
    traceUri,
  };
}

function decodeSessionReceipt(addressValue: Address, bytes: Uint8Array): SessionReceiptAccount {
  const reader = new BorshReader(bytes);
  reader.skip(8);

  const taskRequest = reader.readPubkey();
  const taskClaim = reader.readPubkey();
  const buyer = reader.readPubkey();
  const pilot = reader.readPubkey();
  const traceHash = bytesToHex(reader.readBytes(32));
  const acceptedScoreBand = reader.readU8();
  const payoutTier = reader.readU8();
  const reviewCommitment = bytesToHex(reader.readBytes(32));
  const receiptMint = reader.readPubkey();
  const usageRights = parseUsageRights(reader.readU8());
  const mintedAt = Number(reader.readI64());

  return {
    acceptedScoreBand,
    address: addressValue,
    buyer,
    mintedAt,
    payoutTier,
    pilot,
    reviewCommitment,
    receiptMint:
      receiptMint === address("11111111111111111111111111111111") ? null : receiptMint,
    taskClaim,
    taskRequest,
    traceHash,
    usageRights,
  };
}

function decodeWorldVerification(addressValue: Address, bytes: Uint8Array): WorldVerificationAccount {
  const reader = new BorshReader(bytes);
  reader.skip(8);

  const wallet = reader.readPubkey();
  const nullifierHash = bytesToHex(reader.readBytes(32));
  const verifiedAt = Number(reader.readI64());

  return {
    address: addressValue,
    nullifierHash,
    verifiedAt,
    wallet,
  };
}

export function decodeShadowPilotProgramState(
  deployed: boolean,
  programAccounts: readonly EncodedProgramAccount[],
): ShadowPilotProgramState {
  const taskRequests: TaskRequestAccount[] = [];
  const taskClaims: TaskClaimAccount[] = [];
  const sessionReceipts: SessionReceiptAccount[] = [];
  const pilotProfiles: PilotProfileAccount[] = [];
  const taskAccessPolicies: TaskAccessPolicyAccount[] = [];
  const worldVerifications: WorldVerificationAccount[] = [];

  for (const programAccount of programAccounts) {
    const bytes = bytesFromBase64(programAccount.account.data[0]);
    const discriminator = bytes.slice(0, 8);

    if (bytesEqual(discriminator, ACCOUNT_DISCRIMINATORS.taskRequest)) {
      taskRequests.push(decodeTaskRequest(programAccount.pubkey, bytes));
    } else if (bytesEqual(discriminator, ACCOUNT_DISCRIMINATORS.taskClaim)) {
      taskClaims.push(decodeTaskClaim(programAccount.pubkey, bytes));
    } else if (bytesEqual(discriminator, ACCOUNT_DISCRIMINATORS.sessionReceipt)) {
      sessionReceipts.push(decodeSessionReceipt(programAccount.pubkey, bytes));
    } else if (bytesEqual(discriminator, ACCOUNT_DISCRIMINATORS.pilotProfile)) {
      pilotProfiles.push(decodePilotProfile(programAccount.pubkey, bytes));
    } else if (bytesEqual(discriminator, ACCOUNT_DISCRIMINATORS.taskAccessPolicy)) {
      taskAccessPolicies.push(decodeTaskAccessPolicy(programAccount.pubkey, bytes));
    } else if (bytesEqual(discriminator, ACCOUNT_DISCRIMINATORS.worldVerification)) {
      worldVerifications.push(decodeWorldVerification(programAccount.pubkey, bytes));
    }
  }

  taskRequests.sort((left, right) => right.createdAt - left.createdAt);

  return {
    deployed,
    pilotProfiles,
    sessionReceipts,
    taskAccessPolicies,
    taskClaims,
    taskRequests,
    worldVerifications,
  };
}

export function buildLiveMissions(programState: ShadowPilotProgramState): LiveMission[] {
  return programState.taskRequests.map((task) => {
    const claim =
      programState.taskClaims.find((candidate) => candidate.taskRequest === task.address) ?? null;
    const receipt =
      claim
        ? programState.sessionReceipts.find((candidate) => candidate.taskClaim === claim.address) ?? null
        : null;
    const pilotProfile =
      claim
        ? programState.pilotProfiles.find((candidate) => candidate.wallet === claim.pilot) ?? null
        : null;
    const pilotWorldVerification =
      claim
        ? programState.worldVerifications.find((candidate) => candidate.wallet === claim.pilot) ?? null
        : null;
    const accessPolicy =
      programState.taskAccessPolicies.find((candidate) => candidate.taskRequest === task.address) ?? null;

    return {
      accessPolicy,
      claim,
      pilotProfile,
      pilotWorldVerification,
      receipt,
      task,
    };
  });
}

export async function hashTracePayload(payload: unknown) {
  const bytes = textEncoder.encode(JSON.stringify(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

export async function buildReputationCommitment(walletAddress: string) {
  return hashTracePayload({
    label: "shadowpilot-reputation",
    walletAddress,
  });
}

export function computeMissionSettlement(
  task: TaskRequestAccount,
  claim: Pick<TaskClaimAccount, "collisionCount" | "interventionMillis" | "pathEfficiencyBps" | "success" | "address">,
): MissionSettlement {
  const durationSeconds = Number(claim.interventionMillis) / 1000;
  const collisionPenalty = claim.collisionCount * 9;
  const durationPenalty = Math.max(0, Math.round(durationSeconds - 12));
  const efficiencyBonus = Math.round((claim.pathEfficiencyBps - 7000) / 300);
  const successBase = claim.success ? 82 : 28;
  const score = Math.max(
    0,
    Math.min(99, successBase + efficiencyBonus - collisionPenalty - durationPenalty),
  );

  let payoutBps = 6500;
  let payoutTier = 1;
  let reputationDeltaLabel = "+1 calibration";

  if (score >= 92) {
    payoutBps = 10000;
    payoutTier = 3;
    reputationDeltaLabel = "+3 private rep";
  } else if (score >= 84) {
    payoutBps = 9400;
    payoutTier = 2;
    reputationDeltaLabel = "+2 private rep";
  } else if (score >= 74) {
    payoutBps = 8600;
    payoutTier = 1;
    reputationDeltaLabel = "+1 private rep";
  }

  const payoutLamports = (task.payoutLamports * BigInt(payoutBps)) / 10000n;

  return {
    acceptedScoreBand: score,
    payoutLamports,
    payoutTier,
    receiptMint: address("11111111111111111111111111111111"),
    reputationDeltaLabel,
    score,
    scoreBand: `${score} / 100`,
    scoreBps: score * 100,
    usageRights: "training_and_replay",
  };
}

export function buildBuyerAuthoredSettlement(
  task: TaskRequestAccount,
  input: {
    score: number;
    usageRights: ShadowPilotUsageRights;
  },
): MissionSettlement {
  const score = Math.max(60, Math.min(99, Math.round(input.score)));
  let payoutBps = 7600;
  let payoutTier = 1;
  let reputationDeltaLabel = "+1 private rep";

  if (score >= 96) {
    payoutBps = 10000;
    payoutTier = 3;
    reputationDeltaLabel = "+3 private rep";
  } else if (score >= 90) {
    payoutBps = 9400;
    payoutTier = 3;
    reputationDeltaLabel = "+3 private rep";
  } else if (score >= 82) {
    payoutBps = 8600;
    payoutTier = 2;
    reputationDeltaLabel = "+2 private rep";
  }

  return {
    acceptedScoreBand: score,
    payoutLamports: (task.payoutLamports * BigInt(payoutBps)) / 10000n,
    payoutTier,
    receiptMint: address("11111111111111111111111111111111"),
    reputationDeltaLabel,
    score,
    scoreBand: `${score} / 100`,
    scoreBps: score * 100,
    usageRights: input.usageRights,
  };
}

export function encodeShadowPilotUsageRights(value: ShadowPilotUsageRights) {
  switch (value) {
    case "replay_only":
      return 0;
    case "training_and_replay":
      return 1;
    case "exclusive_training":
      return 2;
  }
}

export function buildCreateAndFundTaskInstructions(input: {
  buyer: string;
  bundleHashHex: string;
  bundleUri: string;
  environment: string;
  payoutLamports: bigint;
  taskSeed: bigint;
  title: string;
  worldIdRequired?: boolean;
}): Promise<{ instructions: Instruction[]; taskRequest: Address }> {
  return (async () => {
    const taskRequest = await deriveTaskRequestAddress(input.buyer, input.taskSeed);
    const bundleHash = hexToFixedBytes(input.bundleHashHex, 32);
    const taskAccessPolicy = input.worldIdRequired
      ? await deriveTaskAccessPolicyAddress(taskRequest)
      : null;

    return {
      instructions: [
        {
          accounts: [
            { address: address(input.buyer), role: AccountRole.WRITABLE_SIGNER },
            { address: taskRequest, role: AccountRole.WRITABLE },
            { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
          ],
          data: concatBytes(
            INSTRUCTION_DISCRIMINATORS.createTask,
            encodeU64(input.taskSeed),
            encodeU64(input.payoutLamports),
            encodeBytes(bundleHash),
            encodeString(input.title),
            encodeString(input.environment),
            encodeString(input.bundleUri),
          ),
          programAddress: SHADOWPILOT_PROGRAM_ID,
        },
        {
          accounts: [
            { address: address(input.buyer), role: AccountRole.WRITABLE_SIGNER },
            { address: taskRequest, role: AccountRole.WRITABLE },
            { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
          ],
          data: concatBytes(
            INSTRUCTION_DISCRIMINATORS.fundTask,
            encodeU64(input.payoutLamports),
          ),
          programAddress: SHADOWPILOT_PROGRAM_ID,
        },
        ...(taskAccessPolicy
          ? ([
              {
                accounts: [
                  { address: address(input.buyer), role: AccountRole.WRITABLE_SIGNER },
                  { address: taskRequest, role: AccountRole.WRITABLE },
                  { address: taskAccessPolicy, role: AccountRole.WRITABLE },
                  { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
                ],
                data: concatBytes(
                  INSTRUCTION_DISCRIMINATORS.configureTaskAccess,
                  encodeBool(true),
                ),
                programAddress: SHADOWPILOT_PROGRAM_ID,
              } satisfies Instruction,
            ])
          : []),
      ],
      taskRequest,
    };
  })();
}

export async function buildClaimTaskInstruction(input: {
  pilot: string;
  skillBand: number;
  taskRequest: string;
  reputationCommitment: Uint8Array;
}) {
  const pilotProfile = await derivePilotProfileAddress(input.pilot);
  const taskClaim = await deriveTaskClaimAddress(input.taskRequest, input.pilot);
  const taskAccessPolicy = await deriveTaskAccessPolicyAddress(input.taskRequest);
  const worldVerification = await deriveWorldVerificationAddress(input.pilot);

  return {
    instruction: {
      accounts: [
        { address: address(input.pilot), role: AccountRole.WRITABLE_SIGNER },
        { address: address(input.taskRequest), role: AccountRole.WRITABLE },
        { address: pilotProfile, role: AccountRole.WRITABLE },
        { address: taskClaim, role: AccountRole.WRITABLE },
        { address: taskAccessPolicy, role: AccountRole.READONLY },
        { address: worldVerification, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
      ],
      data: concatBytes(
        INSTRUCTION_DISCRIMINATORS.claimTask,
        encodeBytes(input.reputationCommitment),
        encodeU8(input.skillBand),
      ),
      programAddress: SHADOWPILOT_PROGRAM_ID,
    } satisfies Instruction,
    pilotProfile,
    taskClaim,
  };
}

export async function buildLinkWorldVerificationInstruction(input: {
  pilot: string;
  nullifierHashHex: string;
  reputationCommitment: Uint8Array;
  skillBand: number;
}) {
  const pilotProfile = await derivePilotProfileAddress(input.pilot);
  const worldVerification = await deriveWorldVerificationAddress(input.pilot);

  return {
    instruction: {
      accounts: [
        { address: address(input.pilot), role: AccountRole.WRITABLE_SIGNER },
        { address: pilotProfile, role: AccountRole.WRITABLE },
        { address: worldVerification, role: AccountRole.WRITABLE },
        { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
      ],
      data: concatBytes(
        INSTRUCTION_DISCRIMINATORS.linkWorldVerification,
        hexToFixedBytes(input.nullifierHashHex, 32),
        encodeBytes(input.reputationCommitment),
        encodeU8(input.skillBand),
      ),
      programAddress: SHADOWPILOT_PROGRAM_ID,
    } satisfies Instruction,
    pilotProfile,
    worldVerification,
  };
}

export async function buildSubmitSessionInstruction(input: {
  collisionCount: number;
  interventionMillis: bigint;
  pathEfficiencyBps: number;
  pilot: string;
  success: boolean;
  taskClaim: string;
  taskRequest: string;
  traceHash: Uint8Array;
  traceUri: string;
}) {
  const pilotProfile = await derivePilotProfileAddress(input.pilot);

  return {
    instruction: {
      accounts: [
        { address: address(input.pilot), role: AccountRole.WRITABLE_SIGNER },
        { address: address(input.taskRequest), role: AccountRole.WRITABLE },
        { address: pilotProfile, role: AccountRole.WRITABLE },
        { address: address(input.taskClaim), role: AccountRole.WRITABLE },
      ],
      data: concatBytes(
        INSTRUCTION_DISCRIMINATORS.submitSession,
        encodeBytes(input.traceHash),
        encodeString(input.traceUri),
        encodeBool(input.success),
        encodeU16(input.collisionCount),
        encodeU64(input.interventionMillis),
        encodeU16(input.pathEfficiencyBps),
      ),
      programAddress: SHADOWPILOT_PROGRAM_ID,
    } satisfies Instruction,
  };
}

export async function buildSettlementInstructions(input: {
  buyer: string;
  nextReputationCommitmentHex: string;
  pilotWallet: string;
  reviewCommitmentHex: string;
  settlement: MissionSettlement;
  taskClaim: string;
  taskRequest: string;
}) {
  const sessionReceipt = await deriveSessionReceiptAddress(input.taskClaim);
  const pilotProfile = await derivePilotProfileAddress(input.pilotWallet);
  const finalizeSessionInstruction = buildFinalizeSessionInstruction({
    buyer: input.buyer,
    nextReputationCommitmentHex: input.nextReputationCommitmentHex,
    pilotProfile,
    reviewCommitmentHex: input.reviewCommitmentHex,
    sessionReceipt,
    settlement: input.settlement,
    taskClaim: input.taskClaim,
    taskRequest: input.taskRequest,
  });
  const releasePayoutInstruction = buildReleasePayoutInstruction({
    buyer: input.buyer,
    pilotWallet: input.pilotWallet,
    taskClaim: input.taskClaim,
    taskRequest: input.taskRequest,
  });

  return {
    finalizeSessionInstruction,
    receiptMintReference: await deriveReceiptMintReference(input.taskClaim),
    releasePayoutInstruction,
    sessionReceipt,
    settlementInstructions: [finalizeSessionInstruction, releasePayoutInstruction] satisfies Instruction[],
  };
}

export function buildFinalizeSessionInstruction(input: {
  buyer: string;
  nextReputationCommitmentHex: string;
  pilotProfile: Address | string;
  reviewCommitmentHex: string;
  sessionReceipt: Address | string;
  settlement: MissionSettlement;
  taskClaim: string;
  taskRequest: string;
}) {
  return {
    accounts: [
      { address: address(input.buyer), role: AccountRole.WRITABLE_SIGNER },
      { address: address(input.taskRequest), role: AccountRole.WRITABLE },
      { address: address(input.taskClaim), role: AccountRole.WRITABLE },
      { address: address(input.pilotProfile), role: AccountRole.WRITABLE },
      { address: address(input.sessionReceipt), role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: concatBytes(
      INSTRUCTION_DISCRIMINATORS.finalizeSession,
      encodeU16(input.settlement.scoreBps),
      encodeU64(input.settlement.payoutLamports),
      encodeU8(input.settlement.acceptedScoreBand),
      encodeU8(input.settlement.payoutTier),
      encodeU8(encodeShadowPilotUsageRights(input.settlement.usageRights)),
      hexToFixedBytes(input.reviewCommitmentHex, 32),
      hexToFixedBytes(input.nextReputationCommitmentHex, 32),
    ),
    programAddress: SHADOWPILOT_PROGRAM_ID,
  } satisfies Instruction;
}

export function buildReleasePayoutInstruction(input: {
  buyer: string;
  pilotWallet: string;
  taskClaim: string;
  taskRequest: string;
}) {
  return {
    accounts: [
      { address: address(input.buyer), role: AccountRole.WRITABLE_SIGNER },
      { address: address(input.taskRequest), role: AccountRole.WRITABLE },
      { address: address(input.taskClaim), role: AccountRole.WRITABLE },
      { address: address(input.pilotWallet), role: AccountRole.WRITABLE },
    ],
    data: INSTRUCTION_DISCRIMINATORS.releasePayout,
    programAddress: SHADOWPILOT_PROGRAM_ID,
  } satisfies Instruction;
}

export function buildMintReceiptInstruction(input: {
  buyer: string;
  receiptMint: Address | string;
  sessionReceipt: Address | string;
  taskClaim: string;
  taskRequest: string;
}) {
  return {
    accounts: [
      { address: address(input.buyer), role: AccountRole.WRITABLE_SIGNER },
      { address: address(input.taskRequest), role: AccountRole.WRITABLE },
      { address: address(input.taskClaim), role: AccountRole.WRITABLE },
      { address: address(input.sessionReceipt), role: AccountRole.WRITABLE },
    ],
    data: concatBytes(
      INSTRUCTION_DISCRIMINATORS.mintReceipt,
      Uint8Array.from(addressEncoder.encode(address(input.receiptMint))),
    ),
    programAddress: SHADOWPILOT_PROGRAM_ID,
  } satisfies Instruction;
}

function hexToFixedBytes(hex: string, size: number) {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(size);

  for (let index = 0; index < size; index += 1) {
    const start = index * 2;
    const value = normalized.slice(start, start + 2);
    bytes[index] = value ? Number.parseInt(value, 16) : 0;
  }

  return bytes;
}
