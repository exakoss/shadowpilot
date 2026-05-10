import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type ConfidentialReviewRecord } from "@/lib/confidential-review";
import {
  buildSubmissionManifestUrl,
  buildSubmissionVideoUrl,
  type SubmissionManifest,
  type SubmissionManifestDraft,
} from "@/lib/submission-artifacts";
import { type ShadowPilotUsageRights } from "@/lib/shadowpilot-program";

const SHADOWPILOT_ROOT = path.join(process.cwd(), ".shadowpilot");
const SUBMISSIONS_ROOT = path.join(SHADOWPILOT_ROOT, "submissions");
const RECEIPTS_ROOT = path.join(SHADOWPILOT_ROOT, "receipts");
const REVIEWS_ROOT = path.join(SHADOWPILOT_ROOT, "reviews");
const PROFILES_ROOT = path.join(SHADOWPILOT_ROOT, "profiles");
const RECEIPT_TREE_PATH = path.join(RECEIPTS_ROOT, "bubblegum-tree.json");
const DEMO_RESET_PATH = path.join(SHADOWPILOT_ROOT, "demo-reset.json");

export type WorkspaceRole = "buyer" | "pilot";

export type UserProfileRecord = {
  role: WorkspaceRole;
  updatedAt: string;
  userId: string;
  wallet: string;
};

export type ReceiptRecord = {
  assetId: string | null;
  assetOwner?: string | null;
  artworkUrl: string;
  buyer: string;
  claimAddress: string;
  createdAt: string;
  environment: string;
  metadataUrl: string;
  payoutLamports: string;
  pilot: string;
  receiptId: string;
  reviewCommitment: string;
  reviewId: string;
  reviewNotes: string;
  score: number;
  signature: string | null;
  submissionUrl: string | null;
  taskAddress: string;
  taskTitle: string;
  treeAddress: string | null;
  usageRights: ShadowPilotUsageRights;
};

export type BubblegumTreeRecord = {
  createdAt: string;
  merkleTree: string;
};

export type DemoResetRecord = {
  resetAfter: number;
  updatedAt: string;
};

async function ensureDir(directory: string) {
  await mkdir(directory, { recursive: true });
}

async function readJsonFile<T>(filepath: string): Promise<T> {
  return JSON.parse(await readFile(filepath, "utf8")) as T;
}

async function writeJsonFile(filepath: string, value: unknown) {
  await writeFile(filepath, JSON.stringify(value, null, 2));
}

function submissionDirectory(submissionId: string) {
  return path.join(SUBMISSIONS_ROOT, submissionId);
}

function submissionManifestPath(submissionId: string) {
  return path.join(submissionDirectory(submissionId), "manifest.json");
}

function receiptDirectory(receiptId: string) {
  return path.join(RECEIPTS_ROOT, receiptId);
}

function receiptRecordPath(receiptId: string) {
  return path.join(receiptDirectory(receiptId), "record.json");
}

function reviewDirectory(reviewId: string) {
  return path.join(REVIEWS_ROOT, reviewId);
}

function reviewRecordPath(reviewId: string) {
  return path.join(reviewDirectory(reviewId), "record.json");
}

function profileRecordPath(wallet: string) {
  const profileKey = crypto.createHash("sha256").update(wallet).digest("hex");
  return path.join(PROFILES_ROOT, `${profileKey}.json`);
}

export function createStorageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export async function writeSubmissionManifest(input: {
  draft: SubmissionManifestDraft;
  origin: string;
  submissionId: string;
}) {
  const directory = submissionDirectory(input.submissionId);
  await ensureDir(directory);

  const manifest: SubmissionManifest = {
    ...input.draft,
    schema: "shadowpilot_submission_v1",
    submissionId: input.submissionId,
    submittedAt: new Date().toISOString(),
    video: input.draft.video
      ? {
          ...input.draft.video,
          url: buildSubmissionVideoUrl(input.origin, input.submissionId),
        }
      : null,
  };

  await writeJsonFile(submissionManifestPath(input.submissionId), manifest);
  return manifest;
}

export async function readSubmissionManifest(submissionId: string) {
  return readJsonFile<SubmissionManifest>(submissionManifestPath(submissionId));
}

export async function writeSubmissionVideo(
  submissionId: string,
  storageFileName: string,
  bytes: Uint8Array,
) {
  const directory = submissionDirectory(submissionId);
  await ensureDir(directory);
  await writeFile(path.join(directory, storageFileName), bytes);
}

export async function readSubmissionVideo(submissionId: string) {
  const manifest = await readSubmissionManifest(submissionId);
  const storageFileName = manifest.video?.storageFileName;
  if (!storageFileName || !manifest.video) {
    throw new Error("Submission video not found.");
  }

  const buffer = await readFile(path.join(submissionDirectory(submissionId), storageFileName));
  return {
    buffer,
    video: manifest.video,
  };
}

export async function writeReceiptRecord(record: ReceiptRecord) {
  const directory = receiptDirectory(record.receiptId);
  await ensureDir(directory);
  await writeJsonFile(receiptRecordPath(record.receiptId), record);
}

export async function readReceiptRecord(receiptId: string) {
  return readJsonFile<ReceiptRecord>(receiptRecordPath(receiptId));
}

export async function writeConfidentialReviewRecord(record: ConfidentialReviewRecord) {
  const directory = reviewDirectory(record.reviewId);
  await ensureDir(directory);
  await writeJsonFile(reviewRecordPath(record.reviewId), record);
}

export async function readConfidentialReviewRecord(reviewId: string) {
  return readJsonFile<ConfidentialReviewRecord>(reviewRecordPath(reviewId));
}

export async function writeUserProfileRecord(record: UserProfileRecord) {
  await ensureDir(PROFILES_ROOT);
  await writeJsonFile(profileRecordPath(record.wallet), record);
}

export async function readUserProfileRecord(wallet: string) {
  return readJsonFile<UserProfileRecord>(profileRecordPath(wallet));
}

export async function readBubblegumTreeRecord() {
  return readJsonFile<BubblegumTreeRecord>(RECEIPT_TREE_PATH);
}

export async function writeBubblegumTreeRecord(record: BubblegumTreeRecord) {
  await ensureDir(RECEIPTS_ROOT);
  await writeJsonFile(RECEIPT_TREE_PATH, record);
}

export async function readDemoResetRecord() {
  return readJsonFile<DemoResetRecord>(DEMO_RESET_PATH);
}

export async function writeDemoResetRecord(record: DemoResetRecord) {
  await ensureDir(SHADOWPILOT_ROOT);
  await writeJsonFile(DEMO_RESET_PATH, record);
}

export function buildReceiptMetadataUrl(origin: string, receiptId: string) {
  return `${origin}/api/receipts/${receiptId}/metadata`;
}

export function buildReceiptArtworkUrl(origin: string, receiptId: string) {
  return `${origin}/api/receipts/${receiptId}/artwork`;
}

export function buildSubmissionPointer(origin: string, submissionId: string) {
  return buildSubmissionManifestUrl(origin, submissionId);
}
