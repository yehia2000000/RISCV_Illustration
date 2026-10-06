import ConvolutionVectorSession from "@/components/ConvolutionVectorSession";
import styles from "../../home.module.css";

export default function ConvolutionVectorPage() {
  return (
    <>
      <p className={styles.kicker}>Walkthrough · vec::BoxFilterNxN</p>
      <h1>Vector walkthrough</h1>
      <p>
        Two steps. First the decision that turns the scalar naive box filter
        into a vector one: what goes in the lanes. Then the RISC-V Vector kernel
        that decision produces, intrinsic by intrinsic.
      </p>
      <ConvolutionVectorSession />
    </>
  );
}
