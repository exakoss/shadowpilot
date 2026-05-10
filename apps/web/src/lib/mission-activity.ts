export type MissionActivityKind = "buyer" | "pilot" | "system" | "arcium" | "solana";

export type MissionActivity = {
  at: string;
  detail: string;
  id: string;
  kind: MissionActivityKind;
  label: string;
};
