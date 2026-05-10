import { Suspense } from "react";

import { OverviewConsole } from "@/components/overview-console";
import { WorkspaceShell } from "@/components/workspace-shell";
import { overviewWorkspaceNav } from "@/lib/workspace-nav";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="page-shell" />}>
      <WorkspaceShell
        defaultNavKey="all-tasks"
        eyebrow="Overview"
        navItems={overviewWorkspaceNav}
        requireConnection
        title="Robotics network overview"
        description="Browse the live ShadowPilot task network, compare remote robot ops against humanoid capture, and jump into the buyer or pilot workspaces without carrying all of their controls on one screen."
      >
        <OverviewConsole />
      </WorkspaceShell>
    </Suspense>
  );
}
