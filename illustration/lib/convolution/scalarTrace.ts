import {
  CONSTANT_ZERO,
  TEACHING_IMAGE,
  TEACHING_KSIZE,
  getPixel,
  horizontalWindowSum,
  imageWidth,
  inBounds,
  kernelArea,
  kernelRadius,
  neighborhoodSamples,
  swapRowSums,
  type GrayImage,
  type Sample,
  verticalWindowSum,
  zerosLike,
} from "@/lib/boxFilter";
import type { StageId } from "@/lib/convolution/stages";

export type OutputImage = (number | null)[][];

export type BoxFilterSnapshot = {
  x: number;
  y: number | null;
  input: GrayImage;
  output: OutputImage;
  samples: Sample[];
  rowSums: number[] | null;
  accumulator: number | null;
  windowSum: number | null;
  incoming: number | null;
  outgoing: number | null;
  highlight: { x: number; y: number }[];
};

export type BoxFilterStep = {
  id: string;
  fn: string;
  watching: string;
  changed: string;
  snippet: string;
  highlightLine: number;
  snapshot: BoxFilterSnapshot;
};

const INPUT = TEACHING_IMAGE;
const KSIZE = TEACHING_KSIZE;
const RADIUS = kernelRadius(KSIZE);
const AREA = kernelArea(KSIZE);
const BORDER = CONSTANT_ZERO;
const HEIGHT = INPUT.length;
const WIDTH = imageWidth(INPUT);

const NAIVE_SNIPPET = `uint32_t sum = 0;
for (int32_t ky = -kRadius; ky <= kRadius; ky++)
{
    for (int32_t kx = -kRadius; kx <= kRadius; kx++)
    {
        sum += ref::GetPixel(input, x + kx, y + ky, border_mode);
    }
}
output.SetPixel(x, y, static_cast<T>(sum / kArea));`;

const PRIME_SNIPPET = `for (int32_t i = 0; i < kSize - 1; i++)
{
    row_sums[i] = HorizontalWindowSum(input, x, i - kRadius, kRadius, border_mode);
}`;

const SEPARABLE_SNIPPET = `row_sums[kSize - 1] = HorizontalWindowSum(input, x, y + kRadius, kRadius, border_mode);
uint32_t window_sum = VerticalWindowSum(row_sums, kSize);
output.SetPixel(x, y, static_cast<T>(window_sum / kArea));
swap_row_sums(row_sums, kSize);`;

const ACC_INIT_SNIPPET = `uint32_t accumulator = VerticalWindowSum(row_sums, kSize - 1);`;

const ENHANCED_SNIPPET = `const uint32_t incoming = HorizontalWindowSum(input, x, y + kRadius, kRadius, border_mode);
accumulator = accumulator + incoming;
row_sums[kSize - 1] = incoming;
output.SetPixel(x, y, static_cast<T>(accumulator / kArea));
const uint32_t outgoing = row_sums[0];
accumulator -= outgoing;
swap_row_sums(row_sums, kSize);`;

const ENTRY_SNIPPET = `void BoxFilterImpl(const Image<T>& input, Image<T>& output, BorderMode border_mode)
{
    constexpr int32_t kSize = static_cast<int32_t>(filter_size);
    constexpr int32_t kRadius = kSize / 2;
    constexpr int32_t kArea = kSize * kSize;
    // teaching scene: for x, then y; CONSTANT 0
}`;

function emptyOutput(): OutputImage {
  return zerosLike(INPUT).map((row) => row.map(() => null));
}

function copyOutput(output: OutputImage): OutputImage {
  return output.map((row) => [...row]);
}

function samplesAt(x: number, y: number): Sample[] {
  return neighborhoodSamples(INPUT, x, y, KSIZE, BORDER);
}

function highlightFrom(samples: Sample[]): { x: number; y: number }[] {
  return samples.map(({ x, y }) => ({ x, y }));
}

function horizontalSamples(centerX: number, y: number): Sample[] {
  const samples: Sample[] = [];
  for (let kx = -RADIUS; kx <= RADIUS; kx += 1) {
    const x = centerX + kx;
    samples.push({
      x,
      y,
      value: getPixel(INPUT, x, y, BORDER),
      inside: inBounds(INPUT, x, y),
    });
  }
  return samples;
}

function snapshot(partial: Partial<BoxFilterSnapshot> & Pick<BoxFilterSnapshot, "x">): BoxFilterSnapshot {
  return {
    y: null,
    input: INPUT,
    output: emptyOutput(),
    samples: [],
    rowSums: null,
    accumulator: null,
    windowSum: null,
    incoming: null,
    outgoing: null,
    highlight: [],
    ...partial,
  };
}

function fmtList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

function buildNaiveTrace(): BoxFilterStep[] {
  const steps: BoxFilterStep[] = [];
  const output = emptyOutput();

  steps.push({
    id: "naive-entry",
    fn: "BoxFilterImpl",
    watching:
      "Loop column x, then row y. Start at x = 0. 3×3 kernel, BorderMode CONSTANT 0. Pads read as 0.",
    changed: "Scratch is empty. Next: load nine GetPixel samples around (0, 0).",
    snippet: ENTRY_SNIPPET,
    highlightLine: 5,
    snapshot: snapshot({ x: 0 }),
  });

  for (let x = 0; x < WIDTH; x += 1) {
    for (let y = 0; y < HEIGHT; y += 1) {
      const samples = samplesAt(x, y);
      const sum = samples.reduce((total, sample) => total + sample.value, 0);
      const pixel = Math.floor(sum / AREA);
      const highlight = highlightFrom(samples);

      steps.push({
        id: `naive-load-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Column x = ${x}, center (${x}, ${y}). The yellow box is the 3×3 GetPixel window. Light zeros are CONSTANT pads.`,
        changed: `9 samples = ${samples.map((sample) => sample.value).join(" + ")}`,
        snippet: NAIVE_SNIPPET,
        highlightLine: 5,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          windowSum: null,
          highlight,
        }),
      });

      steps.push({
        id: `naive-sum-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Nine additions into sum. Window around (${x}, ${y}) totals ${sum}.`,
        changed: `sum = ${sum}`,
        snippet: NAIVE_SNIPPET,
        highlightLine: 5,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          windowSum: sum,
          highlight,
        }),
      });

      output[y][x] = pixel;
      steps.push({
        id: `naive-store-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Integer divide by kArea = 9. Store output(${x}, ${y}) = ${pixel}.`,
        changed: `output(${x}, ${y}) = ${sum} / 9 = ${pixel}`,
        snippet: NAIVE_SNIPPET,
        highlightLine: 8,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          windowSum: sum,
          highlight,
        }),
      });
    }
  }

  return steps;
}

function buildSeparableTrace(): BoxFilterStep[] {
  const steps: BoxFilterStep[] = [];
  const output = emptyOutput();

  steps.push({
    id: "sep-entry",
    fn: "BoxFilterImpl",
    watching:
      "Separable loops x, then y. Each column keeps a row_sums buffer of size n. Start at x = 0.",
    changed: "row_sums is empty. Next: prime the first n − 1 horizontal sums for column 0.",
    snippet: ENTRY_SNIPPET,
    highlightLine: 5,
    snapshot: snapshot({ x: 0, rowSums: [0, 0, 0] }),
  });

  for (let x = 0; x < WIDTH; x += 1) {
    const rowSums = Array<number>(KSIZE).fill(0);

    steps.push({
      id: `sep-col-${x}`,
      fn: "BoxFilterImpl",
      watching: `Column x = ${x}. Prime row_sums, then slide down y.`,
      changed: `Start column ${x}. row_sums = ${fmtList(rowSums)}`,
      snippet: ENTRY_SNIPPET,
      highlightLine: 5,
      snapshot: snapshot({
        x,
        output: copyOutput(output),
        rowSums: [...rowSums],
      }),
    });

    for (let i = 0; i < KSIZE - 1; i += 1) {
      const y = i - RADIUS;
      const samples = horizontalSamples(x, y);
      rowSums[i] = horizontalWindowSum(INPUT, x, y, RADIUS, BORDER);
      steps.push({
        id: `sep-prime-${x}-${i}`,
        fn: "HorizontalWindowSum",
        watching: `Column ${x}: prime row_sums[${i}] from row y = ${y} (i − kRadius). Three horizontal GetPixel loads.`,
        changed: `row_sums[${i}] = ${rowSums[i]}`,
        snippet: PRIME_SNIPPET,
        highlightLine: 2,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          highlight: highlightFrom(samples),
        }),
      });
    }

    for (let y = 0; y < HEIGHT; y += 1) {
      const incomingY = y + RADIUS;
      const samples = horizontalSamples(x, incomingY);
      const incoming = horizontalWindowSum(INPUT, x, incomingY, RADIUS, BORDER);
      rowSums[KSIZE - 1] = incoming;
      const windowSum = verticalWindowSum(rowSums, KSIZE);
      const pixel = Math.floor(windowSum / AREA);

      steps.push({
        id: `sep-in-${x}-${y}`,
        fn: "HorizontalWindowSum",
        watching: `Column ${x}: incoming row y = ${incomingY} (center y + kRadius). Do not reload the whole n×n window.`,
        changed: `incoming = ${incoming} · row_sums = ${fmtList(rowSums)}`,
        snippet: SEPARABLE_SNIPPET,
        highlightLine: 0,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          incoming,
          highlight: highlightFrom(samples),
        }),
      });

      steps.push({
        id: `sep-vert-${x}-${y}`,
        fn: "VerticalWindowSum",
        watching: `Add the n row sums. Window around (${x}, ${y}) totals ${windowSum}.`,
        changed: `window_sum = ${fmtList(rowSums)} = ${windowSum}`,
        snippet: SEPARABLE_SNIPPET,
        highlightLine: 1,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          incoming,
          windowSum,
          highlight: highlightFrom(samples),
        }),
      });

      output[y][x] = pixel;
      steps.push({
        id: `sep-store-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Store output(${x}, ${y}) = ${windowSum} / 9 = ${pixel}.`,
        changed: `output(${x}, ${y}) = ${pixel}`,
        snippet: SEPARABLE_SNIPPET,
        highlightLine: 2,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          incoming,
          windowSum,
          highlight: highlightFrom(samples),
        }),
      });

      swapRowSums(rowSums, KSIZE);
      steps.push({
        id: `sep-swap-${x}-${y}`,
        fn: "swap_row_sums",
        watching: "Shift the buffer up one slot so the oldest row sum drops out on the next y.",
        changed: `row_sums = ${fmtList(rowSums)}`,
        snippet: SEPARABLE_SNIPPET,
        highlightLine: 3,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples: [],
          rowSums: [...rowSums],
          incoming,
          windowSum,
          highlight: [],
        }),
      });
    }
  }

  return steps;
}

function buildEnhancedTrace(): BoxFilterStep[] {
  const steps: BoxFilterStep[] = [];
  const output = emptyOutput();

  steps.push({
    id: "enh-entry",
    fn: "BoxFilterImpl",
    watching:
      "Enhanced loops x, then y. Buffer is n row sums plus one accumulator. Start at x = 0.",
    changed: "Accumulate buffer empty. Next: prime n − 1 row sums, then the accumulator.",
    snippet: ENTRY_SNIPPET,
    highlightLine: 5,
    snapshot: snapshot({ x: 0, rowSums: [0, 0, 0], accumulator: 0 }),
  });

  for (let x = 0; x < WIDTH; x += 1) {
    const rowSums = Array<number>(KSIZE).fill(0);
    let accumulator = 0;

    steps.push({
      id: `enh-col-${x}`,
      fn: "BoxFilterImpl",
      watching: `Column x = ${x}. Reset the n + 1 accumulate buffer for this column.`,
      changed: `Start column ${x}. row_sums = ${fmtList(rowSums)} · acc = 0`,
      snippet: ENTRY_SNIPPET,
      highlightLine: 5,
      snapshot: snapshot({
        x,
        output: copyOutput(output),
        rowSums: [...rowSums],
        accumulator: 0,
      }),
    });

    for (let i = 0; i < KSIZE - 1; i += 1) {
      const y = i - RADIUS;
      const samples = horizontalSamples(x, y);
      rowSums[i] = horizontalWindowSum(INPUT, x, y, RADIUS, BORDER);
      steps.push({
        id: `enh-prime-${x}-${i}`,
        fn: "HorizontalWindowSum",
        watching: `Column ${x}: prime row_sums[${i}] from row y = ${y}. Same as separable.`,
        changed: `row_sums[${i}] = ${rowSums[i]}`,
        snippet: PRIME_SNIPPET,
        highlightLine: 2,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          accumulator,
          highlight: highlightFrom(samples),
        }),
      });
    }

    accumulator = verticalWindowSum(rowSums, KSIZE - 1);
    steps.push({
      id: `enh-acc-init-${x}`,
      fn: "VerticalWindowSum",
      watching: `Column ${x}: sum the primed n − 1 row sums into the extra accumulator slot. Not yet a full window.`,
      changed: `accumulator = ${accumulator}`,
      snippet: ACC_INIT_SNIPPET,
      highlightLine: 0,
      snapshot: snapshot({
        x,
        output: copyOutput(output),
        rowSums: [...rowSums],
        accumulator,
      }),
    });

    for (let y = 0; y < HEIGHT; y += 1) {
      const incomingY = y + RADIUS;
      const samples = horizontalSamples(x, incomingY);
      const incoming = horizontalWindowSum(INPUT, x, incomingY, RADIUS, BORDER);

      steps.push({
        id: `enh-in-${x}-${y}`,
        fn: "HorizontalWindowSum",
        watching: `Column ${x}: incoming row y = ${incomingY}. Load n new pixels and sum them.`,
        changed: `incoming = ${incoming}`,
        snippet: ENHANCED_SNIPPET,
        highlightLine: 0,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          accumulator,
          incoming,
          highlight: highlightFrom(samples),
        }),
      });

      accumulator += incoming;
      rowSums[KSIZE - 1] = incoming;
      steps.push({
        id: `enh-add-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Add incoming into the accumulator. Do not re-sum the overlapping rows.`,
        changed: `accumulator = ${accumulator} · row_sums = ${fmtList(rowSums)}`,
        snippet: ENHANCED_SNIPPET,
        highlightLine: 1,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          accumulator,
          incoming,
          windowSum: accumulator,
          highlight: highlightFrom(samples),
        }),
      });

      const pixel = Math.floor(accumulator / AREA);
      output[y][x] = pixel;
      steps.push({
        id: `enh-store-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Store output(${x}, ${y}) = ${accumulator} / 9 = ${pixel}.`,
        changed: `output(${x}, ${y}) = ${pixel}`,
        snippet: ENHANCED_SNIPPET,
        highlightLine: 3,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples,
          rowSums: [...rowSums],
          accumulator,
          incoming,
          windowSum: accumulator,
          highlight: highlightFrom(samples),
        }),
      });

      const outgoing = rowSums[0] ?? 0;
      accumulator -= outgoing;
      steps.push({
        id: `enh-sub-${x}-${y}`,
        fn: "BoxFilterImpl",
        watching: `Subtract the oldest row sum that is about to slide out of the window.`,
        changed: `accumulator -= row_sums[0] (${outgoing}) → ${accumulator}`,
        snippet: ENHANCED_SNIPPET,
        highlightLine: 5,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples: [],
          rowSums: [...rowSums],
          accumulator,
          incoming,
          outgoing,
          highlight: [],
        }),
      });

      swapRowSums(rowSums, KSIZE);
      steps.push({
        id: `enh-swap-${x}-${y}`,
        fn: "swap_row_sums",
        watching: "Shift row_sums up one. The extra accumulator slot is already updated.",
        changed: `row_sums = ${fmtList(rowSums)} · acc = ${accumulator}`,
        snippet: ENHANCED_SNIPPET,
        highlightLine: 6,
        snapshot: snapshot({
          x,
          y,
          output: copyOutput(output),
          samples: [],
          rowSums: [...rowSums],
          accumulator,
          incoming,
          outgoing,
          highlight: [],
        }),
      });
    }
  }

  return steps;
}

const TRACES: Record<StageId, BoxFilterStep[]> = {
  naive: buildNaiveTrace(),
  separable: buildSeparableTrace(),
  enhanced: buildEnhancedTrace(),
};

export function buildBoxFilterTrace(stage: StageId): BoxFilterStep[] {
  return TRACES[stage];
}

export function verifyBoxFilterTraces(): string[] {
  const errors: string[] = [];
  const naiveLast = TRACES.naive[TRACES.naive.length - 1]?.snapshot.output;
  const sepLast = TRACES.separable[TRACES.separable.length - 1]?.snapshot.output;
  const enhLast = TRACES.enhanced[TRACES.enhanced.length - 1]?.snapshot.output;
  if (naiveLast?.[1]?.[1] !== 50 || naiveLast?.[2]?.[1] !== 80) {
    errors.push("naive trace interiors are not 50 then 80");
  }
  if (naiveLast?.[0]?.[0] !== 13) {
    errors.push("naive trace did not finish column 0");
  }
  if (sepLast?.[1]?.[1] !== 50 || sepLast?.[2]?.[1] !== 80) {
    errors.push("separable trace interiors are not 50 then 80");
  }
  if (enhLast?.[1]?.[1] !== 50 || enhLast?.[2]?.[1] !== 80) {
    errors.push("enhanced trace interiors are not 50 then 80");
  }
  return errors;
}

const TRACE_ERRORS = verifyBoxFilterTraces();
if (TRACE_ERRORS.length > 0) {
  console.error("Box filter trace mismatch", TRACE_ERRORS);
}