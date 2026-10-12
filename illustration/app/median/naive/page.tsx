import NaiveLab from "@/components/median/NaiveLab";
import styles from "../../home.module.css";

export default function NaivePage() {
  return (
    <>
      <p className={styles.kicker}>Concepts · naive rank</p>
      <h1>Sort, then take the middle</h1>
      <p>
        The median is not the mean. On a 5×4 image the 3×3 window visits six centers,
        left to right, then the next row. Each stop gathers nine samples, sorts them,
        and writes index <code>th = 4</code> into the output.
      </p>
      <NaiveLab />
    </>
  );
}
