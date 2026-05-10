export type GridPoint = {
  x: number;
  y: number;
};

export const ROVER_GRID_WIDTH = 12;
export const ROVER_GRID_HEIGHT = 8;
export const ROVER_START: GridPoint = { x: 1, y: 6 };
export const ROVER_GOAL: GridPoint = { x: 10, y: 1 };
export const ROVER_BLOCKED_CELLS: GridPoint[] = [
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 3, y: 4 },
  { x: 3, y: 5 },
  { x: 5, y: 4 },
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 4 },
  { x: 6, y: 5 },
  { x: 7, y: 4 },
  { x: 8, y: 4 },
];

function pointKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

export function isBlockedCell(point: GridPoint) {
  return ROVER_BLOCKED_CELLS.some((cell) => cell.x === point.x && cell.y === point.y);
}

export function isInBounds(point: GridPoint) {
  return point.x >= 0 && point.x < ROVER_GRID_WIDTH && point.y >= 0 && point.y < ROVER_GRID_HEIGHT;
}

export function moveGridPoint(
  point: GridPoint,
  direction: "up" | "down" | "left" | "right",
): GridPoint {
  switch (direction) {
    case "up":
      return { x: point.x, y: point.y - 1 };
    case "down":
      return { x: point.x, y: point.y + 1 };
    case "left":
      return { x: point.x - 1, y: point.y };
    case "right":
      return { x: point.x + 1, y: point.y };
  }
}

function findBestPathSteps() {
  const queue: Array<{ point: GridPoint; steps: number }> = [{ point: ROVER_START, steps: 0 }];
  const visited = new Set<string>([pointKey(ROVER_START)]);

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      continue;
    }

    if (next.point.x === ROVER_GOAL.x && next.point.y === ROVER_GOAL.y) {
      return next.steps;
    }

    const neighbors = [
      { x: next.point.x + 1, y: next.point.y },
      { x: next.point.x - 1, y: next.point.y },
      { x: next.point.x, y: next.point.y + 1 },
      { x: next.point.x, y: next.point.y - 1 },
    ];

    for (const neighbor of neighbors) {
      const key = pointKey(neighbor);
      if (!isInBounds(neighbor) || isBlockedCell(neighbor) || visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({ point: neighbor, steps: next.steps + 1 });
    }
  }

  return 0;
}

export const ROVER_BEST_PATH_STEPS = findBestPathSteps();

export function computePathEfficiencyBps(stepCount: number) {
  if (stepCount <= 0 || ROVER_BEST_PATH_STEPS <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(10000, Math.round((ROVER_BEST_PATH_STEPS / Math.max(stepCount, ROVER_BEST_PATH_STEPS)) * 10000)),
  );
}
