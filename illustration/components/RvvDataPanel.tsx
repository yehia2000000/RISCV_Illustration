import {
  VECTOR_HEIGHT,
  VECTOR_IMAGE,
  VECTOR_RADIUS,
  VECTOR_WIDTH,
  type RvvStep,
} from "@/lib/convolution/vectorTrace";
import styles from "./RvvDataPanel.module.css";

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to; value += 1) {
    out.push(value);
  }
  return out;
}

const XS = range(0, VECTOR_WIDTH - 1);
const YS = range(0, VECTOR_HEIGHT - 1);

function isFrame(x: number, y: number): boolean {
  return (
    x < VECTOR_RADIUS ||
    x >= VECTOR_WIDTH - VECTOR_RADIUS ||
    y < VECTOR_RADIUS ||
    y >= VECTOR_HEIGHT - VECTOR_RADIUS
  );
}

function InputGrid({ step }: { step: RvvStep }) {
  const first = step.loadCells[0] ?? null;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.axis}> </th>
            {XS.map((x) => (
              <th key={`ix-${x}`} className={styles.axis}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {YS.map((y) => (
            <tr key={`iy-${y}`}>
              <th className={styles.axis}>{y}</th>
              {XS.map((x) => {
                const loaded = step.loadCells.some(
                  (cell) => cell.x === x && cell.y === y,
                );
                const isLane0 =
                  first !== null && first.x === x && first.y === y;
                const bits = [styles.box];
                if (isFrame(x, y)) bits.push(styles.frame);
                if (loaded) bits.push(styles.loaded);
                if (isLane0) bits.push(styles.lane0);
                return (
                  <td key={`i-${x}-${y}`} className={bits.join(" ")}>
                    {VECTOR_IMAGE[y][x]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutputRow({ step }: { step: RvvStep }) {
  const owners = step.lanes
    .filter((lane) => lane.active && lane.outX !== null)
    .map((lane) => lane.outX as number);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.axis}> </th>
            {XS.map((x) => (
              <th key={`ox-${x}`} className={styles.axis}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className={styles.axis}>{step.y}</th>
            {XS.map((x) => {
              const value = step.outputRow[x];
              const bits = [styles.box];
              if (owners.includes(x)) bits.push(styles.owned);
              if (value !== null) bits.push(styles.written);
              else bits.push(styles.empty);
              return (
                <td key={`o-${x}`} className={bits.join(" ")}>
                  {value === null ? "·" : value}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LaneTable({ step }: { step: RvvStep }) {
  const cellClass = (lane: RvvStep["lanes"][number], extra?: string) =>
    [styles.cell, lane.active ? "" : styles.tail, extra ?? ""]
      .filter(Boolean)
      .join(" ");

  const show = (value: number | null) => (value === null ? "—" : value);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.lanes}>
        <tbody>
          <tr>
            <th>lane</th>
            {step.lanes.map((lane) => (
              <td key={`l-${lane.lane}`} className={cellClass(lane)}>
                {lane.lane}
              </td>
            ))}
          </tr>
          <tr>
            <th>owns out x</th>
            {step.lanes.map((lane) => (
              <td key={`x-${lane.lane}`} className={cellClass(lane)}>
                {show(lane.outX)}
              </td>
            ))}
          </tr>
          <tr>
            <th>p (loaded)</th>
            {step.lanes.map((lane) => (
              <td
                key={`p-${lane.lane}`}
                className={cellClass(
                  lane,
                  lane.active && lane.loaded !== null ? styles.hotCell : "",
                )}
              >
                {show(lane.loaded)}
              </td>
            ))}
          </tr>
          <tr>
            <th>sum (u16)</th>
            {step.lanes.map((lane) => (
              <td
                key={`s-${lane.lane}`}
                className={cellClass(
                  lane,
                  lane.active && lane.acc !== null ? styles.accCell : "",
                )}
              >
                {show(lane.acc)}
              </td>
            ))}
          </tr>
          <tr>
            <th>result (u8)</th>
            {step.lanes.map((lane) => (
              <td key={`r-${lane.lane}`} className={cellClass(lane)}>
                {show(lane.result)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function RvvDataPanel({ step }: { step: RvvStep }) {
  return (
    <div className={styles.page}>
      <div className={styles.meta}>
        <span>
          y <strong>{step.y}</strong>
        </span>
        <span>
          x <strong>{step.x}</strong>
        </span>
        <span>
          vl <strong>{step.vl}</strong>
        </span>
        <span>
          VLMAX <strong>{step.vlmax}</strong>
        </span>
        <span>
          length left <strong>{step.remaining}</strong>
        </span>
        <span>
          strip <strong>{step.strip}</strong>
        </span>
        <span>
          tap{" "}
          <strong>
            {step.tapIndex === null
              ? "—"
              : `${step.tapIndex}/9 (ky ${step.ky}, kx ${step.kx})`}
          </strong>
        </span>
        <span>
          base <strong>{step.base === null ? "—" : step.base}</strong>
        </span>
        <span>{step.sewLmul}</span>
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

      <section className={styles.section}>
        <h3>
          input
          <span className={styles.hint}>
            {VECTOR_HEIGHT} × {VECTOR_WIDTH} · NO_BORDER · dim cells are the
            unfiltered frame
          </span>
        </h3>
        <InputGrid step={step} />
        <p className={styles.legend}>
          <span>
            <span className={`${styles.swatch} ${styles.swatchLoad}`} />
            this vle8 run
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.swatchLane0}`} />
            lane 0
          </span>
          <span>
            <span className={`${styles.swatch} ${styles.swatchWritten}`} />
            written output
          </span>
        </p>
      </section>

      <section className={styles.section}>
        <h3>
          vector registers
          <span className={styles.hint}>
            lanes {step.vl} active of {step.vlmax}
          </span>
        </h3>
        <LaneTable step={step} />
      </section>

      <section className={styles.section}>
        <h3>
          output row
          <span className={styles.hint}>y = {step.y} · sum / 9</span>
        </h3>
        <OutputRow step={step} />
      </section>

      {step.checkpoint ? (
        <p
          className={`${styles.checkpoint} ${
            step.checkpoint.ok ? "" : styles.bad
          }`}
        >
          {step.checkpoint.ok ? "Checkpoint. " : "Mismatch. "}
          {step.checkpoint.label}: {step.checkpoint.detail}
        </p>
      ) : null}
    </div>
  );
}
