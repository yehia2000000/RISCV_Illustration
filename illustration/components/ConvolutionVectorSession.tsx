"use client";

import LaneChoiceLab from "@/components/LaneChoiceLab";
import RvvKernelLab from "@/components/RvvKernelLab";
import {
  VECTOR_STAGES,
  type VectorStageId,
} from "@/lib/convolution/vectorStages";
import { useState } from "react";
import styles from "./WalkthroughSession.module.css";

export default function ConvolutionVectorSession() {
  const [stage, setStage] = useState<VectorStageId>("lanes");

  return (
    <div className={`${styles.page} ${styles.tight}`}>
      <header className={styles.toolbar}>
        <ol className={styles.stages}>
          {VECTOR_STAGES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={stage === item.id ? styles.on : undefined}
                onClick={() => setStage(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {stage === "lanes" ? <LaneChoiceLab /> : <RvvKernelLab />}
    </div>
  );
}
