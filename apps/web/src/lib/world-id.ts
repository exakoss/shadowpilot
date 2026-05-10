export const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "";
export const WORLD_RP_ID = process.env.NEXT_PUBLIC_WORLD_RP_ID ?? "";
export const WORLD_PILOT_ACTION =
  process.env.NEXT_PUBLIC_WORLD_PILOT_ACTION ?? "shadowpilot-pilot-human-proof";
export const WORLD_ENVIRONMENT =
  process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT === "production" ? "production" : "staging";

export const WORLD_ID_CONFIGURED = Boolean(WORLD_APP_ID && WORLD_RP_ID);

export function compactWorldNullifier(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}
