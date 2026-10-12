import ConvolutionProgress from "@/components/ConvolutionProgress";
import Link from "next/link";
import { TEACHING_IMAGE } from "@/lib/boxFilter";
import styles from "../home.module.css";
import local from "./overview.module.css";

const LESSONS = [
  {
    href: "/convolution/walkthrough",
    title: "Scalar Walkthrough",
    body: "Column x = 1 on the 4×3 scene. Naive n×n loads, then separable row_sums, then the extra accumulator.",
  },
  {
    href: "/convolution/vector",
    title: "Vector Walkthrough",
    body: "Coming later. RISC-V Vector for this kernel, one intrinsic at a time.",
  },
];

export default function ConvolutionOverviewPage() {
  return (
    <div className={styles.home}>
      <p className={styles.kicker}>Concepts · ref::BoxFilterNxN</p>
      <h1>Box filter</h1>
      <p className={styles.lead}>
        A box filter is a low-pass smoother. Each output pixel is the{" "}
        <strong>average</strong> of an n×n neighborhood (uniform weights, then
        divide by n²).
      </p>

      <ConvolutionProgress />

      <p>
        For a 3×3 kernel the center and its 8 neighbors are summed and divided
        by 9. <code>ref::BoxFilterNxN</code> writes a <strong>same-size</strong>{" "}
        output. Samples outside the image go through <code>GetPixel</code> and{" "}
        <code>BorderMode</code>. Division is integer.
      </p>

      <div className={local.preview}>
        <div>
          <h2>Teaching window</h2>
          <p>
            Interior 3×3 of the walkthrough scene. Sum 450, then 450 / 9 = 50.
          </p>
          <div className={`panel ${local.gridWrap}`}>
            <table className={local.grid}>
              <tbody>
                {TEACHING_IMAGE.slice(0, 3).map((row, y) => (
                  <tr key={y}>
                    {row.map((value, x) => (
                      <td key={x}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.lessons}>
        {LESSONS.map((item) => (
          <Link key={item.href} href={item.href} className={`panel ${styles.lessonCard}`}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <span className={styles.go}>Open →</span>
          </Link>
        ))}
      </div>

      <details className="fold">
        <summary>Show contract</summary>
        <ul className={styles.contractList}>
          <li>
            <code>input</code> / <code>output</code> — same{" "}
            <code>Width×Height</code>, <code>Image&lt;uint8_t&gt;</code>
          </li>
          <li>
            <code>filter_size</code> — 3, 5, 7, 9, or 11 (
            <code>FilterSize::KernelSizeNxN</code>)
          </li>
          <li>
            <code>border_mode</code> — <code>NO_BORDER</code>,{" "}
            <code>REPLICATE</code>, <code>CONSTANT</code> (with a fill value),
            or <code>MIRROR</code>. Walkthrough uses <code>CONSTANT 0</code>
          </li>
          <li>
            Neighborhood at <code>(x, y)</code>:{" "}
            <code>kx, ky ∈ [−radius, radius]</code>,{" "}
            <code>radius = n / 2</code>
          </li>
          <li>
            Store <code>static_cast&lt;T&gt;(sum / (n * n))</code> — integer
            divide
          </li>
        </ul>
      </details>

      <details className="fold">
        <summary>Approach comparison</summary>
        <div className={local.tableWrap}>
          <table className={local.table}>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Naive</th>
                <th>Separable</th>
                <th>Enhanced</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Memory loads</td>
                <td>n²</td>
                <td>n + n</td>
                <td>n + 1</td>
              </tr>
              <tr>
                <td>Memory stores</td>
                <td>1</td>
                <td>1</td>
                <td>1 + 1</td>
              </tr>
              <tr>
                <td>ALU additions</td>
                <td>n²</td>
                <td>n + n</td>
                <td>n + 1</td>
              </tr>
              <tr>
                <td>ALU subtractions</td>
                <td>0</td>
                <td>0</td>
                <td>1</td>
              </tr>
              <tr>
                <td>ALU divisions</td>
                <td>1</td>
                <td>1</td>
                <td>1</td>
              </tr>
              <tr>
                <td>Buffer</td>
                <td>0</td>
                <td>n</td>
                <td>n + 1</td>
              </tr>
              <tr>
                <td>Cycles / pixel</td>
                <td>2n² + 2</td>
                <td>4n + 2</td>
                <td>2n + 6</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={local.note}>
          Costs follow the algorithm sections, not Table 1 in the notes (that
          table lists separable loads as n²).
        </p>
      </details>

      <details className="fold">
        <summary>Performance scaling by filter size</summary>
        <div className={local.tableWrap}>
          <table className={local.table}>
            <thead>
              <tr>
                <th>Size</th>
                <th>Separable cycles</th>
                <th>Enhanced cycles</th>
                <th>Improvement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>3×3</td>
                <td>14</td>
                <td>12</td>
                <td>14.28%</td>
              </tr>
              <tr>
                <td>5×5</td>
                <td>22</td>
                <td>16</td>
                <td>27.27%</td>
              </tr>
              <tr>
                <td>7×7</td>
                <td>30</td>
                <td>20</td>
                <td>33.33%</td>
              </tr>
              <tr>
                <td>9×9</td>
                <td>38</td>
                <td>24</td>
                <td>36.84%</td>
              </tr>
              <tr>
                <td>11×11</td>
                <td>46</td>
                <td>28</td>
                <td>39.13%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details className="fold">
        <summary>Check yourself · 3×3 divide</summary>
        <p>
          A 3×3 box filter divides the neighborhood sum by what? Open Scalar
          Walkthrough and step the first interior pixel if you want the numbers.
        </p>
        <ul className={styles.contractList}>
          <li>
            <code>kArea = n * n = 9</code>
          </li>
        </ul>
      </details>
    </div>
  );
}
