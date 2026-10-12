import type { MemoryView, RegisterView, VectorStep } from "@/lib/vectorTrace";
import {
  COLUMN_SCENE,
  naiveMedian,
  network3Row,
  sortColumns3,
  sortedRowsFromColumns,
  windowSamples,
} from "@/lib/median/model";
import type { MedianStageId } from "@/lib/median/stages";
import { setTeachingVl, type TeachingVlmax } from "@/lib/walkthrough";

const SEW = "e8m1";

function lanes(values: number[], vl: number, vlmax: number): RegisterView["lanes"] {
  return Array.from({ length: vlmax }, (_, lane) => ({
    lane,
    active: lane < vl,
    value: lane < vl ? String(values[lane]) : "—",
    highlight: lane < vl,
  }));
}

function vec(name: string, values: number[], vl: number, vlmax: number): RegisterView {
  return { name, kind: "vector", lanes: lanes(values, vl, vlmax) };
}

function rowMemories(
  rows: number[][],
  offset: number,
  vl: number,
  writtenRow: number | null,
): MemoryView[] {
  return rows.map((row, r) => ({
    name: `row ${r}`,
    hint: "image column",
    cells: row.map((value, index) => ({
      index,
      label: String(index),
      value: String(value),
      highlight: index >= offset && index < offset + vl,
      changed: writtenRow === r && index >= offset && index < offset + vl,
    })),
  }));
}

function laneRule(vl: number, vlmax: number, what: string): string {
  if (vl <= 0) {
    return what;
  }
  const tail =
    vl < vlmax ? ` Lanes ${vl}–${vlmax - 1} are tail (—).` : " This strip fills the teaching VLMAX.";
  return `${what} Active lanes are 0–${vl - 1}.${tail}`;
}

type Base = {
  remaining: number;
  offset: number;
  vl: number;
  strip: number;
  vlmax: TeachingVlmax;
};

function make(base: Base, fields: Omit<VectorStep, "sewmLmul" | "vlmax" | "remaining" | "offset" | "vl" | "strip">): VectorStep {
  return {
    ...fields,
    ...base,
    sewmLmul: SEW,
  };
}

function sameRows(a: number[][], b: number[][]): boolean {
  return a.every((row, r) => row.every((value, c) => value === b[r][c]));
}

function buildInputs(vlmax: TeachingVlmax): VectorStep[] {
  const width = COLUMN_SCENE[0].length;
  const vl = setTeachingVl(width, vlmax);
  const network = network3Row(COLUMN_SCENE).map((item) => item.median);
  const naive = [0, 1, 2, 3].map((x) => naiveMedian(windowSamples(COLUMN_SCENE, x)));
  const ok = network.every((value, index) => value === naive[index]);
  const memories = rowMemories(COLUMN_SCENE, 0, width, null);

  return [
    make(
      { remaining: width, offset: 0, vl: 0, strip: 0, vlmax },
      {
        id: "inputs-scalar",
        fn: "MedianFilter3x3",
        helper: "scalar scanline",
        intrinsic: "(not an intrinsic)",
        snippet: `// one scanline of 3 rows
// border GetPixel stays scalar — this scene is interior
const int th = 4;`,
        highlightLine: 2,
        watching:
          "The vertical 3-sort is the vector work: one lane per image column. Rank th = 4 and the mirror border stay scalar. This scene has no border samples.",
        whatItDoes: "Sets up one interior scanline. Four center pixels will be written, columns 1 through 4.",
        whyNeeded: "A sorting network is a fixed list of min/max ops, so each column can take the same instruction.",
        laneRule: "No lanes yet. The next step asks for a strip of columns.",
        changed: "th = 4. Centers at columns 1, 2, 3, 4.",
        registers: [],
        memories,
      },
    ),
    make(
      { remaining: width, offset: 0, vl, strip: 0, vlmax },
      {
        id: "inputs-vl",
        fn: "ColumnSort",
        helper: "SetVlE8M1",
        intrinsic: "__riscv_vsetvl_e8m1",
        snippet: `const size_t vl = rvv::SetVlE8M1(remaining);
// vl = min(remaining, teaching VLMAX)`,
        highlightLine: 0,
        watching: `Teaching VLMAX is ${vlmax}. The first column strip takes vl = ${vl} out of ${width} columns. SetVl runs inside the strip loop, not once for the image.`,
        whatItDoes: "Asks for a strip of uint8 lanes. e8m1 is one byte per lane.",
        whyNeeded: "Hardware VLMAX depends on VLEN. The control on this page simulates it so the tail is visible.",
        laneRule: laneRule(vl, vlmax, "Each active lane is one image column."),
        changed: `vl = ${vl}, remaining = ${width}.`,
        registers: [
          {
            name: "column index",
            kind: "vector",
            lanes: lanes(
              Array.from({ length: vl }, (_, lane) => lane),
              vl,
              vlmax,
            ),
          },
        ],
        memories,
        flow: "VLMAX → vl",
      },
    ),
    make(
      { remaining: width, offset: 0, vl, strip: 0, vlmax },
      {
        id: "inputs-check",
        fn: "MedianFilter3x3",
        helper: "naive rank check",
        intrinsic: "(scalar checkpoint)",
        snippet: `// network output must equal samples[th]
// centers 1..4`,
        highlightLine: 0,
        watching: `Naive medians at the four centers are [${naive.join(", ")}]. The column network has to match that list.`,
        whatItDoes: "Records the scalar answers the later strips are checked against.",
        whyNeeded: "A faster network is only useful if rank th is unchanged.",
        laneRule: "Checkpoint is scalar. Lanes start in Column sort.",
        changed: `expected out = [${naive.join(", ")}]`,
        registers: [],
        memories,
        checkpoint: {
          label: "Matches scalar naive rank",
          ok,
          detail: `centers 1–4 = [${network.join(", ")}]`,
        },
      },
    ),
  ];
}

function buildColumns(vlmax: TeachingVlmax): VectorStep[] {
  const width = COLUMN_SCENE[0].length;
  const mem = COLUMN_SCENE.map((row) => [...row]);
  const steps: VectorStep[] = [];
  let offset = 0;
  let strip = 0;

  while (offset < width) {
    const remaining = width - offset;
    const vl = setTeachingVl(remaining, vlmax);
    const base = { remaining, offset, vl, strip, vlmax };
    let regs = [0, 1, 2].map((row) => mem[row].slice(offset, offset + vl));

    steps.push(
      make(base, {
        id: `col-${strip}-vl`,
        fn: "ColumnSort",
        helper: "SetVlE8M1",
        intrinsic: "__riscv_vsetvl_e8m1",
        snippet: `const size_t vl = rvv::SetVlE8M1(remaining);`,
        highlightLine: 0,
        watching: `Strip ${strip}: ${remaining} columns left, vl = ${vl}, offset ${offset}.`,
        whatItDoes: "Opens the next strip of image columns.",
        whyNeeded: "The same 3-sort runs on every column. Strip-mining is how a wider row fits in the register file.",
        laneRule: laneRule(vl, vlmax, "Lane i is image column offset + i."),
        changed: `offset ${offset}, vl ${vl}`,
        registers: [],
        memories: rowMemories(mem, offset, vl, null),
      }),
    );

    for (let row = 0; row < 3; row += 1) {
      const name = `v${row}`;
      steps.push(
        make(base, {
          id: `col-${strip}-ld-${row}`,
          fn: "ColumnSort",
          helper: "LoadU8M1",
          intrinsic: "__riscv_vle8_v_u8m1",
          snippet: `vuint8m1_t ${name} = rvv::LoadU8M1(row${row} + offset, vl);`,
          highlightLine: 0,
          watching: `Load row ${row} at offset ${offset}. Lane 0 gets ${regs[row][0]}.`,
          whatItDoes: `Brings ${vl} pixels of row ${row} into ${name}.`,
          whyNeeded: "The compare-swaps read registers, not memory, so each row of the strip is loaded once.",
          laneRule: laneRule(vl, vlmax, `${name}[lane] = row ${row}[offset + lane].`),
          changed: `${name} = [${regs[row].join(", ")}]`,
          registers: [vec(name, regs[row], vl, vlmax)],
          memories: rowMemories(mem, offset, vl, null),
          flow: "memory → register",
        }),
      );
    }

    const pairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [0, 1],
    ];
    pairs.forEach(([i, j], pairIndex) => {
      const left = regs[i];
      const right = regs[j];
      const tmin = left.map((value, lane) => Math.min(value, right[lane]));
      const tmax = left.map((value, lane) => Math.max(value, right[lane]));
      steps.push(
        make(base, {
          id: `col-${strip}-min-${pairIndex}`,
          fn: "ColumnSort",
          helper: "MinU8M1",
          intrinsic: "__riscv_vminu_vv_u8m1",
          snippet: `vuint8m1_t tmin = rvv::MinU8M1(v${i}, v${j}, vl);`,
          highlightLine: 0,
          watching: `Compare-swap ${pairIndex + 1}, smaller half. Lane 0: min(${left[0]}, ${right[0]}) = ${tmin[0]}.`,
          whatItDoes: `Unsigned minimum of v${i} and v${j} into tmin. Sources stay put until the matching max.`,
          whyNeeded: "A compare-swap is a min and a max. They are separate intrinsics, so they are separate steps.",
          laneRule: laneRule(vl, vlmax, "Same pair of rows in every lane. No data-dependent branch."),
          changed: `tmin = [${tmin.join(", ")}]`,
          registers: [vec(`v${i}`, left, vl, vlmax), vec(`v${j}`, right, vl, vlmax), vec("tmin", tmin, vl, vlmax)],
          memories: rowMemories(mem, offset, vl, null),
          flow: "register → register",
        }),
      );
      regs = regs.map((row, index) => (index === i ? tmin : index === j ? tmax : row));
      steps.push(
        make(base, {
          id: `col-${strip}-max-${pairIndex}`,
          fn: "ColumnSort",
          helper: "MaxU8M1",
          intrinsic: "__riscv_vmaxu_vv_u8m1",
          snippet: `vuint8m1_t tmax = rvv::MaxU8M1(v${i}, v${j}, vl);
v${i} = tmin;
v${j} = tmax;`,
          highlightLine: 0,
          watching: `Larger half of the same pair. Lane 0: max(${left[0]}, ${right[0]}) = ${tmax[0]}, then v${i} takes the min.`,
          whatItDoes: `Finishes compare-swap (${i},${j}). The panel shows the sources and the max; the changed line is the write-back.`,
          whyNeeded: "Three of these pairs are a full ascending 3-sort, the same order as the scalar column.",
          laneRule: laneRule(vl, vlmax, "Equal values stay put. The scalar swap uses strict >."),
          changed: `v${i} = [${tmin.join(", ")}], v${j} = [${tmax.join(", ")}]`,
          registers: [
            vec(`v${i} src`, left, vl, vlmax),
            vec(`v${j} src`, right, vl, vlmax),
            vec("tmax", tmax, vl, vlmax),
          ],
          memories: rowMemories(mem, offset, vl, null),
          flow: "register → register",
        }),
      );
    });

    for (let row = 0; row < 3; row += 1) {
      for (let lane = 0; lane < vl; lane += 1) {
        mem[row][offset + lane] = regs[row][lane];
      }
      steps.push(
        make(base, {
          id: `col-${strip}-st-${row}`,
          fn: "ColumnSort",
          helper: "StoreU8M1",
          intrinsic: "__riscv_vse8_v_u8m1",
          snippet: `rvv::StoreU8M1(row${row} + offset, v${row}, vl);`,
          highlightLine: 0,
          watching: `Store sorted row ${row} at offset ${offset}. Lane 0 writes ${regs[row][0]}.`,
          whatItDoes: "Writes one sorted strip back so the next stage can reload it.",
          whyNeeded: "Overlapping windows share these columns. Sorting a column twice would waste the separability.",
          laneRule: laneRule(vl, vlmax, "Tail lanes are not stored."),
          changed: `row ${row}[${offset}..${offset + vl - 1}] = [${regs[row].join(", ")}]`,
          registers: [vec(`v${row}`, regs[row], vl, vlmax)],
          memories: rowMemories(mem, offset, vl, row),
          flow: "register → memory",
        }),
      );
    }

    offset += vl;
    strip += 1;
  }

  const expected = sortedRowsFromColumns(sortColumns3(COLUMN_SCENE));
  const ok = sameRows(mem, expected);
  const last = steps[steps.length - 1];
  last.checkpoint = {
    label: "Matches scalar column sort",
    ok,
    detail: `row 0 = [${mem[0].join(", ")}]`,
  };
  return steps;
}

function buildExtrema(vlmax: TeachingVlmax): VectorStep[] {
  const sorted = sortedRowsFromColumns(sortColumns3(COLUMN_SCENE));
  const scalar = network3Row(COLUMN_SCENE);
  const count = scalar.length;
  const steps: VectorStep[] = [];
  const gotTop: number[] = [];
  const gotMid: number[] = [];
  const gotBot: number[] = [];
  let offset = 0;
  let strip = 0;

  while (offset < count) {
    const remaining = count - offset;
    const vl = setTeachingVl(remaining, vlmax);
    const base = { remaining, offset, vl, strip, vlmax };
    const load = (row: number, shift: number) => sorted[row].slice(offset + shift, offset + shift + vl);
    const span = vl + 2;

    steps.push(
      make(base, {
        id: `ext-${strip}-vl`,
        fn: "RowExtrema",
        helper: "SetVlE8M1",
        intrinsic: "__riscv_vsetvl_e8m1",
        snippet: `const size_t vl = rvv::SetVlE8M1(remaining);
// remaining center pixels, not columns`,
        highlightLine: 0,
        watching: `Output strip ${strip}: ${remaining} centers left, vl = ${vl}. Center column = offset + lane + 1.`,
        whatItDoes: "Strip-mines the four center pixels. Each lane still needs three neighboring sorted columns.",
        whyNeeded: "Those neighbors are loaded as three aligned vectors at offset, offset+1, and offset+2, each of length vl.",
        laneRule: laneRule(vl, vlmax, "Lane i writes the center at column offset + i + 1."),
        changed: `output offset ${offset}, vl ${vl}`,
        registers: [],
        memories: rowMemories(sorted, offset, span, null),
      }),
    );

    const topSrc = [load(0, 0), load(0, 1), load(0, 2)];
    topSrc.forEach((values, shift) => {
      steps.push(
        make(base, {
          id: `ext-${strip}-top-ld-${shift}`,
          fn: "RowExtrema",
          helper: "LoadU8M1",
          intrinsic: "__riscv_vle8_v_u8m1",
          snippet: `vuint8m1_t top${shift} = rvv::LoadU8M1(sorted_row0 + offset + ${shift}, vl);`,
          highlightLine: 0,
          watching: `Top row, shift ${shift}. Lane 0 reads column ${offset + shift}, value ${values[0]}.`,
          whatItDoes: "Loads one aligned copy of the sorted top row.",
          whyNeeded: "The max of three neighbors is two vmax ops. A slide is unnecessary when the row is loaded three times.",
          laneRule: laneRule(vl, vlmax, `top${shift}[lane] = row 0[offset + ${shift} + lane].`),
          changed: `top${shift} = [${values.join(", ")}]`,
          registers: [vec(`top${shift}`, values, vl, vlmax)],
          memories: rowMemories(sorted, offset + shift, vl, null),
          flow: "memory → register",
        }),
      );
    });

    const topA = topSrc[0].map((value, lane) => Math.max(value, topSrc[1][lane]));
    const top = topA.map((value, lane) => Math.max(value, topSrc[2][lane]));
    steps.push(
      make(base, {
        id: `ext-${strip}-top-max-0`,
        fn: "RowExtrema",
        helper: "MaxU8M1",
        intrinsic: "__riscv_vmaxu_vv_u8m1",
        snippet: `vuint8m1_t top = rvv::MaxU8M1(top0, top1, vl);`,
        highlightLine: 0,
        watching: `Max of the first two top neighbors. Lane 0: max(${topSrc[0][0]}, ${topSrc[1][0]}) = ${topA[0]}.`,
        whatItDoes: "First of two vmax ops that reduce three top values to their max.",
        whyNeeded: "The median network wants the max of the top row, not a full horizontal sort.",
        laneRule: laneRule(vl, vlmax, "Independent per center pixel."),
        changed: `partial top = [${topA.join(", ")}]`,
        registers: [vec("top0", topSrc[0], vl, vlmax), vec("top1", topSrc[1], vl, vlmax), vec("top", topA, vl, vlmax)],
        memories: rowMemories(sorted, offset, span, null),
        flow: "register → register",
      }),
    );
    steps.push(
      make(base, {
        id: `ext-${strip}-top-max-1`,
        fn: "RowExtrema",
        helper: "MaxU8M1",
        intrinsic: "__riscv_vmaxu_vv_u8m1",
        snippet: `top = rvv::MaxU8M1(top, top2, vl);`,
        highlightLine: 0,
        watching: `Top-row max is done. Lane 0: max(${topA[0]}, ${topSrc[2][0]}) = ${top[0]}.`,
        whatItDoes: "Folds in the third neighbor. This register is A for each center, called top here.",
        whyNeeded: "Salt that sorted to the bottom of its column is not in this row, so it cannot win the max.",
        laneRule: laneRule(vl, vlmax, "top[lane] = max of three sorted column-tops."),
        changed: `top = [${top.join(", ")}]`,
        registers: [vec("top", top, vl, vlmax)],
        memories: rowMemories(sorted, offset, span, null),
        flow: "register → register",
      }),
    );
    gotTop.push(...top);

    let mid = [load(1, 0), load(1, 1), load(1, 2)];
    mid.forEach((values, shift) => {
      steps.push(
        make(base, {
          id: `ext-${strip}-mid-ld-${shift}`,
          fn: "RowExtrema",
          helper: "LoadU8M1",
          intrinsic: "__riscv_vle8_v_u8m1",
          snippet: `vuint8m1_t m${shift} = rvv::LoadU8M1(sorted_row1 + offset + ${shift}, vl);`,
          highlightLine: 0,
          watching: `Middle row, shift ${shift}. Lane 0 reads ${values[0]} from column ${offset + shift}.`,
          whatItDoes: "Loads the three middle-row neighbors that the 3-sort will rank.",
          whyNeeded: "The middle statistic is a median of 3, so min and max both have to run.",
          laneRule: laneRule(vl, vlmax, `m${shift}[lane] = row 1[offset + ${shift} + lane].`),
          changed: `m${shift} = [${values.join(", ")}]`,
          registers: [vec(`m${shift}`, values, vl, vlmax)],
          memories: rowMemories(sorted, offset + shift, vl, null),
          flow: "memory → register",
        }),
      );
    });

    const midPairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [0, 1],
    ];
    midPairs.forEach(([i, j], pairIndex) => {
      const left = mid[i];
      const right = mid[j];
      const tmin = left.map((value, lane) => Math.min(value, right[lane]));
      const tmax = left.map((value, lane) => Math.max(value, right[lane]));
      steps.push(
        make(base, {
          id: `ext-${strip}-mid-min-${pairIndex}`,
          fn: "RowExtrema",
          helper: "MinU8M1",
          intrinsic: "__riscv_vminu_vv_u8m1",
          snippet: `vuint8m1_t tmin = rvv::MinU8M1(m${i}, m${j}, vl);`,
          highlightLine: 0,
          watching: `Middle-row compare-swap ${pairIndex + 1}, min. Lane 0: min(${left[0]}, ${right[0]}) = ${tmin[0]}.`,
          whatItDoes: "Smaller half of one pair inside the horizontal 3-sort.",
          whyNeeded: "After three pairs the middle register is the median of the three neighbors.",
          laneRule: laneRule(vl, vlmax, "Same pair order as the vertical column sort: (0,1), (1,2), (0,1)."),
          changed: `tmin = [${tmin.join(", ")}]`,
          registers: [vec(`m${i}`, left, vl, vlmax), vec(`m${j}`, right, vl, vlmax), vec("tmin", tmin, vl, vlmax)],
          memories: rowMemories(sorted, offset, span, null),
          flow: "register → register",
        }),
      );
      mid = mid.map((row, index) => (index === i ? tmin : index === j ? tmax : row));
      steps.push(
        make(base, {
          id: `ext-${strip}-mid-max-${pairIndex}`,
          fn: "RowExtrema",
          helper: "MaxU8M1",
          intrinsic: "__riscv_vmaxu_vv_u8m1",
          snippet: `vuint8m1_t tmax = rvv::MaxU8M1(m${i}, m${j}, vl);
m${i} = tmin;
m${j} = tmax;`,
          highlightLine: 0,
          watching: `Middle-row compare-swap ${pairIndex + 1}, max. Lane 0: max(${left[0]}, ${right[0]}) = ${tmax[0]}.`,
          whatItDoes: "Completes the pair. The median will sit in m1 when the third pair finishes.",
          whyNeeded: "Keeping both halves is what makes the middle element the median rather than a min or a max.",
          laneRule: laneRule(vl, vlmax, "One median per center, no cross-lane shuffle."),
          changed: `m${i} = [${tmin.join(", ")}], m${j} = [${tmax.join(", ")}]`,
          registers: [vec(`m${i} src`, left, vl, vlmax), vec(`m${j} src`, right, vl, vlmax), vec("tmax", tmax, vl, vlmax)],
          memories: rowMemories(sorted, offset, span, null),
          flow: "register → register",
        }),
      );
    });
    gotMid.push(...mid[1]);

    const botSrc = [load(2, 0), load(2, 1), load(2, 2)];
    botSrc.forEach((values, shift) => {
      steps.push(
        make(base, {
          id: `ext-${strip}-bot-ld-${shift}`,
          fn: "RowExtrema",
          helper: "LoadU8M1",
          intrinsic: "__riscv_vle8_v_u8m1",
          snippet: `vuint8m1_t bot${shift} = rvv::LoadU8M1(sorted_row2 + offset + ${shift}, vl);`,
          highlightLine: 0,
          watching: `Bottom row, shift ${shift}. Lane 0 reads ${values[0]} from column ${offset + shift}.`,
          whatItDoes: "Loads the three bottom neighbors. The salt 9 lives in this row when it is in the window.",
          whyNeeded: "The network keeps the min of the bottom row, which drops that salt.",
          laneRule: laneRule(vl, vlmax, `bot${shift}[lane] = row 2[offset + ${shift} + lane].`),
          changed: `bot${shift} = [${values.join(", ")}]`,
          registers: [vec(`bot${shift}`, values, vl, vlmax)],
          memories: rowMemories(sorted, offset + shift, vl, null),
          flow: "memory → register",
        }),
      );
    });
    const botA = botSrc[0].map((value, lane) => Math.min(value, botSrc[1][lane]));
    const bot = botA.map((value, lane) => Math.min(value, botSrc[2][lane]));
    steps.push(
      make(base, {
        id: `ext-${strip}-bot-min-0`,
        fn: "RowExtrema",
        helper: "MinU8M1",
        intrinsic: "__riscv_vminu_vv_u8m1",
        snippet: `vuint8m1_t bot = rvv::MinU8M1(bot0, bot1, vl);`,
        highlightLine: 0,
        watching: `Min of the first two bottom neighbors. Lane 0: min(${botSrc[0][0]}, ${botSrc[1][0]}) = ${botA[0]}.`,
        whatItDoes: "First vmin of the bottom row.",
        whyNeeded: "A value that is only large, such as salt 9, loses a min.",
        laneRule: laneRule(vl, vlmax, "Independent per center pixel."),
        changed: `partial bot = [${botA.join(", ")}]`,
        registers: [vec("bot0", botSrc[0], vl, vlmax), vec("bot1", botSrc[1], vl, vlmax), vec("bot", botA, vl, vlmax)],
        memories: rowMemories(sorted, offset, span, null),
        flow: "register → register",
      }),
    );
    steps.push(
      make(base, {
        id: `ext-${strip}-bot-min-1`,
        fn: "RowExtrema",
        helper: "MinU8M1",
        intrinsic: "__riscv_vminu_vv_u8m1",
        snippet: `bot = rvv::MinU8M1(bot, bot2, vl);`,
        highlightLine: 0,
        watching: `Bottom-row min is done. Lane 0: min(${botA[0]}, ${botSrc[2][0]}) = ${bot[0]}.`,
        whatItDoes: "Folds in the third neighbor. This register is C for each center.",
        whyNeeded: "Together with top and the middle median, this is the trio the last stage sorts.",
        laneRule: laneRule(vl, vlmax, "bot[lane] = min of three sorted column-bottoms."),
        changed: `bot = [${bot.join(", ")}]`,
        registers: [vec("top", top, vl, vlmax), vec("mid", mid[1], vl, vlmax), vec("bot", bot, vl, vlmax)],
        memories: rowMemories(sorted, offset, span, null),
        flow: "register → register",
      }),
    );
    gotBot.push(...bot);

    offset += vl;
    strip += 1;
  }

  const ok =
    gotTop.every((value, index) => value === scalar[index].top) &&
    gotMid.every((value, index) => value === scalar[index].mid) &&
    gotBot.every((value, index) => value === scalar[index].bot);
  const last = steps[steps.length - 1];
  last.checkpoint = {
    label: "Matches scalar row extrema",
    ok,
    detail: `top [${gotTop.join(", ")}], mid [${gotMid.join(", ")}], bot [${gotBot.join(", ")}]`,
  };
  return steps;
}

function buildFinal(vlmax: TeachingVlmax): VectorStep[] {
  const scalar = network3Row(COLUMN_SCENE);
  const tops = scalar.map((item) => item.top);
  const mids = scalar.map((item) => item.mid);
  const bots = scalar.map((item) => item.bot);
  const count = scalar.length;
  const steps: VectorStep[] = [];
  const written: number[] = [];
  let offset = 0;
  let strip = 0;

  const trioMemory = (filled: number[]): MemoryView[] => {
    const cells = (name: string, values: number[]) => ({
      name,
      hint: "center column = index + 1",
      cells: values.map((value, index) => ({
        index,
        label: String(index + 1),
        value: String(value),
        highlight: index >= offset && index < offset + Math.min(count - offset, vlmax),
        changed: false,
      })),
    });
    return [
      cells("top", tops),
      cells("mid", mids),
      cells("bot", bots),
      {
        name: "out",
        hint: "center column",
        cells: scalar.map((item, index) => ({
          index,
          label: String(item.x + 1),
          value: index < filled.length ? String(filled[index]) : "—",
          highlight: index >= offset && index < offset + Math.min(count - offset, vlmax),
          changed: index === filled.length - 1 || (filled.length > offset && index >= offset && index < filled.length),
        })),
      },
    ];
  };

  while (offset < count) {
    const remaining = count - offset;
    const vl = setTeachingVl(remaining, vlmax);
    const base = { remaining, offset, vl, strip, vlmax };
    let regs = [tops.slice(offset, offset + vl), mids.slice(offset, offset + vl), bots.slice(offset, offset + vl)];
    const names = ["a", "b", "c"];

    steps.push(
      make(base, {
        id: `fin-${strip}-vl`,
        fn: "FinalMedian",
        helper: "SetVlE8M1",
        intrinsic: "__riscv_vsetvl_e8m1",
        snippet: `const size_t vl = rvv::SetVlE8M1(remaining);`,
        highlightLine: 0,
        watching: `Final strip ${strip}. vl = ${vl}. Each lane holds the top, mid, and bot already chosen for that center.`,
        whatItDoes: "Opens a strip of centers whose three statistics are ready.",
        whyNeeded: "The last median-of-3 is the same 3-sort, and the middle element is the pixel.",
        laneRule: laneRule(vl, vlmax, "Lane i writes center column offset + i + 1."),
        changed: `offset ${offset}, vl ${vl}`,
        registers: [],
        memories: trioMemory(written),
      }),
    );

    regs.forEach((values, index) => {
      steps.push(
        make(base, {
          id: `fin-${strip}-ld-${names[index]}`,
          fn: "FinalMedian",
          helper: "LoadU8M1",
          intrinsic: "__riscv_vle8_v_u8m1",
          snippet: `vuint8m1_t ${names[index]} = rvv::LoadU8M1(${names[index]}_row + offset, vl);`,
          highlightLine: 0,
          watching: `Load ${names[index]} for this strip. Lane 0 is ${values[0]}.`,
          whatItDoes: `Brings the ${names[index] === "a" ? "top max" : names[index] === "b" ? "middle median" : "bottom min"} into a register.`,
          whyNeeded: "median3 needs all three values resident before the compare-swaps.",
          laneRule: laneRule(vl, vlmax, `${names[index]}[lane] is one statistic for that center.`),
          changed: `${names[index]} = [${values.join(", ")}]`,
          registers: [vec(names[index], values, vl, vlmax)],
          memories: trioMemory(written),
          flow: "memory → register",
        }),
      );
    });

    const pairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [0, 1],
    ];
    pairs.forEach(([i, j], pairIndex) => {
      const left = regs[i];
      const right = regs[j];
      const tmin = left.map((value, lane) => Math.min(value, right[lane]));
      const tmax = left.map((value, lane) => Math.max(value, right[lane]));
      steps.push(
        make(base, {
          id: `fin-${strip}-min-${pairIndex}`,
          fn: "FinalMedian",
          helper: "MinU8M1",
          intrinsic: "__riscv_vminu_vv_u8m1",
          snippet: `vuint8m1_t tmin = rvv::MinU8M1(${names[i]}, ${names[j]}, vl);`,
          highlightLine: 0,
          watching: `Final compare-swap ${pairIndex + 1}, min. Lane 0: min(${left[0]}, ${right[0]}) = ${tmin[0]}.`,
          whatItDoes: "Smaller half of A, B, C.",
          whyNeeded: "The output is the middle of the three, so both min and max run.",
          laneRule: laneRule(vl, vlmax, "Pair order (0,1), (1,2), (0,1). The median ends in b."),
          changed: `tmin = [${tmin.join(", ")}]`,
          registers: [vec(names[i], left, vl, vlmax), vec(names[j], right, vl, vlmax), vec("tmin", tmin, vl, vlmax)],
          memories: trioMemory(written),
          flow: "register → register",
        }),
      );
      regs = regs.map((row, index) => (index === i ? tmin : index === j ? tmax : row));
      const medianNow = pairIndex === pairs.length - 1;
      steps.push(
        make(base, {
          id: `fin-${strip}-max-${pairIndex}`,
          fn: "FinalMedian",
          helper: "MaxU8M1",
          intrinsic: "__riscv_vmaxu_vv_u8m1",
          snippet: `vuint8m1_t tmax = rvv::MaxU8M1(${names[i]}, ${names[j]}, vl);
${names[i]} = tmin;
${names[j]} = tmax;`,
          highlightLine: 0,
          watching: `Final compare-swap ${pairIndex + 1}, max. Lane 0: max(${left[0]}, ${right[0]}) = ${tmax[0]}.`,
          whatItDoes: medianNow
            ? "Last pair. b now holds the median of A, B, and C."
            : "Completes this pair. b is the median only after the third pair.",
          whyNeeded: "This is the same median3 the scalar final stage calls.",
          laneRule: laneRule(vl, vlmax, "No lane reads another center's values."),
          changed: `${names[i]} = [${tmin.join(", ")}], ${names[j]} = [${tmax.join(", ")}]`,
          registers: [
            vec(`${names[i]} src`, left, vl, vlmax),
            vec(`${names[j]} src`, right, vl, vlmax),
            vec(medianNow ? "b (median)" : "tmax", medianNow ? regs[1] : tmax, vl, vlmax),
          ],
          memories: trioMemory(written),
          flow: "register → register",
        }),
      );
    });

    written.push(...regs[1]);
    steps.push(
      make(base, {
        id: `fin-${strip}-st`,
        fn: "FinalMedian",
        helper: "StoreU8M1",
        intrinsic: "__riscv_vse8_v_u8m1",
        snippet: `rvv::StoreU8M1(out + offset, b, vl);`,
        highlightLine: 0,
        watching: `Store the middle register. Lane 0 writes ${regs[1][0]} at center column ${offset + 1}.`,
        whatItDoes: "Writes the median of top, mid, and bot for each center in the strip.",
        whyNeeded: "That value is the filter output. It matches the naive sample at rank 4.",
        laneRule: laneRule(vl, vlmax, "b holds the median after the 3-sort."),
        changed: `out = [${written.join(", ")}]`,
        registers: [vec("b", regs[1], vl, vlmax)],
        memories: trioMemory(written),
        flow: "register → memory",
      }),
    );

    offset += vl;
    strip += 1;
  }

  const expected = scalar.map((item) => item.median);
  const ok = written.every((value, index) => value === expected[index]);
  const last = steps[steps.length - 1];
  last.checkpoint = {
    label: "Matches scalar FinalMedian",
    ok,
    detail: `out = [${written.join(", ")}]`,
  };
  return steps;
}

export function buildMedianVectorLesson(stage: MedianStageId, vlmax: TeachingVlmax): VectorStep[] {
  switch (stage) {
    case "inputs":
      return buildInputs(vlmax);
    case "columns":
      return buildColumns(vlmax);
    case "extrema":
      return buildExtrema(vlmax);
    case "final":
      return buildFinal(vlmax);
  }
}

export function verifyMedianVectorTraces(): string[] {
  const errors: string[] = [];
  const vlmaxes: TeachingVlmax[] = [2, 4, 8];
  for (const vlmax of vlmaxes) {
    for (const stage of ["inputs", "columns", "extrema", "final"] as const) {
      const steps = buildMedianVectorLesson(stage, vlmax);
      if (steps.length === 0) {
        errors.push(`${stage} vlmax ${vlmax} has no steps`);
        continue;
      }
      const last = steps[steps.length - 1];
      if (!last.checkpoint?.ok) {
        errors.push(`${stage} vlmax ${vlmax}: ${last.checkpoint?.detail ?? "missing checkpoint"}`);
      }
      const intrinsics = new Set(steps.map((item) => item.intrinsic));
      if (stage !== "inputs" && !intrinsics.has("__riscv_vsetvl_e8m1")) {
        errors.push(`${stage} vlmax ${vlmax} never sets vl`);
      }
    }
  }
  return errors;
}

const VECTOR_ERRORS = verifyMedianVectorTraces();
if (VECTOR_ERRORS.length > 0) {
  throw new Error(`Median vector mismatch: ${VECTOR_ERRORS.join(" | ")}`);
}
