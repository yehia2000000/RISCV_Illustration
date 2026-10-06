"use client";

import BoxFilterWalk from "@/components/BoxFilterWalk";
import { STAGES, type StageId } from "@/lib/convolution/stages";
import { useState } from "react";
import styles from "./WalkthroughSession.module.css";

export default function ConvolutionSession() {
  const [stage, setStage] = useState<StageId>("naive");
  const [stepIndex, setStepIndex] = useState(0);

  return (
    <div className={`${styles.page} ${styles.tight}`}>
      <header className={styles.toolbar}>
        <ol className={styles.stages}>
          {STAGES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={stage === item.id ? styles.on : undefined}
                onClick={() => {
                  setStage(item.id);
                  setStepIndex(0);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </header>

      <BoxFilterWalk
        key={stage}
        stage={stage}
        stepIndex={stepIndex}
        onStepIndex={setStepIndex}
      />
    </div>
  );
}
