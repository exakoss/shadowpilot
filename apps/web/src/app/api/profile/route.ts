import { NextResponse } from "next/server";

import { ShadowPilotRequestAuthError, requirePrivyWallet } from "@/lib/server/privy-auth";
import {
  readUserProfileRecord,
  type UserProfileRecord,
  type WorkspaceRole,
  writeUserProfileRecord,
} from "@/lib/server/shadowpilot-storage";

export const runtime = "nodejs";

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "buyer" || value === "pilot";
}

export async function GET(request: Request) {
  try {
    const auth = await requirePrivyWallet(request);
    const record = await readUserProfileRecord(auth.requestedWallet).catch(() => null);

    return NextResponse.json({
      role: record?.role ?? null,
      updatedAt: record?.updatedAt ?? null,
      wallet: auth.requestedWallet,
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The profile could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePrivyWallet(request);
    const body = (await request.json()) as { role?: unknown };

    if (!isWorkspaceRole(body.role)) {
      return NextResponse.json(
        {
          error: "Choose either the buyer or pilot workspace.",
        },
        { status: 400 },
      );
    }

    const record: UserProfileRecord = {
      role: body.role,
      updatedAt: new Date().toISOString(),
      userId: auth.user.id,
      wallet: auth.requestedWallet,
    };

    await writeUserProfileRecord(record);

    return NextResponse.json({
      role: record.role,
      updatedAt: record.updatedAt,
      wallet: record.wallet,
    });
  } catch (error) {
    if (error instanceof ShadowPilotRequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The profile could not be saved.",
      },
      { status: 500 },
    );
  }
}
