import clsx from "clsx";

export type Tone = "neutral" | "active" | "good" | "warning" | "critical" | "arcium";

const toneMap: Record<Tone, string> = {
  neutral: "border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] text-[var(--text-muted)]",
  active: "border-[rgba(55,65,81,0.12)] bg-[rgba(55,65,81,0.06)] text-[var(--text)]",
  good: "border-[rgba(15,118,110,0.14)] bg-[rgba(15,118,110,0.08)] text-[var(--success)]",
  warning: "border-[rgba(154,103,0,0.14)] bg-[rgba(154,103,0,0.08)] text-[var(--warning)]",
  critical: "border-[rgba(180,35,24,0.16)] bg-[rgba(180,35,24,0.08)] text-[var(--critical)]",
  arcium:
    "border-[rgba(109,69,255,0.2)] bg-[rgba(109,69,255,0.1)] text-[var(--arcium-strong)]",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
        toneMap[tone],
      )}
    >
      {label}
    </span>
  );
}
