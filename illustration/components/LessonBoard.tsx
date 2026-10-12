"use client";

import type { ReactNode } from "react";
import styles from "./LessonBoard.module.css";

type Props = {
  watching: string;
  fn?: string;
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onReset?: () => void;
  nextDisabled?: boolean;
  code: string;
  highlightLine?: number;
  data: ReactNode;
  changed: string;
  extraBar?: ReactNode;
  navBesideCode?: boolean;
  compact?: boolean;
};

export default function LessonBoard({
  watching,
  fn,
  index = 0,
  total = 1,
  onPrev,
  onNext,
  onReset,
  nextDisabled,
  code,
  highlightLine = 0,
  data,
  changed,
  extraBar,
  navBesideCode = false,
  compact = false,
}: Props) {
  const lines = code.replace(/\n$/, "").split("\n");
  const showNav = total > 1 && onNext && onPrev && onReset;
  const nav = showNav ? (
    <div className={styles.nav}>
      <button type="button" className="btn" onClick={onReset}>
        Reset
      </button>
      <button
        type="button"
        className="btn"
        onClick={onPrev}
        disabled={index === 0}
      >
        Prev
      </button>
      <span className={styles.counter}>
        {index + 1} / {total}
      </span>
      <button
        type="button"
        className="btn primary"
        onClick={onNext}
        disabled={nextDisabled || index >= total - 1}
      >
        Next
      </button>
    </div>
  ) : null;

  return (
    <div className={`${styles.page} ${compact ? styles.compact : ""}`}>
      <header className={`panel ${styles.bar}`}>
        <p className={styles.watching}>
          <strong>Now watching. </strong>
          {watching}
        </p>
        {!navBesideCode ? nav : null}
      </header>
      {extraBar && !navBesideCode ? (
        <div className={`panel ${styles.extra}`}>{extraBar}</div>
      ) : null}
      <div className={styles.board}>
        <section className={`panel ${styles.col}`}>
          <div className={styles.codeHead}>
            <div>
              <p className={styles.label}>Code</p>
              {fn ? <p className={styles.fn}>{fn}</p> : null}
            </div>
            {navBesideCode ? nav : null}
          </div>
          {extraBar && navBesideCode ? (
            <div className={styles.inlineExtra}>{extraBar}</div>
          ) : null}
          <pre className={styles.code}>
            <code>
              {lines.map((line, i) => (
                <span
                  key={`${i}-${line}`}
                  className={`${styles.line} ${i === highlightLine ? styles.lit : ""}`}
                >
                  {line.length ? line : " "}
                </span>
              ))}
            </code>
          </pre>
        </section>
        <section className={`panel ${styles.col}`}>
          <p className={styles.label}>Data</p>
          {data}
        </section>
      </div>
      <p className={`panel ${styles.changed}`}>
        <span>What changed</span>
        {changed}
      </p>
    </div>
  );
}
