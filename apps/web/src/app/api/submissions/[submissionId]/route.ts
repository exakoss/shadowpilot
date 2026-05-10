import { NextResponse } from "next/server";

import {
  ShadowPilotRequestAuthError,
  requireSubmissionViewer,
} from "@/lib/server/privy-auth";
import { readSubmissionManifest } from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  try {
    const { submissionId } = await context.params;
    const manifest = await readSubmissionManifest(submissionId);
    await requireSubmissionViewer(request, manifest);
    return NextResponse.json(manifest);
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Submission not found.",
      },
      { status: 404 },
    );
  }
}
