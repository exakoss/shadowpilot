import clsx from "clsx";

import {
  ROVER_BLOCKED_CELLS,
  ROVER_GOAL,
  ROVER_GRID_HEIGHT,
  ROVER_GRID_WIDTH,
  ROVER_START,
  type GridPoint,
} from "@/lib/rover-course";

function pointKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

export function LiveRoverGrid({
  collisionCount,
  roverPosition,
  stepCount,
  trace,
}: {
  collisionCount: number;
  roverPosition: GridPoint;
  stepCount: number;
  trace: GridPoint[];
}) {
  const visited = new Set(trace.map((point) => pointKey(point)));
  const cells = Array.from({ length: ROVER_GRID_WIDTH * ROVER_GRID_HEIGHT }, (_, index) => ({
    x: index % ROVER_GRID_WIDTH,
    y: Math.floor(index / ROVER_GRID_WIDTH),
  }));

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-[var(--line)] bg-[rgba(8,16,21,0.92)] p-3">
        <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[rgba(239,140,115,0.24)] bg-[rgba(239,140,115,0.14)] px-3 py-1 font-[var(--font-ibm-plex-mono)] text-[0.64rem] uppercase tracking-[0.16em] text-[var(--critical)]">
            Autonomy fault: pallet breach
          </span>
          <span className="rounded-full border border-[rgba(113,196,156,0.24)] bg-[rgba(113,196,156,0.14)] px-3 py-1 font-[var(--font-ibm-plex-mono)] text-[0.64rem] uppercase tracking-[0.16em] text-[var(--success)]">
            Goal: clear aisle and reach handoff zone
          </span>
        </div>

        <div
          className="grid h-full gap-1 pt-12"
          style={{
            gridTemplateColumns: `repeat(${ROVER_GRID_WIDTH}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell) => {
            const blocked = ROVER_BLOCKED_CELLS.some(
              (blockedCell) => blockedCell.x === cell.x && blockedCell.y === cell.y,
            );
            const goal = ROVER_GOAL.x === cell.x && ROVER_GOAL.y === cell.y;
            const rover = roverPosition.x === cell.x && roverPosition.y === cell.y;
            const start = ROVER_START.x === cell.x && ROVER_START.y === cell.y;
            const traversed = visited.has(pointKey(cell));

            return (
              <div
                key={pointKey(cell)}
                className={clsx(
                  "relative overflow-hidden rounded-[12px] border",
                  blocked
                    ? "border-[rgba(239,140,115,0.2)] bg-[rgba(239,140,115,0.16)]"
                    : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)]",
                )}
              >
                {traversed && !blocked ? (
                  <div className="absolute inset-[32%] rounded-full bg-[rgba(240,166,72,0.26)]" />
                ) : null}
                {start ? (
                  <div className="absolute inset-[16%] rounded-[12px] border border-[rgba(240,166,72,0.42)]" />
                ) : null}
                {goal ? (
                  <div className="absolute inset-[12%] rounded-[12px] border border-[rgba(113,196,156,0.42)] bg-[rgba(113,196,156,0.12)]" />
                ) : null}
                {rover ? (
                  <div className="absolute inset-[18%] rounded-[14px] bg-[var(--accent)] shadow-[0_0_30px_rgba(240,166,72,0.65)]" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-3 left-3 rounded-2xl border border-[var(--line)] bg-[rgba(8,16,21,0.78)] px-3 py-2">
          <p className="font-[var(--font-ibm-plex-mono)] text-[0.62rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Route quality
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text)]">
            {stepCount} steps · {collisionCount} collisions
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span className="rounded-full border border-[var(--line)] px-3 py-1">Start cell</span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1">Visited trace</span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1">Blocked pallet lane</span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1">Goal zone</span>
      </div>
    </div>
  );
}
