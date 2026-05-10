import { Suspense } from "react";

import { BuyerConsole } from "@/components/buyer-console";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buyerWorkspaceNav } from "@/lib/workspace-nav";

export default function BuyerPage() {
  return (
    <Suspense fallback={<div className="page-shell" />}>
      <WorkspaceShell
        defaultNavKey="all-tasks"
        eyebrow="Buyer"
        navItems={buyerWorkspaceNav}
        requireConnection
        sectionMeta={{ task: { icon: "tasks", label: "Task detail" } }}
        title="Buyer workspace"
        description="Post a robotics task with a required control or upload link, then review the pilot submission package and release payout once the result meets the brief."
        workspaceHeaderSections={["your-tasks"]}
      >
        <BuyerConsole />
      </WorkspaceShell>
    </Suspense>
  );
}
