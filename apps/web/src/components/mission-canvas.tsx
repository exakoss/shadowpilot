import { StatusPill } from "./status-pill";

export function MissionCanvas({
  title,
  subtitle,
  mode,
}: {
  title: string;
  subtitle: string;
  mode: "autonomy" | "pilot";
}) {
  return (
    <div className="panel rounded-[30px] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Mission Canvas</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <StatusPill label={mode === "pilot" ? "Pilot takeover" : "Autonomy fault"} tone={mode === "pilot" ? "good" : "critical"} />
      </div>

      <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-[24px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:68px_68px]" />
        <div className="absolute left-[12%] top-[16%] h-[14%] w-[22%] rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)]" />
        <div className="absolute right-[14%] top-[22%] h-[18%] w-[18%] rounded-[22px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)]" />
        <div className="absolute left-[34%] top-[44%] h-[22%] w-[20%] rounded-[24px] border border-[rgba(239,140,115,0.34)] bg-[rgba(239,140,115,0.18)] shadow-[0_0_40px_rgba(239,140,115,0.16)]" />
        <div className="absolute bottom-[14%] right-[12%] flex h-[18%] w-[24%] items-center justify-center rounded-[24px] border border-[rgba(113,196,156,0.3)] bg-[rgba(113,196,156,0.14)] text-sm font-semibold text-[var(--success)]">
          Goal zone
        </div>

        <div className="absolute left-[16%] top-[60%] h-6 w-6 rounded-full bg-[var(--accent)] shadow-[0_0_30px_rgba(240,166,72,0.8)]" />
        <div className="absolute left-[19%] top-[56%] h-1.5 w-[16%] rounded-full bg-[rgba(240,166,72,0.75)]" />
        <div className="absolute left-[34%] top-[49%] h-1.5 w-[12%] rotate-[58deg] rounded-full bg-[rgba(240,166,72,0.75)]" />
        <div className="absolute left-[44%] top-[64%] h-1.5 w-[28%] rounded-full bg-[rgba(113,196,156,0.75)]" />
        <div className="absolute left-[69%] top-[55%] h-1.5 w-[11%] rotate-[-58deg] rounded-full bg-[rgba(113,196,156,0.75)]" />

        <div className="absolute left-4 top-4 rounded-2xl border border-[var(--line)] bg-[rgba(8,16,21,0.72)] px-3 py-2">
          <p className="font-[var(--font-ibm-plex-mono)] text-[0.66rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Signal
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text)]">
            {mode === "pilot" ? "Pilot trajectory accepted" : "Autonomy confidence below threshold"}
          </p>
        </div>
      </div>
    </div>
  );
}

