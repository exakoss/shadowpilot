import Image from "next/image";
import clsx from "clsx";

export type IntegrationKind = "arcium" | "world";

const integrationConfig = {
  arcium: {
    badgeClass:
      "border-[rgba(241,161,255,0.38)] bg-[linear-gradient(135deg,#6d45ff,#3c1f9d)] text-white shadow-[0_12px_28px_rgba(109,69,255,0.24)]",
    cardClass:
      "border-[rgba(109,69,255,0.18)] bg-[linear-gradient(135deg,rgba(241,236,255,0.98),rgba(255,255,255,0.94))]",
    description:
      "Arcium seals the confidential review package so ShadowPilot can write score, payout, and reputation-safe commitments without exposing the full settlement context onchain.",
    eyebrow: "Sealed review",
    label: "Arcium",
    logoShellClass:
      "border-[rgba(241,161,255,0.38)] bg-[linear-gradient(135deg,#6d45ff,#3c1f9d)] shadow-[0_14px_28px_rgba(109,69,255,0.24)]",
    compactLogoClass: "h-[0.92rem] w-auto max-w-none",
    fullLogoClass: "h-[1.16rem] w-auto max-w-[10rem]",
    logoSrc: "/brands/arcium-logo.svg",
    logomarkClass: "h-5 w-auto",
    logomarkSrc: "/brands/arcium-logomark.svg",
  },
  world: {
    badgeClass:
      "border-[rgba(45,44,44,0.14)] bg-[rgba(249,249,248,0.98)] text-[var(--world-ink)]",
    cardClass:
      "border-[rgba(45,44,44,0.12)] bg-[linear-gradient(135deg,rgba(249,249,248,0.98),rgba(255,255,255,0.92))]",
    description:
      "World ID lets buyers gate tasks for unique humans, so pilots can prove they are real people before they claim human-verified robotics work.",
    eyebrow: "Unique human gating",
    label: "World ID",
    logoShellClass:
      "border-[rgba(45,44,44,0.12)] bg-[var(--world-soft)] shadow-[0_10px_24px_rgba(45,44,44,0.08)]",
    compactLogoClass: "h-[1.22rem] w-auto max-w-none",
    fullLogoClass: "h-[1.52rem] w-auto max-w-[9rem]",
    logoSrc: "/brands/world-logo.svg",
    logomarkClass: "h-5 w-auto",
    logomarkSrc: "/brands/world-logomark.svg",
  },
} as const;

function IntegrationMark({
  className,
  kind,
  variant = "logomark",
}: {
  className?: string;
  kind: IntegrationKind;
  variant?: "logo" | "logomark";
}) {
  const config = integrationConfig[kind];
  const src = variant === "logo" ? config.logoSrc : config.logomarkSrc;

  return (
    <Image
      alt=""
      aria-hidden="true"
      className={clsx(
        variant === "logo" ? config.fullLogoClass : config.logomarkClass,
        className,
      )}
      draggable={false}
      src={src}
      width={variant === "logo" ? 403 : 32}
      height={variant === "logo" ? 46 : 20}
      unoptimized
    />
  );
}

export function IntegrationBadge({
  className,
  compact = false,
  kind,
  label,
}: {
  className?: string;
  compact?: boolean;
  kind: IntegrationKind;
  label?: string;
}) {
  const config = integrationConfig[kind];

  if (kind === "arcium") {
    const accessibleLabel = `${label ?? config.label} ${config.eyebrow}`;

    return (
      <span
        aria-label={accessibleLabel}
        className={clsx(
          "inline-flex items-center justify-center rounded-full border",
          compact ? "min-h-8 px-2.5 py-1" : "min-h-9 px-3.5 py-1.5",
          config.badgeClass,
          className,
        )}
      >
        <IntegrationMark
          kind={kind}
          variant="logo"
          className={compact ? config.compactLogoClass : config.fullLogoClass}
        />
      </span>
    );
  }

  if (compact) {
    return (
      <span
        className={clsx(
          "inline-flex min-h-8 items-center rounded-full border px-2 py-1",
          config.badgeClass,
          className,
        )}
      >
        <IntegrationMark kind={kind} variant="logo" className={config.compactLogoClass} />
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
        config.badgeClass,
        className,
      )}
    >
      <span
        className={clsx(
          "inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-1.5",
          config.logoShellClass,
        )}
      >
        <IntegrationMark kind={kind} />
      </span>
      <span>{label ?? config.label}</span>
      <span className="opacity-70">{config.eyebrow}</span>
    </span>
  );
}

export function IntegrationCard({
  className,
  description,
  kind,
  title,
}: {
  className?: string;
  description?: string;
  kind: IntegrationKind;
  title: string;
}) {
  const config = integrationConfig[kind];

  return (
    <article className={clsx("rounded-[24px] border p-4", config.cardClass, className)}>
      <div className="flex items-center justify-between gap-3">
        <div
          className={clsx(
            "inline-flex min-h-13 items-center rounded-[18px] border px-4 py-2.5",
            config.logoShellClass,
          )}
        >
          <IntegrationMark kind={kind} variant="logo" />
        </div>
        <span className="eyebrow">{config.eyebrow}</span>
      </div>
      <h4 className="mt-4 text-base font-semibold text-[var(--text)]">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
        {description ?? config.description}
      </p>
    </article>
  );
}
