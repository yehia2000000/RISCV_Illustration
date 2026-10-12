"use client";

import LessonBoard from "@/components/LessonBoard";
import PixelGrid, { type Pixel } from "@/components/median/PixelGrid";
import { histogramBinLimit, histogramLessonSteps } from "@/lib/median/conceptLessons";
import { HISTOGRAM_K, HISTOGRAM_SCENE, type HistFrame } from "@/lib/median/model";
import { useMemo, useState } from "react";
import styles from "./median.module.css";

function Bins({
  hist,
  mdn,
  limit,
  marks,
  mark,
}: {
  hist: number[];
  mdn: number;
  limit: number;
  marks: number[];
  mark: "leave" | "enter" | null;
}) {
  const outlined = new Set(marks);
  let peak = 1;
  for (let value = 0; value <= limit; value += 1) {
    peak = Math.max(peak, hist[value] ?? 0);
  }
  return (
    <div className={styles.bins} aria-label="histogram bins">
      {Array.from({ length: limit + 1 }, (_, value) => {
        const count = hist[value] ?? 0;
        const height = `${(count / peak) * 100}%`;
        const outline = outlined.has(value) ? (mark === "leave" ? styles.trackLeave : styles.trackEnter) : "";
        return (
          <div key={value} className={styles.bin}>
            <div className={`${styles.track} ${outline}`}>
              <div className={value === mdn ? styles.barOn : styles.bar} style={{ height }} />
              <span className={styles.count}>{count}</span>
            </div>
            <span>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function windowOrigin(frame: HistFrame, phase: "init" | "leave" | "enter" | "adjust"): { y: number; x: number } {
  if (phase !== "leave" || frame.kind === "init") {
    return { y: frame.y, x: frame.x };
  }
  if (frame.kind === "slide-v") {
    return { y: frame.y - 1, x: frame.x };
  }
  if (frame.dir === 1) {
    return { y: frame.y, x: frame.x - 1 };
  }
  return { y: frame.y, x: frame.x + 1 };
}

function edgeCells(frame: HistFrame, phase: "leave" | "enter"): string[] {
  const k = HISTOGRAM_K;
  const cells: string[] = [];
  if (frame.kind === "slide-v") {
    const row = phase === "leave" ? frame.y - 1 : frame.y + k - 1;
    for (let col = 0; col < k; col += 1) {
      cells.push(`${row},${frame.x + col}`);
    }
    return cells;
  }
  const col =
    frame.dir === 1
      ? phase === "leave"
        ? frame.x - 1
        : frame.x + k - 1
      : phase === "leave"
        ? frame.x + k
        : frame.x;
  for (let row = 0; row < k; row += 1) {
    cells.push(`${frame.y + row},${col}`);
  }
  return cells;
}

function windowPixels(frame: HistFrame, phase: "init" | "leave" | "enter" | "adjust"): Pixel[][] {
  const k = HISTOGRAM_K;
  const origin = windowOrigin(frame, phase);
  const edge = new Set(phase === "leave" || phase === "enter" ? edgeCells(frame, phase) : []);
  return HISTOGRAM_SCENE.map((row, y) =>
    row.map((value, x) => {
      const inside = y >= origin.y && y < origin.y + k && x >= origin.x && x < origin.x + k;
      const center = y === frame.y + 1 && x === frame.x + 1 && phase !== "leave";
      let tone: Pixel["tone"] = inside ? "focus" : "drop";
      if (edge.has(`${y},${x}`)) {
        tone = phase === "leave" ? "bad" : "keep";
      } else if (center && phase === "adjust") {
        tone = "keep";
      } else if (center) {
        tone = "c";
      }
      return { value, tone, badge: y === 0 ? String(x) : undefined };
    }),
  );
}

export default function HistogramLab() {
  const steps = useMemo(() => histogramLessonSteps(), []);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  if (!step) {
    return null;
  }

  const scan =
    step.phase === "leave" ? "leaving" : step.phase === "enter" ? "entering" : step.phase === "init" ? "first window" : "select median";

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
            <p className={styles.caption}>Image · window in gold, center marked · {scan}</p>
            <PixelGrid rows={windowPixels(step.frame, step.phase)} />
            <p className={styles.counters}>
              <span>
                th <strong>{step.frame.th}</strong>
              </span>
              <span>
                mdn <strong>{step.mdn}</strong>
              </span>
              <span>
                ltmdn <strong>{step.ltmdn}</strong>
              </span>
              <span>
                k <strong>{HISTOGRAM_K}</strong>
              </span>
            </p>
            <Bins
              hist={step.hist}
              mdn={step.mdn}
              limit={histogramBinLimit(step.hist)}
              marks={step.marks}
              mark={step.phase === "leave" ? "leave" : step.phase === "enter" ? "enter" : null}
            />
            <p className={styles.note}>
              The gold bin is mdn. Reference code uses 256 bins for uint8. This board draws 0–9 because the example fits there. Production calls this same loop for 7×7, 9×9, and 11×11.
            </p>
          </div>
        }
      />
    </div>
  );
}
