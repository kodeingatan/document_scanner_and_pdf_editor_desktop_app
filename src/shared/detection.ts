import type { DetectionResult, Point, Quad } from './types';
import {
  type ImageBuffer,
  laplacianVariance,
  meanLuminance,
  quadArea,
  resizeImage,
  toGrayscale,
} from './filters';

/**
 * Smart document detection.
 *
 * Pipeline (matches PRD §6.4):
 *   grayscale → blur → gradient magnitude → binary mask → connected component
 *   → quadrilateral corner extraction → validation → confidence score.
 *
 * Everything runs in-process on an RGBA buffer so the same implementation is
 * used for camera frames (renderer) and scanned images (main process).
 */

const DETECT_WIDTH = 480;

function grayArray(image: ImageBuffer): Float32Array {
  const { data, width, height } = image;
  const gray = new Float32Array(width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    gray[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return gray;
}

function blurGray(gray: Float32Array, width: number, height: number, radius = 1): Float32Array {
  const out = new Float32Array(gray.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += gray[yy * width + xx];
          count += 1;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

function sobel(gray: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] -
        2 * gray[i - 1] -
        gray[i + width - 1] +
        gray[i - width + 1] +
        2 * gray[i + 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

interface Component {
  pixels: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function connectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; components: Component[] } {
  const labels = new Int32Array(width * height).fill(-1);
  const components: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start] !== -1) continue;
    const id = components.length;
    const component: Component = {
      pixels: 0,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
    };
    stack.push(start);
    labels[start] = id;
    while (stack.length) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      component.pixels += 1;
      if (x < component.minX) component.minX = x;
      if (x > component.maxX) component.maxX = x;
      if (y < component.minY) component.minY = y;
      if (y > component.maxY) component.maxY = y;
      const neighbours = [
        index - 1 >= 0 && x > 0 ? index - 1 : -1,
        index + 1 < mask.length && x < width - 1 ? index + 1 : -1,
        index - width >= 0 ? index - width : -1,
        index + width < mask.length ? index + width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || !mask[neighbour] || labels[neighbour] !== -1) continue;
        labels[neighbour] = id;
        stack.push(neighbour);
      }
    }
    components.push(component);
  }
  return { labels, components };
}

function orderCorners(points: Point[]): Quad {
  const sorted = [...points];
  const sum = (p: Point) => p.x + p.y;
  const diff = (p: Point) => p.x - p.y;
  const topLeft = sorted.reduce((a, b) => (sum(a) <= sum(b) ? a : b));
  const bottomRight = sorted.reduce((a, b) => (sum(a) >= sum(b) ? a : b));
  const topRight = sorted.reduce((a, b) => (diff(a) >= diff(b) ? a : b));
  const bottomLeft = sorted.reduce((a, b) => (diff(a) <= diff(b) ? a : b));
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function cornersFromComponent(
  component: Component,
  labels: Int32Array,
  id: number,
  width: number,
): Point[] {
  let tl = { x: width, y: Number.MAX_SAFE_INTEGER };
  let tr = { x: 0, y: Number.MAX_SAFE_INTEGER };
  let bl = { x: width, y: 0 };
  let br = { x: 0, y: 0 };
  let tlScore = Number.MAX_SAFE_INTEGER;
  let trScore = -Number.MAX_SAFE_INTEGER;
  let blScore = Number.MAX_SAFE_INTEGER;
  let brScore = -Number.MAX_SAFE_INTEGER;
  for (let y = component.minY; y <= component.maxY; y += 1) {
    for (let x = component.minX; x <= component.maxX; x += 1) {
      const index = y * width + x;
      if (labels[index] !== id) continue;
      const sum = x + y;
      const diff = x - y;
      if (sum < tlScore) {
        tlScore = sum;
        tl = { x, y };
      }
      if (sum > brScore) {
        brScore = sum;
        br = { x, y };
      }
      if (diff > trScore) {
        trScore = diff;
        tr = { x, y };
      }
      if (diff < blScore) {
        blScore = diff;
        bl = { x, y };
      }
    }
  }
  return [tl, tr, br, bl];
}

function edgeSupport(
  gray: Float32Array,
  width: number,
  height: number,
  quad: Point[],
  radius = 3,
): number {
  let hits = 0;
  let samples = 0;
  for (let side = 0; side < 4; side += 1) {
    const a = quad[side];
    const b = quad[(side + 1) % 4];
    const steps = Math.max(8, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      let best = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 1 || yy >= height - 1) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = x + dx;
          if (xx < 1 || xx >= width - 1) continue;
          const i = yy * width + xx;
          const gradient = Math.abs(gray[i + 1] - gray[i - 1]) + Math.abs(gray[i + width] - gray[i - width]);
          if (gradient > best) best = gradient;
        }
      }
      samples += 1;
      if (best > 40) hits += 1;
    }
  }
  return samples ? hits / samples : 0;
}

const FULL_FRAME: Quad = [
  { x: 0.02, y: 0.02 },
  { x: 0.98, y: 0.02 },
  { x: 0.98, y: 0.98 },
  { x: 0.02, y: 0.98 },
];

export function detectDocument(
  image: ImageBuffer,
  sensitivity = 55,
): DetectionResult {
  const brightness = meanLuminance(image);
  const blur = laplacianVariance(image);
  const scale = Math.min(1, DETECT_WIDTH / image.width);
  const small =
    scale < 1
      ? resizeImage(image, Math.round(image.width * scale), Math.round(image.height * scale))
      : image;
  const smallGray = toGrayscale(small, 100);
  const { width, height, data } = smallGray;

  const gray = new Float32Array(width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) gray[p] = data[i];
  const smooth = blurGray(gray, width, height, 1);
  const edges = sobel(smooth, width, height);

  // Adaptive threshold over the gradient magnitude.
  let sum = 0;
  for (let i = 0; i < edges.length; i += 1) sum += edges[i];
  const mean = sum / edges.length;
  const userFactor = 1.35 - (Math.max(0, Math.min(100, sensitivity)) / 100) * 0.9;
  const threshold = Math.max(14, mean * userFactor);
  const mask = new Uint8Array(edges.length);
  for (let i = 0; i < edges.length; i += 1) mask[i] = edges[i] > threshold ? 1 : 0;

  const { labels, components } = connectedComponents(mask, width, height);
  const frameArea = width * height;
  let best: Component | null = null;
  let bestId = -1;
  components.forEach((component, id) => {
    const bboxWidth = component.maxX - component.minX;
    const bboxHeight = component.maxY - component.minY;
    if (bboxWidth < width * 0.12 || bboxHeight < height * 0.12) return;
    if (component.pixels < frameArea * 0.006) return;
    // Reject "frame border" components that hug the image edges.
    const hugsBorder =
      component.minX <= 2 && component.maxX >= width - 3 && component.pixels > frameArea * 0.35;
    if (hugsBorder) return;
    if (!best || component.pixels > best.pixels) {
      best = component;
      bestId = id;
    }
  });

  if (!best) {
    const support = edgeSupport(gray, width, height, FULL_FRAME.map((p) => ({ x: p.x * width, y: p.y * height })));
    return {
      found: false,
      confidence: Math.min(0.4, support * 0.5),
      corners: FULL_FRAME,
      areaRatio: 1,
      brightness,
      blur,
    };
  }

  const component = best as Component;
  const rawCorners = cornersFromComponent(component, labels, bestId, width);
  const quad = orderCorners(rawCorners);
  const normalized: Quad = quad.map((point) => ({
    x: point.x / width,
    y: point.y / height,
  })) as Quad;

  const pixelQuad = normalized.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  })) as Quad;
  const area = quadArea(pixelQuad) / frameArea;
  const bboxArea =
    Math.max(1, (Math.max(...pixelQuad.map((p) => p.x)) - Math.min(...pixelQuad.map((p) => p.x))) *
      (Math.max(...pixelQuad.map((p) => p.y)) - Math.min(...pixelQuad.map((p) => p.y))));
  const rectangularity = Math.min(1, quadArea(pixelQuad) / bboxArea);
  const support = edgeSupport(gray, width, height, pixelQuad);

  const minEdgeRatio = Math.min(
    Math.hypot(pixelQuad[1].x - pixelQuad[0].x, pixelQuad[1].y - pixelQuad[0].y) / width,
    Math.hypot(pixelQuad[2].x - pixelQuad[3].x, pixelQuad[2].y - pixelQuad[3].y) / width,
    Math.hypot(pixelQuad[3].x - pixelQuad[0].x, pixelQuad[3].y - pixelQuad[0].y) / height,
    Math.hypot(pixelQuad[2].x - pixelQuad[1].x, pixelQuad[2].y - pixelQuad[1].y) / height,
  );

  const areaScore = Math.min(1, area / 0.18);
  const confidence = Math.max(
    0,
    Math.min(1, areaScore * 0.35 + rectangularity * 0.25 + support * 0.4 - (minEdgeRatio < 0.15 ? 0.2 : 0)),
  );

  const plausible = area > 0.06 && area < 0.99 && rectangularity > 0.6 && minEdgeRatio > 0.1;

  return {
    found: plausible && confidence > 0.28,
    confidence,
    corners: normalized,
    areaRatio: area,
    brightness,
    blur,
  };
}

/** Camera-frame analysis with stability scoring over consecutive frames. */
export interface FrameAnalysis extends DetectionResult {
  stable: boolean;
  ready: boolean;
  issues: string[];
}

export function analyzeFrame(
  image: ImageBuffer,
  options: {
    sensitivity: number;
    blurThreshold: number;
    minDocumentSize: number;
    stabilityThreshold: number;
    previousCorners?: Quad | null;
  },
): FrameAnalysis {
  const result = detectDocument(image, options.sensitivity);
  const issues: string[] = [];
  let movement = 0;
  if (options.previousCorners) {
    for (let i = 0; i < 4; i += 1) {
      const a = options.previousCorners[i];
      const b = result.corners[i];
      movement += Math.hypot(a.x - b.x, a.y - b.y) / 4;
    }
  }
  const stable = movement * 100 < options.stabilityThreshold;
  if (!result.found) issues.push('no-document');
  if (result.blur < options.blurThreshold) issues.push('blurry');
  if (result.brightness < 55) issues.push('too-dark');
  if (result.brightness > 235) issues.push('too-bright');
  if (result.areaRatio < options.minDocumentSize / 100) issues.push('too-small');
  if (!stable) issues.push('moving');
  return {
    ...result,
    stable,
    ready: issues.length === 0,
    issues,
  };
}

export { FULL_FRAME };
