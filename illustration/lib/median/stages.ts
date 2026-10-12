export type MedianStageId = "inputs" | "columns" | "extrema" | "final";

export const MEDIAN_STAGES: { id: MedianStageId; label: string }[] = [
  { id: "inputs", label: "1. Inputs" },
  { id: "columns", label: "2. Column sort" },
  { id: "extrema", label: "3. Row extrema" },
  { id: "final", label: "4. Final median" },
];
