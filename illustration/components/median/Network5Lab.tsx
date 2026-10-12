"use client";

import LessonBoard from "@/components/LessonBoard";
import PixelGrid from "@/components/median/PixelGrid";
import { network5Steps } from "@/lib/median/conceptLessons";
import { useMemo, useState } from "react";
import styles from "./median.module.css";

export default function Network5Lab() {
  const steps = useMemo(() => network5Steps(), []);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  if (!step) {
    return null;
  }

  return (
    <div className={styles.stack}>
      <LessonBoard
        watching={step.watching}
        fn={step.fn}
        index={index}
        total={steps.length}
        onReset={() => setIndex(0)}
        onPrev={() => setIndex((value) => Math.max(0, value - 1))}
        onNext={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}
        code={step.snippet}
        highlightLine={step.highlightLine}
        changed={step.changed}
        data={
          <div>
            {step.before ? (
              <div className={styles.pair}>
                <div>
                  <p className={styles.caption}>Before selection</p>
                  <PixelGrid rows={step.before} />
                </div>
                <div>
                  <p className={styles.caption}>After selection</p>
                  <PixelGrid rows={step.rows} />
                </div>
              </div>
            ) : (
              <PixelGrid rows={step.rows} />
            )}
            {step.lanes?.map((lane) => (
              <div key={lane.caption}>
                <p className={styles.caption}>{lane.caption}</p>
                <div className={styles.sorted}>
                  {lane.values.map((value, rank) => {
                    const tone = lane.keep === rank ? styles.keep : lane.compare === rank ? styles.focus : styles.plain;
                    return (
                      <div key={`${lane.caption}-${rank}`} className={`${styles.pixel} ${tone}`}>
                        <span className={styles.idx}>{rank}</span>
                        <span>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className={styles.aside}>{step.aside}</p>
            <div className={styles.legend}>
              <span>
                <i className={`${styles.swatch} ${styles.a}`} /> A · max of i+j = 3
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.b}`} /> B · median of i+j = 4
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.c}`} /> C · min of i+j = 5
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.drop}`} /> excluded
              </span>
            </div>
          </div>
        }
      />
    </div>
  );
}
