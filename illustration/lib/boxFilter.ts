/** Scalar box-filter helpers, ported from test/reference/source/box_filter.cpp (ref::). */

export type GrayImage = number[][];
export type FilterSize = 3 | 5 | 7 | 9 | 11;
export type BoxFilterKind = "naive" | "separable" | "optimized";

export enum BorderPolicy {
  NoBorder = "NO_BORDER",
  Replicate = "REPLICATE",
  Constant = "CONSTANT",
  Mirror = "MIRROR",
}

export type BorderMode = {
  policy: BorderPolicy;
  value: number;
};

export const CONSTANT_ZERO: BorderMode = {
  policy: BorderPolicy.Constant,
  value: 0,
};

export const TEACHING_IMAGE: GrayImage = [
  [10, 20, 30],
  [40, 50, 60],
  [70, 80, 90],
  [100, 110, 120],
];

export const TEACHING_KSIZE: FilterSize = 3;
export const TEACHING_COLUMN = 1;

export function imageHeight(image: GrayImage): number {
  return image.length;
}

export function imageWidth(image: GrayImage): number {
  return image[0]?.length ?? 0;
}

export function zerosLike(image: GrayImage): GrayImage {
  const height = imageHeight(image);
  const width = imageWidth(image);
  return Array.from({ length: height }, () => Array<number>(width).fill(0));
}

export function copyImage(image: GrayImage): GrayImage {
  return image.map((row) => [...row]);
}

export function imagesEqual(a: GrayImage, b: GrayImage): boolean {
  if (imageHeight(a) !== imageHeight(b) || imageWidth(a) !== imageWidth(b)) {
    return false;
  }
  for (let y = 0; y < imageHeight(a); y += 1) {
    for (let x = 0; x < imageWidth(a); x += 1) {
      if (a[y][x] !== b[y][x]) {
        return false;
      }
    }
  }
  return true;
}

function clampCoord(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

function mirrorCoord(coord: number, size: number): number {
  if (size <= 1) {
    return 0;
  }
  let next = coord;
  while (next < 0 || next >= size) {
    if (next < 0) {
      next = -next - 1;
    } else {
      next = 2 * size - next - 1;
    }
  }
  return next;
}

export function inBounds(image: GrayImage, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < imageWidth(image) && y < imageHeight(image);
}

export function getPixel(
  image: GrayImage,
  x: number,
  y: number,
  borderMode: BorderMode,
): number {
  const width = imageWidth(image);
  const height = imageHeight(image);
  let sx = x;
  let sy = y;

  switch (borderMode.policy) {
    case BorderPolicy.NoBorder:
      break;
    case BorderPolicy.Replicate:
      sx = clampCoord(x, 0, width - 1);
      sy = clampCoord(y, 0, height - 1);
      break;
    case BorderPolicy.Constant:
      if (x < 0 || x >= width || y < 0 || y >= height) {
        return borderMode.value;
      }
      break;
    case BorderPolicy.Mirror:
      sx = mirrorCoord(x, width);
      sy = mirrorCoord(y, height);
      break;
    default:
      throw new Error("Unknown BorderPolicy");
  }

  if (!inBounds(image, sx, sy)) {
    throw new Error(`GetPixel out of range (${sx}, ${sy}) with ${borderMode.policy}`);
  }
  return image[sy][sx];
}

export function kernelRadius(ksize: FilterSize): number {
  return Math.floor(ksize / 2);
}

export function kernelArea(ksize: FilterSize): number {
  return ksize * ksize;
}

export function horizontalWindowSum(
  image: GrayImage,
  centerX: number,
  y: number,
  radius: number,
  borderMode: BorderMode,
): number {
  let sum = 0;
  for (let kx = -radius; kx <= radius; kx += 1) {
    sum += getPixel(image, centerX + kx, y, borderMode);
  }
  return sum;
}

export function verticalWindowSum(rowSums: number[], ksize: number): number {
  let sum = 0;
  for (let ky = 0; ky < ksize; ky += 1) {
    sum += rowSums[ky] ?? 0;
  }
  return sum;
}

export function swapRowSums(rowSums: number[], ksize: number): void {
  for (let i = 0; i < ksize - 1; i += 1) {
    rowSums[i] = rowSums[i + 1] ?? 0;
  }
}

export type Sample = {
  x: number;
  y: number;
  value: number;
  inside: boolean;
};

export function neighborhoodSamples(
  image: GrayImage,
  centerX: number,
  centerY: number,
  ksize: FilterSize,
  borderMode: BorderMode,
): Sample[] {
  const radius = kernelRadius(ksize);
  const samples: Sample[] = [];
  for (let ky = -radius; ky <= radius; ky += 1) {
    for (let kx = -radius; kx <= radius; kx += 1) {
      const x = centerX + kx;
      const y = centerY + ky;
      samples.push({
        x,
        y,
        value: getPixel(image, x, y, borderMode),
        inside: inBounds(image, x, y),
      });
    }
  }
  return samples;
}

export function boxFilterNaive(
  input: GrayImage,
  ksize: FilterSize,
  borderMode: BorderMode,
): GrayImage {
  const radius = kernelRadius(ksize);
  const area = kernelArea(ksize);
  const output = zerosLike(input);
  const height = imageHeight(input);
  const width = imageWidth(input);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        for (let kx = -radius; kx <= radius; kx += 1) {
          sum += getPixel(input, x + kx, y + ky, borderMode);
        }
      }
      output[y][x] = Math.floor(sum / area);
    }
  }
  return output;
}

export function boxFilterSeparable(
  input: GrayImage,
  ksize: FilterSize,
  borderMode: BorderMode,
): GrayImage {
  const radius = kernelRadius(ksize);
  const area = kernelArea(ksize);
  const output = zerosLike(input);
  const height = imageHeight(input);
  const width = imageWidth(input);

  for (let x = 0; x < width; x += 1) {
    const rowSums = Array<number>(ksize).fill(0);
    for (let i = 0; i < ksize - 1; i += 1) {
      rowSums[i] = horizontalWindowSum(input, x, i - radius, radius, borderMode);
    }
    for (let y = 0; y < height; y += 1) {
      rowSums[ksize - 1] = horizontalWindowSum(
        input,
        x,
        y + radius,
        radius,
        borderMode,
      );
      const windowSum = verticalWindowSum(rowSums, ksize);
      output[y][x] = Math.floor(windowSum / area);
      swapRowSums(rowSums, ksize);
    }
  }
  return output;
}

export function boxFilterOptimized(
  input: GrayImage,
  ksize: FilterSize,
  borderMode: BorderMode,
): GrayImage {
  const radius = kernelRadius(ksize);
  const area = kernelArea(ksize);
  const output = zerosLike(input);
  const height = imageHeight(input);
  const width = imageWidth(input);

  for (let x = 0; x < width; x += 1) {
    const rowSums = Array<number>(ksize).fill(0);
    for (let i = 0; i < ksize - 1; i += 1) {
      rowSums[i] = horizontalWindowSum(input, x, i - radius, radius, borderMode);
    }
    let accumulator = verticalWindowSum(rowSums, ksize - 1);

    for (let y = 0; y < height; y += 1) {
      const incoming = horizontalWindowSum(
        input,
        x,
        y + radius,
        radius,
        borderMode,
      );
      accumulator += incoming;
      rowSums[ksize - 1] = incoming;
      output[y][x] = Math.floor(accumulator / area);
      const outgoing = rowSums[0] ?? 0;
      accumulator -= outgoing;
      swapRowSums(rowSums, ksize);
    }
  }
  return output;
}

export function boxFilterNxN(
  input: GrayImage,
  ksize: FilterSize,
  borderMode: BorderMode,
  kind: BoxFilterKind = "naive",
): GrayImage {
  switch (kind) {
    case "naive":
      return boxFilterNaive(input, ksize, borderMode);
    case "separable":
      return boxFilterSeparable(input, ksize, borderMode);
    case "optimized":
      return boxFilterOptimized(input, ksize, borderMode);
    default:
      throw new Error(`Unknown box filter kind ${kind}`);
  }
}

export type ResourceCost = {
  loads: string;
  stores: string;
  adds: string;
  subs: string;
  divs: string;
  buffer: string;
  cycles: string;
};

export function resourceCost(kind: BoxFilterKind, n: number): ResourceCost {
  if (kind === "naive") {
    return {
      loads: `${n * n}`,
      stores: "1",
      adds: `${n * n}`,
      subs: "0",
      divs: "1",
      buffer: "0",
      cycles: `${2 * n * n + 2}`,
    };
  }
  if (kind === "separable") {
    return {
      loads: `${n + n}`,
      stores: "1",
      adds: `${n + n}`,
      subs: "0",
      divs: "1",
      buffer: `${n}`,
      cycles: `${4 * n + 2}`,
    };
  }
  return {
    loads: `${n + 1}`,
    stores: "1 + 1",
    adds: `${n + 1}`,
    subs: "1",
    divs: "1",
    buffer: `${n + 1}`,
    cycles: `${2 * n + 6}`,
  };
}

export function verifyBoxFilter(): string[] {
  const errors: string[] = [];
  const kinds: BoxFilterKind[] = ["naive", "separable", "optimized"];
  const outputs = kinds.map((kind) =>
    boxFilterNxN(TEACHING_IMAGE, TEACHING_KSIZE, CONSTANT_ZERO, kind),
  );
  const naive = outputs[0];

  for (let i = 1; i < outputs.length; i += 1) {
    if (!imagesEqual(naive, outputs[i])) {
      errors.push(`${kinds[i]} disagrees with naive on the teaching scene`);
    }
  }

  const interiorA = naive[1]?.[1];
  const interiorB = naive[2]?.[1];
  if (interiorA !== 50) {
    errors.push(`expected output(1,1)=50, got ${interiorA}`);
  }
  if (interiorB !== 80) {
    errors.push(`expected output(1,2)=80, got ${interiorB}`);
  }

  return errors;
}

const BOX_FILTER_ERRORS = verifyBoxFilter();
if (BOX_FILTER_ERRORS.length > 0) {
  console.error("Box filter teaching-scene mismatch", BOX_FILTER_ERRORS);
}
