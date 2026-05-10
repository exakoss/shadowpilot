export type WorkspaceNavIcon = "activity" | "settings" | "tasks" | "your";

export type WorkspaceNavItem = {
  href: string;
  icon: WorkspaceNavIcon;
  key: string;
  label: string;
};

export const buyerWorkspaceNav: readonly WorkspaceNavItem[] = [
  {
    href: "/buyer?section=all-tasks",
    icon: "tasks",
    key: "all-tasks",
    label: "All Tasks",
  },
  {
    href: "/buyer?section=your-tasks",
    icon: "your",
    key: "your-tasks",
    label: "Your Tasks",
  },
  {
    href: "/buyer?section=settings",
    icon: "settings",
    key: "settings",
    label: "Settings",
  },
] as const;

export const pilotWorkspaceNav: readonly WorkspaceNavItem[] = [
  {
    href: "/pilot?section=all-tasks",
    icon: "tasks",
    key: "all-tasks",
    label: "All Tasks",
  },
  {
    href: "/pilot?section=your-tasks",
    icon: "your",
    key: "your-tasks",
    label: "Your Tasks",
  },
  {
    href: "/pilot?section=settings",
    icon: "settings",
    key: "settings",
    label: "Settings",
  },
] as const;

export const overviewWorkspaceNav: readonly WorkspaceNavItem[] = [
  {
    href: "/?section=all-tasks",
    icon: "tasks",
    key: "all-tasks",
    label: "All Tasks",
  },
  {
    href: "/?section=network-activity",
    icon: "activity",
    key: "network-activity",
    label: "Network Activity",
  },
  {
    href: "/?section=settings",
    icon: "settings",
    key: "settings",
    label: "Settings",
  },
] as const;
