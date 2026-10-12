import HistogramLab from "@/components/median/HistogramLab";
import styles from "../../home.module.css";

export default function HistogramPage() {
  return (
    <>
      <p className={styles.kicker}>Concepts · MedianFilterHistogram</p>
      <h1>Slide the histogram</h1>
      <p>
        Large windows do not re-sort. One histogram tracks the active neighborhood.{" "}
        <code>ltmdn</code> counts samples strictly below <code>mdn</code>, and{" "}
        <code>th = (k × k) / 2</code> is the same rank as the naive sort. The window
        snakes across the image so the histogram is built only once.
      </p>
      <HistogramLab />
    </>
  );
}
