export const ROUNDS = 6;

export const NAIVE_SCORE_KEY = "median-illustration-naive-score";
export const NETWORK5_SCORE_KEY = "median-illustration-network5-score";
export const HISTOGRAM_SCORE_KEY = "median-illustration-histogram-score";
export const WALK_SCORE_KEY = "median-illustration-walk-score";

export function pointsForStreak(streak: number): number {
  return 10 + (streak - 1) * 5;
}

export function rankTitle(best: number): string {
  if (best >= 110) return "Hourglass";
  if (best >= 70) return "Network";
  if (best >= 30) return "Selector";
  return "Observer";
}

export function sessionRank(total: number): string {
  if (total >= 300) return "Hourglass";
  if (total >= 180) return "Network";
  if (total >= 60) return "Selector";
  return "Observer";
}

export function randomWindow(k: number, bins = 10): number[][] {
  return Array.from({ length: k }, () =>
    Array.from({ length: k }, () => Math.floor(Math.random() * bins)),
  );
}
