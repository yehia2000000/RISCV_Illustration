import Network5Lab from "@/components/median/Network5Lab";
import styles from "../../home.module.css";

export default function Network5Page() {
  return (
    <>
      <p className={styles.kicker}>Concepts · MedianFilter5x5</p>
      <h1>Partial columns, three diagonals</h1>
      <p>
        A full sort of 25 samples is the naive answer. The network sorts each row
        once, keeps only the column ranks that sit on the middle anti-diagonals,
        and finishes with the same median-of-three used by the 3×3 path.
      </p>
      <Network5Lab />
    </>
  );
}
