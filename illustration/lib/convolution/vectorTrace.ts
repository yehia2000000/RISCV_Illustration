/** RVV box-filter teaching trace, ported from lib/source/image_box_filter.cpp (vec::). */

import { imageHeight, imageWidth, type GrayImage } from "@/lib/boxFilter";

export type VectorVlmax = 2 | 4 | 8;

export const VECTOR_VLMAX: VectorVlmax[] = [2, 4, 8];

export const VECTOR_IMAGE: GrayImage = [
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  [12, 22, 32, 42, 52, 62, 72, 82, 92, 102],
  [14, 24, 34, 44, 54, 64, 74, 84, 94, 104],
  [16, 26, 36, 46, 56, 66, 76, 86, 96, 106],
  [18, 28, 38, 48, 58, 68, 78, 88, 98, 108],
];

export const VECTOR_KSIZE = 3;
export const VECTOR_RADIUS = 1;
export const VECTOR_AREA = 9;
/** The walkthrough traces the first interior row; later rows repeat it. */
export const VECTOR_ROW = 1;

export const VECTOR_WIDTH = imageWidth(VECTOR_IMAGE);
export const VECTOR_HEIGHT = imageHeight(VECTOR_IMAGE);

const X_START = VECTOR_RADIUS;
const X_END = VECTOR_WIDTH - VECTOR_RADIUS;
const ROW_LENGTH = X_END - X_START;

export type RvvLane = {
  lane: number;
  active: boolean;
  outX: number | null;
  loaded: number | null;
  acc: number | null;
  result: number | null;
};

export type RvvStep = {
  id: string;
  fn: string;
  intrinsic: string;
  highlightLine: number;
  snippet: string;
  watching: string;
  whatItDoes: string;
  whyNeeded: string;
  laneRule: string;
  changed: string;
  sewLmul: string;
  y: number;
  x: number;
  vl: number;
  vlmax: number;
  remaining: number;
  strip: number;
  tapIndex: number | null;
  ky: number | null;
  kx: number | null;
  base: number | null;
  lanes: RvvLane[];
  loadCells: { x: number; y: number }[];
  outputRow: (number | null)[];
  checkpoint?: { label: string; ok: boolean; detail: string };
};

const ENTRY_SNIPPET = `for (int y = kRadius; y < height - kRadius; ++y)
{
    for (size_t x = kRadius, length = width - 2 * kRadius;
         length > 0;
         length -= vl, x += vl)
    {
        // one strip of vl output pixels
    }
}`;

const STRIP_SNIPPET = `vl = __riscv_vsetvl_e8m1(length);
vuint16m2_t sum = __riscv_vmv_v_x_u16m2(0, vl);
for (int ky = -kRadius; ky <= kRadius; ++ky)
{
    for (int kx = -kRadius; kx <= kRadius; ++kx)
    {
        const vuint8m1_t p = __riscv_vle8_v_u8m1(
            &in[(y + ky) * width + x + kx], vl);
        sum = __riscv_vwaddu_wv_u16m2(sum, p, vl);
    }
}
const vuint16m2_t avg = __riscv_vdivu_vx_u16m2(sum, kArea, vl);
const vuint8m1_t result = __riscv_vnsrl_wx_u8m1(avg, 0, vl);
__riscv_vse8_v_u8m1(&out[y * width + x], result, vl);`;

const COPY_SNIPPET = `// Leave the unsupported border pixels unchanged.
copy_rect(0, kRadius, 0, height);
copy_rect(width - kRadius, width, 0, height);
copy_rect(0, width, 0, kRadius);
copy_rect(0, width, height - kRadius, height);`;

const LINE = {
  vsetvl: 0,
  vmv: 1,
  vle8: 6,
  vwaddu: 8,
  vdivu: 11,
  vnsrl: 12,
  vse8: 13,
};

function setTeachingVl(remaining: number, vlmax: VectorVlmax): number {
  return Math.min(remaining, vlmax);
}

function laneList(
  vl: number,
  vlmax: number,
  x: number,
  acc: (number | null)[],
  loaded: (number | null)[],
  result: (number | null)[],
): RvvLane[] {
  const lanes: RvvLane[] = [];
  for (let j = 0; j < vlmax; j += 1) {
    const active = j < vl;
    lanes.push({
      lane: j,
      active,
      outX: active ? x + j : null,
      loaded: active ? loaded[j] ?? null : null,
      acc: active ? acc[j] ?? null : null,
      result: active ? result[j] ?? null : null,
    });
  }
  return lanes;
}

function fmtLanes(values: (number | null)[], vl: number): string {
  return `[${values
    .slice(0, vl)
    .map((value) => (value === null ? "—" : value))
    .join(", ")}]`;
}

export function buildRvvTrace(vlmax: VectorVlmax): RvvStep[] {
  const steps: RvvStep[] = [];
  const y = VECTOR_ROW;
  const outputRow: (number | null)[] = Array<number | null>(VECTOR_WIDTH).fill(
    null,
  );
  const emptyLanes = Array<number | null>(vlmax).fill(null);

  steps.push({
    id: "rvv-entry",
    fn: "box_filter_loop",
    intrinsic: "—",
    highlightLine: 2,
    snippet: ENTRY_SNIPPET,
    watching: `Row y = ${y}. The interior is x = ${X_START}…${X_END - 1}, so ${ROW_LENGTH} output pixels are split into strips of at most VLMAX = ${vlmax}.`,
    whatItDoes:
      "Walks interior rows top to bottom, and each row left to right in chunks the hardware sizes.",
    whyNeeded:
      "NO_BORDER only filters the interior. Rows and columns within kRadius are copied through after the main loop.",
    laneRule: `Lane j will own output pixel (x + j, ${y}) for the whole strip. Lanes never exchange data.`,
    changed: `length = ${ROW_LENGTH}, x = ${X_START}, vl not set yet`,
    sewLmul: "e8m1 load / u16m2 accumulate",
    y,
    x: X_START,
    vl: 0,
    vlmax,
    remaining: ROW_LENGTH,
    strip: 0,
    tapIndex: null,
    ky: null,
    kx: null,
    base: null,
    lanes: laneList(0, vlmax, X_START, emptyLanes, emptyLanes, emptyLanes),
    loadCells: [],
    outputRow: [...outputRow],
  });

  let x = X_START;
  let remaining = ROW_LENGTH;
  let strip = 0;

  while (remaining > 0) {
    strip += 1;
    const vl = setTeachingVl(remaining, vlmax);
    const acc: (number | null)[] = Array<number | null>(vl).fill(null);
    const loaded: (number | null)[] = Array<number | null>(vl).fill(null);
    const result: (number | null)[] = Array<number | null>(vl).fill(null);

    steps.push({
      id: `rvv-vsetvl-${strip}`,
      fn: "box_filter_loop",
      intrinsic: "__riscv_vsetvl_e8m1",
      highlightLine: LINE.vsetvl,
      snippet: STRIP_SNIPPET,
      watching: `Strip ${strip}: ask the hardware how many 8-bit pixels it can take. ${remaining} left, so vl = ${vl}.`,
      whatItDoes: `Sets vl = min(length, VLMAX) = min(${remaining}, ${vlmax}) = ${vl}.`,
      whyNeeded:
        "Strip-mining. The last chunk of a row simply gets a smaller vl, so the same loop body handles the ragged tail with no scalar cleanup.",
      laneRule: `Lanes 0…${vl - 1} are active. Lanes ${vl}…${vlmax - 1} are tail and stay untouched.`,
      changed: `vl = ${vl}, x = ${x}, lanes own x = ${x}…${x + vl - 1}`,
      sewLmul: "e8m1 (SEW 8, LMUL 1)",
      y,
      x,
      vl,
      vlmax,
      remaining,
      strip,
      tapIndex: null,
      ky: null,
      kx: null,
      base: null,
      lanes: laneList(vl, vlmax, x, acc, loaded, result),
      loadCells: [],
      outputRow: [...outputRow],
    });

    for (let j = 0; j < vl; j += 1) {
      acc[j] = 0;
    }

    steps.push({
      id: `rvv-vmv-${strip}`,
      fn: "box_filter_loop",
      intrinsic: "__riscv_vmv_v_x_u16m2",
      highlightLine: LINE.vmv,
      snippet: STRIP_SNIPPET,
      watching:
        "Clear the accumulator. Each active lane starts its own window sum at 0.",
      whatItDoes: "Broadcasts the scalar 0 into every lane of a 16-bit vector.",
      whyNeeded: `A 3×3 window of 255s sums to 2295, past a byte. 16 bits holds the worst case (11×11 → 121 × 255 = 30855).`,
      laneRule: "sum[j] is private to lane j. It is the scalar accumulator, one copy per lane.",
      changed: `sum = ${fmtLanes(acc, vl)}`,
      sewLmul: "u16m2 (SEW 16, LMUL 2)",
      y,
      x,
      vl,
      vlmax,
      remaining,
      strip,
      tapIndex: null,
      ky: null,
      kx: null,
      base: null,
      lanes: laneList(vl, vlmax, x, acc, loaded, result),
      loadCells: [],
      outputRow: [...outputRow],
    });

    let tapIndex = 0;
    for (let ky = -VECTOR_RADIUS; ky <= VECTOR_RADIUS; ky += 1) {
      for (let kx = -VECTOR_RADIUS; kx <= VECTOR_RADIUS; kx += 1) {
        tapIndex += 1;
        const row = y + ky;
        const base = row * VECTOR_WIDTH + x + kx;
        const cells: { x: number; y: number }[] = [];
        for (let j = 0; j < vl; j += 1) {
          loaded[j] = VECTOR_IMAGE[row][x + kx + j];
          cells.push({ x: x + kx + j, y: row });
        }

        steps.push({
          id: `rvv-vle-${strip}-${tapIndex}`,
          fn: "box_filter_loop",
          intrinsic: "__riscv_vle8_v_u8m1",
          highlightLine: LINE.vle8,
          snippet: STRIP_SNIPPET,
          watching: `Tap ${tapIndex} of ${VECTOR_AREA} (ky = ${ky}, kx = ${kx}). One unit-stride load of ${vl} pixels from row ${row}, starting at x = ${x + kx}.`,
          whatItDoes: `Loads in[${base} … ${base + vl - 1}] into a vector register, one pixel per lane.`,
          whyNeeded:
            "Because the window slides by one pixel per output, the same tap for vl neighbouring outputs is a contiguous run. That is why x goes in the lanes and not y.",
          laneRule: `Lane j gets in[(${y} ${ky < 0 ? "-" : "+"} ${Math.abs(ky)}) * width + x ${kx < 0 ? "-" : "+"} ${Math.abs(kx)} + j], the same tap of its own window.`,
          changed: `p = ${fmtLanes(loaded, vl)}`,
          sewLmul: "u8m1 (SEW 8, LMUL 1)",
          y,
          x,
          vl,
          vlmax,
          remaining,
          strip,
          tapIndex,
          ky,
          kx,
          base,
          lanes: laneList(vl, vlmax, x, acc, loaded, result),
          loadCells: cells,
          outputRow: [...outputRow],
        });

        for (let j = 0; j < vl; j += 1) {
          acc[j] = (acc[j] ?? 0) + (loaded[j] ?? 0);
        }

        steps.push({
          id: `rvv-vwaddu-${strip}-${tapIndex}`,
          fn: "box_filter_loop",
          intrinsic: "__riscv_vwaddu_wv_u16m2",
          highlightLine: LINE.vwaddu,
          snippet: STRIP_SNIPPET,
          watching: `Widening add: the ${vl} loaded bytes go into the 16-bit sums. Tap ${tapIndex} of ${VECTOR_AREA} done.`,
          whatItDoes:
            "Adds the 8-bit vector into the 16-bit accumulator in one instruction.",
          whyNeeded:
            "The w in wv means the first operand is already wide, so no separate zero-extend step is needed.",
          laneRule: "sum[j] += p[j]. No carry, no shuffle, nothing crosses lanes.",
          changed: `sum = ${fmtLanes(acc, vl)}`,
          sewLmul: "u16m2 ← u8m1",
          y,
          x,
          vl,
          vlmax,
          remaining,
          strip,
          tapIndex,
          ky,
          kx,
          base,
          lanes: laneList(vl, vlmax, x, acc, loaded, result),
          loadCells: cells,
          outputRow: [...outputRow],
        });
      }
    }

    const avg: (number | null)[] = acc.map((value) =>
      value === null ? null : Math.floor(value / VECTOR_AREA),
    );

    steps.push({
      id: `rvv-vdivu-${strip}`,
      fn: "box_filter_loop",
      intrinsic: "__riscv_vdivu_vx_u16m2",
      highlightLine: LINE.vdivu,
      snippet: STRIP_SNIPPET,
      watching: `All ${VECTOR_AREA} taps are in. Divide every lane by kArea = ${VECTOR_AREA}.`,
      whatItDoes: "Vector ÷ scalar, truncating integer division, one lane at a time in parallel.",
      whyNeeded:
        "This is the average. It is also the most expensive instruction in the loop: integer vector divide is usually not pipelined.",
      laneRule: "avg[j] = sum[j] / kArea, same truncation as the scalar kernel.",
      changed: `avg = ${fmtLanes(avg, vl)}`,
      sewLmul: "u16m2",
      y,
      x,
      vl,
      vlmax,
      remaining,
      strip,
      tapIndex: null,
      ky: null,
      kx: null,
      base: null,
      lanes: laneList(vl, vlmax, x, avg, loaded, result),
      loadCells: [],
      outputRow: [...outputRow],
    });

    for (let j = 0; j < vl; j += 1) {
      result[j] = avg[j];
    }

    steps.push({
      id: `rvv-vnsrl-${strip}`,
      fn: "box_filter_loop",
      intrinsic: "__riscv_vnsrl_wx_u8m1",
      highlightLine: LINE.vnsrl,
      snippet: STRIP_SNIPPET,
      watching: "Narrow the 16-bit averages back down to 8-bit pixels.",
      whatItDoes: "A narrowing shift right by 0, used purely as a truncating cast.",
      whyNeeded:
        "Safe because an average of bytes can never exceed 255, so narrowing loses nothing.",
      laneRule: "result[j] = avg[j] as uint8. Lane count is unchanged.",
      changed: `result = ${fmtLanes(result, vl)}`,
      sewLmul: "u8m1 ← u16m2",
      y,
      x,
      vl,
      vlmax,
      remaining,
      strip,
      tapIndex: null,
      ky: null,
      kx: null,
      base: null,
      lanes: laneList(vl, vlmax, x, avg, loaded, result),
      loadCells: [],
      outputRow: [...outputRow],
    });

    for (let j = 0; j < vl; j += 1) {
      outputRow[x + j] = result[j];
    }

    steps.push({
      id: `rvv-vse-${strip}`,
      fn: "box_filter_loop",
      intrinsic: "__riscv_vse8_v_u8m1",
      highlightLine: LINE.vse8,
      snippet: STRIP_SNIPPET,
      watching: `Store ${vl} finished pixels at out[${y} * width + ${x}]. Strip ${strip} cost ${VECTOR_AREA} loads and ${VECTOR_AREA} adds, whatever vl was.`,
      whatItDoes: "One unit-stride store writes the whole strip of output pixels.",
      whyNeeded: "Finishes the chunk. x advances by vl and length drops by vl.",
      laneRule: `Lane j wrote out(${x} + j, ${y}).`,
      changed: `out[${x}…${x + vl - 1}] = ${fmtLanes(result, vl)}`,
      sewLmul: "u8m1",
      y,
      x,
      vl,
      vlmax,
      remaining,
      strip,
      tapIndex: null,
      ky: null,
      kx: null,
      base: null,
      lanes: laneList(vl, vlmax, x, avg, loaded, result),
      loadCells: [],
      outputRow: [...outputRow],
    });

    remaining -= vl;
    x += vl;
  }

  for (let border = 0; border < VECTOR_RADIUS; border += 1) {
    outputRow[border] = VECTOR_IMAGE[y][border];
    outputRow[VECTOR_WIDTH - 1 - border] =
      VECTOR_IMAGE[y][VECTOR_WIDTH - 1 - border];
  }

  const expected = interiorReference(y);
  const got = outputRow.slice(X_START, X_END);
  const ok = expected.every((value, index) => value === got[index]);

  steps.push({
    id: "rvv-copy",
    fn: "copy_rect",
    intrinsic: "__riscv_vle8_v_u8m1 / __riscv_vse8_v_u8m1",
    highlightLine: 1,
    snippet: COPY_SNIPPET,
    watching: `Row ${y} is done in ${strip} strip${strip === 1 ? "" : "s"}. The border columns are copied straight through, never filtered.`,
    whatItDoes:
      "Copies the left, right, top, and bottom strips from input to output, unmodified.",
    whyNeeded:
      "Per-lane boundary conditions would need masking on every iteration to serve a handful of pixels. NO_BORDER copies instead.",
    laneRule: "No accumulation here. It is a plain vector load and store.",
    changed: `out[0] = ${outputRow[0]}, out[${VECTOR_WIDTH - 1}] = ${outputRow[VECTOR_WIDTH - 1]}`,
    sewLmul: "u8m1",
    y,
    x: X_START,
    vl: 0,
    vlmax,
    remaining: 0,
    strip,
    tapIndex: null,
    ky: null,
    kx: null,
    base: null,
    lanes: laneList(0, vlmax, X_START, emptyLanes, emptyLanes, emptyLanes),
    loadCells: [],
    outputRow: [...outputRow],
    checkpoint: {
      label: "Matches the scalar naive reference",
      ok,
      detail: `interior out[${X_START}…${X_END - 1}] = [${got.join(", ")}]. Rows ${y + 1} and ${y + 2} repeat the same strips.`,
    },
  });

  return steps;
}

/** Direct window sums for one row, independent of the lane simulation. */
function interiorReference(y: number): number[] {
  const out: number[] = [];
  for (let x = X_START; x < X_END; x += 1) {
    let sum = 0;
    for (let ky = -VECTOR_RADIUS; ky <= VECTOR_RADIUS; ky += 1) {
      for (let kx = -VECTOR_RADIUS; kx <= VECTOR_RADIUS; kx += 1) {
        sum += VECTOR_IMAGE[y + ky][x + kx];
      }
    }
    out.push(Math.floor(sum / VECTOR_AREA));
  }
  return out;
}

export function verifyRvvTraces(): string[] {
  const errors: string[] = [];
  for (const vlmax of VECTOR_VLMAX) {
    const steps = buildRvvTrace(vlmax);
    const last = steps[steps.length - 1];
    if (!last?.checkpoint?.ok) {
      errors.push(`VLMAX ${vlmax}: interior does not match the scalar reference`);
    }
  }
  return errors;
}

const RVV_ERRORS = verifyRvvTraces();
if (RVV_ERRORS.length > 0) {
  console.error("RVV box filter trace mismatch", RVV_ERRORS);
}
