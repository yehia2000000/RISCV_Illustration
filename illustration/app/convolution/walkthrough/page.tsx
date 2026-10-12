import ConvolutionSession from "@/components/ConvolutionSession";
import styles from "../../home.module.css";

export default function ConvolutionWalkthroughPage() {
  return (
    <>
      <p className={styles.kicker}>Walkthrough · ref::BoxFilterNxN</p>
      <h1>Scalar walkthrough</h1>
      <p>
        4×3 image, 3×3 kernel, CONSTANT 0 pads. Columns x = 0, 1, 2 then down
        y. Integer divide by 9.
      </p>
      <ConvolutionSession />
    </>
  );
}
