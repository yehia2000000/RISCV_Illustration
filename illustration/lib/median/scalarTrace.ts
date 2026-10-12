import {
  COLUMN_SCENE,
  naiveMedian,
  network3Row,
  sortColumns3,
  windowSamples,
} from "@/lib/median/model";
import type { MedianStageId } from "@/lib/median/stages";

export type MedianScalarStep = {
  id: string;
  fn: string;
  watching: string;
  snippet: string;
  highlightLine: number;
  changed: string;
  /** Columns 0..sortedThrough are shown sorted. -1 keeps the raw image only. */
  sortedThrough: number;
  focusCol: number | null;
  /** Center column of the window being written. */
  focusCenter: number | null;
  revealedCenters: number;
  showNaive: boolean;
};

const COLUMN_SNIPPET = `void CompareSwap(uint8_t& a, uint8_t& b)
{
    if (a > b)
        std::swap(a, b);
}
// 3-sort this column: (0,1), (1,2), (0,1)`;

const EXTREMA_SNIPPET = `uint8_t top = max(col[x][0], col[x + 1][0], col[x + 2][0]);
uint8_t mid = median3(col[x][1], col[x + 1][1], col[x + 2][1]);
uint8_t bot = min(col[x][2], col[x + 1][2], col[x + 2][2]);`;

const FINAL_SNIPPET = `uint8_t out = median3(top, mid, bot);
// same value as samples[th], th = 4`;

function step(
  partial: Omit<MedianScalarStep, "sortedThrough" | "focusCol" | "focusCenter" | "revealedCenters" | "showNaive"> &
    Partial<Pick<MedianScalarStep, "sortedThrough" | "focusCol" | "focusCenter" | "revealedCenters" | "showNaive">>,
): MedianScalarStep {
  return {
    sortedThrough: -1,
    focusCol: null,
    focusCenter: null,
    revealedCenters: 0,
    showNaive: false,
    ...partial,
  };
}

function inputSteps(): MedianScalarStep[] {
  const naive = naiveMedian(windowSamples(COLUMN_SCENE, 0));
  return [
    step({
      id: "inputs-image",
      fn: "MedianFilter3x3",
      watching:
        "One scanline, 3 rows by 6 columns. Output replaces the center pixel. The window on column 1 uses columns 0–2 and holds the salt value 9.",
      snippet: `const int k = 3;
const int th = (k * k) / 2; // 4, 0-based rank
// centers written here: columns 1, 2, 3, 4`,
      highlightLine: 1,
      changed: "th = 4. Four center columns.",
    }),
    step({
      id: "inputs-naive",
      fn: "MedianFilterNxN_naive",
      watching: `The naive path sorts those 9 samples and reads index th. samples[4] = ${naive}. Later stages have to write ${naive} at column 1 without sorting the whole window.`,
      snippet: `std::sort(samples, samples + 9);
uint8_t median = samples[th];`,
      highlightLine: 1,
      changed: `samples[4] = ${naive}`,
      focusCenter: 1,
      showNaive: true,
    }),
  ];
}

function columnSteps(): MedianScalarStep[] {
  return sortColumns3(COLUMN_SCENE).map((column, x) =>
    step({
      id: `col-${x}`,
      fn: "ColumnSort",
      watching:
        x === 1
          ? `Column 1 is [${column.before.join(", ")}]. Salt 9 sinks to the bottom: [${column.after.join(", ")}].`
          : `Column ${x} sorted small-at-top: [${column.before.join(", ")}] → [${column.after.join(", ")}]. Later windows reuse this column.`,
      snippet: COLUMN_SNIPPET,
      highlightLine: 3,
      changed: `column ${x} = [${column.after.join(", ")}]`,
      sortedThrough: x,
      focusCol: x,
    }),
  );
}

function extremaSteps(): MedianScalarStep[] {
  return network3Row(COLUMN_SCENE).map((item) => {
    const center = item.x + 1;
    const salt =
      center === 1 ? " Bottom min is 5, so the salt 9 is not a candidate." : "";
    return step({
      id: `ext-${center}`,
      fn: "RowExtrema",
      watching: `Center column ${center}. max of the top row is ${item.top}, median of the middle row is ${item.mid}, min of the bottom row is ${item.bot}.${salt}`,
      snippet: EXTREMA_SNIPPET,
      highlightLine: 0,
      changed: `top ${item.top}, mid ${item.mid}, bot ${item.bot}`,
      sortedThrough: COLUMN_SCENE[0].length - 1,
      focusCenter: center,
    });
  });
}

function finalSteps(): MedianScalarStep[] {
  const outputs = network3Row(COLUMN_SCENE);
  return outputs.map((item, index) => {
    const center = item.x + 1;
    const written = outputs.slice(0, index + 1).map((row) => row.median);
    return step({
      id: `final-${center}`,
      fn: "FinalMedian",
      watching: `median3(${item.top}, ${item.mid}, ${item.bot}) = ${item.median}. Write that at column ${center}.`,
      snippet: FINAL_SNIPPET,
      highlightLine: 0,
      changed: `out[${center}] = ${item.median}; written [${written.join(", ")}]`,
      sortedThrough: COLUMN_SCENE[0].length - 1,
      focusCenter: center,
      revealedCenters: index + 1,
    });
  });
}

export function scalarSteps(stage: MedianStageId): MedianScalarStep[] {
  switch (stage) {
    case "inputs":
      return inputSteps();
    case "columns":
      return columnSteps();
    case "extrema":
      return extremaSteps();
    case "final":
      return finalSteps();
  }
}
