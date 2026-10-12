"use client";

import type {
  MemoryView,
  RegisterView,
  VectorStep,
} from "@/lib/vectorTrace";
import styles from "./VectorDataFlow.module.css";

export default function VectorDataFlow({ step }: { step: VectorStep }) {
  return (
    <div className={styles.page}>
      <div className={styles.meta}>
        <span>
          VLMAX <strong>{step.vlmax}</strong>
        </span>
        <span>
          remaining <strong>{step.remaining}</strong>
        </span>
        <span>
          offset <strong>{step.offset}</strong>
        </span>
        <span>
          vl <strong>{step.vl}</strong>
        </span>
        <span>
          strip <strong>{step.strip}</strong>
        </span>
        <span>
          {step.sewmLmul}
        </span>
      </div>

      <div className={styles.cards}>
        <p className={styles.card}>
          <span>What it does</span>
          {step.whatItDoes}
        </p>
        <p className={styles.card}>
          <span>Why it is needed</span>
          {step.whyNeeded}
        </p>
        <p className={styles.card}>
          <span>Lane rule</span>
          {step.laneRule}
        </p>
      </div>

      {step.flow ? <p className={styles.flow}>{step.flow}</p> : null}

      {step.registers.map((register) => (
        <RegisterBlock key={register.name} register={register} />
      ))}

      {step.memories.map((memory) => (
        <MemoryBlock key={`${memory.name}-${memory.hint ?? ""}`} memory={memory} />
      ))}

      {step.checkpoint ? (
        <p className={`${styles.checkpoint} ${step.checkpoint.ok ? "" : styles.bad}`}>
          {step.checkpoint.ok ? "Checkpoint. " : "Mismatch. "}
          {step.checkpoint.label}: {step.checkpoint.detail}
        </p>
      ) : null}
    </div>
  );
}

function RegisterBlock({ register }: { register: RegisterView }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.label}>
        {register.kind === "mask" ? "mask" : register.kind} {register.name}
      </h3>
      {register.kind === "scalar" ? (
        <div className={styles.scalar}>{register.scalar}</div>
      ) : (
        <div className={styles.lanes}>
          {register.lanes?.map((lane) => (
            <div
              key={`${register.name}-${lane.lane}`}
              className={[
                styles.lane,
                lane.active ? "" : styles.tail,
                lane.highlight ? styles.hl : "",
                register.kind === "mask" && lane.active && lane.value === "true"
                  ? styles.maskTrue
                  : "",
                register.kind === "mask" && lane.active && lane.value === "false"
                  ? styles.maskFalse
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>lane {lane.lane}</span>
              <strong>{lane.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MemoryBlock({ memory }: { memory: MemoryView }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.label}>
        {memory.name}
        {memory.hint ? <span className={styles.hint}>{memory.hint}</span> : null}
      </h3>
      <div className={styles.cells}>
        {memory.cells.map((cell) => (
          <div
            key={`${memory.name}-${cell.index}`}
            className={[
              styles.cell,
              cell.highlight ? styles.hl : "",
              cell.changed ? styles.changed : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{cell.label}</span>
            <strong>{cell.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
