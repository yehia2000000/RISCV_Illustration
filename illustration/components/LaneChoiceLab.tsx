"use client";

import { BOX_LANES_SCORE_KEY } from "@/lib/quizStorage";
import { useBestScore } from "@/lib/useBestScore";
import {
  VECTOR_AREA,
  VECTOR_HEIGHT,
  VECTOR_IMAGE,
  VECTOR_KSIZE,
  VECTOR_RADIUS,
  VECTOR_ROW,
  VECTOR_WIDTH,
} from "@/lib/convolution/vectorTrace";
import { useState } from "react";
import styles from "./LaneChoiceLab.module.css";

/** Output pixels the diagrams walk: x = 1…8 on row y = 1. */
const OUT_X_START = VECTOR_RADIUS;
const OUT_COUNT = VECTOR_WIDTH - 2 * VECTOR_RADIUS;
const VLEN_CHOICES = [128, 256, 512];
const OFFSETS = [-VECTOR_RADIUS, 0, VECTOR_RADIUS];
const LANE_DISPLAY_CAP = 12;

const TAPS = OFFSETS.flatMap((ky) => OFFSETS.map((kx) => ({ ky, kx })));

function windowValue(ky: number, kx: number, outX: number): number {
  return VECTOR_IMAGE[VECTOR_ROW + ky][outX + kx];
}

function partialSum(outX: number, taps: number): number {
  let sum = 0;
  for (let index = 0; index < taps; index += 1) {
    const tap = TAPS[index];
    sum += windowValue(tap.ky, tap.kx, outX);
  }
  return sum;
}

/** Pixels Option A puts in its lanes: the 3x3 window of output (1, 1). */
const OPTION_A_CELLS = new Set(
  OFFSETS.flatMap((ky) =>
    OFFSETS.map((kx) => `${OUT_X_START + kx},${VECTOR_ROW + ky}`),
  ),
);

/** Pixels Option B has loaded after `taps` taps, across all its lanes. */
function optionBCells(taps: number, lanes: number): Set<string> {
  const cells = new Set<string>();
  for (let index = 0; index < taps; index += 1) {
    const tap = TAPS[index];
    for (let lane = 0; lane < lanes; lane += 1) {
      cells.add(`${OUT_X_START + tap.kx + lane},${VECTOR_ROW + tap.ky}`);
    }
  }
  return cells;
}

function isFrame(x: number, y: number): boolean {
  return (
    x < VECTOR_RADIUS ||
    x >= VECTOR_WIDTH - VECTOR_RADIUS ||
    y < VECTOR_RADIUS ||
    y >= VECTOR_HEIGHT - VECTOR_RADIUS
  );
}

export default function LaneChoiceLab() {
  const [vlen, setVlen] = useState(512);
  const [taps, setTaps] = useState(VECTOR_AREA);
  const [ky, setKy] = useState(-VECTOR_RADIUS);
  const [kx, setKx] = useState(0);
  const [best, setBest] = useBestScore(BOX_LANES_SCORE_KEY);
  const [choice, setChoice] = useState<number | null>(null);

  const vlmax = vlen / 8;
  const busyB = Math.min(vlmax, OUT_COUNT);
  const shown = Math.min(vlmax, LANE_DISPLAY_CAP);
  const hidden = vlmax - shown;
  const done = taps === VECTOR_AREA;
  const readB = optionBCells(taps, busyB);

  const answer = (index: number) => {
    if (choice !== null) {
      return;
    }
    setChoice(index);
    if (index === 1) {
      setBest(1);
    }
  };

  const row = VECTOR_ROW + ky;
  const fetchCount = (x: number) =>
    OFFSETS.filter(
      (offset) =>
        x >= OUT_X_START + offset && x < OUT_X_START + offset + OUT_COUNT,
    ).length;

  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        Vectorizing the naive filter comes down to a single decision: which
        quantity occupies the lanes of a vector register. There are two
        plausible answers, and they lead to completely different kernels. Every
        diagram on this page reads the one image below.
      </p>

      <section className={styles.scene}>
        <h3>The input image</h3>
        <p>
          A {VECTOR_HEIGHT} × {VECTOR_WIDTH} grayscale image, a {VECTOR_KSIZE}×
          {VECTOR_KSIZE} box filter, NO_BORDER. Only the interior is filtered,
          so the outputs in play are x = {OUT_X_START}…
          {OUT_X_START + OUT_COUNT - 1} on row y = {VECTOR_ROW}. Option A
          computes the first of them on its own; Option B computes all{" "}
          {OUT_COUNT} at once.
        </p>
        <div className={styles.scenePair}>
          <div className={styles.sceneCol}>
            <h4>
              in
              <span className={styles.colHint}>
                {VECTOR_HEIGHT} × {VECTOR_WIDTH}
              </span>
            </h4>
            <table className={styles.imgTable}>
              <thead>
                <tr>
                  <th className={styles.axis}> </th>
                  {Array.from({ length: VECTOR_WIDTH }, (_, x) => (
                    <th key={`sx-${x}`} className={styles.axis}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: VECTOR_HEIGHT }, (_, y) => (
                  <tr key={`sy-${y}`}>
                    <th className={styles.axis}>{y}</th>
                    {Array.from({ length: VECTOR_WIDTH }, (_, x) => {
                      const bits = [styles.imgCell];
                      if (isFrame(x, y)) bits.push(styles.frameCell);
                      if (readB.has(`${x},${y}`)) bits.push(styles.readB);
                      if (OPTION_A_CELLS.has(`${x},${y}`))
                        bits.push(styles.readA);
                      return (
                        <td key={`s-${x}-${y}`} className={bits.join(" ")}>
                          {VECTOR_IMAGE[y][x]}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.sceneCol}>
            <h4>
              out
              <span className={styles.colHint}>sum / {VECTOR_AREA}</span>
            </h4>
            <table className={styles.imgTable}>
              <thead>
                <tr>
                  <th className={styles.axis}> </th>
                  {Array.from({ length: VECTOR_WIDTH }, (_, x) => (
                    <th key={`ox-${x}`} className={styles.axis}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: VECTOR_HEIGHT }, (_, y) => (
                  <tr key={`oy-${y}`}>
                    <th className={styles.axis}>{y}</th>
                    {Array.from({ length: VECTOR_WIDTH }, (_, x) => {
                      const lane = x - OUT_X_START;
                      const traced =
                        y === VECTOR_ROW && lane >= 0 && lane < OUT_COUNT;
                      if (!traced) {
                        return (
                          <td key={`o-${x}-${y}`} className={styles.outCell}>
                            ·
                          </td>
                        );
                      }
                      return (
                        <td
                          key={`o-${x}-${y}`}
                          className={`${styles.outCell} ${
                            done ? styles.outDone : ""
                          }`}
                        >
                          {done
                            ? Math.floor(
                                partialSum(x, VECTOR_AREA) / VECTOR_AREA,
                              )
                            : "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className={styles.legend}>
          <span>
            <span className={`${styles.swatch} ${styles.swatchA}`} />
            Option A&apos;s 9 lanes · the window of output ({OUT_X_START},{" "}
            {VECTOR_ROW})
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.swatchB}`} />
            loaded by Option B so far ({taps} of {VECTOR_AREA} taps)
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.swatchOut}`} />
            finished output row y = {VECTOR_ROW}
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.swatchFrame}`} />
            NO_BORDER frame, never filtered
          </span>
        </p>
      </section>

      <div className={styles.controls}>
        <label htmlFor="vlen">machine VLEN</label>
        <div className={styles.pills} id="vlen">
          {VLEN_CHOICES.map((value) => (
            <button
              type="button"
              key={value}
              className={`${styles.pill} ${vlen === value ? styles.on : ""}`}
              onClick={() => setVlen(value)}
            >
              {value} bit
            </button>
          ))}
        </div>
        <p className={styles.note}>
          e8m1 → VLMAX = VLEN / 8 = {vlmax} lanes
        </p>
        <label htmlFor="taps">Option B taps</label>
        <input
          id="taps"
          type="range"
          min={0}
          max={VECTOR_AREA}
          value={taps}
          onChange={(event) => setTaps(Number(event.target.value))}
        />
        <p className={styles.note}>
          {taps} / {VECTOR_AREA} — drag to fill the image and the lanes
        </p>
      </div>

      <div className={styles.options}>
        <section className={`${styles.option} ${styles.rejected}`}>
          <h3>
            Option A — one window per vector
            <span className={`${styles.tag} ${styles.tagBad}`}>rejected</span>
          </h3>
          <p>
            Put the n² window pixels in the lanes, then horizontally reduce them
            to a single number. It mirrors the scalar code most literally. All
            nine lanes come from the teal-ringed window above, the neighbourhood
            of output ({OUT_X_START}, {VECTOR_ROW}).
          </p>
          <div className={styles.laneStrip}>
            {Array.from({ length: shown }, (_, lane) => {
              const tap = TAPS[lane];
              const busy = lane < VECTOR_AREA;
              return (
                <div
                  key={`a-${lane}`}
                  className={`${styles.laneBox} ${
                    busy ? styles.busy : styles.idle
                  }`}
                >
                  <span>
                    {busy
                      ? `in(${OUT_X_START + tap.kx}, ${VECTOR_ROW + tap.ky})`
                      : `lane ${lane}`}
                  </span>
                  <strong>
                    {busy ? windowValue(tap.ky, tap.kx, OUT_X_START) : "idle"}
                  </strong>
                </div>
              );
            })}
            {hidden > 0 ? (
              <span className={styles.more}>+{hidden} idle</span>
            ) : null}
          </div>
          <p className={styles.flow}>
            vredsum → {partialSum(OUT_X_START, VECTOR_AREA)} → ÷ {VECTOR_AREA} →{" "}
            {Math.floor(partialSum(OUT_X_START, VECTOR_AREA) / VECTOR_AREA)} →
            out({OUT_X_START}, {VECTOR_ROW})
          </p>
          <ul>
            <li>
              Produces only one output pixel per vector pass, so throughput
              barely beats scalar.
            </li>
            <li>
              Leaves most lanes idle: {VECTOR_AREA} of {vlmax} busy at 3×3 on a{" "}
              {vlen}-bit register.
            </li>
            <li>
              Needs a reduction, which is inherently serial and crosses lanes.
            </li>
          </ul>
        </section>

        <section className={`${styles.option} ${styles.chosen}`}>
          <h3>
            Option B — one output pixel per lane
            <span className={`${styles.tag} ${styles.tagGood}`}>used</span>
          </h3>
          <p>
            Put neighbouring output pixels in the lanes and iterate the n² taps
            over time. Lane j owns output (j + {OUT_X_START}, {VECTOR_ROW}), and
            each tap loads one contiguous run of {busyB} pixels — the yellow
            cells above, filling in as you drag the tap slider.
          </p>
          <div className={styles.laneStrip}>
            {Array.from({ length: Math.min(shown, busyB + 2) }, (_, lane) => {
              const busy = lane < busyB;
              const outX = OUT_X_START + lane;
              const sum = busy ? partialSum(outX, taps) : 0;
              return (
                <div
                  key={`b-${lane}`}
                  className={`${styles.laneBox} ${
                    busy ? styles.busy : styles.idle
                  }`}
                >
                  <span>
                    {busy ? `out(${outX}, ${VECTOR_ROW})` : `lane ${lane}`}
                  </span>
                  <strong>
                    {busy
                      ? done
                        ? Math.floor(sum / VECTOR_AREA)
                        : sum
                      : "idle"}
                  </strong>
                </div>
              );
            })}
          </div>
          <p className={styles.flow}>
            {done
              ? `÷ ${VECTOR_AREA} in every lane → ${busyB} output pixels after ${VECTOR_AREA} loads`
              : `running window sums after ${taps} of ${VECTOR_AREA} taps`}
          </p>
          <ul>
            <li>
              Lane 0 reads exactly the nine pixels Option A puts in its lanes,
              and ends on the same{" "}
              {Math.floor(partialSum(OUT_X_START, VECTOR_AREA) / VECTOR_AREA)}.
              The other {busyB - 1} lanes come free.
            </li>
            <li>
              Every lane runs a private copy of the scalar algorithm, so no lane
              ever needs to talk to another.
            </li>
            <li>
              One vector instruction advances VLEN / 8 = {vlmax} pixels at once.
            </li>
            <li>
              This row only has {OUT_COUNT} interior pixels, so vl = {busyB}{" "}
              here. On a wide image all {vlmax} lanes stay busy.
            </li>
          </ul>
        </section>
      </div>

      <section>
        <h3>Why x goes in the lanes and not y</h3>
        <p>
          Consecutive x values are consecutive addresses, which makes each tap
          load unit-stride, the fastest memory pattern there is. Vectorizing
          over y would make every load stride by <code>width</code>, costing far
          more cache traffic for exactly the same data.
        </p>
      </section>

      <section>
        <h3>What that does to the loop nest</h3>
        <div className={styles.nest}>
          <div>
            <h4>Scalar — four loops</h4>
            <pre className={styles.code}>{`for y
  for x
    acc = 0                       // one pixel's sum
    for ky
      for kx
        acc += in[(y+ky)*w + x+kx]
    out[y*w + x] = acc / kArea`}</pre>
          </div>
          <div>
            <h4>Vector — x splits into chunk and lane</h4>
            <pre className={styles.code}>{`for y
  for x-chunk (x += vl)
    vacc = 0                      // vl independent sums
    for ky
      for kx
        vacc += vle8(&in[(y+ky)*w + x+kx])
    vse8(&out[y*w + x], vacc / kArea)`}</pre>
          </div>
        </div>
        <p>
          The lane dimension is pushed all the way innermost, past ky and kx,
          where hardware executes it in parallel instead of a loop running it.
          The accumulator is promoted from a scalar to a vector holding{" "}
          <code>vl</code> independent partial sums, and the x loop advances by{" "}
          <code>vl</code> instead of by 1.
        </p>
      </section>

      <section>
        <h3>Why one scalar load becomes one vector load at the same address</h3>
        <p>
          The window slides by exactly one pixel when x advances by one. So for
          a fixed tap (ky, kx), the neighbours of a contiguous run of output
          pixels are themselves a contiguous run of input pixels — the same run,
          shifted by kx. Each bracketed run below is one <code>vle8</code>. Here
          p0…p9 are the ten pixels of one row of the image above.
        </p>
        <div className={styles.controls}>
          <label htmlFor="ky">tap row ky</label>
          <div className={styles.pills} id="ky">
            {OFFSETS.map((value) => (
              <button
                type="button"
                key={`ky-${value}`}
                className={`${styles.pill} ${ky === value ? styles.on : ""}`}
                onClick={() => setKy(value)}
              >
                {value > 0 ? `+${value}` : value}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            reading input row y {ky > 0 ? "+" : "−"} {Math.abs(ky)} = {row}
          </p>
        </div>
        <div className={styles.shiftWrap}>
          <table className={styles.shift}>
            <thead>
              <tr>
                <th> </th>
                {Array.from({ length: VECTOR_WIDTH }, (_, x) => (
                  <th key={`h-${x}`}>p{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>input row {row}</th>
                {Array.from({ length: VECTOR_WIDTH }, (_, x) => {
                  const inRun =
                    x >= OUT_X_START + kx && x < OUT_X_START + kx + OUT_COUNT;
                  return (
                    <td
                      key={`src-${x}`}
                      className={`${styles.cell} ${inRun ? styles.run : ""}`}
                    >
                      {VECTOR_IMAGE[row][x]}
                    </td>
                  );
                })}
              </tr>
              {OFFSETS.map((offset) => (
                <tr key={`run-${offset}`}>
                  <th>
                    <button
                      type="button"
                      className={styles.rowBtn}
                      onClick={() => setKx(offset)}
                    >
                      kx = {offset > 0 ? `+${offset}` : offset}
                    </button>
                  </th>
                  {Array.from({ length: VECTOR_WIDTH }, (_, x) => {
                    const lane = x - (OUT_X_START + offset);
                    const inRun = lane >= 0 && lane < OUT_COUNT;
                    if (!inRun) {
                      return (
                        <td
                          key={`r-${offset}-${x}`}
                          className={`${styles.cell} ${styles.blank}`}
                        />
                      );
                    }
                    return (
                      <td
                        key={`r-${offset}-${x}`}
                        className={`${styles.cell} ${styles.run} ${
                          offset === kx ? styles.runOn : ""
                        }`}
                      >
                        {VECTOR_IMAGE[row][x]}
                        <span className={styles.laneTag}>lane {lane}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th>fetched</th>
                {Array.from({ length: VECTOR_WIDTH }, (_, x) => {
                  const count = fetchCount(x);
                  return (
                    <td
                      key={`f-${x}`}
                      className={`${styles.cell} ${
                        count === OFFSETS.length ? styles.fetch3 : styles.fetch1
                      }`}
                    >
                      ×{count}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className={styles.sumHead}>
          the same three loads, stacked lane by lane
        </h4>
        <div className={styles.shiftWrap}>
          <table className={styles.sumTable}>
            <thead>
              <tr>
                <th> </th>
                <th className={styles.opCol}> </th>
                {Array.from({ length: OUT_COUNT }, (_, lane) => (
                  <th key={`sh-${lane}`}>lane {lane}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>owns</th>
                <td className={styles.opCol}> </td>
                {Array.from({ length: OUT_COUNT }, (_, lane) => (
                  <td key={`so-${lane}`} className={styles.ownsCell}>
                    out({OUT_X_START + lane}, {VECTOR_ROW})
                  </td>
                ))}
              </tr>
              {OFFSETS.map((offset, index) => (
                <tr key={`add-${offset}`}>
                  <th>
                    <button
                      type="button"
                      className={styles.rowBtn}
                      onClick={() => setKx(offset)}
                    >
                      vle8 kx = {offset > 0 ? `+${offset}` : offset}
                    </button>
                  </th>
                  <td className={styles.opCol}>{index === 0 ? " " : "+"}</td>
                  {Array.from({ length: OUT_COUNT }, (_, lane) => (
                    <td
                      key={`add-${offset}-${lane}`}
                      className={`${styles.addend} ${
                        offset === kx ? styles.addendOn : ""
                      }`}
                    >
                      {VECTOR_IMAGE[row][OUT_X_START + offset + lane]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className={styles.ruleRow}>
                <th> </th>
                <td className={styles.opCol}> </td>
                {Array.from({ length: OUT_COUNT }, (_, lane) => (
                  <td key={`rule-${lane}`} />
                ))}
              </tr>
              <tr>
                <th>row sum</th>
                <td className={styles.opCol}>=</td>
                {Array.from({ length: OUT_COUNT }, (_, lane) => (
                  <td key={`sum-${lane}`} className={styles.sumCell}>
                    {OFFSETS.reduce(
                      (total, offset) =>
                        total + VECTOR_IMAGE[row][OUT_X_START + offset + lane],
                      0,
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Aligned by lane, the three shifted loads are just three vectors added
          together, and nothing moves sideways: lane 0 sums only its own three
          pixels, lane 7 only its own. That column of additions is the row sum
          of one window row for {OUT_COUNT} output pixels at once. Repeat it for
          ky = −1, 0, +1 and the three row sums add up to the full window sum —
          lane 0 reaches {partialSum(OUT_X_START, VECTOR_AREA)}, which divides
          to {Math.floor(partialSum(OUT_X_START, VECTOR_AREA) / VECTOR_AREA)},
          the value in the out grid at the top.
        </p>
        <p>
          Lane 0 accumulates p0, p1, p2 — exactly the three top neighbours of
          output pixel x = 1. Lane 7 accumulates p7, p8, p9, the neighbours of
          x = 8. Repeat for rows y − 1, y, y + 1 and the accumulator holds eight
          finished window sums after nine loads. So the scalar expression{" "}
          <code>in[(y+ky)*width + x+kx]</code> is reused character for character
          as the vector load address; only its meaning changes, from one pixel
          to <code>vl</code> pixels. The <code>×3</code> row is the redundancy of
          the naive algorithm made visible: those pixels are fetched three times
          over, and removing that overlap is exactly what the separable version
          does.
        </p>
      </section>

      <section>
        <h3>Why the result is bit-identical</h3>
        <p>
          Nothing ever crosses lanes. Lane j is a completely private copy of the
          scalar algorithm: the same n² values, added in the same order, divided
          by the same constant with the same truncating integer division. No
          reductions, no shuffles, no carries between neighbours. That is why
          the output matches the reference exactly rather than approximately,
          and why the tests pass with no tolerance.
        </p>
      </section>

      <section>
        <h3>The three places it is not a literal translation</h3>
        <ul className={styles.deviations}>
          <li>
            <strong>Accumulator narrowed from uint32_t to 16 bits.</strong> Not
            cosmetic: halving the element width doubles the lanes per register.
            Legal only because the <code>static_assert</code> proves the
            worst-case window sum fits.
          </li>
          <li>
            <strong>Border pixels handled differently.</strong> The scalar
            version computes every pixel including edges; the vector version
            restricts the main loop to the interior and copies the border
            through. Per-lane boundary conditions would need masking, which adds
            cost to every iteration to serve a handful of pixels.
          </li>
          <li>
            <strong>Ragged row ends handled by strip-mining</strong>, not a
            scalar cleanup loop. <code>vsetvl</code> simply returns a smaller{" "}
            <code>vl</code> on the final chunk and the identical loop body
            handles it.
          </li>
        </ul>
      </section>

      <section>
        <h3>Comparison</h3>
        <div className={styles.tableWrap}>
          <table className={styles.compare}>
            <thead>
              <tr>
                <th> </th>
                <th>Option A — window in lanes</th>
                <th>Option B — output pixels in lanes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>A lane holds</th>
                <td>one of the n² window pixels</td>
                <td>one output pixel</td>
              </tr>
              <tr>
                <th>Iterated over time</th>
                <td>output pixels, one per pass</td>
                <td>the n² taps</td>
              </tr>
              <tr>
                <th>Output per pass</th>
                <td className={styles.bad}>1 pixel</td>
                <td className={styles.good}>vl pixels (up to VLEN / 8)</td>
              </tr>
              <tr>
                <th>Lanes busy at 3×3, VLEN {vlen}</th>
                <td className={styles.bad}>
                  {VECTOR_AREA} of {vlmax}
                </td>
                <td className={styles.good}>
                  {vlmax} of {vlmax}
                </td>
              </tr>
              <tr>
                <th>Cross-lane traffic</th>
                <td className={styles.bad}>horizontal reduction, serial</td>
                <td className={styles.good}>none</td>
              </tr>
              <tr>
                <th>Load pattern</th>
                <td>n² short loads, one window row each</td>
                <td>n² unit-stride loads, vl pixels each</td>
              </tr>
              <tr>
                <th>Scaling with kernel size</th>
                <td>more lanes used, same one pixel out</td>
                <td>more taps in time, same vl pixels out</td>
              </tr>
              <tr>
                <th>Ragged row ends</th>
                <td>needs its own handling</td>
                <td className={styles.good}>vsetvl strip-mining</td>
              </tr>
              <tr>
                <th>Result vs scalar</th>
                <td>reduction changes the add order</td>
                <td className={styles.good}>bit-identical</td>
              </tr>
              <tr>
                <th>Verdict</th>
                <td className={styles.bad}>rejected</td>
                <td className={styles.good}>
                  used in <code>vec::BoxFilterNxN</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <details className="fold">
        <summary>Check yourself · best {best}/1</summary>
        <p className={styles.prompt}>
          On a 512-bit machine at e8m1, why does Option B beat Option A even
          though both do nine loads per window?
        </p>
        <div className={styles.quizBtns}>
          {[
            "Option B issues fewer loads per output pixel",
            "Option B finishes 64 output pixels per nine loads, Option A finishes 1",
            "Option B uses a cheaper divide instruction",
          ].map((label, index) => (
            <button
              type="button"
              key={label}
              className="btn"
              onClick={() => answer(index)}
            >
              {label}
            </button>
          ))}
        </div>
        {choice !== null ? (
          <p className={choice === 1 ? styles.ok : styles.bad}>
            {choice === 1 ? "Correct. " : "Not quite. "}
            Both options touch nine window pixels, and both divide once per
            output. The difference is what a load carries: Option A&apos;s nine
            loads fill one window, Option B&apos;s nine loads fill {vlmax}{" "}
            windows at once, then a reduction that Option A needs and Option B
            does not.
          </p>
        ) : null}
      </details>
    </div>
  );
}
