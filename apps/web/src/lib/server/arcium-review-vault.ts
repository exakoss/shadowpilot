import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Aes256Cipher, x25519 } from "@arcium-hq/client";

import {
  buildConfidentialReviewId,
  type ConfidentialReviewDraft,
  type ConfidentialReviewPayload,
  type ConfidentialReviewRecord,
  SHADOWPILOT_CONFIDENTIAL_REVIEW_ALGORITHM,
  SHADOWPILOT_CONFIDENTIAL_REVIEW_SCHEMA,
} from "@/lib/confidential-review";

const SHADOWPILOT_ROOT = path.join(process.cwd(), ".shadowpilot");
const ARCIUM_ROOT = path.join(SHADOWPILOT_ROOT, "arcium");
const REVIEW_VAULT_PATH = path.join(ARCIUM_ROOT, "review-vault.json");

type ReviewVaultKeyRecord = {
  createdAt: string;
  publicKey: string;
  secretKey: string;
  sdk: "@arcium-hq/client";
  type: "x25519";
};

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function sha256Hex(value: Uint8Array | string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getReputationDeltaLabel(score: number) {
  if (score >= 96) {
    return "+3 private rep";
  }
  if (score >= 82) {
    return "+2 private rep";
  }
  return "+1 private rep";
}

async function ensureDir(directory: string) {
  await mkdir(directory, { recursive: true });
}

async function readJsonFile<T>(filepath: string): Promise<T> {
  return JSON.parse(await readFile(filepath, "utf8")) as T;
}

async function writeJsonFile(filepath: string, value: unknown) {
  await writeFile(filepath, JSON.stringify(value, null, 2));
}

async function ensureReviewVault() {
  try {
    const record = await readJsonFile<ReviewVaultKeyRecord>(REVIEW_VAULT_PATH);
    return {
      publicKey: base64ToBytes(record.publicKey),
      secretKey: base64ToBytes(record.secretKey),
    };
  } catch {
    await ensureDir(ARCIUM_ROOT);
    const secretKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(secretKey);
    const record: ReviewVaultKeyRecord = {
      createdAt: new Date().toISOString(),
      publicKey: bytesToBase64(publicKey),
      sdk: "@arcium-hq/client",
      secretKey: bytesToBase64(secretKey),
      type: "x25519",
    };

    await writeJsonFile(REVIEW_VAULT_PATH, record);

    return {
      publicKey,
      secretKey,
    };
  }
}

function buildConfidentialReviewPayload(
  draft: ConfidentialReviewDraft,
  reviewId: string,
): ConfidentialReviewPayload {
  return {
    ...draft,
    createdAt: new Date().toISOString(),
    reputationDeltaLabel: getReputationDeltaLabel(draft.score),
    reviewId,
    schema: SHADOWPILOT_CONFIDENTIAL_REVIEW_SCHEMA,
  };
}

export async function sealConfidentialReview(draft: ConfidentialReviewDraft) {
  const reviewId = buildConfidentialReviewId(draft.claimAddress);
  const payload = buildConfidentialReviewPayload(draft, reviewId);
  const vault = await ensureReviewVault();
  const ephemeralSecretKey = x25519.utils.randomSecretKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralSecretKey);
  const sharedSecret = x25519.getSharedSecret(ephemeralSecretKey, vault.publicKey);
  const cipher = new Aes256Cipher(sharedSecret);
  const nonce = crypto.randomBytes(8);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = cipher.encrypt(plaintext, nonce);
  const reviewCommitment = sha256Hex(
    Buffer.concat([Buffer.from(ciphertext), nonce, Buffer.from(ephemeralPublicKey)]),
  );
  const nextReputationCommitment = sha256Hex(
    JSON.stringify({
      claimAddress: draft.claimAddress,
      currentReputationCommitment: draft.currentReputationCommitment,
      pilot: draft.pilot,
      reviewCommitment,
      score: draft.score,
      traceHash: draft.traceHash,
    }),
  );

  const record: ConfidentialReviewRecord = {
    buyer: draft.buyer,
    claimAddress: draft.claimAddress,
    createdAt: payload.createdAt,
    environment: draft.environment,
    nextReputationCommitment,
    pilot: draft.pilot,
    payoutLamports: draft.payoutLamports,
    payoutTier: draft.payoutTier,
    reviewCommitment,
    reviewId,
    score: draft.score,
    sealed: {
      algorithm: SHADOWPILOT_CONFIDENTIAL_REVIEW_ALGORITHM,
      ciphertext: bytesToBase64(ciphertext),
      ephemeralPublicKey: bytesToBase64(ephemeralPublicKey),
      nonce: nonce.toString("base64"),
      sdk: "@arcium-hq/client",
      vaultPublicKey: bytesToBase64(vault.publicKey),
    },
    submissionUrl: draft.submissionUrl ?? null,
    taskAddress: draft.taskAddress,
    taskTitle: draft.taskTitle,
    traceHash: draft.traceHash,
    usageRights: draft.usageRights,
  };

  return {
    nextReputationCommitment,
    payload,
    record,
    reviewCommitment,
    reviewId,
  };
}

export async function openConfidentialReview(record: ConfidentialReviewRecord) {
  const vault = await ensureReviewVault();
  const sharedSecret = x25519.getSharedSecret(
    vault.secretKey,
    base64ToBytes(record.sealed.ephemeralPublicKey),
  );
  const cipher = new Aes256Cipher(sharedSecret);
  const plaintext = cipher.decrypt(
    base64ToBytes(record.sealed.ciphertext),
    base64ToBytes(record.sealed.nonce),
  );

  return JSON.parse(Buffer.from(plaintext).toString("utf8")) as ConfidentialReviewPayload;
}
