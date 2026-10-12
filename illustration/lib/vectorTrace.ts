export type Lane = {
  lane: number;
  value: string;
  active: boolean;
  highlight?: boolean;
};

export type MemoryCell = {
  index: number;
  label: string;
  value: string;
  highlight?: boolean;
  changed?: boolean;
};

export type RegisterView = {
  name: string;
  kind: "vector" | "mask" | "scalar";
  lanes?: Lane[];
  scalar?: string;
};

export type MemoryView = {
  name: string;
  hint?: string;
  cells: MemoryCell[];
};

export type VectorStep = {
  id: string;
  fn: string;
  helper: string;
  intrinsic: string;
  snippet: string;
  highlightLine: number;
  watching: string;
  whatItDoes: string;
  whyNeeded: string;
  laneRule: string;
  changed: string;
  sewmLmul: string;
  remaining: number;
  offset: number;
  vl: number;
  vlmax: number;
  strip: number;
  registers: RegisterView[];
  memories: MemoryView[];
  flow?: string;
  checkpoint?: { label: string; ok: boolean; detail: string };
};
