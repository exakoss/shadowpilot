import clsx from "clsx";

import { getTaskLaneDefinition, type TaskLaneId } from "@/lib/task-lane";

const laneStyles: Record<TaskLaneId, string> = {
  humanoid_capture:
    "border-[rgba(56,124,171,0.24)] bg-[rgba(56,124,171,0.1)] text-[#2f6792]",
  remote_operation:
    "border-[rgba(218,123,35,0.24)] bg-[rgba(218,123,35,0.1)] text-[var(--accent-soft)]",
};

export function TaskLanePill({
  compact = false,
  laneId,
}: {
  compact?: boolean;
  laneId: TaskLaneId;
}) {
  const lane = getTaskLaneDefinition(laneId);

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
        laneStyles[laneId],
      )}
    >
      {compact ? lane.shortLabel : lane.label}
    </span>
  );
}
