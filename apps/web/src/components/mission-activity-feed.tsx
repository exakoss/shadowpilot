import clsx from "clsx";

import type { MissionActivity } from "@/lib/mission-activity";

import { PrivacyPill, type PrivacyScope } from "./privacy-pill";

const kindStyles: Record<MissionActivity["kind"], string> = {
  arcium:
    "border-[rgba(109,69,255,0.2)] bg-[rgba(109,69,255,0.1)] text-[var(--arcium-strong)]",
  buyer: "border-[rgba(218,123,35,0.18)] bg-[rgba(218,123,35,0.08)] text-[var(--accent-soft)]",
  pilot: "border-[rgba(23,33,44,0.12)] bg-[rgba(23,33,44,0.04)] text-[var(--text)]",
  solana: "border-[rgba(56,124,171,0.18)] bg-[rgba(56,124,171,0.08)] text-[#2f6792]",
  system: "border-[rgba(197,74,57,0.18)] bg-[rgba(197,74,57,0.08)] text-[var(--critical)]",
};

export function MissionActivityFeed({
  events,
  scope = "public",
  title = "Mission activity",
}: {
  events: MissionActivity[];
  scope?: PrivacyScope;
  title?: string;
}) {
  return (
    <article className="panel rounded-[30px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Timeline</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrivacyPill scope={scope} />
          <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {events.length} events
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {[...events].reverse().map((event) => (
          <div key={event.id} className="panel-muted rounded-[22px] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div
                  className={clsx(
                    "inline-flex rounded-full border px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em]",
                    kindStyles[event.kind],
                  )}
                >
                  {event.label}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{event.detail}</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(event.at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
