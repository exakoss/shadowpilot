import clsx from "clsx";

import { type LiveMission } from "@/lib/shadowpilot-program";
import {
  getTaskLaneFromMission,
  getTaskPackageMetrics,
  getTaskPackageStatus,
} from "@/lib/task-lane";

import { IntegrationBadge, IntegrationCard } from "./integration-badge";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";
import { TaskLanePill } from "./task-lane-pill";

export function TaskFlowPanel({
  buyerUnlocked = false,
  className,
  mission,
  pilotUnlocked = false,
}: {
  buyerUnlocked?: boolean;
  className?: string;
  mission: LiveMission;
  pilotUnlocked?: boolean;
}) {
  const lane = getTaskLaneFromMission(mission);
  const packageStatus = getTaskPackageStatus(mission);
  const metricCards = getTaskPackageMetrics(mission);

  return (
    <div className={clsx("grid gap-4 xl:grid-cols-[0.92fr_1.08fr]", className)}>
      <article className="rounded-[26px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Task lane</p>
              <TaskLanePill laneId={lane.id} />
            </div>
            <h4 className="mt-2 text-xl font-semibold tracking-tight">{lane.label}</h4>
          </div>
          <StatusPill label={packageStatus.label} tone={packageStatus.tone} />
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{lane.description}</p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="panel-muted rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Public shell</p>
              <PrivacyPill scope="public" />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{lane.publicSummary}</p>
          </div>

          <div className="panel-muted rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Buyer lane</p>
              <PrivacyPill scope="buyer" />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {buyerUnlocked
                ? "The connected buyer wallet can review the private brief, score memo, and rights settings for this task."
                : "The private brief, settlement memo, and rights settings stay locked to the buyer wallet."}
            </p>
          </div>

          <div className="panel-muted rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Pilot lane</p>
              <PrivacyPill scope="pilot" />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {pilotUnlocked ? lane.pilotPrivateUnlocked : lane.pilotPrivateLocked}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-[26px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Submission and rating</p>
              <IntegrationBadge compact kind="arcium" label="Arcium" />
            </div>
            <h4 className="mt-2 text-xl font-semibold tracking-tight">How the package moves</h4>
          </div>
          <PrivacyPill scope="shared" />
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{packageStatus.detail}</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="eyebrow">Submission package</p>
            {lane.artifacts.map((artifact) => (
              <div key={artifact.label} className="panel-muted rounded-[22px] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">{artifact.label}</p>
                  <PrivacyPill scope={artifact.scope} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{artifact.detail}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="eyebrow">Review and payout</p>
            {lane.reviewSteps.map((step, index) => (
              <div key={step.label} className="panel-muted rounded-[22px] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {index + 1}. {step.label}
                  </p>
                  <PrivacyPill scope={step.scope} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {metricCards.map((metric) => (
            <div key={metric.label} className="panel-muted rounded-[22px] p-4">
              <p className="eyebrow">{metric.label}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{metric.value}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{metric.detail}</p>
            </div>
          ))}
        </div>

        <IntegrationCard
          className="mt-5"
          kind="arcium"
          title="Confidential review lane"
          description="The buyer-visible score, payout tier, and reputation-safe outcome are sealed into an Arcium-backed review package so the public task shell does not expose the full settlement context."
        />

        <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">{lane.reviewSummary}</p>
      </article>
    </div>
  );
}
