"use client";

import LessonBoard from "@/components/LessonBoard";
import VectorDataFlow from "@/components/VectorDataFlow";
import type { MedianStageId } from "@/lib/median/stages";
import { buildMedianVectorLesson } from "@/lib/median/vectorTrace";
import type { TeachingVlmax } from "@/lib/walkthrough";
import { useMemo } from "react";

type Props = {
  stage: MedianStageId;
  vlmax: TeachingVlmax;
  stepIndex: number;
  onStepIndex: (index: number) => void;
};

export default function MedianVector({ stage, vlmax, stepIndex, onStepIndex }: Props) {
  const steps = useMemo(
    () => buildMedianVectorLesson(stage, vlmax),
    [stage, vlmax],
  );
  const last = Math.max(0, steps.length - 1);
  const index = Math.min(stepIndex, last);
  const step = steps[index];

  if (!step) {
    return <p>No vector steps for this stage.</p>;
  }

  const snippet = `${step.helper}
// ${step.intrinsic}
${step.snippet}`;

  return (
    <LessonBoard
      watching={step.watching}
      fn={`${step.fn} · ${step.helper}`}
      index={index}
      total={steps.length}
      onReset={() => onStepIndex(0)}
      onPrev={() => onStepIndex(Math.max(0, index - 1))}
      onNext={() => onStepIndex(Math.min(last, index + 1))}
      code={snippet}
      highlightLine={step.highlightLine + 2}
      changed={step.changed}
      data={<VectorDataFlow step={step} />}
    />
  );
}
