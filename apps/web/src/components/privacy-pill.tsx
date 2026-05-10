import clsx from "clsx";

export type PrivacyScope = "public" | "buyer" | "pilot" | "shared";

const scopeMap: Record<PrivacyScope, string> = {
  public:
    "border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] text-[var(--text-muted)]",
  buyer:
    "border-[rgba(55,65,81,0.12)] bg-[rgba(55,65,81,0.06)] text-[var(--text)]",
  pilot:
    "border-[rgba(71,85,105,0.12)] bg-[rgba(71,85,105,0.06)] text-[var(--text)]",
  shared:
    "border-[rgba(100,116,139,0.14)] bg-[rgba(100,116,139,0.08)] text-[var(--accent-soft)]",
};

const defaultLabels: Record<PrivacyScope, string> = {
  public: "Public onchain",
  buyer: "Private to buyer",
  pilot: "Private to pilot",
  shared: "Shared private handoff",
};

export function PrivacyPill({
  label,
  scope,
}: {
  label?: string;
  scope: PrivacyScope;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
        scopeMap[scope],
      )}
    >
      {label ?? defaultLabels[scope]}
    </span>
  );
}
