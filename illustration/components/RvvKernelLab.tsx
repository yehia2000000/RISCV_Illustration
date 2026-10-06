"use client";

import LessonBoard from "@/components/LessonBoard";
import RvvDataPanel from "@/components/RvvDataPanel";
import {
  buildRvvTrace,
  VECTOR_AREA,
  VECTOR_HEIGHT,
  VECTOR_KSIZE,
  VECTOR_ROW,
  VECTOR_VLMAX,
  VECTOR_WIDTH,
  type VectorVlmax,
} from "@/lib/convolution/vectorTrace";
import { BOX_RVV_SCORE_KEY } from "@/lib/quizStorage";
import { useBestScore } from "@/lib/useBestScore";
import { useMemo, useState } from "react";
import styles from "./RvvKernelLab.module.css";

const VLEN_CHOICES = [128, 256, 512];

const PARAMETERS: [string, string][] = [
  ["Pixel type", "uint8_t, single channel (grayscale)"],
  ["Supported kernel sizes", "3×3, 5×5, 7×7, 9×9, 11×11 (FilterSize enum)"],
  ["Kernel radius", "kRadius = kSize / 2 → 1, 2, 3, 4, 5"],
  ["Window area", "kArea = kSize × kSize → 9, 25, 49, 81, 121"],
  ["Accumulator type", "uint16_t per lane"],
  ["Border policy supported", "NO_BORDER only"],
  ["Test image size", "66 × 40, random pixels in [0, 255]"],
];

const INTRINSICS: [string, string, string][] = [
  [
    "__riscv_vsetvl_e8m1(length)",
    "Asks the hardware how many 8-bit pixels it can do right now.",
    "Returns vl. On the last chunk of a row it returns less than the full width, so the same loop body handles the ragged tail with no scalar cleanup code.",
  ],
  [
    "__riscv_vmv_v_x_u16m2(0, vl)",
    "Creates an accumulator vector of 16-bit zeros.",
    "16-bit because a window of up to 121 pixels × 255 overflows a byte. This is the running window sum.",
  ],
  [
    "__riscv_vle8_v_u8m1(&in[...], vl)",
    "Loads vl consecutive pixels from one row of the image.",
    "Unit-stride load, the fastest memory pattern. Called once per kernel tap, so n² times per output block.",
  ],
  [
    "__riscv_vwaddu_wv_u16m2(sum, p, vl)",
    "Widening add: adds the 8-bit pixels into the 16-bit accumulator.",
    "The w in wv means the first operand is already the wide one, which avoids a separate zero-extend step.",
  ],
  [
    "__riscv_vdivu_vx_u16m2(sum, kArea, vl)",
    "Divides every lane by n² to get the average.",
    "vx means vector ÷ scalar. Correct, but integer vector divide is the most expensive op in this loop.",
  ],
  [
    "__riscv_vnsrl_wx_u8m1(avg, 0, vl)",
    "Narrows the 16-bit averages back down to 8-bit pixels.",
    "A narrowing shift by 0, used purely as a truncating cast. Safe because the average is always ≤ 255.",
  ],
  [
    "__riscv_vse8_v_u8m1(&out[...], result, vl)",
    "Stores vl finished pixels to the output row.",
    "Ends the strip. x advances by vl and length drops by vl.",
  ],
];

const LOADS: [string, number, number][] = [
  ["3×3", 9, 5],
  ["5×5", 25, 7],
  ["7×7", 49, 9],
  ["9×9", 81, 11],
  ["11×11", 121, 13],
];

const MAGIC: [string, number, number, number, string][] = [
  ["3×3", 9, 1821, 14, "4,179,195"],
  ["5×5", 25, 5243, 17, "33,424,125"],
  ["7×7", 49, 2675, 17, "33,424,125"],
  ["9×9", 81, 6473, 19, "133,699,815"],
  ["11×11", 121, 4333, 19, "133,694,715"],
];

const KERNEL_SOURCE = `template <int32_t kSize>
void box_filter_loop(const uint8_t* in, uint8_t* out,
                     const int width, const int height,
                     const BorderMode border_mode)
{
    assert(border_mode.policy == BorderPolicy::NO_BORDER);

    constexpr int32_t  kRadius = kSize / 2;
    constexpr uint16_t kArea   = static_cast<uint16_t>(kSize * kSize);
    static_assert(kSize * kSize * 255 <= 65535, "window sum must fit in uint16");

    assert(width > 2 * kRadius && height > 2 * kRadius);

    size_t vl = 0;

    const int y_start = kRadius,  y_end = height - kRadius;
    const int x_start = kRadius,  x_end = width  - kRadius;

    for (int y = y_start; y < y_end; ++y)
    {
        for (size_t x = static_cast<size_t>(x_start),
                    length = static_cast<size_t>(x_end - x_start);
             length > 0;
             length -= vl, x += vl)
        {
            vl = __riscv_vsetvl_e8m1(length);

            vuint16m2_t sum = __riscv_vmv_v_x_u16m2(0, vl);
            for (int ky = -kRadius; ky <= kRadius; ++ky)
            {
                for (int kx = -kRadius; kx <= kRadius; ++kx)
                {
                    const vuint8m1_t p = __riscv_vle8_v_u8m1(
                        &in[(y + ky) * width + static_cast<int>(x) + kx], vl);
                    sum = __riscv_vwaddu_wv_u16m2(sum, p, vl);
                }
            }

            const vuint16m2_t avg    = __riscv_vdivu_vx_u16m2(sum, kArea, vl);
            const vuint8m1_t  result = __riscv_vnsrl_wx_u8m1(avg, 0, vl);
            __riscv_vse8_v_u8m1(&out[y * width + x], result, vl);
        }
    }

    // Border pixels are copied through unfiltered.
    copy_rect(0, kRadius, 0, height);                 // left strip
    copy_rect(width - kRadius, width, 0, height);     // right strip
    copy_rect(0, width, 0, kRadius);                  // top strip
    copy_rect(0, width, height - kRadius, height);    // bottom strip
}`;

export default function RvvKernelLab() {
  const [vlmax, setVlmax] = useState<VectorVlmax>(4);
  const [stepIndex, setStepIndex] = useState(0);
  const [vlen, setVlen] = useState(512);
  const [best, setBest] = useBestScore(BOX_RVV_SCORE_KEY);
  const [choice, setChoice] = useState<number | null>(null);

  const steps = useMemo(() => buildRvvTrace(vlmax), [vlmax]);
  const clamped = Math.min(stepIndex, steps.length - 1);
  const step = steps[clamped];

  const answer = (index: number) => {
    if (choice !== null) {
      return;
    }
    setChoice(index);
    if (index === 0) {
      setBest(1);
    }
  };

  const pick = (value: VectorVlmax) => {
    setVlmax(value);
    setStepIndex(0);
  };

  if (!step) {
    return null;
  }

  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        <code>vec::BoxFilterNxN</code> in{" "}
        <code>lib/source/image_box_filter.cpp</code> is Option B made real. All
        five kernel sizes match the scalar reference under{" "}
        <code>qemu-riscv64</code>, and the RVV usage is textbook: strip-mining,
        widening accumulate, and narrowing store. The algorithm it vectorizes is
        still the naive n² convolution, not the separable one.
      </p>

      <section>
        <h3>Parameters and data types</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              {PARAMETERS.map(([property, value]) => (
                <tr key={property}>
                  <th>{property}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The accumulator width is guarded by{" "}
          <code>static_assert(kSize * kSize * 255 &lt;= 65535)</code>. Worst
          case is 11×11, where 121 × 255 = 30,855 — comfortably inside 16 bits.
        </p>
      </section>

      <section>
        <h3>Step through the kernel</h3>
        <div className={styles.controls}>
          <label htmlFor="vlmax">teaching VLMAX</label>
          <div className={styles.pills} id="vlmax">
            {VECTOR_VLMAX.map((value) => (
              <button
                type="button"
                key={value}
                className={`${styles.pill} ${
                  vlmax === value ? styles.on : ""
                }`}
                onClick={() => pick(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            {VECTOR_HEIGHT} × {VECTOR_WIDTH} image · {VECTOR_KSIZE}×
            {VECTOR_KSIZE} · NO_BORDER · row y = {VECTOR_ROW} ·{" "}
            {steps.length} steps
          </p>
        </div>
        <LessonBoard
          watching={step.watching}
          fn={`${step.fn} · ${step.intrinsic}`}
          index={clamped}
          total={steps.length}
          onReset={() => setStepIndex(0)}
          onPrev={() => setStepIndex((n) => Math.max(0, n - 1))}
          onNext={() =>
            setStepIndex((n) => Math.min(steps.length - 1, n + 1))
          }
          code={step.snippet}
          highlightLine={step.highlightLine}
          changed={step.changed}
          extraBar={
            <p className={styles.cost}>
              Per strip of vl pixels · {VECTOR_AREA} vle8 · {VECTOR_AREA} vwaddu
              · 1 vdivu · 1 vnsrl · 1 vse8 — the cost is the same whatever vl is
            </p>
          }
          data={<RvvDataPanel step={step} />}
        />
        <p className={styles.note}>
          VLMAX here is a teaching value so the strips stay readable. Real
          hardware at e8m1 gives VLEN / 8 lanes, so 64 on a 512-bit machine.
        </p>
      </section>

      <details className="fold">
        <summary>The full kernel source</summary>
        <pre className={styles.code}>{KERNEL_SOURCE}</pre>
        <p>
          For each output row the code walks the row left to right in chunks
          whose size the hardware chooses. For each chunk it zeroes a 16-bit
          accumulator, adds every pixel in the n×n window into it, divides by
          the window area, narrows back to 8-bit, and stores. Rows and columns
          within <code>kRadius</code> of the edge are copied straight from the
          input instead of being filtered.
        </p>
      </details>

      <details className="fold">
        <summary>Every intrinsic, in plain terms</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Intrinsic</th>
                <th>What it does</th>
                <th>Why it is here</th>
              </tr>
            </thead>
            <tbody>
              {INTRINSICS.map(([name, what, why]) => (
                <tr key={name}>
                  <td className={styles.mono}>{name}</td>
                  <td>{what}</td>
                  <td>{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="fold">
        <summary>Why e8m1 and u16m2 share one vl</summary>
        <p>
          This is the part that trips people up. <code>vl</code> is set once
          with <code>vsetvl_e8m1</code> — 8-bit elements, LMUL 1 — and then
          handed to intrinsics operating on 16-bit LMUL-2 vectors. That looks
          like a mismatch, but it is not. The number of elements a register
          group holds is <code>VLMAX = VLEN ÷ SEW × LMUL</code>.
        </p>
        <div className={styles.controls}>
          <label htmlFor="rvv-vlen">VLEN</label>
          <div className={styles.pills} id="rvv-vlen">
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
        </div>
        <div className={styles.vlmath}>
          <p className={styles.vlcard}>
            <span>e8m1 — the loads</span>
            {vlen} ÷ 8 × 1 = <strong>{vlen / 8}</strong> elements
          </p>
          <p className={styles.vlcard}>
            <span>e16m2 — the accumulator</span>
            {vlen} ÷ 16 × 2 = <strong>{vlen / 8}</strong> elements
          </p>
        </div>
        <p>
          The ratio SEW / LMUL is 8 in both cases, so both configurations hold
          exactly the same number of elements and one <code>vl</code> is valid
          for both. That invariant is what makes every widening chain in RVV
          work, and it is the same reasoning that makes the u16m2 → u8m1
          narrowing store legal on the way out.
        </p>
      </details>

      <details className="fold">
        <summary>Where the cost is</summary>
        <p>
          Because every output position reloads the whole window, memory traffic
          grows with the square of the kernel size. A separable version — keep a
          running column sum per x, add the incoming row and subtract the
          outgoing one, then sum n of those horizontally — grows linearly
          instead.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kernel</th>
                <th>Current, naive (n²)</th>
                <th>Separable, vectorized (n + 2)</th>
              </tr>
            </thead>
            <tbody>
              {LOADS.map(([kernel, naive, separable]) => (
                <tr key={kernel}>
                  <th>{kernel}</th>
                  <td className={`${styles.num} ${styles.bad}`}>{naive}</td>
                  <td className={`${styles.num} ${styles.good}`}>
                    {separable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          Vector load instructions issued per block of output pixels, lower is
          better. The separable figure assumes one incoming-row load, one
          outgoing-row load, and n loads from the column-sum buffer.
        </p>
      </details>

      <details className="fold">
        <summary>Replacing the divide</summary>
        <p>
          <code>vdivu</code> can be swapped for a widening multiply and a
          narrowing shift, which are both cheap, pipelined operations:{" "}
          <code>avg = (sum × magic) &gt;&gt; shift</code>. Every possible
          accumulator value was checked for all five kernel sizes; these
          constants reproduce <code>sum / kArea</code> exactly, with the
          intermediate product always fitting in 32 bits.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kernel</th>
                <th>Area</th>
                <th>Magic multiplier</th>
                <th>Right shift</th>
                <th>Max product</th>
              </tr>
            </thead>
            <tbody>
              {MAGIC.map(([kernel, area, magic, shift, product]) => (
                <tr key={kernel}>
                  <th>{kernel}</th>
                  <td className={styles.num}>{area}</td>
                  <td className={styles.num}>{magic}</td>
                  <td className={styles.num}>{shift}</td>
                  <td className={styles.num}>{product}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          Exact for all sum in [0, 255 × area].
        </p>
      </details>

      <details className="fold">
        <summary>Invariants a correct simulation must preserve</summary>
        <ul className={styles.list}>
          <li>
            Lanes never exchange data. <code>acc[j]</code> depends only on the
            window centred on <code>(x + j, y)</code>.
          </li>
          <li>
            Each tap contributes exactly one load and one add per chunk, so a
            chunk costs n² loads and n² adds regardless of <code>vl</code>.
          </li>
          <li>
            <code>vl</code> equals VLMAX on every iteration except possibly the
            last of each row.
          </li>
          <li>
            The division is truncating integer division, and the final narrowing
            to 8 bits never loses information because the average cannot exceed
            255.
          </li>
          <li>Border pixels are copies of the input, never filtered values.</li>
        </ul>
      </details>

      <details className="fold">
        <summary>Check yourself · best {best}/1</summary>
        <p className={styles.prompt}>
          A row has 8 interior pixels and VLMAX is 4. How many{" "}
          <code>vle8</code> instructions does the 3×3 kernel issue for that row?
        </p>
        <div className={styles.quizBtns}>
          {["18", "9", "72"].map((label, index) => (
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
          <p className={choice === 0 ? styles.ok : styles.bad}>
            {choice === 0 ? "Correct. " : "Not quite. "}
            Two strips of vl = 4, and each strip issues one load per tap, so 2 ×
            9 = 18. Doubling VLMAX to 8 would make it one strip and 9 loads for
            the same 8 pixels.
          </p>
        ) : null}
      </details>
    </div>
  );
}
