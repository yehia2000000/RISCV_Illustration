"use client";

import PixelGrid, { type Pixel } from "@/components/median/PixelGrid";
import { naiveMedian } from "@/lib/median/model";
import {
  ROUNDS,
  pointsForStreak,
  randomWindow,
  rankTitle,
} from "@/lib/median/score";
import { useBestScore } from "@/lib/useBestScore";
import { useState, type ReactNode } from "react";
import styles from "./median.module.css";

type Props = {
  scoreKey: string;
  k: number;
  first: number[][];
  prompt: string;
  reveal: (rows: number[][], answer: number) => ReactNode;
};

export default function MedianChallenge({ scoreKey, k, first, prompt, reveal }: Props) {
  const [best, setBest] = useBestScore(scoreKey);
  const [rows, setRows] = useState(() => first.map((row) => [...row]));
  const [round, setRound] = useState(0);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<{ r: number; c: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [lastPoints, setLastPoints] = useState<number | null>(null);

  const answer = naiveMedian(rows.flat());
  const done = locked && round === ROUNDS - 1;

  const pixels: Pixel[][] = rows.map((row, r) =>
    row.map((value, c) => {
      const isPick = picked?.r === r && picked?.c === c;
      let tone: Pixel["tone"] = "plain";
      if (locked && value === answer) {
        tone = "good";
      } else if (locked && isPick) {
        tone = "bad";
      }
      return { value, tone, badge: `${r},${c}` };
    }),
  );

  const choose = (r: number, c: number) => {
    if (locked) {
      return;
    }
    const correct = rows[r][c] === answer;
    setPicked({ r, c });
    setLocked(true);
    if (correct) {
      const nextStreak = streak + 1;
      const gained = pointsForStreak(nextStreak);
      const nextScore = score + gained;
      setStreak(nextStreak);
      setScore(nextScore);
      setLastPoints(gained);
      setBest(nextScore);
    } else {
      setStreak(0);
      setLastPoints(0);
    }
  };

  const restart = () => {
    setRows(first.map((row) => [...row]));
    setRound(0);
    setStreak(0);
    setScore(0);
    setPicked(null);
    setLocked(false);
    setLastPoints(null);
  };

  const next = () => {
    if (!locked || done) {
      return;
    }
    setRows(randomWindow(k));
    setRound((value) => value + 1);
    setPicked(null);
    setLocked(false);
    setLastPoints(null);
  };

  return (
    <section className={`panel ${styles.challenge}`}>
      <div className={styles.hud}>
        <span className={styles.rank}>{rankTitle(best)}</span>
        <span>
          Round <b>{round + 1}</b> / {ROUNDS}
        </span>
        <span>
          Streak <b>{streak}</b>
        </span>
        <span>
          This run <b>{score}</b>
        </span>
        <span>
          Best <b>{best}</b>
        </span>
        {lastPoints !== null && lastPoints > 0 ? (
          <span className={styles.gain}>+{lastPoints}</span>
        ) : null}
        {lastPoints === 0 ? <span className={styles.miss}>streak reset</span> : null}
      </div>
      <h2>Challenge</h2>
      <p>{prompt}</p>
      <PixelGrid rows={pixels} onPick={choose} disabled={locked} />
      {locked ? reveal(rows, answer) : null}
      <div className={styles.actions}>
        {done ? (
          <button type="button" className="btn primary" onClick={restart}>
            Play again
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={next} disabled={!locked}>
            Next round
          </button>
        )}
      </div>
    </section>
  );
}
