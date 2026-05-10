"use client";

import { IntegrationBadge } from "./integration-badge";
import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";

function compactCommitment(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}

function formatSolString(lamports: string) {
  const value = (Number(lamports) / 1_000_000_000).toFixed(3).replace(/\.?0+$/u, "");
  return `${value} SOL`;
}

export function ConfidentialReviewPanel({
  error,
  isLoading,
  payload,
  record,
}: {
  error: string | null;
  isLoading: boolean;
  payload: {
    createdAt: string;
    reputationDeltaLabel: string;
    reviewNotes: string;
    score: number;
    usageRights: string;
  } | null;
  record: {
    payoutLamports: string;
    payoutTier: number;
    reviewCommitment: string;
    reviewId: string;
  } | null;
}) {
  return (
    <article className="panel-muted rounded-[22px] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Confidential review</p>
            <IntegrationBadge compact kind="arcium" label="Arcium" />
          </div>
          <h4 className="mt-2 text-lg font-semibold text-[var(--text)]">
            Sealed settlement package
          </h4>
        </div>
        <PrivacyPill scope="shared" label="Buyer + pilot" />
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        ShadowPilot seals the raw review note, payout shaping inputs, and reputation-sensitive
        outcome before the public receipt closes the mission.
      </p>

      {isLoading ? (
        <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-4 text-sm text-[var(--text-muted)]">
          Opening the confidential review package...
        </div>
      ) : payload && record ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
              <p className="eyebrow">Review score</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{payload.score}/100</p>
            </div>
            <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
              <p className="eyebrow">Payout tier</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                Tier {record.payoutTier}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {formatSolString(record.payoutLamports)}
              </p>
            </div>
            <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
              <p className="eyebrow">Private rep outcome</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {payload.reputationDeltaLabel}
              </p>
            </div>
            <div className="rounded-[18px] border border-[var(--line)] bg-white p-4">
              <p className="eyebrow">Usage rights</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {payload.usageRights}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Commitment anchor</p>
                <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-xs text-[var(--text)]">
                  {compactCommitment(record.reviewCommitment)}
                </p>
              </div>
              <StatusPill label="Sealed with Arcium SDK" tone="arcium" />
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-4">
            <p className="eyebrow">Buyer note</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {payload.reviewNotes || "No buyer note was attached to this settlement package."}
            </p>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-4 text-sm text-[var(--text-muted)]">
          This package appears after the buyer approves the task and ShadowPilot seals the review
          outcome for the buyer and pilot pair.
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-[var(--critical)]">{error}</p> : null}
    </article>
  );
}
