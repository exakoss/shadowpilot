"use client";

import { compactAddress } from "@shadowpilot/shared";

import { PrivacyPill, type PrivacyScope } from "./privacy-pill";
import { StatusPill, type Tone } from "./status-pill";

type ContextCard = {
  detail: string;
  label: string;
  value: string;
};

type PrivateCard = {
  detail: string;
  label: string;
  scope?: PrivacyScope;
  value: string;
};

export function ViewerIdentityPanel({
  audienceLabel,
  connectedWallet,
  contextCards,
  privateCards,
  privateSummary,
  privateTitle,
  scope,
  statusLabel,
  statusTone,
  summary,
  title,
}: {
  audienceLabel: string;
  connectedWallet: string | null;
  contextCards: ContextCard[];
  privateCards: PrivateCard[];
  privateSummary: string;
  privateTitle: string;
  scope: Exclude<PrivacyScope, "public" | "shared">;
  statusLabel: string;
  statusTone: Tone;
  summary: string;
  title: string;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
      <article className="panel rounded-[32px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{audienceLabel}</p>
              <PrivacyPill scope={scope} />
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
          </div>
          <StatusPill label={statusLabel} tone={statusTone} />
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{summary}</p>
        <p className="mt-4 font-[var(--font-ibm-plex-mono)] text-xs text-[var(--text-muted)]">
          {connectedWallet
            ? `Connected wallet: ${compactAddress(connectedWallet)}`
            : "Continue with Privy or connect Phantom to unlock private controls."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {contextCards.map((card) => (
            <div key={card.label} className="panel-muted rounded-[22px] p-4">
              <p className="eyebrow">{card.label}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{card.value}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{card.detail}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel rounded-[32px] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Private Layer</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">{privateTitle}</h3>
          </div>
          <PrivacyPill scope={scope} />
        </div>

        <div className="mt-6 space-y-3">
          {privateCards.map((card) => (
            <div key={card.label} className="panel-muted rounded-[22px] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="eyebrow">{card.label}</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">{card.value}</p>
                </div>
                <PrivacyPill scope={card.scope ?? scope} />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.detail}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">{privateSummary}</p>
      </article>
    </section>
  );
}
