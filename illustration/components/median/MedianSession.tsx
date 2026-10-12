"use client";

import MedianScalar from "@/components/median/MedianScalar";
import MedianVector from "@/components/median/MedianVector";
import { MEDIAN_STAGES, type MedianStageId } from "@/lib/median/stages";
import {
  TEACHING_VLMAX,
  type LessonMode,
  type TeachingVlmax,
} from "@/lib/walkthrough";
import { useState } from "react";
import styles from "../WalkthroughSession.module.css";

export default function MedianSession() {
  const [stage, setStage] = useState<MedianStageId>("inputs");
  const [mode, setMode] = useState<LessonMode>("scalar");
  const [stepIndex, setStepIndex] = useState(0);
  const [vlmax, setVlmax] = useState<TeachingVlmax>(4);

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <ol className={styles.stages}>
          {MEDIAN_STAGES.map((item) => (
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

      <header className={styles.toolbar}>
        <ol className={styles.modes}>
          <li>
            <button
              type="button"
              className={mode === "scalar" ? styles.on : undefined}
              onClick={() => {
                setMode("scalar");
                setStepIndex(0);
              }}
            >
              Scalar
            </button>
          </li>
          <li>
            <button
              type="button"
              className={mode === "vector" ? styles.vectorOn : undefined}
              onClick={() => {
                setMode("vector");
                setStepIndex(0);
              }}
            >
              Vector
            </button>
          </li>
        </ol>

        {mode === "vector" ? (
          <label className={styles.vlmax}>
            Teaching VLMAX
            <select
              value={vlmax}
              onChange={(event) => {
                setVlmax(Number(event.target.value) as TeachingVlmax);
                setStepIndex(0);
              }}
            >
              {TEACHING_VLMAX.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Simulates hardware VLMAX for e8m1. Default 4 splits six columns into a strip of 4 and a tail of 2.
            </span>
          </label>
        ) : null}
      </header>

      {mode === "scalar" ? (
        <MedianScalar key={stage} stage={stage} />
      ) : (
        <MedianVector
          stage={stage}
          vlmax={vlmax}
          stepIndex={stepIndex}
          onStepIndex={setStepIndex}
        />
      )}
    </div>
  );
}
