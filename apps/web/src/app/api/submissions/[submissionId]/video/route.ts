import {
  ShadowPilotRequestAuthError,
  requireSubmissionViewer,
} from "@/lib/server/privy-auth";
import { readSubmissionManifest, readSubmissionVideo } from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

function buildVideoHeaders(input: {
  contentLength: number;
  contentType: string;
  contentRange?: string;
}) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "content-length": input.contentLength.toString(),
    "content-type": input.contentType,
  });

  if (input.contentRange) {
    headers.set("content-range", input.contentRange);
  }

  return headers;
}

function normalizeVideoContentType(contentType: string | null | undefined) {
  const normalized = contentType?.toLowerCase() ?? "";

  if (normalized.includes("webm")) {
    return "video/webm";
  }
  if (normalized.includes("mp4")) {
    return "video/mp4";
  }
  if (normalized.includes("quicktime") || normalized.includes("mov")) {
    return "video/quicktime";
  }

  return "application/octet-stream";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  try {
    const { submissionId } = await context.params;
    const manifest = await readSubmissionManifest(submissionId);
    await requireSubmissionViewer(request, manifest);
    const { buffer, video } = await readSubmissionVideo(submissionId);
    const contentType = normalizeVideoContentType(video.mimeType);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        return new Response(null, {
          headers: {
            "content-range": `bytes */${buffer.byteLength}`,
          },
          status: 416,
        });
      }

      const requestedStart = match[1] ? Number(match[1]) : null;
      const requestedEnd = match[2] ? Number(match[2]) : null;
      const suffixLength = requestedStart === null && requestedEnd !== null ? requestedEnd : null;
      const start =
        suffixLength !== null
          ? Math.max(buffer.byteLength - suffixLength, 0)
          : (requestedStart ?? 0);
      const rawEnd =
        suffixLength !== null || requestedEnd === null ? buffer.byteLength - 1 : requestedEnd;
      const end = Math.min(rawEnd, buffer.byteLength - 1);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
        return new Response(null, {
          headers: {
            "content-range": `bytes */${buffer.byteLength}`,
          },
          status: 416,
        });
      }

      const body = buffer.subarray(start, end + 1);
      return new Response(body, {
        headers: buildVideoHeaders({
          contentLength: body.byteLength,
          contentRange: `bytes ${start}-${end}/${buffer.byteLength}`,
          contentType,
        }),
        status: 206,
      });
    }

    return new Response(buffer, {
      headers: buildVideoHeaders({
        contentLength: buffer.byteLength,
        contentType,
      }),
      status: 200,
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Submission video not found.",
      },
      { status: 404 },
    );
  }
}
