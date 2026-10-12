"use client";

import {
  HISTOGRAM_SCORE_KEY,
  NAIVE_SCORE_KEY,
  NETWORK5_SCORE_KEY,
  rankTitle,
  sessionRank,
} from "@/lib/median/score";
import { useBestScore } from "@/lib/useBestScore";
import styles from "./median.module.css";

export default function MedianScoreboard() {
  const [naive] = useBestScore(NAIVE_SCORE_KEY);
  const [network] = useBestScore(NETWORK5_SCORE_KEY);
  const [hist] = useBestScore(HISTOGRAM_SCORE_KEY);
  const total = naive + network + hist;
  const cards = [
    { name: "Naive", best: naive },
    { name: "5×5 network", best: network },
    { name: "Histogram", best: hist },
  ];

  return (
    <div>
      <div className={styles.scores}>
        {cards.map((card) => (
          <article key={card.name} className={`panel ${styles.scoreCard}`}>
            <h2>{card.name}</h2>
            <p className={styles.rank}>{rankTitle(card.best)}</p>
            <p>
              Best <strong>{card.best}</strong>
            </p>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        Session rank <strong className={styles.rank}>{sessionRank(total)}</strong> · combined best{" "}
        {total}. A perfect lab is 135. Six rounds, 10 points plus 5 per streak step.
      </p>
    </div>
  );
}
