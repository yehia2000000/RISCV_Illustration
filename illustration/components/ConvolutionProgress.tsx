"use client";

import {
  BOX_ENHANCED_SCORE_KEY,
  BOX_NAIVE_SCORE_KEY,
  BOX_SEPARABLE_SCORE_KEY,
} from "@/lib/quizStorage";
import { useBestScore } from "@/lib/useBestScore";
import styles from "./ConvolutionProgress.module.css";

export default function ConvolutionProgress() {
  const [naive] = useBestScore(BOX_NAIVE_SCORE_KEY);
  const [separable] = useBestScore(BOX_SEPARABLE_SCORE_KEY);
  const [enhanced] = useBestScore(BOX_ENHANCED_SCORE_KEY);
  return (
    <div className={`panel ${styles.strip}`}>
      <span>Quiz progress (this browser)</span>
      <span className={naive ? styles.on : undefined}>Naive {naive}/1</span>
      <span className={separable ? styles.on : undefined}>
        Separable {separable}/1
      </span>
      <span className={enhanced ? styles.on : undefined}>Enhanced {enhanced}/1</span>
    </div>
  );
}
