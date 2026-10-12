import {
  HISTOGRAM_K,
  HISTOGRAM_SCENE,
  NETWORK5_SCENE,
  histogramFrames,
  naiveMedian,
  network5,
  rankThreshold,
  type Cell,
  type HistFrame,
} from "@/lib/median/model";

/** 5 columns by 4 rows. A 3×3 window fits six centers: rows 1–2, columns 1–3. */
export const NAIVE_IMAGE: number[][] = [
  [1, 4, 2, 8, 0],
  [3, 9, 5, 1, 2],
  [2, 6, 4, 3, 7],
  [0, 1, 2, 5, 1],
];

export type NaiveSlide = {
  y: number;
  x: number;
  samples: number[];
  sorted: number[];
  median: number;
  watching: string;
  changed: string;
};

/** Row-major interior scan. Each stop is one full naive window: gather, sort, write. */
export function naiveSlides(image: number[][], k = 3): NaiveSlide[] {
  const radius = (k - 1) / 2;
  const height = image.length;
  const width = image[0]?.length ?? 0;
  const th = rankThreshold(k);
  const slides: NaiveSlide[] = [];

  for (let y = radius; y < height - radius; y += 1) {
    for (let x = radius; x < width - radius; x += 1) {
      const samples: number[] = [];
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          samples.push(image[y + dy][x + dx]);
        }
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[th];
      if (median !== naiveMedian(samples)) {
        throw new Error(`naive slide (${y},${x}) rank drifted`);
      }
      const prev = slides[slides.length - 1];
      const move = prev
        ? prev.y === y
          ? `The window steps right, from (${prev.y}, ${prev.x}) to (${y}, ${x}).`
          : `The row ends. The window steps down, from (${prev.y}, ${prev.x}) to (${y}, ${x}).`
        : `Start at center (${y}, ${x}). The 3×3 covers rows ${y - radius}–${y + radius} and columns ${x - radius}–${x + radius}.`;
      const salt = samples.some((value) => value >= 9)
        ? " The 9 sorts to the end, so it is not written."
        : "";
      slides.push({
        y,
        x,
        samples,
        sorted,
        median,
        watching: `${move} samples[${th}] = ${median}, written at out[${y}][${x}].${salt}`,
        changed: `out[${y}][${x}] = ${median}`,
      });
    }
  }

  return slides;
}

export type Tone = "plain" | "focus" | "drop" | "a" | "b" | "c" | "keep";

export type GridCell = {
  value: number | null;
  tone: Tone;
  badge?: string;
};

export type DiagonalLane = {
  caption: string;
  values: number[];
  keep: number | null;
  compare: number | null;
};

export type Network5Step = {
  id: string;
  fn: string;
  watching: string;
  snippet: string;
  highlightLine: number;
  changed: string;
  rows: GridCell[][];
  before?: GridCell[][];
  aside: string;
  lanes?: DiagonalLane[];
};

export type HistLessonStep = {
  id: string;
  fn: string;
  watching: string;
  snippet: string;
  highlightLine: number;
  changed: string;
  frame: HistFrame;
  phase: "init" | "leave" | "enter" | "adjust";
  hist: number[];
  mdn: number;
  ltmdn: number;
  /** Bins whose count just changed, drawn with an outline. */
  marks: number[];
};

const ROW_SNIPPET = `std::sort(row, row + 5);
// ascending, small at the left`;

const DIAG_SNIPPET = `A = max(cells where i + j == 3);
B = median(cells where i + j == 4); // rank 2 of 5
C = min(cells where i + j == 5);`;

const FINAL5_SNIPPET = `out = median3(A, B, C);
// same rank as samples[12] after a full sort of 25`;

const COLUMN_NOTE = [
  "two largest, at rows 3 and 4",
  "three largest, at rows 2, 3, and 4",
  "middle three, at rows 1, 2, and 3",
  "three smallest, at rows 0, 1, and 2",
  "two smallest, at rows 0 and 1",
];

function numbered(rows: number[][], focusRow: number | null): GridCell[][] {
  return rows.map((row, r) =>
    row.map((value) => ({
      value,
      tone: focusRow === r ? "focus" : "plain",
    })),
  );
}

function partialGrid(grid: Cell[][], throughCol: number): GridCell[][] {
  return grid.map((row) =>
    row.map((value, c) => ({
      value: c <= throughCol ? value : null,
      tone: c === throughCol && value !== null ? "focus" : value === null || c > throughCol ? "drop" : "plain",
    })),
  );
}

function diagonalGrid(grid: Cell[][]): GridCell[][] {
  return grid.map((row, i) =>
    row.map((value, j) => {
      if (value === null) {
        return { value, tone: "drop" as const };
      }
      const sum = i + j;
      if (sum === 3) {
        return { value, tone: "a" as const };
      }
      if (sum === 4) {
        return { value, tone: "b" as const };
      }
      if (sum === 5) {
        return { value, tone: "c" as const };
      }
      return { value, tone: "drop" as const };
    }),
  );
}

type Path = ReadonlyArray<readonly [number, number]>;

/** Low end first, so an ascending sort parks the maximum at the last cell. */
const SUPER_PATH: Path = [
  [3, 0],
  [2, 1],
  [1, 2],
  [0, 3],
];
const MAIN_PATH: Path = [
  [4, 0],
  [3, 1],
  [2, 2],
  [1, 3],
  [0, 4],
];
const SUB_PATH: Path = [
  [4, 1],
  [3, 2],
  [2, 3],
  [1, 4],
];

function cellsOf(grid: Cell[][], path: Path): number[] {
  return path.map(([row, col]) => {
    const value = grid[row][col];
    if (value === null) {
      throw new Error(`diagonal hole at ${row},${col}`);
    }
    return value;
  });
}

function columnSourceGrid(sortedRows: number[][], column: number): GridCell[][] {
  return sortedRows.map((row) =>
    row.map((value, c) => ({
      value,
      tone: c === column ? "focus" : "plain",
    })),
  );
}

function resultGrid(grid: Cell[][]): GridCell[][] {
  const marks = new Map<string, string>([
    ["0,3", "A"],
    ["2,2", "B"],
    ["4,1", "C"],
  ]);
  return diagonalGrid(grid).map((row, r) =>
    row.map((cell, c) => {
      const badge = marks.get(`${r},${c}`);
      if (!badge) {
        return cell;
      }
      return { ...cell, tone: "keep", badge };
    }),
  );
}

export function network5Steps(): Network5Step[] {
  const solved = network5(NETWORK5_SCENE);
  const steps: Network5Step[] = [
    {
      id: "raw",
      fn: "MedianFilter5x5",
      watching:
        "25 samples, rank th = 12. The 9 at row 0, column 0 is salt. A full sort would put it at the end, so it cannot be the median.",
      snippet: `const int th = (5 * 5) / 2; // 12
// naive: sort 25, read samples[th]`,
      highlightLine: 0,
      changed: "window is still in image order",
      rows: numbered(NETWORK5_SCENE, null),
      aside: "Naive cost is a 25-sort on every pixel. The network keeps only the cells that can still be the median.",
    },
  ];

  const progressive = NETWORK5_SCENE.map((row) => [...row]);
  for (let r = 0; r < 5; r += 1) {
    progressive[r] = solved.sortedRows[r];
    steps.push({
      id: `row-${r}`,
      fn: "SortRow",
      watching: `Row ${r} sorted small-at-left: [${solved.sortedRows[r].join(", ")}].`,
      snippet: ROW_SNIPPET,
      highlightLine: 0,
      changed: `row ${r} = [${solved.sortedRows[r].join(", ")}]`,
      rows: numbered(progressive, r),
      aside: "Each new scanline sorts one row of 5 and reuses the rows already sorted above it.",
    });
  }

  for (let c = 0; c < 5; c += 1) {
    const source = solved.sortedRows.map((row) => row[c]);
    const placed = solved.grid
      .map((row) => row[c])
      .filter((value): value is number => value !== null);
    steps.push({
      id: `col-${c}`,
      fn: "PartialColumn",
      watching: `Column ${c} before selection is [${source.join(", ")}], top to bottom. It keeps its ${COLUMN_NOTE[c]}. Placed values [${placed.join(", ")}], small at the top.`,
      snippet: `// column ${c} before: [${source.join(", ")}]
// keep ${COLUMN_NOTE[c]}`,
      highlightLine: 0,
      changed: `column ${c} placed [${placed.join(", ")}]`,
      before: columnSourceGrid(solved.sortedRows, c),
      rows: partialGrid(solved.grid, c),
      aside: "The gold column is the original values. Unused cells after selection are the hyperbolic slices: too small or too large to be the median.",
    });
  }

  const superValues = cellsOf(solved.grid, SUPER_PATH);
  const mainValues = cellsOf(solved.grid, MAIN_PATH);
  const subValues = cellsOf(solved.grid, SUB_PATH);
  const mainSorted = [...mainValues].sort((a, b) => a - b);
  if (superValues[superValues.length - 1] !== solved.a || mainSorted[2] !== solved.b || subValues[0] !== solved.c) {
    throw new Error("diagonal statistics are not parked at the expected ranks");
  }

  steps.push({
    id: "diags",
    fn: "AntiDiagonals",
    watching: `Super-diagonal maximum A = ${solved.a}. Main-diagonal median B = ${solved.b}. Sub-diagonal minimum C = ${solved.c}.`,
    snippet: DIAG_SNIPPET,
    highlightLine: 1,
    changed: `A ${solved.a}, B ${solved.b}, C ${solved.c}`,
    rows: resultGrid(solved.grid),
    aside: "One read from each diagonal. The marked cell is the value that read produces.",
    lanes: [
      {
        caption: "Super-diagonal i+j=3, last rank is the maximum",
        values: superValues,
        keep: superValues.length - 1,
        compare: null,
      },
      {
        caption: "Main diagonal i+j=4, rank 2 is the median",
        values: mainSorted,
        keep: 2,
        compare: null,
      },
      {
        caption: "Sub-diagonal i+j=5, first rank is the minimum",
        values: subValues,
        keep: 0,
        compare: null,
      },
    ],
  });

  steps.push({
    id: "median",
    fn: "FinalMedian",
    watching: `median3(${solved.a}, ${solved.b}, ${solved.c}) = ${solved.median}. That is the median of the original 25.`,
    snippet: FINAL5_SNIPPET,
    highlightLine: 0,
    changed: `out = ${solved.median}`,
    rows: resultGrid(solved.grid),
    aside: "The median of A, B, and C is the pixel.",
    lanes: [
      {
        caption: "median3(A, B, C)",
        values: [solved.a, solved.b, solved.c],
        keep: [solved.a, solved.b, solved.c].indexOf(solved.median),
        compare: null,
      },
    ],
  });

  return steps;
}

const INIT_SNIPPET = `const int th = (k * k) / 2;
histogram[val] += 1;          // every sample in the first window
// walk bins until the count passes th → mdn, ltmdn`;

const LEAVE_SNIPPET = `histogram[leaving] -= 1;
if (leaving < mdn) ltmdn -= 1;`;

const ENTER_SNIPPET = `histogram[entering] += 1;
if (entering < mdn) ltmdn += 1;`;

const ADJUST_SNIPPET = `while (ltmdn > th) {
    mdn -= 1;
    ltmdn -= histogram[mdn];
}
while (ltmdn + histogram[mdn] <= th) {
    ltmdn += histogram[mdn];
    mdn += 1;
}`;

function centerOf(frame: HistFrame): string {
  const radius = (HISTOGRAM_K - 1) / 2;
  return `(${frame.y + radius}, ${frame.x + radius})`;
}

function bumpHist(hist: number[], values: number[], mdn: number, ltmdn: number, sign: 1 | -1) {
  const next = hist.slice();
  let less = ltmdn;
  for (const value of values) {
    next[value] += sign;
    if (value < mdn) {
      less += sign;
    }
  }
  return { hist: next, ltmdn: less };
}

function binChange(before: number[], values: number[], sign: 1 | -1): string {
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    const times = values.filter((item) => item === value).length;
    parts.push(`${value}: ${before[value]} → ${before[value] + sign * times}`);
  }
  return parts.join(", ");
}

function sameHist(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((count, index) => count === b[index]);
}

export function histogramLessonSteps(): HistLessonStep[] {
  const frames = histogramFrames(HISTOGRAM_SCENE, HISTOGRAM_K);
  const steps: HistLessonStep[] = [];
  let previous = frames[0];
  if (!previous) {
    return steps;
  }

  frames.forEach((frame, index) => {
    const center = centerOf(frame);
    if (frame.kind === "init") {
      steps.push({
        id: `init-${index}`,
        fn: "MedianFilterHistogram",
        watching: `Center ${center}. Walk the bins until the count passes th ${frame.th}. mdn = ${frame.mdn}, ltmdn = ${frame.ltmdn}.`,
        snippet: INIT_SNIPPET,
        highlightLine: 2,
        changed: `mdn = ${frame.mdn}, ltmdn = ${frame.ltmdn}`,
        frame,
        phase: "init",
        hist: frame.hist,
        mdn: frame.mdn,
        ltmdn: frame.ltmdn,
        marks: [],
      });
      previous = frame;
      return;
    }

    const mdn = frame.mdnBefore;
    const left = bumpHist(previous.hist, frame.removed, mdn, previous.ltmdn, -1);
    const entered = bumpHist(left.hist, frame.added, mdn, left.ltmdn, 1);
    if (entered.ltmdn !== frame.ltmdnBefore || !sameHist(entered.hist, frame.hist) || previous.mdn !== mdn) {
      throw new Error(`histogram lesson drifted at center ${center}`);
    }

    const motion =
      frame.kind === "slide-v"
        ? "The window steps down: the top row leaves and the bottom row enters."
        : frame.dir === 1
          ? "The window steps right: the left column leaves and a new right column enters."
          : "The window steps left: the right column leaves and a new left column enters.";

    steps.push({
      id: `leave-${index}`,
      fn: "HistogramLeave",
      watching: `${motion} Leaving [${frame.removed.join(", ")}]. Bins ${binChange(previous.hist, frame.removed, -1)}. mdn stays ${mdn}. ltmdn ${previous.ltmdn} → ${left.ltmdn}.`,
      snippet: LEAVE_SNIPPET,
      highlightLine: frame.removed.some((value) => value < mdn) ? 1 : 0,
      changed: `ltmdn = ${left.ltmdn}`,
      frame,
      phase: "leave",
      hist: left.hist,
      mdn,
      ltmdn: left.ltmdn,
      marks: [...new Set(frame.removed)],
    });

    steps.push({
      id: `enter-${index}`,
      fn: "HistogramEnter",
      watching: `Entering [${frame.added.join(", ")}]. Bins ${binChange(left.hist, frame.added, 1)}. mdn stays ${mdn}. ltmdn ${left.ltmdn} → ${entered.ltmdn}.`,
      snippet: ENTER_SNIPPET,
      highlightLine: frame.added.some((value) => value < mdn) ? 1 : 0,
      changed: `ltmdn = ${entered.ltmdn}`,
      frame,
      phase: "enter",
      hist: entered.hist,
      mdn,
      ltmdn: entered.ltmdn,
      marks: [...new Set(frame.added)],
    });

    const covered = entered.ltmdn + entered.hist[mdn];
    const stayed = frame.moves.length === 0;
    steps.push({
      id: `adjust-${index}`,
      fn: "SelectMedian",
      watching: stayed
        ? `Select the median at center ${center}. ltmdn ${entered.ltmdn} is not above th ${frame.th}, and ltmdn + histogram[${mdn}] = ${covered} is above th, so mdn stays ${frame.mdn}.`
        : `Select the median at center ${center}. mdn walks ${frame.moves.join(" then ")} from ${mdn} to ${frame.mdn}, until ltmdn ${frame.ltmdn} ≤ th ${frame.th} and ltmdn + histogram[${frame.mdn}] > th.`,
      snippet: ADJUST_SNIPPET,
      highlightLine: frame.moves.includes("down") ? 1 : frame.moves.includes("up") ? 5 : 0,
      changed: `mdn = ${frame.mdn}, ltmdn = ${frame.ltmdn}`,
      frame,
      phase: "adjust",
      hist: frame.hist,
      mdn: frame.mdn,
      ltmdn: frame.ltmdn,
      marks: [],
    });
    previous = frame;
  });
  return steps;
}

export function histogramBinLimit(hist: number[]): number {
  let last = 9;
  for (let value = hist.length - 1; value >= 0; value -= 1) {
    if (hist[value] > 0) {
      last = Math.max(9, value);
      break;
    }
  }
  return last;
}

