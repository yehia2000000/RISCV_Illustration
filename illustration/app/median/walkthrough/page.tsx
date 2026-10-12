import MedianSession from "@/components/median/MedianSession";
import MedianWalkQuiz from "@/components/median/MedianWalkQuiz";
import board from "@/components/median/median.module.css";
import styles from "../../home.module.css";

export default function MedianWalkthroughPage() {
  return (
    <>
      <p className={styles.kicker}>Walkthrough · ref:: and vec::MedianFilter3x3</p>
      <h1>3×3 selection network</h1>
      <p>
        One scanline, six columns, four centers. Column 1 holds a salt 9. Scalar
        steps sort each column, then take the max of the top, the median of the
        middle, and the min of the bottom. Vector steps are that same compare-swap
        as <code>vmin</code> / <code>vmax</code> on <code>e8m1</code>, one intrinsic
        at a time. Teaching VLMAX is a stand-in for hardware VLMAX.
      </p>
      <div className={board.stack}>
        <MedianSession />
        <MedianWalkQuiz />
      </div>
    </>
  );
}
