"use client";

import LessonBoard from "@/components/LessonBoard";
import PixelGrid, { type Pixel } from "@/components/median/PixelGrid";
import { NAIVE_IMAGE, naiveSlides } from "@/lib/median/conceptLessons";
import { rankThreshold } from "@/lib/median/model";
import { useMemo, useState } from "react";
import styles from "./median.module.css";

const K = 3;
const RADIUS = (K - 1) / 2;
const TH = rankThreshold(K);

const SNIPPET = `const int k = 3;
const int th = (k * k) / 2; // 4
for (int y = 1; y < height - 1; ++y)
  for (int x = 1; x < width - 1; ++x) {
    uint8_t samples[9];
    // image[y-1..y+1][x-1..x+1] → samples
    std::sort(samples, samples + 9);
    out[y][x] = samples[th];
  }`;

export default function NaiveLab() {
  const slides = useMemo(() => naiveSlides(NAIVE_IMAGE, K), []);
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  if (!slide) {
    return null;
  }

  const written = new Map(slides.slice(0, index + 1).map((item) => [`${item.y},${item.x}`, item.median]));

  const input: Pixel[][] = NAIVE_IMAGE.map((row, y) =>
    row.map((value, x) => {
      const inside =
        Math.abs(y - slide.y) <= RADIUS && Math.abs(x - slide.x) <= RADIUS;
      const center = y === slide.y && x === slide.x;
      let tone: Pixel["tone"] = "plain";
      if (center) {
        tone = "c";
      } else if (inside) {
        tone = "focus";
      }
      return { value, tone, badge: y === 0 ? String(x) : undefined };
    }),
  );

  const output: Pixel[][] = NAIVE_IMAGE.map((row, y) =>
    row.map((_, x) => {
      const interior = y >= RADIUS && y < NAIVE_IMAGE.length - RADIUS && x >= RADIUS && x < row.length - RADIUS;
      const value = written.get(`${y},${x}`) ?? null;
      const current = y === slide.y && x === slide.x;
      let tone: Pixel["tone"] = "drop";
      if (current) {
        tone = "keep";
      } else if (value !== null) {
        tone = "plain";
      } else if (interior) {
        tone = "plain";
      }
      return { value, tone, badge: y === 0 ? String(x) : undefined };
    }),
  );

  return (
    <div className={styles.stack}>
      <LessonBoard
        watching={slide.watching}
        fn="MedianFilterNxN_naive"
        index={index}
        total={slides.length}
        onReset={() => setIndex(0)}
        onPrev={() => setIndex((value) => Math.max(0, value - 1))}
        onNext={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
        code={SNIPPET}
        highlightLine={7}
        changed={slide.changed}
        data={
          <div>
            <div className={styles.legend}>
              <span>
                <i className={`${styles.swatch} ${styles.focus}`} /> window
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.c}`} /> center
              </span>
              <span>
                <i className={`${styles.swatch} ${styles.keep}`} /> written median
              </span>
            </div>
            <div className={styles.path} aria-label="window centers">
              {slides.map((item, stop) => (
                <span key={`${item.y}-${item.x}`} className={stop === index ? styles.stopOn : styles.stop}>
                  ({item.y},{item.x})
                </span>
              ))}
            </div>
            <div className={styles.pair}>
              <div>
                <p className={styles.caption}>Input 5×4 · window in gold</p>
                <PixelGrid rows={input} />
              </div>
              <div>
                <p className={styles.caption}>Output · written centers</p>
                <PixelGrid rows={output} />
              </div>
            </div>
            <p className={styles.caption}>Window samples, row-major · index {TH} is the center pixel</p>
            <div className={styles.sorted}>
              {slide.samples.map((value, sample) => (
                <div
                  key={`s-${sample}`}
                  className={`${styles.pixel} ${sample === TH ? styles.c : styles.plain}`}
                >
                  <span className={styles.idx}>{sample}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            <p className={styles.caption}>Sorted · rank {TH} is written</p>
            <div className={styles.sorted}>
              {slide.sorted.map((value, rank) => (
                <div
                  key={`r-${rank}-${value}`}
                  className={`${styles.pixel} ${rank === TH ? styles.keep : value >= 9 ? styles.drop : styles.plain}`}
                >
                  <span className={styles.idx}>{rank}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            <p className={styles.note}>
              Unsorted index {TH} is the center pixel ({slide.samples[TH]}). Sorted index {TH} is the median ({slide.median}). Border cells of the output stay empty; only a center with a full 3×3 is written.
            </p>
          </div>
        }
      />
    </div>
  );
}
