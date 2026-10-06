export type VectorStageId = "lanes" | "rvv";

export const VECTOR_STAGES: { id: VectorStageId; label: string }[] = [
  { id: "lanes", label: "1. Scalar → Vector" },
  { id: "rvv", label: "2. RVV kernel" },
];
