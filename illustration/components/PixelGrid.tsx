import { fmtNum } from "@/lib/format";
import type { BoxFilterSnapshot, OutputImage } from "@/lib/convolution/scalarTrace";
import type { StageId } from "@/lib/convolution/stages";
import {
  CONSTANT_ZERO,
  TEACHING_KSIZE,
  getPixel,
  imageHeight,
  imageWidth,
  inBounds,
  kernelRadius,
  type GrayImage,
  type Sample,
} from "@/lib/boxFilter";
import styles from "./PixelGrid.module.css";

type Props = {
  stage: StageId;
  snapshot: BoxFilterSnapshot;
};

const RADIUS = kernelRadius(TEACHING_KSIZE);

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to; value += 1) {
    out.push(value);
  }
  return out;
}

function isWindowCell(x: number, y: number, samples: Sample[]): boolean {
  return samples.some((sample) => sample.x === x && sample.y === y);
}

function axisClass(coord: number, min: number, max: number): string {
  const pad = coord < min || coord > max;
  return pad ? `${styles.axis} ${styles.axisPad}` : styles.axis;
}

function PixelTable({
  kind,
  image,
  output,
  snapshot,
  xs,
  ys,
}: {
  kind: "input" | "output";
  image: GrayImage;
  output?: OutputImage;
  snapshot: BoxFilterSnapshot;
  xs: number[];
  ys: number[];
}) {
  const height = imageHeight(image);
  const width = imageWidth(image);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.axis}> </th>
            {xs.map((x) => (
              <th key={`x-${x}`} className={axisClass(x, 0, width - 1)}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((y) => (
            <tr key={`y-${y}`}>
              <th className={axisClass(y, 0, height - 1)}>{y}</th>
              {xs.map((x) => {
                const inside = inBounds(image, x, y);
                const inWindow =
                  kind === "input" && isWindowCell(x, y, snapshot.samples);
                const outPixel =
                  kind === "output" &&
                  snapshot.y !== null &&
                  snapshot.x === x &&
                  snapshot.y === y;
                const center =
                  kind === "input" &&
                  snapshot.y !== null &&
                  snapshot.x === x &&
                  snapshot.y === y;
                const bits = [styles.box];
                if (!inside) {
                  bits.push(styles.pad);
                }
                if (inWindow) {
                  bits.push(styles.inWindow);
                }
                if (center || outPixel) {
                  bits.push(styles.center);
                }
                let label = "—";
                if (kind === "input") {
                  label = fmtNum(getPixel(image, x, y, CONSTANT_ZERO));
                } else if (inside) {
                  const written = output?.[y]?.[x];
                  if (written === null || written === undefined) {
                    bits.push(styles.empty);
                    label = "—";
                  } else {
                    label = fmtNum(written);
                  }
                } else {
                  label = "";
                }
                return (
                  <td key={`${kind}-${x}-${y}`} className={bits.join(" ")}>
                    {label}
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

function WindowPeek({ samples }: { samples: Sample[] }) {
  const xs = [...new Set(samples.map((sample) => sample.x))].sort((a, b) => a - b);
  const ys = [...new Set(samples.map((sample) => sample.y))].sort((a, b) => a - b);
  const at = (x: number, y: number) =>
    samples.find((sample) => sample.x === x && sample.y === y);
  return (
    <div className={styles.windowPeek}>
      {samples.length === 0 ? (
        <p className={styles.emptyHint}>No window on this step.</p>
      ) : (
        <table className={styles.grid}>
          <tbody>
            {ys.map((y) => (
              <tr key={`peek-${y}`}>
                {xs.map((x) => {
                  const sample = at(x, y);
                  const bits = [styles.box, styles.inWindow];
                  if (sample && !sample.inside) {
                    bits.push(styles.pad);
                  }
                  return (
                    <td key={`peek-${x}-${y}`} className={bits.join(" ")}>
                      {sample ? fmtNum(sample.value) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function PixelGrid({ stage, snapshot }: Props) {
  const height = imageHeight(snapshot.input);
  const width = imageWidth(snapshot.input);
  const xs = range(-RADIUS, width - 1 + RADIUS);
  const ys = range(-RADIUS, height - 1 + RADIUS);
  const rowSums = snapshot.rowSums ?? (stage === "enhanced" ? [0, 0, 0] : null);
  const showAcc = stage === "enhanced";
  const acc = snapshot.accumulator ?? 0;

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <section>
          <h3>
            input
            <span className={styles.hint}>
              [{height} × {width}] · CONSTANT 0 · x = {snapshot.x}
              {snapshot.y === null ? "" : `, y = ${snapshot.y}`}
            </span>
          </h3>
          <PixelTable
            kind="input"
            image={snapshot.input}
            snapshot={snapshot}
            xs={xs}
            ys={ys}
          />
          <p className={styles.legend}>
            <span>
              <span className={`${styles.swatch} ${styles.swatchPad}`} />
              pad 0
            </span>
            <span>
              <span className={`${styles.swatch} ${styles.swatchWin}`} />
              window
            </span>
            <span>
              <span className={`${styles.swatch} ${styles.swatchCenter}`} />
              center
            </span>
          </p>
        </section>
        <section>
          <h3>
            selected window
            <span className={styles.hint}>
              {snapshot.samples.length
                ? `${snapshot.samples.length} loads`
                : "none this step"}
            </span>
          </h3>
          <WindowPeek samples={snapshot.samples} />
        </section>
        <section>
          <h3>
            output
            <span className={styles.hint}>sum / 9</span>
          </h3>
          <PixelTable
            kind="output"
            image={snapshot.input}
            output={snapshot.output}
            snapshot={snapshot}
            xs={range(0, width - 1)}
            ys={range(0, height - 1)}
          />
        </section>
      </div>

      {rowSums && stage === "separable" ? (
        <section>
          <h3>
            row_sums
            <span className={styles.hint}>buffer size n = 3</span>
          </h3>
          <div className={styles.buffer}>
            {rowSums.map((value, slot) => (
              <div key={`row-${slot}`} className={styles.slot}>
                <span>[{slot}]</span>
                <strong>{fmtNum(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showAcc ? (
        <section>
          <h3>
            accumulate buffer
            <span className={styles.hint}>n + 1 slots · row_sums then acc</span>
          </h3>
          <div className={styles.buffer}>
            {(rowSums ?? [0, 0, 0]).map((value, slot) => (
              <div
                key={`acc-row-${slot}`}
                className={`${styles.slot} ${
                  snapshot.outgoing !== null && slot === 0 ? styles.hot : ""
                }`}
              >
                <span>row_sums[{slot}]</span>
                <strong>{fmtNum(value)}</strong>
              </div>
            ))}
            <div className={`${styles.slot} ${styles.acc}`}>
              <span>accumulator</span>
              <strong>{fmtNum(acc)}</strong>
            </div>
            {snapshot.incoming !== null ? (
              <div className={`${styles.slot} ${styles.hot}`}>
                <span>incoming</span>
                <strong>{fmtNum(snapshot.incoming)}</strong>
              </div>
            ) : null}
            {snapshot.outgoing !== null ? (
              <div className={styles.slot}>
                <span>outgoing</span>
                <strong>{fmtNum(snapshot.outgoing)}</strong>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {snapshot.windowSum !== null ? (
        <p className={styles.sum}>window sum {fmtNum(snapshot.windowSum)}</p>
      ) : null}
    </div>
  );
}
