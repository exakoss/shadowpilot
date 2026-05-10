import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..");

const CLUSTER_MONIKER = "devnet";
const CLUSTER_URL = "https://api.devnet.solana.com";
const COMMITMENT = "confirmed";
const PROGRAM_ID = new PublicKey("4pPWvEnHLd2MRCW67nS7uZViBiyxo3M51S65NoFc7fiB");
const SYSTEM_PROGRAM_ADDRESS = new PublicKey("11111111111111111111111111111111");
const SOLANA_BIN_DIR =
  process.env.SOLANA_BIN_DIR ??
  path.join(homedir(), ".local", "share", "solana", "install", "active_release", "bin");
const SOLANA = path.join(SOLANA_BIN_DIR, "solana");
const SOLANA_KEYGEN = path.join(SOLANA_BIN_DIR, "solana-keygen");
const DEVNET_POW = process.env.DEVNET_POW_BIN ?? path.join(homedir(), ".cargo", "bin", "devnet-pow");
const DEVNET_DIR = path.join(homedir(), ".config", "shadowpilot", "devnet");
const DEPLOYER_KEYPAIR_PATH = path.join(DEVNET_DIR, "deployer.json");
const BUYER_KEYPAIR_PATH = path.join(DEVNET_DIR, "buyer.json");
const PILOT_KEYPAIR_PATH = path.join(DEVNET_DIR, "pilot.json");
const PROGRAM_SO_PATH = path.join(workspaceRoot, "target", "deploy", "shadowpilot.so");
const PROGRAM_KEYPAIR_PATH = path.join(
  workspaceRoot,
  "target",
  "deploy",
  "shadowpilot-keypair.json",
);
const PRIVATE_STATE_DIR = path.join(workspaceRoot, ".shadowpilot");
const IDL_PATH = path.join(workspaceRoot, "target", "idl", "shadowpilot.json");
const MIN_TRANSACTION_LAMPORTS = 5_000;
const POW_DIFFICULTY = 3;
const POW_REWARD_SOL = 0.02;
const SHOULD_CLEAN_PRIVATE_STATE = !process.argv.includes("--keep-private-state");
const SHOULD_SEED_MISSIONS = process.argv.includes("--seed");
const DEPLOYER_TARGET_SOL = Number(
  process.env.SHADOWPILOT_DEPLOYER_TARGET_SOL ?? (SHOULD_SEED_MISSIONS ? 4 : 3.95),
);
const BUYER_TARGET_SOL = Number(
  process.env.SHADOWPILOT_BUYER_TARGET_SOL ?? (SHOULD_SEED_MISSIONS ? 1.1 : 0.01),
);
const PILOT_TARGET_SOL = Number(
  process.env.SHADOWPILOT_PILOT_TARGET_SOL ?? (SHOULD_SEED_MISSIONS ? 0.05 : 0.01),
);

const connection = new Connection(CLUSTER_URL, COMMITMENT);
const idl = JSON.parse(readFileSync(IDL_PATH, "utf8"));
const instructionDiscriminators = new Map(
  idl.instructions.map((instruction) => [
    instruction.name,
    Uint8Array.from(instruction.discriminator),
  ]),
);

const MISSIONS = [
  {
    bundleHashHex:
      "4f0b8e4bca09f064c7e8b8bc0d8c4f6e9e2ca33125e4547c5040b711923a7c18",
    bundleUri: "ar://shadowpilot/task/SP-OPEN.bundle",
    environment: "Warehouse grid / aisle 14",
    payoutSol: 0.45,
    seed: 7101n,
    stage: "open",
    title: "Rover aisle recovery",
    worldIdRequired: true,
  },
  {
    bundleHashHex:
      "30bbec82834a8218dbad1e9e4dfe9bd2e03d28c1b8f855602640af945bdb4ae1",
    bundleUri: "ar://shadowpilot/task/SP-SUBMITTED.bundle",
    environment: "Conveyor merge / lane 3",
    payoutSol: 0.3,
    seed: 7102n,
    stage: "submitted",
    title: "Conveyor merge recovery",
    worldIdRequired: false,
  },
  {
    bundleHashHex:
      "8f4b1806102da7d0fbcaf5df2f1e71e7d3f6b859236f85055e9dfe9558790ce7",
    bundleUri: "ar://shadowpilot/task/SP-CLOSED.bundle",
    environment: "Dock handoff / bay 6",
    payoutSol: 0.2,
    seed: 7103n,
    stage: "closed",
    title: "Dock handoff recovery",
    worldIdRequired: false,
  },
  {
    bundleHashHex:
      "7f5d57b41cd62f1d7f67fe95d8c1faad71517432752758126365c32f813f63af",
    bundleUri: "ar://shadowpilot/task/SP-HUMANOID-CLOSED.bundle",
    environment: "Capture stage / shelf transfer",
    payoutSol: 0.35,
    seed: 7104n,
    stage: "closed",
    title: "Humanoid shelf transfer capture",
    worldIdRequired: true,
  },
];

class BorshReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }

  readBytes(length) {
    const output = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return output;
  }

  readBool() {
    return this.readU8() === 1;
  }

  readI64() {
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readPubkey() {
    return new PublicKey(this.readBytes(32));
  }

  readString() {
    const length = this.readU32();
    const value = this.readBytes(length);
    return Buffer.from(value).toString("utf8");
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

  skip(length) {
    this.offset += length;
  }
}

function runCommand(bin, args, label) {
  const result = spawnSync(bin, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${label} failed.`,
        result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : null,
        result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return result.stdout.trim();
}

function ensureCli(binaryPath, label) {
  if (!existsSync(binaryPath)) {
    throw new Error(`${label} not found at ${binaryPath}`);
  }
}

function ensureKeypairFile(filepath) {
  if (existsSync(filepath)) {
    return;
  }

  runCommand(
    SOLANA_KEYGEN,
    [
      "new",
      "--outfile",
      filepath,
      "--no-bip39-passphrase",
      "--force",
      "--silent",
    ],
    `Generate ${path.basename(filepath)}`,
  );
}

function loadKeypair(filepath) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filepath, "utf8"))));
}

function encodeU8(value) {
  return Uint8Array.of(value);
}

function encodeBool(value) {
  return Uint8Array.of(value ? 1 : 0);
}

function encodeU16(value) {
  const output = new Uint8Array(2);
  const view = new DataView(output.buffer);
  view.setUint16(0, value, true);
  return output;
}

function encodeU32(value) {
  const output = new Uint8Array(4);
  const view = new DataView(output.buffer);
  view.setUint32(0, value, true);
  return output;
}

function encodeU64(value) {
  const output = new Uint8Array(8);
  const view = new DataView(output.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return output;
}

function encodeString(value) {
  const bytes = Buffer.from(value, "utf8");
  return concatBytes(encodeU32(bytes.length), bytes);
}

function concatBytes(...segments) {
  const size = segments.reduce((sum, segment) => sum + segment.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;

  for (const segment of segments) {
    output.set(segment, offset);
    offset += segment.length;
  }

  return output;
}

function u64SeedBytes(value) {
  return Buffer.from(encodeU64(value));
}

function hexToFixedBytes(hex, size) {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const output = new Uint8Array(size);

  for (let index = 0; index < size; index += 1) {
    const value = normalized.slice(index * 2, index * 2 + 2);
    output[index] = value ? Number.parseInt(value, 16) : 0;
  }

  return output;
}

function sha256Bytes(value) {
  return Uint8Array.from(crypto.createHash("sha256").update(value).digest());
}

function instructionDiscriminator(name) {
  const discriminator = instructionDiscriminators.get(name);
  if (discriminator) {
    return discriminator;
  }

  return Uint8Array.from(
    crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

function deriveTaskRequestAddress(buyerPublicKey, taskSeed) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("task"), buyerPublicKey.toBuffer(), u64SeedBytes(taskSeed)],
    PROGRAM_ID,
  )[0];
}

function derivePilotProfileAddress(pilotPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pilot"), pilotPublicKey.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function deriveTaskAccessPolicyAddress(taskRequestPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), taskRequestPublicKey.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function deriveTaskClaimAddress(taskRequestPublicKey, pilotPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), taskRequestPublicKey.toBuffer(), pilotPublicKey.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function deriveSessionReceiptAddress(taskClaimPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), taskClaimPublicKey.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function deriveReceiptReference(taskClaimPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt-mint"), taskClaimPublicKey.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function deriveWorldVerificationAddress(pilotPublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("world"), pilotPublicKey.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function createInstruction(keys, data) {
  return new TransactionInstruction({
    data: Buffer.from(data),
    keys,
    programId: PROGRAM_ID,
  });
}

function buildCreateTaskInstruction({
  buyerPublicKey,
  bundleHashHex,
  bundleUri,
  environment,
  payoutLamports,
  taskRequest,
  taskSeed,
  title,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: buyerPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    concatBytes(
      instructionDiscriminator("create_task"),
      encodeU64(taskSeed),
      encodeU64(payoutLamports),
      hexToFixedBytes(bundleHashHex, 32),
      encodeString(title),
      encodeString(environment),
      encodeString(bundleUri),
    ),
  );
}

function buildFundTaskInstruction({ amountLamports, buyerPublicKey, taskRequest }) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: buyerPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    concatBytes(instructionDiscriminator("fund_task"), encodeU64(amountLamports)),
  );
}

function buildConfigureTaskAccessInstruction({
  buyerPublicKey,
  taskAccessPolicy,
  taskRequest,
  worldIdRequired,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: buyerPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: true, pubkey: taskAccessPolicy },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    concatBytes(
      instructionDiscriminator("configure_task_access"),
      encodeBool(worldIdRequired),
    ),
  );
}

function buildClaimTaskInstruction({
  pilotPublicKey,
  pilotProfile,
  reputationCommitment,
  skillBand,
  taskClaim,
  taskAccessPolicy,
  taskRequest,
  worldVerification,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: pilotPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: true, pubkey: pilotProfile },
      { isSigner: false, isWritable: true, pubkey: taskClaim },
      { isSigner: false, isWritable: false, pubkey: taskAccessPolicy },
      { isSigner: false, isWritable: false, pubkey: worldVerification },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    concatBytes(
      instructionDiscriminator("claim_task"),
      reputationCommitment,
      encodeU8(skillBand),
    ),
  );
}

function buildLinkWorldVerificationInstruction({
  nullifierHash,
  pilotProfile,
  pilotPublicKey,
  reputationCommitment,
  skillBand,
  worldVerification,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: pilotPublicKey },
      { isSigner: false, isWritable: true, pubkey: pilotProfile },
      { isSigner: false, isWritable: true, pubkey: worldVerification },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    concatBytes(
      instructionDiscriminator("link_world_verification"),
      nullifierHash,
      reputationCommitment,
      encodeU8(skillBand),
    ),
  );
}

function buildSubmitSessionInstruction({
  collisionCount,
  interventionMillis,
  pathEfficiencyBps,
  pilotProfile,
  pilotPublicKey,
  success,
  taskClaim,
  taskRequest,
  traceHash,
  traceUri,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: pilotPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: true, pubkey: pilotProfile },
      { isSigner: false, isWritable: true, pubkey: taskClaim },
    ],
    concatBytes(
      instructionDiscriminator("submit_session"),
      traceHash,
      encodeString(traceUri),
      encodeBool(success),
      encodeU16(collisionCount),
      encodeU64(interventionMillis),
      encodeU16(pathEfficiencyBps),
    ),
  );
}

function buildFinalizeSessionInstruction({
  acceptedScoreBand,
  buyerPublicKey,
  payoutLamports,
  payoutTier,
  scoreBps,
  sessionReceipt,
  taskClaim,
  taskRequest,
  usageRightsVariant,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: buyerPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: true, pubkey: taskClaim },
      { isSigner: false, isWritable: true, pubkey: sessionReceipt },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    concatBytes(
      instructionDiscriminator("finalize_session"),
      encodeU16(scoreBps),
      encodeU64(payoutLamports),
      encodeU8(acceptedScoreBand),
      encodeU8(payoutTier),
      encodeU8(usageRightsVariant),
    ),
  );
}

function buildReleasePayoutInstruction({
  buyerPublicKey,
  pilotPublicKey,
  taskClaim,
  taskRequest,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: buyerPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: true, pubkey: taskClaim },
      { isSigner: false, isWritable: true, pubkey: pilotPublicKey },
    ],
    instructionDiscriminator("release_payout"),
  );
}

function buildMintReceiptInstruction({
  buyerPublicKey,
  receiptMint,
  sessionReceipt,
  taskClaim,
  taskRequest,
}) {
  return createInstruction(
    [
      { isSigner: true, isWritable: true, pubkey: buyerPublicKey },
      { isSigner: false, isWritable: true, pubkey: taskRequest },
      { isSigner: false, isWritable: true, pubkey: taskClaim },
      { isSigner: false, isWritable: true, pubkey: sessionReceipt },
    ],
    concatBytes(instructionDiscriminator("mint_receipt"), receiptMint.toBuffer()),
  );
}

function decodeClaimSummary(bytes) {
  const reader = new BorshReader(bytes);
  reader.skip(8);
  reader.readPubkey();
  reader.readPubkey();
  reader.readBytes(32);
  reader.readString();
  reader.readBool();
  reader.readU16();
  reader.readU64();
  reader.readU16();
  reader.readU16();
  reader.readU64();
  const submittedAt = reader.readI64();
  const status = reader.readU8();
  return { status, submittedAt };
}

function decodeReceiptSummary(bytes) {
  const reader = new BorshReader(bytes);
  reader.skip(8);
  reader.readPubkey();
  reader.readPubkey();
  reader.readPubkey();
  reader.readPubkey();
  reader.readBytes(32);
  reader.readU8();
  reader.readU8();
  const receiptMint = reader.readPubkey();
  reader.readU8();
  const mintedAt = reader.readI64();
  return { mintedAt, receiptMint };
}

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getBalance(publicKey) {
  return connection.getBalance(publicKey, COMMITMENT);
}

async function airdropIfNeeded(publicKey, targetSol) {
  const targetLamports = Math.round(targetSol * LAMPORTS_PER_SOL);
  let balance = await getBalance(publicKey);
  if (balance >= targetLamports) {
    return balance;
  }

  while (balance < targetLamports) {
    const remainingSol = Math.max(
      1,
      Math.ceil((targetLamports - balance) / LAMPORTS_PER_SOL),
    );
    const requestSol = Math.min(2, remainingSol);
    console.log(
      `Requesting ${requestSol} SOL for ${publicKey.toBase58()} on ${CLUSTER_MONIKER}...`,
    );
    try {
      runCommand(
        SOLANA,
        ["airdrop", String(requestSol), publicKey.toBase58(), "--url", CLUSTER_MONIKER],
        `Airdrop ${publicKey.toBase58()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Airdrop funding failed for ${publicKey.toBase58()}.\n\n${message}`,
      );
    }
    await wait(2_500);
    balance = await getBalance(publicKey);
  }

  return balance;
}

async function transferIfNeeded(fromKeypair, toPublicKey, targetSol) {
  const targetLamports = Math.round(targetSol * LAMPORTS_PER_SOL);
  const currentBalance = await getBalance(toPublicKey);
  if (currentBalance >= targetLamports) {
    return currentBalance;
  }

  const lamports = targetLamports - currentBalance;
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      lamports,
      toPubkey: toPublicKey,
    }),
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair], {
    commitment: COMMITMENT,
  });

  console.log(
    `Transferred ${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL to ${toPublicKey.toBase58()} (${signature})`,
  );

  return getBalance(toPublicKey);
}

async function mineIfNeeded({ keypairPath, publicKey, targetSol }) {
  ensureCli(DEVNET_POW, "devnet-pow");

  const targetLamports = Math.round(targetSol * LAMPORTS_PER_SOL);
  let balance = await getBalance(publicKey);
  if (balance >= targetLamports) {
    return balance;
  }

  if (balance < MIN_TRANSACTION_LAMPORTS) {
    const minimumStarterSol = (MIN_TRANSACTION_LAMPORTS / LAMPORTS_PER_SOL).toFixed(6);
    throw new Error(
      [
        `Proof-of-work mining is available, but ${publicKey.toBase58()} is completely unfunded.`,
        `Send at least ${minimumStarterSol} SOL to ${publicKey.toBase58()} so it can pay the first devnet transaction fee. In practice, sending 0.001 SOL is the safer manual top-up, then rerun \`pnpm devnet:bootstrap\`.`,
      ].join("\n\n"),
    );
  }

  const missingLamports = targetLamports - balance;
  console.log(
    `Mining ${(missingLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL for ${publicKey.toBase58()} via devnet-pow...`,
  );

  runCommand(
    DEVNET_POW,
    [
      "mine",
      "-u",
      "dev",
      "-k",
      keypairPath,
      "-d",
      String(POW_DIFFICULTY),
      "--reward",
      String(POW_REWARD_SOL),
      "--no-infer",
      "-t",
      String(missingLamports),
    ],
    `Mine ${publicKey.toBase58()}`,
  );

  await wait(1_500);
  balance = await getBalance(publicKey);
  return balance;
}

async function ensureTargetBalance({
  fallbackFunderKeypair,
  keypairPath,
  label,
  publicKey,
  targetSol,
}) {
  let balance = await getBalance(publicKey);
  const targetLamports = Math.round(targetSol * LAMPORTS_PER_SOL);
  if (balance >= targetLamports) {
    return balance;
  }

  try {
    balance = await airdropIfNeeded(publicKey, targetSol);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${label} faucet bootstrap failed: ${message}`);
  }

  balance = await getBalance(publicKey);
  if (balance >= targetLamports) {
    return balance;
  }

  if (fallbackFunderKeypair) {
    balance = await transferIfNeeded(fallbackFunderKeypair, publicKey, targetSol);
  } else if (keypairPath) {
    balance = await mineIfNeeded({ keypairPath, publicKey, targetSol });
  }

  if (balance < targetLamports) {
    throw new Error(
      `Unable to fund ${label} to ${(targetSol).toFixed(3)} SOL. Current balance: ${(
        balance / LAMPORTS_PER_SOL
      ).toFixed(6)} SOL.`,
    );
  }

  return balance;
}

async function sendInstructions(label, payer, instructions) {
  const transaction = new Transaction().add(...instructions);
  const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
    commitment: COMMITMENT,
  });
  console.log(`${label}: ${signature}`);
  return signature;
}

async function deployProgram(deployerKeypair) {
  console.log("Deploying or upgrading shadowpilot on devnet...");
  const output = runCommand(
    SOLANA,
    [
      "program",
      "deploy",
      PROGRAM_SO_PATH,
      "--url",
      CLUSTER_MONIKER,
      "--keypair",
      DEPLOYER_KEYPAIR_PATH,
      "--upgrade-authority",
      DEPLOYER_KEYPAIR_PATH,
      "--program-id",
      PROGRAM_KEYPAIR_PATH,
      "--output",
      "json-compact",
    ],
    "Program deploy",
  );

  const accountInfo = await connection.getAccountInfo(PROGRAM_ID, COMMITMENT);
  if (!accountInfo?.executable) {
    throw new Error("Program deploy finished without a live executable account on devnet.");
  }

  console.log(output);
  console.log(
    `Program ${PROGRAM_ID.toBase58()} is live. Deployer balance: ${(
      (await getBalance(deployerKeypair.publicKey)) / LAMPORTS_PER_SOL
    ).toFixed(3)} SOL`,
  );
}

function cleanPrivateState() {
  if (!SHOULD_CLEAN_PRIVATE_STATE) {
    return;
  }

  rmSync(PRIVATE_STATE_DIR, { force: true, recursive: true });
  console.log("Cleared local private ShadowPilot state.");
}

async function seedMissionState({ buyerKeypair, mission, pilotKeypair }) {
  const buyerPublicKey = buyerKeypair.publicKey;
  const pilotPublicKey = pilotKeypair.publicKey;
  const payoutLamports = BigInt(Math.round(mission.payoutSol * LAMPORTS_PER_SOL));
  const taskRequest = deriveTaskRequestAddress(buyerPublicKey, mission.seed);
  const taskAccessPolicy = deriveTaskAccessPolicyAddress(taskRequest);
  const pilotProfile = derivePilotProfileAddress(pilotPublicKey);
  const taskClaim = deriveTaskClaimAddress(taskRequest, pilotPublicKey);
  const sessionReceipt = deriveSessionReceiptAddress(taskClaim);
  const receiptMint = deriveReceiptReference(taskClaim);
  const worldVerification = deriveWorldVerificationAddress(pilotPublicKey);

  const taskInfo = await connection.getAccountInfo(taskRequest, COMMITMENT);
  if (!taskInfo) {
    const createInstructions = [
      buildCreateTaskInstruction({
        buyerPublicKey,
        bundleHashHex: mission.bundleHashHex,
        bundleUri: mission.bundleUri,
        environment: mission.environment,
        payoutLamports,
        taskRequest,
        taskSeed: mission.seed,
        title: mission.title,
      }),
      buildFundTaskInstruction({
        amountLamports: payoutLamports,
        buyerPublicKey,
        taskRequest,
      }),
    ];

    if (mission.worldIdRequired) {
      createInstructions.push(
        buildConfigureTaskAccessInstruction({
          buyerPublicKey,
          taskAccessPolicy,
          taskRequest,
          worldIdRequired: true,
        }),
      );
    }

    await sendInstructions(`Create ${mission.title}`, buyerKeypair, createInstructions);
  }

  const taskAccessPolicyInfo = await connection.getAccountInfo(taskAccessPolicy, COMMITMENT);
  if (mission.worldIdRequired && !taskAccessPolicyInfo) {
    await sendInstructions(`Gate ${mission.title}`, buyerKeypair, [
      buildConfigureTaskAccessInstruction({
        buyerPublicKey,
        taskAccessPolicy,
        taskRequest,
        worldIdRequired: true,
      }),
    ]);
  }

  if (mission.stage === "open") {
    return {
      stage: "open",
      taskRequest: taskRequest.toBase58(),
      title: mission.title,
    };
  }

  const worldVerificationInfo = await connection.getAccountInfo(worldVerification, COMMITMENT);
  if (mission.worldIdRequired && !worldVerificationInfo) {
    await sendInstructions(`Link World ${pilotPublicKey.toBase58().slice(0, 6)}`, pilotKeypair, [
      buildLinkWorldVerificationInstruction({
        nullifierHash: sha256Bytes(`shadowpilot-world:${pilotPublicKey.toBase58()}`),
        pilotProfile,
        pilotPublicKey,
        reputationCommitment: sha256Bytes(`shadowpilot-reputation:${pilotPublicKey.toBase58()}`),
        skillBand: 3,
        worldVerification,
      }),
    ]);
  }

  const claimInfo = await connection.getAccountInfo(taskClaim, COMMITMENT);
  if (!claimInfo) {
    await sendInstructions(`Claim ${mission.title}`, pilotKeypair, [
      buildClaimTaskInstruction({
        pilotPublicKey,
        pilotProfile,
        reputationCommitment: sha256Bytes(`shadowpilot-reputation:${pilotPublicKey.toBase58()}`),
        skillBand: 3,
        taskClaim,
        taskAccessPolicy,
        taskRequest,
        worldVerification,
      }),
    ]);
  }

  const latestClaimInfo = await connection.getAccountInfo(taskClaim, COMMITMENT);
  const latestClaim = latestClaimInfo ? decodeClaimSummary(latestClaimInfo.data) : null;
  if (latestClaim && latestClaim.status === 0) {
    await sendInstructions(`Submit ${mission.title}`, pilotKeypair, [
      buildSubmitSessionInstruction({
        collisionCount: mission.stage === "closed" ? 0 : 1,
        interventionMillis: mission.stage === "closed" ? 13_100n : 18_400n,
        pathEfficiencyBps: mission.stage === "closed" ? 9_280 : 8_250,
        pilotProfile,
        pilotPublicKey,
        success: true,
        taskClaim,
        taskRequest,
        traceHash: sha256Bytes(`${mission.title}:${mission.stage}`),
        traceUri: `ar://shadowpilot/trace/${taskRequest.toBase58().slice(0, 8)}-${mission.stage}`,
      }),
    ]);
  }

  if (mission.stage === "submitted") {
    return {
      stage: "submitted",
      taskClaim: taskClaim.toBase58(),
      taskRequest: taskRequest.toBase58(),
      title: mission.title,
    };
  }

  const receiptInfo = await connection.getAccountInfo(sessionReceipt, COMMITMENT);
  if (!receiptInfo) {
    await sendInstructions(`Finalize ${mission.title}`, buyerKeypair, [
      buildFinalizeSessionInstruction({
        acceptedScoreBand: 94,
        buyerPublicKey,
        payoutLamports,
        payoutTier: 3,
        scoreBps: 9_400,
        sessionReceipt,
        taskClaim,
        taskRequest,
        usageRightsVariant: 1,
      }),
    ]);
  }

  const latestReceiptInfo = await connection.getAccountInfo(sessionReceipt, COMMITMENT);
  const latestReceipt = latestReceiptInfo ? decodeReceiptSummary(latestReceiptInfo.data) : null;
  const currentClaimInfo = await connection.getAccountInfo(taskClaim, COMMITMENT);
  const currentClaim = currentClaimInfo ? decodeClaimSummary(currentClaimInfo.data) : null;

  if (currentClaim?.status === 2) {
    await sendInstructions(`Release + mint ${mission.title}`, buyerKeypair, [
      buildReleasePayoutInstruction({
        buyerPublicKey,
        pilotPublicKey,
        taskClaim,
        taskRequest,
      }),
      buildMintReceiptInstruction({
        buyerPublicKey,
        receiptMint,
        sessionReceipt,
        taskClaim,
        taskRequest,
      }),
    ]);
  } else if (
    currentClaim?.status === 3 &&
    latestReceipt &&
    latestReceipt.receiptMint.equals(SYSTEM_PROGRAM_ADDRESS)
  ) {
    await sendInstructions(`Mint ${mission.title}`, buyerKeypair, [
      buildMintReceiptInstruction({
        buyerPublicKey,
        receiptMint,
        sessionReceipt,
        taskClaim,
        taskRequest,
      }),
    ]);
  }

  return {
    receiptMint: receiptMint.toBase58(),
    stage: "closed",
    taskClaim: taskClaim.toBase58(),
    taskRequest: taskRequest.toBase58(),
    title: mission.title,
  };
}

async function main() {
  ensureCli(SOLANA, "solana");
  ensureCli(SOLANA_KEYGEN, "solana-keygen");
  mkdirSync(DEVNET_DIR, { recursive: true });

  ensureKeypairFile(DEPLOYER_KEYPAIR_PATH);
  ensureKeypairFile(BUYER_KEYPAIR_PATH);
  ensureKeypairFile(PILOT_KEYPAIR_PATH);

  const deployerKeypair = loadKeypair(DEPLOYER_KEYPAIR_PATH);
  const buyerKeypair = loadKeypair(BUYER_KEYPAIR_PATH);
  const pilotKeypair = loadKeypair(PILOT_KEYPAIR_PATH);

  cleanPrivateState();

  console.log("Devnet identities");
  console.log(`Deployer: ${deployerKeypair.publicKey.toBase58()}`);
  console.log(`Buyer: ${buyerKeypair.publicKey.toBase58()}`);
  console.log(`Pilot: ${pilotKeypair.publicKey.toBase58()}`);

  await ensureTargetBalance({
    keypairPath: DEPLOYER_KEYPAIR_PATH,
    label: "deployer",
    publicKey: deployerKeypair.publicKey,
    targetSol: DEPLOYER_TARGET_SOL,
  });
  await deployProgram(deployerKeypair);
  await ensureTargetBalance({
    fallbackFunderKeypair: deployerKeypair,
    keypairPath: BUYER_KEYPAIR_PATH,
    label: "buyer",
    publicKey: buyerKeypair.publicKey,
    targetSol: BUYER_TARGET_SOL,
  });
  await ensureTargetBalance({
    fallbackFunderKeypair: deployerKeypair,
    keypairPath: PILOT_KEYPAIR_PATH,
    label: "pilot",
    publicKey: pilotKeypair.publicKey,
    targetSol: PILOT_TARGET_SOL,
  });

  if (SHOULD_SEED_MISSIONS) {
    const seededMissions = [];
    for (const mission of MISSIONS) {
      seededMissions.push(
        await seedMissionState({
          buyerKeypair,
          mission,
          pilotKeypair,
        }),
      );
    }

    console.log("\nSeeded devnet state");
    for (const mission of seededMissions) {
      console.log(JSON.stringify(mission, null, 2));
    }
  } else {
    console.log("\nSeeded devnet state");
    console.log("Skipped. This deployment is clean and contains no pre-created tasks.");
  }

  console.log("\nBalances");
  console.log(
    `Deployer: ${(
      (await getBalance(deployerKeypair.publicKey)) / LAMPORTS_PER_SOL
    ).toFixed(3)} SOL`,
  );
  console.log(
    `Buyer: ${((await getBalance(buyerKeypair.publicKey)) / LAMPORTS_PER_SOL).toFixed(3)} SOL`,
  );
  console.log(
    `Pilot: ${((await getBalance(pilotKeypair.publicKey)) / LAMPORTS_PER_SOL).toFixed(3)} SOL`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
