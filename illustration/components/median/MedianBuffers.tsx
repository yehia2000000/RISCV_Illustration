"use client";

import PixelGrid, { type Pixel, type PixelTone } from "@/components/median/PixelGrid";
import {
  COLUMN_SCENE,
  naiveMedian,
  network3Row,
  sortColumns3,
  windowSamples,
} from "@/lib/median/model";
import type { MedianScalarStep } from "@/lib/median/scalarTrace";
import styles from "./median.module.css";

function toneForColumn(
  col: number,
  step: MedianScalarStep,
): PixelTone {
  if (step.focusCol === col) {
    return "focus";
  }
  if (step.focusCenter !== null) {
    const left = step.focusCenter - 1;
    if (col >= left && col <= left + 2) {
      return "focus";
    }
  }
  return "plain";
}

export default function MedianBuffers({ step }: { step: MedianScalarStep }) {
  const columns = sortColumns3(COLUMN_SCENE);
  const outputs = network3Row(COLUMN_SCENE);
  const image: Pixel[][] = COLUMN_SCENE.map((row, r) =>
    row.map((value, col) => ({
      value,
      tone: toneForColumn(col, step),
      badge: r === 0 ? String(col) : undefined,
    })),
  );

  const sortedRows: Pixel[][] | null =
    step.sortedThrough >= 0
      ? [0, 1, 2].map((row) =>
          columns.map((column, col) => ({
            value: col <= step.sortedThrough ? column.after[row] : column.before[row],
            tone: toneForColumn(col, step),
            badge: row === 0 ? String(col) : undefined,
          })),
        )
      : null;

  const outputCells: Pixel[] = COLUMN_SCENE[0].map((_, col) => {
    if (col < 1 || col > 4) {
      return { value: null, tone: "drop", badge: String(col) };
    }
    const index = col - 1;
    const show = index < step.revealedCenters;
    const hot = step.focusCenter === col;
    return {
      value: show ? outputs[index].median : null,
      tone: hot ? "keep" : show ? "plain" : "drop",
      badge: String(col),
    };
  });

  const naiveSamples = [...windowSamples(COLUMN_SCENE, 0)].sort((a, b) => a - b);
  const naive = naiveMedian(windowSamples(COLUMN_SCENE, 0));

  return (
    <div className={styles.stack}>
      <div>
        <p className={styles.caption}>Image · column index on the top row</p>
        <PixelGrid rows={image} />
      </div>
      {sortedRows ? (
        <div>
          <p className={styles.caption}>Columns after the 3-sort · small on top</p>
          <PixelGrid rows={sortedRows} />
        </div>
      ) : null}
      {step.sortedThrough === COLUMN_SCENE[0].length - 1 && step.focusCenter !== null ? (
        <p className={styles.note}>
          Center {step.focusCenter}: top {outputs[step.focusCenter - 1].top}, mid{" "}
          {outputs[step.focusCenter - 1].mid}, bot {outputs[step.focusCenter - 1].bot}.
        </p>
      ) : null}
      {step.revealedCenters > 0 ? (
        <div>
          <p className={styles.caption}>Output at the center column</p>
          <PixelGrid rows={[outputCells]} />
        </div>
      ) : null}
      {step.showNaive ? (
        <div>
          <p className={styles.caption}>Window on column 1, sorted · rank 4</p>
          <div className={styles.sorted}>
            {naiveSamples.map((value, index) => (
              <div
                key={`${index}-${value}`}
                className={`${styles.pixel} ${index === 4 ? styles.keep : styles.plain}`}
              >
                <span className={styles.idx}>{index}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <p className={styles.note}>samples[4] = {naive}. The 9 is the last sample.</p>
        </div>
      ) : null}
    </div>
  );
}
