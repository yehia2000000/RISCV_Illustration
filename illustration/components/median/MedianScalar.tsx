"use client";

import LessonBoard from "@/components/LessonBoard";
import MedianBuffers from "@/components/median/MedianBuffers";
import { scalarSteps } from "@/lib/median/scalarTrace";
import type { MedianStageId } from "@/lib/median/stages";
import { useMemo, useState } from "react";

export default function MedianScalar({ stage }: { stage: MedianStageId }) {
  const steps = useMemo(() => scalarSteps(stage), [stage]);
  const [index, setIndex] = useState(0);
  const last = Math.max(0, steps.length - 1);
  const step = steps[Math.min(index, last)];

  if (!step) {
    return <p>No scalar steps for this stage.</p>;
  }

  return (
    <LessonBoard
      watching={step.watching}
      fn={step.fn}
      index={Math.min(index, last)}
      total={steps.length}
      onReset={() => setIndex(0)}
      onPrev={() => setIndex((value) => Math.max(0, value - 1))}
      onNext={() => setIndex((value) => Math.min(last, value + 1))}
      code={step.snippet}
      highlightLine={step.highlightLine}
      changed={step.changed}
      data={<MedianBuffers step={step} />}
    />
  );
}
