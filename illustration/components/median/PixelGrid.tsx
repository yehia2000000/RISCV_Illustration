"use client";

import styles from "./median.module.css";

export type PixelTone =
  | "plain"
  | "focus"
  | "drop"
  | "a"
  | "b"
  | "c"
  | "keep"
  | "good"
  | "bad"
  | "picked";

export type Pixel = {
  value: number | null;
  tone?: PixelTone;
  badge?: string;
};

type Props = {
  rows: Pixel[][];
  onPick?: (row: number, col: number) => void;
  disabled?: boolean;
};

export default function PixelGrid({ rows, onPick, disabled }: Props) {
  const columns = rows[0]?.length ?? 1;
  return (
    <div
      className={styles.scan}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(2.15rem, 1fr))` }}
    >
      {rows.map((row, r) =>
        row.map((cell, c) => {
          const tone = styles[cell.tone ?? "plain"];
          const body = (
            <>
              {cell.badge ? <span className={styles.idx}>{cell.badge}</span> : null}
              <span>{cell.value === null ? "·" : cell.value}</span>
            </>
          );
          if (onPick) {
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`${styles.pixelBtn} ${tone}`}
                disabled={disabled}
                onClick={() => onPick(r, c)}
                aria-label={
                  cell.value === null ? `row ${r} column ${c} empty` : `row ${r} column ${c} value ${cell.value}`
                }
              >
                {body}
              </button>
            );
          }
          return (
            <div key={`${r}-${c}`} className={`${styles.pixel} ${tone}`}>
              {body}
            </div>
          );
        }),
      )}
    </div>
  );
}
