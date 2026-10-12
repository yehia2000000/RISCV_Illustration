"use client";

import manifestJson from "@/lib/median/boxCompare.json";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import styles from "./BoxCompare.module.css";

type FrameName = "noisy" | "box" | "median";

type KernelResult = {
  box: string;
  median: string;
  saltCenter: Record<FrameName, number>;
  saltCrop: Record<FrameName, number[][]>;
  profile: Record<FrameName, number[]>;
  changed: Record<FrameName, number>;
};

type Manifest = {
  opencv: string;
  width: number;
  height: number;
  background: number;
  foreground: number;
  barX0: number;
  barX1: number;
  profileY: number;
  profileX0: number;
  crop: number;
  salt: { y: number; x: number };
  frames: { clean: string; noisy: string };
  kernels: Record<"3" | "5", KernelResult>;
};

const manifest = manifestJson as Manifest;
const KERNELS = [3, 5] as const;

function cellStyle(value: number): CSSProperties {
  const light = value > 128;
  return {
    background: `rgb(${value} ${value} ${value})`,
    color: light ? "#102018" : "#f7fbff",
    textShadow: light ? "0 0 2px rgba(255,255,255,0.45)" : "0 0 2px rgba(0,0,0,0.7)",
  };
}

function rectStyle(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    left: `${(x / manifest.width) * 100}%`,
    top: `${(y / manifest.height) * 100}%`,
    width: `${(w / manifest.width) * 100}%`,
    height: `${(h / manifest.height) * 100}%`,
  };
}

function GrayGrid({ rows }: { rows: number[][] }) {
  const n = rows.length;
  const mid = Math.floor(n / 2);
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {rows.map((row, y) =>
        row.map((value, x) => {
          const isCenter = x === mid && y === mid;
          const dirty = value !== manifest.background;
          const tone = isCenter ? styles.center : dirty ? styles.dirty : "";
          return (
            <span
              key={`${y}-${x}`}
              className={`${styles.cell} ${tone}`}
              style={cellStyle(value)}
              title={String(value)}
            >
              {value}
            </span>
          );
        }),
      )}
    </div>
  );
}

export default function BoxCompare() {
  const [k, setK] = useState<(typeof KERNELS)[number]>(5);
  const kernel = manifest.kernels[String(k) as "3" | "5"];
  const radius = Math.floor(manifest.crop / 2);
  const edgeIndex = manifest.barX0 - manifest.profileX0;
  const ramp = kernel.profile.box.filter(
    (value) => value !== manifest.background && value !== manifest.foreground,
  );
  const snippet = `cv::Mat box, median;
cv::blur(noisy, box, cv::Size(${k}, ${k}));
cv::medianBlur(noisy, median, ${k});`;

  const shots = [
    {
      src: manifest.frames.clean,
      title: "Clean",
      alt: "Clean vertical bar, field 24 and bar 230, with no impulse noise",
      detail: `Field ${manifest.background}, bar ${manifest.foreground}.`,
    },
    {
      src: manifest.frames.noisy,
      title: "Impulse noise",
      alt: "The same bar with salt and pepper impulses",
      detail: `${kernel.changed.noisy} spikes at 0 and 255.`,
    },
    {
      src: kernel.box,
      title: "cv::blur",
      alt: `OpenCV box blur, ${k} by ${k}, of the noisy bar`,
      detail: `${kernel.changed.box} pixels moved off the clean values.`,
    },
    {
      src: kernel.median,
      title: "cv::medianBlur",
      alt: `OpenCV median blur, ${k} by ${k}, of the noisy bar`,
      detail: "Matches the clean bar on every pixel.",
    },
  ];

  const crops: { name: FrameName; label: string }[] = [
    { name: "noisy", label: "Noisy" },
    { name: "box", label: "cv::blur" },
    { name: "median", label: "cv::medianBlur" },
  ];

  return (
    <section className={`panel ${styles.section}`}>
      <h2>Median versus box</h2>
      <p className={styles.intro}>
        OpenCV runs both filters on one <code>uint8</code> image: a hard vertical bar, then salt
        and pepper. <code>cv::blur</code> writes the mean of the {k}×{k} window.{" "}
        <code>cv::medianBlur</code> writes the middle sample after that window is ordered.
      </p>

      <div className={styles.toolbar}>
        <div className={styles.kernels} role="group" aria-label="Kernel size">
          {KERNELS.map((size) => (
            <button
              key={size}
              type="button"
              className={size === k ? styles.kernelOn : styles.kernel}
              aria-pressed={size === k}
              onClick={() => setK(size)}
            >
              {size}×{size}
            </button>
          ))}
        </div>
        <pre className={styles.snippet}>
          <code>{snippet}</code>
        </pre>
      </div>

      <div className={styles.frames}>
        {shots.map((shot) => (
          <figure key={shot.title} className={styles.figure}>
            <div className={styles.shot}>
              <Image
                src={shot.src}
                alt={shot.alt}
                width={manifest.width}
                height={manifest.height}
                unoptimized
                className={styles.img}
              />
              <span
                className={styles.markSalt}
                style={rectStyle(
                  manifest.salt.x - radius,
                  manifest.salt.y - radius,
                  manifest.crop,
                  manifest.crop,
                )}
              />
              <span
                className={styles.markEdge}
                style={rectStyle(manifest.profileX0, manifest.profileY, kernel.profile.noisy.length, 1)}
              />
            </div>
            <figcaption>
              <strong>{shot.title}</strong>
              <span>{shot.detail}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className={styles.legend}>
        <span>
          <span className={`${styles.swatch} ${styles.swatchSalt}`} />
          Salt window
        </span>
        <span>
          <span className={`${styles.swatch} ${styles.swatchEdge}`} />
          Edge row
        </span>
      </p>

      <div className={styles.details}>
        <div className={styles.panel}>
          <h3>Impulse</h3>
          <p>
            The yellow window is centered on a salt pixel, value {kernel.saltCenter.noisy}, on a
            field of {manifest.background}. <code>cv::blur</code> writes {kernel.saltCenter.box}{" "}
            there. Every neighbor whose window still contains the spike is lifted the same way, so
            the spike becomes a {k}×{k} square. <code>cv::medianBlur</code> writes{" "}
            {kernel.saltCenter.median}. One extreme sample sits at the end of the ordered window,
            so the middle rank stays on the surrounding value. Pepper pixels are 0. They pull the
            mean the other way, and the middle rank stays on the surrounding value there too.
          </p>
          <div className={styles.crops}>
            {crops.map((crop) => (
              <div key={crop.name}>
                <p className={styles.cropLabel}>
                  {crop.label} <b>{kernel.saltCenter[crop.name]}</b>
                </p>
                <GrayGrid rows={kernel.saltCrop[crop.name]} />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <h3>Edge</h3>
          <p>
            The teal row crosses the left side of the bar. The column labeled bar is the first
            pixel of the bar. On the clean image that row is {manifest.background}, then{" "}
            {manifest.foreground}. <code>cv::blur</code> mixes the two sides, so the step becomes{" "}
            {ramp.join(", ")}. <code>cv::medianBlur</code> stays with the side that fills more than
            half the window, so the samples stay {manifest.background}, then {manifest.foreground}.
            The step remains one pixel wide.
          </p>
          <div className={styles.strips}>
            <div
              className={styles.axis}
              style={{ gridTemplateColumns: `repeat(${kernel.profile.noisy.length}, minmax(0, 1fr))` }}
            >
              {kernel.profile.noisy.map((_, index) => (
                <span key={index}>{index === edgeIndex ? "bar" : ""}</span>
              ))}
            </div>
            {crops.map((crop) => (
              <div key={crop.name}>
                <p className={styles.cropLabel}>{crop.label}</p>
                <div
                  className={styles.strip}
                  style={{
                    gridTemplateColumns: `repeat(${kernel.profile[crop.name].length}, minmax(0, 1fr))`,
                  }}
                >
                  {kernel.profile[crop.name].map((value, index) => {
                    const mixed =
                      value !== manifest.background && value !== manifest.foreground;
                    return (
                      <span
                        key={index}
                        className={mixed ? styles.mixed : undefined}
                        style={cellStyle(value)}
                        title={String(value)}
                      >
                        {value}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className={styles.source}>
        Frames from OpenCV {manifest.opencv}. <code>cv::blur</code> uses{" "}
        <code>BORDER_REFLECT_101</code>. <code>cv::medianBlur</code> replicates the border. The
        windows above sit in the interior, so the border mode does not change them.
      </p>
    </section>
  );
}
