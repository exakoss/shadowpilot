import path from "node:path";

import { NextResponse } from "next/server";

import { type SubmissionManifestDraft } from "@/lib/submission-artifacts";
import { ShadowPilotRequestAuthError, requirePrivyWallet } from "@/lib/server/privy-auth";
import {
  buildSubmissionPointer,
  createStorageId,
  writeSubmissionManifest,
  writeSubmissionVideo,
} from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

function inferVideoExtension(file: File) {
  const fromName = path.extname(file.name).trim();
  if (fromName) {
    return fromName.toLowerCase();
  }

  if (file.type.includes("mp4")) {
    return ".mp4";
  }
  if (file.type.includes("quicktime")) {
    return ".mov";
  }
  if (file.type.includes("webm")) {
    return ".webm";
  }

  return ".bin";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const manifestRaw = formData.get("manifest");

    if (typeof manifestRaw !== "string") {
      return NextResponse.json(
        {
          error: "Submission manifest is required.",
        },
        { status: 400 },
      );
    }

    const draft = JSON.parse(manifestRaw) as SubmissionManifestDraft;
    await requirePrivyWallet(request, draft.pilot);

    const clipEntry = formData.get("clip");
    const submissionId = createStorageId("submission");
    const origin = new URL(request.url).origin;

    if (clipEntry && !(clipEntry instanceof File)) {
      return NextResponse.json(
        {
          error: "The uploaded clip is invalid.",
        },
        { status: 400 },
      );
    }

    const storageFileName =
      clipEntry instanceof File && draft.video
        ? `primary${inferVideoExtension(clipEntry)}`
        : draft.video?.storageFileName;

    if (clipEntry instanceof File && storageFileName) {
      const bytes = new Uint8Array(await clipEntry.arrayBuffer());
      await writeSubmissionVideo(submissionId, storageFileName, bytes);
    }

    const manifest = await writeSubmissionManifest({
      draft: {
        ...draft,
        video:
          draft.video && storageFileName
            ? {
                ...draft.video,
                storageFileName,
              }
            : null,
      },
      origin,
      submissionId,
    });

    return NextResponse.json({
      manifest,
      traceUri: buildSubmissionPointer(origin, submissionId),
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The submission package could not be stored.",
      },
      { status: 500 },
    );
  }
}
