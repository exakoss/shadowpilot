export type SubmissionLane = "humanoid_capture" | "remote_operation";
export type SubmissionVideoSource = "recorded" | "uploaded";

export type SubmissionVideoArtifact = {
  durationMillis: number;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  source: SubmissionVideoSource;
  storageFileName?: string;
  url: string;
};

export type SubmissionMetrics = {
  collisionCount: number;
  interventionMillis: number;
  pathEfficiencyBps: number;
  success: boolean;
  tracePoints: number;
};

export type SubmissionManifest = {
  accessLink: string;
  buyer: string;
  claimAddress: string;
  environment: string;
  lane: SubmissionLane;
  notes: string;
  pilot: string;
  schema: "shadowpilot_submission_v1";
  submissionId: string;
  submittedAt: string;
  taskAddress: string;
  taskTitle: string;
  traceHash: string;
  metrics: SubmissionMetrics;
  video: SubmissionVideoArtifact | null;
};

export type SubmissionManifestDraft = Omit<
  SubmissionManifest,
  "schema" | "submissionId" | "submittedAt" | "video"
> & {
  video: Omit<SubmissionVideoArtifact, "url"> | null;
};

export function buildSubmissionManifestUrl(origin: string, submissionId: string) {
  return `${origin}/api/submissions/${submissionId}`;
}

export function buildSubmissionVideoUrl(origin: string, submissionId: string) {
  return `${origin}/api/submissions/${submissionId}/video`;
}

export function isResolvableSubmissionManifestUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value) || value.startsWith("/");
}

export function resolveSubmissionManifestUrl(value: string | null | undefined) {
  if (!isResolvableSubmissionManifestUrl(value)) {
    return null;
  }

  return value as string;
}
