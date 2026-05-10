import { type LiveMission } from "@/lib/shadowpilot-program";
import { getTaskLaneFromMission } from "@/lib/task-lane";

import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";

function isBrowserReadyLink(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function shortenLink(value: string) {
  if (value.length <= 64) {
    return value;
  }

  return `${value.slice(0, 40)}...${value.slice(-16)}`;
}

export function TaskAccessLinkPanel({
  mission,
  scope = "shared",
}: {
  mission: LiveMission;
  scope?: "buyer" | "pilot" | "public" | "shared";
}) {
  const lane = getTaskLaneFromMission(mission);
  const linkValue = mission.task.bundleUri;
  const browserReady = isBrowserReadyLink(linkValue);

  return (
    <article className="panel-muted rounded-[24px] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">{lane.accessLinkLabel}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text)]">
            Buyer-provided access point
          </h3>
        </div>
        <PrivacyPill scope={scope} />
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{lane.accessLinkDescription}</p>

      <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-white px-4 py-4">
        <p className="font-[var(--font-ibm-plex-mono)] text-xs leading-6 text-[var(--text)]">
          {shortenLink(linkValue)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {mission.accessPolicy?.worldIdRequired ? (
          <StatusPill label="World ID required" tone="warning" />
        ) : null}
        {browserReady ? (
          <a
            href={linkValue}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)]"
          >
            {lane.accessLinkActionLabel}
          </a>
        ) : (
          <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--text-muted)]">
            Open this task from a browser session that can reach the provided control or upload
            endpoint.
          </span>
        )}
      </div>
    </article>
  );
}
