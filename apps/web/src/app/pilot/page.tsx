import { Suspense } from "react";

import { PilotConsole } from "@/components/pilot-console";
import { WorkspaceShell } from "@/components/workspace-shell";
import { pilotWorkspaceNav } from "@/lib/workspace-nav";

export default function PilotPage() {
  return (
    <Suspense fallback={<div className="page-shell" />}>
      <WorkspaceShell
        defaultNavKey="all-tasks"
        eyebrow="Pilot"
        navItems={pilotWorkspaceNav}
        requireConnection
        sectionMeta={{ task: { icon: "tasks", label: "Task detail" } }}
        title="Pilot workspace"
        description="Browse claimable work, open the buyer-provided control or upload link, run a local takeover or local clip capture, and submit the compact package back to the buyer."
        workspaceHeaderSections={["your-tasks"]}
      >
        <PilotConsole />
      </WorkspaceShell>
    </Suspense>
  );
}
