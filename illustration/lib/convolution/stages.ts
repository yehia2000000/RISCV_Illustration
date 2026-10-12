export type StageId = "naive" | "separable" | "enhanced";

export const STAGES: { id: StageId; label: string }[] = [
  { id: "naive", label: "1. Naive" },
  { id: "separable", label: "2. Separable" },
  { id: "enhanced", label: "3. Enhanced" },
];
