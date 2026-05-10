import { NextResponse } from "next/server";

import {
  readDemoResetRecord,
  writeDemoResetRecord,
  type DemoResetRecord,
} from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

const RESET_CLOCK_SKEW_SECONDS = 30;

function defaultResetRecord(): DemoResetRecord {
  return {
    resetAfter: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function GET() {
  const record = await readDemoResetRecord().catch(() => defaultResetRecord());
  return NextResponse.json(record);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    resetAfter?: unknown;
  } | null;
  const requestedResetAfter =
    typeof body?.resetAfter === "number" && Number.isFinite(body.resetAfter)
      ? Math.max(0, Math.floor(body.resetAfter))
      : null;
  const resetAfter =
    requestedResetAfter ?? Math.max(0, Math.floor(Date.now() / 1000) - RESET_CLOCK_SKEW_SECONDS);
  const record: DemoResetRecord = {
    resetAfter,
    updatedAt: new Date().toISOString(),
  };

  await writeDemoResetRecord(record);

  return NextResponse.json(record);
}
