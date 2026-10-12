"use client";

import { COLUMN_SCENE, network3Row } from "@/lib/median/model";
import { WALK_SCORE_KEY } from "@/lib/median/score";
import { useBestScore } from "@/lib/useBestScore";
import { useState } from "react";
import styles from "./median.module.css";

export default function MedianWalkQuiz() {
  const window0 = network3Row(COLUMN_SCENE)[0];
  const answer = window0.median;
  const choices = [9, 5, answer, 2].filter((value, index, all) => all.indexOf(value) === index);
  const [picked, setPicked] = useState<number | null>(null);
  const [best, setBest] = useBestScore(WALK_SCORE_KEY);
  const locked = picked !== null;
  const ok = picked === answer;

  return (
    <details className="fold">
      <summary>Check yourself · best {best}/1</summary>
      <p>
        The window on column 1 contains the salt value 9. What does the network write at that center?
      </p>
      <div className={styles.actions}>
        {choices.map((choice) => {
          const selected = picked === choice;
          const tone = !locked ? "" : choice === answer ? styles.good : selected ? styles.bad : "";
          return (
            <button
              key={choice}
              type="button"
              className={`btn ${tone}`}
              disabled={locked}
              onClick={() => {
                setPicked(choice);
                if (choice === answer) {
                  setBest(1);
                }
              }}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {locked ? (
        <p className={ok ? styles.gain : styles.miss}>
          {ok ? "Correct. " : "Not quite. "}
          Bottom-row min throws the 9 away. median3({window0.top}, {window0.mid}, {window0.bot}) = {answer}, the same as samples[4].
        </p>
      ) : null}
    </details>
  );
}
