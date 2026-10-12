/** Scalar median helpers for the illustration session.
 *  3×3 selection network: review section 2.
 *  5×5 partial columns + three anti-diagonals: median 5×5 plan.
 *  Running histogram + zigzag: histogram plan (review section 4).
 */

export const HIST_BINS = 256;

export function rankThreshold(k: number): number {
  return Math.floor((k * k) / 2);
}

export function naiveMedian(values: number[]): number {
  if (values.length === 0) {
    throw new Error("naiveMedian of empty window");
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(values.length / 2)];
}

export function median3(a: number, b: number, c: number): number {
  return a + b + c - Math.min(a, b, c) - Math.max(a, b, c);
}

/** Ascending 3-sort. Compare-swap order is (0,1), (1,2), (0,1). */
export function sort3Network(values: [number, number, number]): [number, number, number] {
  const v: [number, number, number] = [...values];
  const swap = (i: 0 | 1 | 2, j: 0 | 1 | 2) => {
    if (v[i] > v[j]) {
      const t = v[i];
      v[i] = v[j];
      v[j] = t;
    }
  };
  swap(0, 1);
  swap(1, 2);
  swap(0, 1);
  return v;
}

export type ColumnSort = {
  before: [number, number, number];
  after: [number, number, number];
};

/** One scanline, height 3. Each column is sorted small-at-top. */
export function sortColumns3(rows: number[][]): ColumnSort[] {
  const width = rows[0]?.length ?? 0;
  if (rows.length !== 3 || rows.some((row) => row.length !== width)) {
    throw new Error("sortColumns3 expects 3 equal rows");
  }
  const out: ColumnSort[] = [];
  for (let x = 0; x < width; x += 1) {
    const before: [number, number, number] = [rows[0][x], rows[1][x], rows[2][x]];
    out.push({ before, after: sort3Network(before) });
  }
  return out;
}

export function sortedRowsFromColumns(columns: ColumnSort[]): number[][] {
  return [0, 1, 2].map((row) => columns.map((column) => column.after[row]));
}

export type WindowExtrema = {
  x: number;
  top: number;
  mid: number;
  bot: number;
  median: number;
};

/** Max of the top row, median of the middle, min of the bottom, across 3 sorted columns. */
export function extremaAt(sortedRows: number[][], x: number): WindowExtrema {
  const top = Math.max(sortedRows[0][x], sortedRows[0][x + 1], sortedRows[0][x + 2]);
  const mid = median3(sortedRows[1][x], sortedRows[1][x + 1], sortedRows[1][x + 2]);
  const bot = Math.min(sortedRows[2][x], sortedRows[2][x + 1], sortedRows[2][x + 2]);
  return { x, top, mid, bot, median: median3(top, mid, bot) };
}

export function network3Row(rows: number[][]): WindowExtrema[] {
  const sorted = sortedRowsFromColumns(sortColumns3(rows));
  const outputs = rows[0].length - 2;
  return Array.from({ length: outputs }, (_, x) => extremaAt(sorted, x));
}

export function windowSamples(rows: number[][], x: number, k = 3): number[] {
  const values: number[] = [];
  for (let dy = 0; dy < k; dy += 1) {
    for (let dx = 0; dx < k; dx += 1) {
      values.push(rows[dy][x + dx]);
    }
  }
  return values;
}

/** Interior 3-row image used by the walkthrough. Four overlapping 3×3 windows. */
export const COLUMN_SCENE: number[][] = [
  [4, 9, 1, 3, 2, 8],
  [5, 2, 6, 1, 4, 0],
  [3, 7, 2, 5, 1, 6],
];

export type Cell = number | null;

export type Network5 = {
  sortedRows: number[][];
  grid: Cell[][];
  diagA: number[];
  diagB: number[];
  diagC: number[];
  a: number;
  b: number;
  c: number;
  median: number;
};

/** 5×5 separable network. Rows sorted small-at-left, then partial column ranks. */
export function network5(window: number[][]): Network5 {
  if (window.length !== 5 || window.some((row) => row.length !== 5)) {
    throw new Error("network5 expects a 5×5 window");
  }
  const sortedRows = window.map((row) => [...row].sort((a, b) => a - b));
  const grid: Cell[][] = Array.from({ length: 5 }, () => Array<Cell>(5).fill(null));

  for (let c = 0; c < 5; c += 1) {
    const col = sortedRows.map((row) => row[c]).sort((a, b) => a - b);
    const put = (row: number, rank: number) => {
      grid[row][c] = col[rank];
    };
    if (c === 0) {
      put(3, 3);
      put(4, 4);
    } else if (c === 1) {
      put(2, 2);
      put(3, 3);
      put(4, 4);
    } else if (c === 2) {
      put(1, 1);
      put(2, 2);
      put(3, 3);
    } else if (c === 3) {
      put(0, 0);
      put(1, 1);
      put(2, 2);
    } else {
      put(0, 0);
      put(1, 1);
    }
  }

  const diag = (sum: number): number[] => {
    const vals: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const j = sum - i;
      if (j < 0 || j > 4) {
        continue;
      }
      const value = grid[i][j];
      if (value === null) {
        throw new Error(`network5 hole at ${i},${j}`);
      }
      vals.push(value);
    }
    return vals;
  };

  const diagA = diag(3);
  const diagB = diag(4);
  const diagC = diag(5);
  const a = Math.max(...diagA);
  const b = [...diagB].sort((p, q) => p - q)[2];
  const c = Math.min(...diagC);
  return {
    sortedRows,
    grid,
    diagA,
    diagB,
    diagC,
    a,
    b,
    c,
    median: median3(a, b, c),
  };
}

/** Corner 9 is salt. A, B, and C land on three different values; their median is 4. */
export const NETWORK5_SCENE: number[][] = [
  [9, 8, 5, 6, 0],
  [8, 0, 1, 3, 6],
  [3, 0, 3, 7, 2],
  [1, 4, 7, 4, 2],
  [5, 7, 3, 7, 0],
];

export type HistMove = "down" | "up";

export type HistState = {
  hist: number[];
  mdn: number;
  ltmdn: number;
};

export function emptyHist(): number[] {
  return Array.from({ length: HIST_BINS }, () => 0);
}

export function medianFromHistogram(hist: number[], th: number): { mdn: number; ltmdn: number } {
  let ltmdn = 0;
  for (let value = 0; value < hist.length; value += 1) {
    if (ltmdn + hist[value] > th) {
      return { mdn: value, ltmdn };
    }
    ltmdn += hist[value];
  }
  throw new Error("histogram has no median");
}

export function adjustMedian(
  hist: number[],
  mdn: number,
  ltmdn: number,
  th: number,
): { mdn: number; ltmdn: number; moves: HistMove[] } {
  const moves: HistMove[] = [];
  let next = mdn;
  let less = ltmdn;
  while (less > th) {
    next -= 1;
    if (next < 0) {
      throw new Error("median walked below 0");
    }
    less -= hist[next];
    moves.push("down");
  }
  while (less + hist[next] <= th) {
    less += hist[next];
    next += 1;
    if (next >= hist.length) {
      throw new Error("median walked off the top bin");
    }
    moves.push("up");
  }
  return { mdn: next, ltmdn: less, moves };
}

function touch(hist: number[], state: { mdn: number; ltmdn: number }, value: number, sign: 1 | -1) {
  hist[value] += sign;
  if (value < state.mdn) {
    state.ltmdn += sign;
  }
}

export type HistFrame = {
  y: number;
  x: number;
  dir: 1 | -1;
  kind: "init" | "slide-h" | "slide-v";
  mdn: number;
  ltmdn: number;
  mdnBefore: number;
  ltmdnBefore: number;
  th: number;
  hist: number[];
  removed: number[];
  added: number[];
  moves: HistMove[];
};

/** Interior running histogram. Window top-left is the output coordinate. */
export function histogramFrames(image: number[][], k: number): HistFrame[] {
  const height = image.length;
  const width = image[0]?.length ?? 0;
  if (k < 1 || height < k || width < k || image.some((row) => row.length !== width)) {
    throw new Error("histogramFrames image is smaller than the kernel");
  }
  const outH = height - k + 1;
  const outW = width - k + 1;
  const th = rankThreshold(k);
  const hist = emptyHist();
  for (let y = 0; y < k; y += 1) {
    for (let x = 0; x < k; x += 1) {
      hist[image[y][x]] += 1;
    }
  }
  const init = medianFromHistogram(hist, th);
  const state = { mdn: init.mdn, ltmdn: init.ltmdn };
  const frames: HistFrame[] = [
    {
      y: 0,
      x: 0,
      dir: 1,
      kind: "init",
      mdn: state.mdn,
      ltmdn: state.ltmdn,
      mdnBefore: state.mdn,
      ltmdnBefore: state.ltmdn,
      th,
      hist: [...hist],
      removed: [],
      added: [],
      moves: [],
    },
  ];

  let y = 0;
  let x = 0;
  let dir: 1 | -1 = 1;

  const commit = (
    kind: HistFrame["kind"],
    removed: number[],
    added: number[],
    mdnBefore: number,
    ltmdnBefore: number,
    moves: HistMove[],
  ) => {
    frames.push({
      y,
      x,
      dir,
      kind,
      mdn: state.mdn,
      ltmdn: state.ltmdn,
      mdnBefore,
      ltmdnBefore,
      th,
      hist: [...hist],
      removed,
      added,
      moves,
    });
  };

  for (let row = 0; row < outH; row += 1) {
    for (let step = 0; step < outW - 1; step += 1) {
      const removed: number[] = [];
      const added: number[] = [];
      if (dir === 1) {
        for (let i = 0; i < k; i += 1) {
          const drop = image[y + i][x];
          const enter = image[y + i][x + k];
          removed.push(drop);
          added.push(enter);
          touch(hist, state, drop, -1);
          touch(hist, state, enter, 1);
        }
        x += 1;
      } else {
        for (let i = 0; i < k; i += 1) {
          const drop = image[y + i][x + k - 1];
          const enter = image[y + i][x - 1];
          removed.push(drop);
          added.push(enter);
          touch(hist, state, drop, -1);
          touch(hist, state, enter, 1);
        }
        x -= 1;
      }
      const mdnBefore = state.mdn;
      const ltmdnBefore = state.ltmdn;
      const adjusted = adjustMedian(hist, state.mdn, state.ltmdn, th);
      state.mdn = adjusted.mdn;
      state.ltmdn = adjusted.ltmdn;
      commit("slide-h", removed, added, mdnBefore, ltmdnBefore, adjusted.moves);
    }
    if (row + 1 < outH) {
      const removed: number[] = [];
      const added: number[] = [];
      for (let j = 0; j < k; j += 1) {
        const drop = image[y][x + j];
        const enter = image[y + k][x + j];
        removed.push(drop);
        added.push(enter);
        touch(hist, state, drop, -1);
        touch(hist, state, enter, 1);
      }
      y += 1;
      dir = dir === 1 ? -1 : 1;
      const mdnBefore = state.mdn;
      const ltmdnBefore = state.ltmdn;
      const adjusted = adjustMedian(hist, state.mdn, state.ltmdn, th);
      state.mdn = adjusted.mdn;
      state.ltmdn = adjusted.ltmdn;
      commit("slide-v", removed, added, mdnBefore, ltmdnBefore, adjusted.moves);
    }
  }

  if (frames.length !== outH * outW) {
    throw new Error(`histogram frame count ${frames.length} != ${outH * outW}`);
  }
  return frames;
}

export const HISTOGRAM_SCENE: number[][] = [
  [1, 2, 2, 3, 9],
  [1, 4, 4, 5, 1],
  [0, 1, 8, 2, 2],
  [1, 1, 3, 3, 0],
];

export const HISTOGRAM_K = 3;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomImage(rand: () => number, height: number, width: number, bins: number): number[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => Math.floor(rand() * bins)),
  );
}

function naiveWindow(image: number[][], y: number, x: number, k: number): number {
  const values: number[] = [];
  for (let dy = 0; dy < k; dy += 1) {
    for (let dx = 0; dx < k; dx += 1) {
      values.push(image[y + dy][x + dx]);
    }
  }
  return naiveMedian(values);
}

export function verifyMedianModel(): string[] {
  const errors: string[] = [];

  const columns = sortColumns3(COLUMN_SCENE);
  const sorted = sortedRowsFromColumns(columns);
  const outputs = network3Row(COLUMN_SCENE);
  outputs.forEach((item, x) => {
    const expected = naiveMedian(windowSamples(COLUMN_SCENE, x));
    if (item.median !== expected) {
      errors.push(`3×3 window ${x}: network ${item.median} != naive ${expected}`);
    }
  });
  if (sorted[0].length !== COLUMN_SCENE[0].length) {
    errors.push("column sort width drifted");
  }

  const rand = mulberry32(0x5a17);
  for (let n = 0; n < 40; n += 1) {
    const window = randomImage(rand, 3, 3, 16);
    const got = network3Row(window)[0]?.median;
    const expected = naiveMedian(window.flat());
    if (got !== expected) {
      errors.push(`random 3×3 ${n}: ${got} != ${expected}`);
    }
  }

  const scene5 = network5(NETWORK5_SCENE);
  const naive5 = naiveMedian(NETWORK5_SCENE.flat());
  if (scene5.median !== naive5) {
    errors.push(`5×5 scene: network ${scene5.median} != naive ${naive5}`);
  }
  for (let n = 0; n < 80; n += 1) {
    const window = randomImage(rand, 5, 5, 32);
    const got = network5(window).median;
    const expected = naiveMedian(window.flat());
    if (got !== expected) {
      errors.push(`random 5×5 ${n}: ${got} != ${expected}`);
    }
  }

  const frames = histogramFrames(HISTOGRAM_SCENE, HISTOGRAM_K);
  frames.forEach((frame) => {
    const expected = naiveWindow(HISTOGRAM_SCENE, frame.y, frame.x, HISTOGRAM_K);
    if (frame.mdn !== expected) {
      errors.push(`histogram scene (${frame.y},${frame.x}): ${frame.mdn} != ${expected}`);
    }
  });

  for (const k of [3, 5, 7]) {
    for (let n = 0; n < 8; n += 1) {
      const image = randomImage(rand, k + 2, k + 3, 24);
      const got = histogramFrames(image, k);
      got.forEach((frame) => {
        const expected = naiveWindow(image, frame.y, frame.x, k);
        if (frame.mdn !== expected) {
          errors.push(`histogram k=${k} n=${n} (${frame.y},${frame.x}): ${frame.mdn} != ${expected}`);
        }
        const less = frame.hist.reduce(
          (sum, count, value) => (value < frame.mdn ? sum + count : sum),
          0,
        );
        if (less !== frame.ltmdn) {
          errors.push(`ltmdn drift k=${k} at (${frame.y},${frame.x})`);
        }
      });
    }
  }

  return errors;
}

const MEDIAN_ERRORS = verifyMedianModel();
if (MEDIAN_ERRORS.length > 0) {
  throw new Error(`Median model mismatch: ${MEDIAN_ERRORS.slice(0, 6).join(" | ")}`);
}
