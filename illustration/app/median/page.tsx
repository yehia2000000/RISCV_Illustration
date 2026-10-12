import Link from "next/link";
import BoxCompare from "@/components/median/BoxCompare";
import MedianScoreboard from "@/components/median/MedianScoreboard";
import board from "@/components/median/median.module.css";
import styles from "../home.module.css";

const LESSONS = [
  {
    href: "/median/naive",
    title: "Naive",
    body: "Sort the neighborhood and read rank th. A 3×3 salt pixel loses because it lands at the end of the list.",
  },
  {
    href: "/median/network",
    title: "5×5 network",
    body: "Sort each row, keep a partial column, then take max, median, and min on the three middle anti-diagonals.",
  },
  {
    href: "/median/histogram",
    title: "Histogram",
    body: "One running histogram, zigzagged. The toy window is 3×3 so the bins fit; the same loop is what 7×7, 9×9, and 11×11 call.",
  },
  {
    href: "/median/walkthrough",
    title: "Walkthrough",
    body: "The 3×3 selection network on one scanline. Scalar and Vector, one compare-swap at a time.",
  },
];

export default function MedianOverviewPage() {
  return (
    <div className={styles.home}>
      <p className={styles.kicker}>Concepts · ref::MedianFilterNxN</p>
      <h1>Median filter</h1>
      <p className={styles.lead}>
        Replace each pixel with the middle rank of its neighborhood. Impulse noise
        drops out. Edges stay, because nothing is averaged.
      </p>

      <BoxCompare />

      <MedianScoreboard />

      <div className={styles.lessons}>
        {LESSONS.map((item) => (
          <Link key={item.href} href={item.href} className={`panel ${styles.lessonCard}`}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <span className={styles.go}>Open →</span>
          </Link>
        ))}
      </div>

      <div className={`panel ${board.board}`}>
        <h2>Which algorithm</h2>
        <table className={board.table}>
          <thead>
            <tr>
              <th>Support</th>
              <th>Path</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>3×3</td>
              <td>Selection network</td>
              <td>Column sort, then max / median / min, then the median of those three.</td>
            </tr>
            <tr>
              <td>5×5</td>
              <td>Separable network</td>
              <td>Partial columns and three anti-diagonals. Same final trio as 3×3.</td>
            </tr>
            <tr>
              <td>7×7, 9×9, 11×11</td>
              <td>Running histogram</td>
              <td>Slide one strip, then move mdn until ltmdn is back in range. 7×7 uses the histogram on purpose.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="fold">
        <summary>Show contract</summary>
        <ul className={styles.contractList}>
          <li>
            Samples are <code>uint8</code>. Rank <code>th = (k × k) / 2</code> is 0-based in the ascending window.
          </li>
          <li>
            For a 3×3, <code>th = 4</code>. For a 5×5, <code>th = 12</code>. The naive filter and every faster path write that same sample.
          </li>
          <li>
            The reference border is mirror <code>GetPixel</code>. These boards use interior windows, so every sample is inside the image.
          </li>
          <li>
            Histogram bins in the reference are 256. The lab draws the bins the example actually uses.
          </li>
            <li>
              Vector mode on the walkthrough strip-mines the 3×3 compare-swap network with a teaching VLMAX. The 5×5 and histogram lessons are the scalar paths.
            </li>
        </ul>
      </details>
    </div>
  );
}
