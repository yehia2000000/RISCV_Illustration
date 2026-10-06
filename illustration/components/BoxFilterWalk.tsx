"use client";

import LessonBoard from "@/components/LessonBoard";
import PixelGrid from "@/components/PixelGrid";
import { resourceCost, TEACHING_KSIZE } from "@/lib/boxFilter";
import { buildBoxFilterTrace } from "@/lib/convolution/scalarTrace";
import type { StageId } from "@/lib/convolution/stages";
import {
  BOX_ENHANCED_SCORE_KEY,
  BOX_NAIVE_SCORE_KEY,
  BOX_SEPARABLE_SCORE_KEY,
} from "@/lib/quizStorage";
import { useBestScore } from "@/lib/useBestScore";
import { useMemo, useState } from "react";
import styles from "./BoxFilterWalk.module.css";

type Props = {
  stage: StageId;
  stepIndex: number;
  onStepIndex: (value: number | ((prev: number) => number)) => void;
};

const QUIZ: Record<
  StageId,
  {
    key: string;
    prompt: string;
    options: { label: string; correct: boolean }[];
    explain: string;
  }
> = {
  naive: {
    key: BOX_NAIVE_SCORE_KEY,
    prompt:
      "After GetPixel loads 10…90 around (1, 1), what does SetPixel store?",
    options: [
      { label: "50", correct: true },
      { label: "45", correct: false },
      { label: "450", correct: false },
    ],
    explain: "sum = 450, kArea = 9, integer divide stores 50.",
  },
  separable: {
    key: BOX_SEPARABLE_SCORE_KEY,
    prompt:
      "Just before swap_row_sums at center (1, 2), what is row_sums and the stored pixel?",
    options: [
      { label: "[150, 240, 330] and 80", correct: true },
      { label: "[60, 150, 240] and 50", correct: false },
      { label: "[240, 330, 330] and 80", correct: false },
    ],
    explain:
      "Incoming row 3 sums to 330. VerticalWindowSum is 720. Store 80, then swap.",
  },
  enhanced: {
    key: BOX_ENHANCED_SCORE_KEY,
    prompt:
      "At center (1, 2), after adding incoming 330, what are accumulator and output?",
    options: [
      { label: "720 and 80", correct: true },
      { label: "450 and 50", correct: false },
      { label: "390 and 80", correct: false },
    ],
    explain:
      "Add incoming 330 into the running accumulator (390 + 330 = 720). Integer divide stores 80, then subtract the outgoing row.",
  },
};

const KIND = {
  naive: "naive",
  separable: "separable",
  enhanced: "optimized",
} as const;

export default function BoxFilterWalk({
  stage,
  stepIndex,
  onStepIndex,
}: Props) {
  const steps = useMemo(() => buildBoxFilterTrace(stage), [stage]);
  const clamped = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const step = steps[clamped];
  const quiz = QUIZ[stage];
  const [best, setBest] = useBestScore(quiz.key);
  const [choice, setChoice] = useState<number | null>(null);
  const cost = resourceCost(KIND[stage], TEACHING_KSIZE);

  if (!step) {
    return null;
  }

  const answer = (index: number) => {
    if (choice !== null) {
      return;
    }
    setChoice(index);
    if (quiz.options[index]?.correct) {
      setBest(1);
    }
  };

  return (
    <div className={styles.page}>
      <LessonBoard
        watching={step.watching}
        fn={step.fn}
        index={clamped}
        total={steps.length}
        onReset={() => onStepIndex(0)}
        onPrev={() => onStepIndex((n) => Math.max(0, n - 1))}
        onNext={() => onStepIndex((n) => Math.min(steps.length - 1, n + 1))}
        code={step.snippet}
        highlightLine={step.highlightLine}
        changed={step.changed}
        extraBar={
          <p className={styles.cost}>
            Per output pixel · loads {cost.loads} · adds {cost.adds} · subs{" "}
            {cost.subs} · buffer {cost.buffer} · {cost.cycles} cycles
          </p>
        }
        data={<PixelGrid stage={stage} snapshot={step.snapshot} />}
      />

      <details className="fold">
        <summary>Check yourself · best {best}/1</summary>
        <p className={styles.prompt}>{quiz.prompt}</p>
        <div className={styles.quizBtns}>
          {quiz.options.map((option, index) => (
            <button
              type="button"
              key={option.label}
              className="btn"
              onClick={() => answer(index)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {choice !== null ? (
          <p className={quiz.options[choice]?.correct ? styles.ok : styles.bad}>
            {quiz.options[choice]?.correct ? "Correct. " : "Not quite. "}
            {quiz.explain}
          </p>
        ) : null}
      </details>
    </div>
  );
}
