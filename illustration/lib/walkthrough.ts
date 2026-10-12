export type LessonMode = "scalar" | "vector";
export type TeachingVlmax = 2 | 4 | 8;

export const TEACHING_VLMAX: TeachingVlmax[] = [2, 4, 8];

export function setTeachingVl(remaining: number, vlmax: TeachingVlmax): number {
  return Math.min(remaining, vlmax);
}
