"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { type WorkspaceNavIcon, type WorkspaceNavItem } from "@/lib/workspace-nav";

import { AuthSessionCard } from "./auth-session-card";
import { useShadowPilotAuth } from "./shadowpilot-auth-provider";
import { WorkspaceAuthControl } from "./workspace-auth-control";
import { WorkspaceLandingPanel } from "./workspace-landing-panel";
import { useWorkspaceRolePreference, WorkspaceRoleGate } from "./workspace-role-gate";

function WorkspaceIcon({
  active,
  icon,
}: {
  active: boolean;
  icon: WorkspaceNavIcon;
}) {
  const strokeClass = active ? "text-[var(--text)]" : "text-[var(--text-muted)]";

  switch (icon) {
    case "tasks":
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={clsx("h-4 w-4", strokeClass)}
        >
          <rect x="3" y="3" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="12" y="3" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="12" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "your":
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={clsx("h-4 w-4", strokeClass)}
        >
          <circle cx="5" cy="5" r="2" fill="currentColor" />
          <path d="M9 5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="5" cy="10" r="2" fill="currentColor" opacity="0.7" />
          <path d="M9 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="5" cy="15" r="2" fill="currentColor" opacity="0.45" />
          <path d="M9 15h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "activity":
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={clsx("h-4 w-4", strokeClass)}
        >
          <path
            d="M3 12h3l2-5 4 8 2-4h3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "settings":
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={clsx("h-4 w-4", strokeClass)}
        >
          <path
            d="M7 4.5h10M7 15.5h10M3 4.5h1M3 15.5h1M13 10h4M3 10h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="5.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="11.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="5.5" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

function RailToggle({
  label,
  onClick,
  open,
}: {
  label: string;
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--line)] bg-white text-[var(--text)] transition hover:bg-[var(--background-muted)]"
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        {open ? (
          <path
            d="M5 5l10 10M15 5L5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M4 6h12M4 10h12M4 14h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}

function RailCollapseToggle({
  collapsed,
  onClick,
  className,
}: {
  collapsed: boolean;
  onClick: () => void;
  className?: string;
}) {
  const label = collapsed ? "Expand navigation rail" : "Collapse navigation rail";

  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      onClick={onClick}
      className={clsx(
        "hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-white text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] transition hover:bg-[var(--background-muted)] hover:text-[var(--brand-blue-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)] lg:flex",
        className,
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path
          d={collapsed ? "M7.5 4.5L13 10l-5.5 5.5" : "M12.5 4.5L7 10l5.5 5.5"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function WorkspaceShell({
  children,
  defaultNavKey,
  description,
  eyebrow,
  navItems,
  requireConnection,
  sectionMeta,
  workspaceHeaderSections,
  title,
}: {
  children: React.ReactNode;
  defaultNavKey: string;
  description: string;
  eyebrow: string;
  navItems: readonly WorkspaceNavItem[];
  requireConnection?: boolean;
  sectionMeta?: Partial<
    Record<
      string,
      {
        icon: WorkspaceNavIcon;
        label: string;
      }
    >
  >;
  workspaceHeaderSections?: readonly string[];
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const { buildApiHeaders, connectedWallet, identityToken } = useShadowPilotAuth();
  const {
    chooseRole: chooseWorkspaceRole,
    ready: rolePreferenceReady,
    role: workspaceRole,
  } = useWorkspaceRolePreference({
    buildApiHeaders,
    connectedWallet,
    identityToken,
  });

  const activeSectionKey = useMemo(() => {
    const currentSection = searchParams.get("section");
    if (
      currentSection &&
      (navItems.some((item) => item.key === currentSection) || sectionMeta?.[currentSection])
    ) {
      return currentSection;
    }
    return defaultNavKey;
  }, [defaultNavKey, navItems, searchParams, sectionMeta]);

  const showLanding = Boolean(requireConnection && !connectedWallet);
  const showRoleGate = Boolean(requireConnection && connectedWallet && rolePreferenceReady && !workspaceRole);
  const showRoleLoading = Boolean(requireConnection && connectedWallet && !rolePreferenceReady);
  const displayedEyebrow = showLanding ? "ShadowPilot" : showRoleGate ? "ShadowPilot" : eyebrow;
  const displayedTitle = showLanding
    ? "Private robotics operations network"
    : showRoleGate
      ? "Choose buyer or pilot"
      : title;
  const displayedDescription = showLanding
    ? "Connect a Solana wallet to unlock live tasks, post robotics work, review pilot submissions, and move through the full ShadowPilot settlement flow."
    : showRoleGate
      ? "Select how this wallet should enter the demo before ShadowPilot opens a role-specific workspace."
    : description;
  const compactRail = railCollapsed && !mobileOpen;
  const showWorkspaceHeader =
    showLanding ||
    showRoleGate ||
    showRoleLoading ||
    !workspaceHeaderSections ||
    workspaceHeaderSections.includes(activeSectionKey);
  const shellStyle = {
    "--sidebar-width": railCollapsed ? "5.5rem" : "17rem",
  } as CSSProperties;

  useEffect(() => {
    if (!requireConnection || !connectedWallet || !workspaceRole) {
      return;
    }

    const targetPath = workspaceRole === "buyer" ? "/buyer" : "/pilot";
    const isRolePath = pathname === "/buyer" || pathname === "/pilot";
    if (pathname === "/" || (isRolePath && pathname !== targetPath)) {
      router.replace(`${targetPath}?section=all-tasks`);
    }
  }, [connectedWallet, pathname, requireConnection, router, workspaceRole]);

  return (
    <main className="page-shell">
      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <RailToggle
          label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((current) => !current)}
          open={mobileOpen}
        />
        <WorkspaceAuthControl className="max-w-[13rem]" />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[rgba(17,24,39,0.18)] backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <div
        className="lg:grid lg:gap-5 lg:[grid-template-columns:var(--sidebar-width)_minmax(0,1fr)]"
        style={shellStyle}
      >
        <aside
          className={clsx(
            "panel fixed inset-y-3 left-3 z-40 flex w-[17rem] flex-col rounded-[28px] p-3 transition-transform duration-200 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-full",
            mobileOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0",
            compactRail ? "lg:px-2.5" : "lg:px-3",
          )}
        >
          <div
            className={clsx(
              "flex items-center rounded-[20px] border border-transparent",
              compactRail ? "justify-center px-0 py-1" : "justify-between gap-3 px-2 py-1",
            )}
          >
            <div className={clsx("flex min-w-0 items-center", compactRail ? "justify-center" : "gap-3")}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
                <Image
                  src="/brands/shadowpilot-mark.svg"
                  alt=""
                  width={40}
                  height={40}
                  priority
                  className="h-full w-full"
                />
              </div>
              {!compactRail ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-[var(--text)]">
                    ShadowPilot
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">Private robotics ops</p>
                </div>
              ) : null}
            </div>

            {!compactRail ? (
              <RailCollapseToggle
                collapsed={false}
                onClick={() => setRailCollapsed(true)}
              />
            ) : null}

            {mobileOpen ? (
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--line)] bg-white text-[var(--text)] transition hover:bg-[var(--background-muted)] lg:hidden"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>

          {compactRail ? (
            <RailCollapseToggle
              collapsed
              onClick={() => setRailCollapsed(false)}
              className="mx-auto mt-3"
            />
          ) : null}

          {!compactRail ? <AuthSessionCard /> : null}

          <nav className="mt-4 grid gap-1.5">
            {navItems.map((item) => {
              const selected = item.key === activeSectionKey;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-label={item.label}
                  title={item.label}
                  className={clsx(
                    "group flex items-center rounded-[18px] border text-sm font-medium transition",
                    compactRail ? "justify-center px-0 py-3" : "gap-3 px-3 py-3",
                    selected
                      ? "border-[var(--line)] bg-[var(--background-muted)] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]"
                      : "border-transparent text-[var(--text-muted)] hover:border-[var(--line)] hover:bg-[var(--background-muted)] hover:text-[var(--text)]",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition",
                      selected
                        ? "border-[var(--line-strong)] bg-white"
                        : "border-transparent bg-[rgba(255,255,255,0.4)] group-hover:border-[var(--line)] group-hover:bg-white",
                    )}
                  >
                    <WorkspaceIcon active={selected} icon={item.icon} />
                  </span>
                  {!compactRail ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

        </aside>

        <section className="mt-5 flex min-w-0 flex-col gap-6 lg:mt-0">
          {showWorkspaceHeader ? (
            <header className="panel rounded-[28px] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="eyebrow">{displayedEyebrow}</p>
                  <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-[var(--text)]">
                    {displayedTitle}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                    {displayedDescription}
                  </p>
                </div>
                <div className="hidden lg:block">
                  <WorkspaceAuthControl />
                </div>
              </div>
            </header>
          ) : null}
          {showLanding ? <WorkspaceLandingPanel /> : null}
          {showRoleGate && connectedWallet ? (
            <WorkspaceRoleGate connectedWallet={connectedWallet} onChooseRole={chooseWorkspaceRole} />
          ) : null}
          {showRoleLoading ? (
            <div className="panel rounded-[28px] p-6 text-sm text-[var(--text-muted)]">
              Preparing workspace choice...
            </div>
          ) : null}
          {!showLanding && !showRoleGate && !showRoleLoading ? children : null}
        </section>
      </div>
    </main>
  );
}
