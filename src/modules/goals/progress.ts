export interface MilestoneLike {
  done: boolean;
}

/**
 * Goal progress, 0–100. With milestones it is the share completed; in manual mode it is whatever the
 * user set. Always an integer and always clamped so the UI never draws a bar past its track.
 */
export function computeGoalProgress(mode: "MANUAL" | "FROM_MILESTONES", manual: number, milestones: MilestoneLike[]): number {
  if (mode === "MANUAL") return clampPercent(manual);
  if (milestones.length === 0) return 0;
  return clampPercent((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

export const clampPercent = (n: number): number => Math.min(100, Math.max(0, Math.round(n)));
