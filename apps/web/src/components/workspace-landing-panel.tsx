"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

import { IntegrationBadge, type IntegrationKind } from "./integration-badge";
import { useShadowPilotAuth } from "./shadowpilot-auth-provider";

const LANDING_POINTS = [
  {
    detail: "Buyers post either remote robot intervention or humanoid capture work with private handoff links.",
    label: "Robotics-first tasks",
  },
  {
    detail: "Pilots complete real runs, submit compact packages, and hand reviewable footage back to buyers.",
    label: "Human-in-the-loop ops",
  },
  {
    detail: "Settlement, receipts, and rights-aware payouts happen on Solana devnet with human gating available through World ID.",
    label: "Onchain review rails",
  },
] as const;

const STACK_CARDS = [
  {
    detail:
      "A buyer can submit either a live teleop recovery task or a humanoid data-collection request, then attach the handoff or upload link and payout.",
    integration: null,
    label: "Task setup",
    subtitle: "Teleop recovery or humanoid data collection.",
    tone: "blue",
    visual: "task",
  },
  {
    detail:
      "World ID-linked pilots can open tasks that require a unique human before the robot handoff begins.",
    integration: "world",
    label: "Human gate",
    subtitle: "World ID-linked pilots unlock tasks that require a unique human.",
    tone: "neutral",
    visual: "gate",
  },
  {
    detail:
      "Arcium marks the confidential review lane where ShadowPilot presents private scoring, payout shaping, and sensitive settlement outcomes.",
    integration: "arcium",
    label: "Private score",
    subtitle: "Arcium-backed review keeps scoring context out of the public task shell.",
    tone: "neutral",
    visual: "review",
  },
  {
    detail:
      "Once the buyer approves, ShadowPilot settles on devnet and closes the mission with the cNFT rights receipt.",
    integration: null,
    label: "Receipt",
    subtitle: "Mint the devnet cNFT and close the mission.",
    tone: "blue",
    visual: "receipt",
  },
] as const satisfies ReadonlyArray<{
  detail: string;
  integration: IntegrationKind | null;
  label: string;
  subtitle: string;
  tone: "blue" | "neutral";
  visual: "gate" | "receipt" | "review" | "task";
}>;

function CarouselCardVisual({ card }: { card: (typeof STACK_CARDS)[number] }) {
  if (card.visual === "task") {
    return (
      <div className="mt-4 rounded-[20px] border border-[rgba(37,99,235,0.16)] bg-[rgba(219,234,254,0.46)] p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[rgba(37,99,235,0.16)] bg-white px-3 py-3">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand-blue)]">
              Teleop
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--text)]">Robot recovery</p>
          </div>
          <div className="rounded-[16px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Humanoid
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--text)]">Data collection</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[16px] border border-white/80 bg-white/72 px-3 py-2 text-xs text-[var(--text-muted)]">
          <span>Handoff link</span>
          <span className="font-semibold text-[var(--text)]">0.25 SOL min</span>
        </div>
      </div>
    );
  }

  if (card.visual === "gate") {
    return (
      <div className="mt-4 rounded-[20px] border border-[rgba(15,23,42,0.1)] bg-[rgba(249,249,248,0.82)] p-4">
        <div className="flex items-center justify-between rounded-[18px] border border-[rgba(45,44,44,0.12)] bg-white px-3 py-3">
          <span className="text-sm font-semibold text-[var(--text)]">Pilot claim</span>
          <span className="rounded-full bg-[var(--world-ink)] px-3 py-1 text-xs font-semibold text-white">
            Verified
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="h-2 rounded-full bg-[rgba(45,44,44,0.18)]" />
          <span>proof check</span>
          <span className="h-2 rounded-full bg-[rgba(45,44,44,0.42)]" />
        </div>
      </div>
    );
  }

  if (card.visual === "review") {
    return (
      <div className="mt-4 rounded-[20px] border border-[rgba(109,69,255,0.16)] bg-[rgba(241,236,255,0.58)] p-4">
        <div className="flex items-center justify-between gap-3">
          <IntegrationBadge
            compact
            kind="arcium"
            className="origin-left scale-[0.82]"
          />
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--arcium)]">
            84 / 100
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["score", "payout", "rep"].map((label, index) => (
            <div key={label} className="rounded-[14px] bg-white/78 px-2 py-3 text-center">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {label}
              </p>
              <div
                className={clsx(
                  "mx-auto mt-2 h-1.5 rounded-full",
                  index === 0 && "w-9 bg-[var(--arcium)]",
                  index === 1 && "w-7 bg-[var(--brand-blue)]",
                  index === 2 && "w-5 bg-[var(--accent-soft)]",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[20px] border border-[rgba(37,99,235,0.14)] bg-white p-4">
      <div className="rounded-[18px] border border-dashed border-[rgba(37,99,235,0.28)] bg-[rgba(219,234,254,0.44)] p-4">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand-blue)]">
          cNFT receipt
        </p>
        <p className="mt-2 font-[var(--font-ibm-plex-mono)] text-sm font-semibold text-[var(--text)]">
          Minted after review
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>Payout released</span>
        <span className="font-semibold text-[var(--text)]">Training + replay</span>
      </div>
    </div>
  );
}

function CarouselCard({
  active,
  card,
  onClick,
  position,
}: {
  active: boolean;
  card: (typeof STACK_CARDS)[number];
  onClick: () => void;
  position: "active" | "next" | "previous" | "hidden";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "absolute left-1/2 top-1/2 w-[min(18.5rem,72vw)] rounded-[24px] border p-4 text-left shadow-[0_24px_70px_rgba(15,23,42,0.13)] transition-all duration-700 ease-out [backface-visibility:hidden] sm:w-[20rem]",
        card.tone === "blue"
          ? "border-[rgba(37,99,235,0.18)] bg-[rgba(255,255,255,0.96)]"
          : "border-[rgba(15,23,42,0.1)] bg-[rgba(255,255,255,0.92)]",
        position === "active" && "z-30 opacity-100 ring-1 ring-[rgba(15,23,42,0.08)]",
        position === "previous" &&
          "z-20 opacity-80 hover:opacity-100",
        position === "next" &&
          "z-10 opacity-68 hover:opacity-95",
        position === "hidden" && "pointer-events-none z-0 opacity-0",
      )}
      style={{
        transform:
          position === "active"
            ? "translate(-50%, -50%) translateZ(86px) rotateX(0deg) rotateY(0deg)"
            : position === "previous"
              ? "translate(calc(-50% - clamp(2.75rem, 16vw, 7rem)), -50%) translateZ(-54px) rotateX(3deg) rotateY(16deg) scale(0.88)"
              : position === "next"
                ? "translate(calc(-50% + clamp(2.75rem, 16vw, 7rem)), -50%) translateZ(-92px) rotateX(3deg) rotateY(-16deg) scale(0.82)"
                : "translate(-50%, -50%) translateZ(-180px) scale(0.76)",
      }}
    >
      <div className="flex min-h-8 items-start justify-between gap-3">
        <p className="eyebrow">{card.label}</p>
        {card.integration ? (
          <IntegrationBadge
            compact
            kind={card.integration}
            className={card.integration === "arcium" ? "origin-top-right scale-[0.82]" : undefined}
          />
        ) : null}
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text)]">{card.subtitle}</p>
      <CarouselCardVisual card={card} />
    </button>
  );
}

function getDeckPosition(index: number, activeIndex: number) {
  const cardCount = STACK_CARDS.length;
  const previousIndex = (activeIndex - 1 + cardCount) % cardCount;
  const nextIndex = (activeIndex + 1) % cardCount;

  if (index === activeIndex) {
    return "active";
  }

  if (index === previousIndex) {
    return "previous";
  }

  if (index === nextIndex) {
    return "next";
  }

  return "hidden";
}

export function WorkspaceLandingPanel() {
  const { authActionPending, configured, login, ready } = useShadowPilotAuth();
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveCardIndex((current) => (current + 1) % STACK_CARDS.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [paused]);

  return (
    <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
      <article className="panel order-2 rounded-[34px] px-6 py-7 sm:px-8 sm:py-8 xl:order-1">
        <p className="eyebrow">ShadowPilot</p>
        <h3 className="mt-4 max-w-3xl text-[2.55rem] font-semibold tracking-tight text-[var(--text)]">
          The private human layer for robotics and physical AI.
        </h3>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
          Connect a wallet to unlock the live ShadowPilot workspace. Once signed in, buyers can post
          robotics tasks, pilots can claim them, and both sides can move through the submit, review,
          payout, and cNFT receipt flow on devnet.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={login}
            disabled={!configured || !ready || authActionPending}
            className="rounded-[18px] border border-[var(--brand-blue-strong)] bg-[var(--brand-blue)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.22)] transition hover:bg-[var(--brand-blue-strong)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {authActionPending ? "Connecting wallet" : ready ? "Connect to enter the workspace" : "Loading auth"}
          </button>
          <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text-muted)]">
            Built for Solana Colosseum Frontier
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {LANDING_POINTS.map((item) => (
            <div key={item.label} className="panel-muted rounded-[22px] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.detail}</p>
            </div>
          ))}
        </div>

      </article>

      <article className="panel order-1 relative overflow-hidden rounded-[34px] px-6 py-7 sm:px-8 sm:py-8 xl:order-2">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(241,245,249,0.76)_46%,rgba(235,239,246,0.86))]" />
        <div className="relative">
          <p className="eyebrow">Live flow stack</p>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-muted)]">
            Follow the demo from task setup through pilot handoff, private review, and receipt.
          </p>
        </div>

        <div
          className="relative mt-8 px-0 pb-2 pt-4"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative mx-auto h-[25rem] max-w-[35rem] overflow-visible [perspective:1300px] sm:h-[27rem]">
            <div className="absolute inset-x-6 bottom-10 h-24 rounded-[999px] bg-[linear-gradient(90deg,rgba(15,23,42,0.04),rgba(37,99,235,0.08),rgba(15,23,42,0.04))] blur-xl" />
            <div className="absolute inset-0 [transform-style:preserve-3d]">
              {STACK_CARDS.map((card, index) => {
                const position = getDeckPosition(index, activeCardIndex);
                return (
                  <CarouselCard
                    key={card.label}
                    active={index === activeCardIndex}
                    card={card}
                    onClick={() => setActiveCardIndex(index)}
                    position={position}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveCardIndex(
                    (current) => (current - 1 + STACK_CARDS.length) % STACK_CARDS.length,
                  )
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white text-lg text-[var(--text)] transition hover:bg-[var(--background-muted)]"
                aria-label="Previous stack card"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setActiveCardIndex((current) => (current + 1) % STACK_CARDS.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white text-lg text-[var(--text)] transition hover:bg-[var(--background-muted)]"
                aria-label="Next stack card"
              >
                ›
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {STACK_CARDS.map((card, index) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => setActiveCardIndex(index)}
                  className={clsx(
                    "h-2.5 rounded-full transition-all duration-300",
                    index === activeCardIndex
                      ? "w-9 bg-[var(--text)]"
                      : "w-2.5 bg-[rgba(15,23,42,0.18)] hover:bg-[rgba(15,23,42,0.32)]",
                  )}
                  aria-label={`Show ${card.label}`}
                />
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
