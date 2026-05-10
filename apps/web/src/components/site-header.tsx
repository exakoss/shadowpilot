import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/", label: "Overview", key: "overview" },
  { href: "/buyer", label: "Buyer", key: "buyer" },
  { href: "/pilot", label: "Pilot", key: "pilot" },
] as const;

type HeaderKey = (typeof links)[number]["key"];

export function SiteHeader({ current }: { current: HeaderKey }) {
  return (
    <header className="panel flex flex-col gap-4 rounded-[28px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-black">
          <Image
            src="/brands/shadowpilot-mark.svg"
            alt=""
            width={44}
            height={44}
            priority
            className="h-full w-full"
          />
        </div>
        <div>
          <p className="eyebrow">Private Human Layer</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">ShadowPilot</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Remote robot operations and humanoid capture workflows on Solana.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm transition",
              current === link.key
                ? "border-[var(--line-strong)] bg-[rgba(218,123,35,0.1)] text-[var(--text)]"
                : "border-[var(--line)] text-[var(--text-muted)] hover:border-[rgba(23,33,44,0.18)] hover:text-[var(--text)]",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
