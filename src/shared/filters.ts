import type {
  FilterConfig,
  FilterPreset,
  PageAdjustments,
  PageRecipe,
  Quad,
} from './types';

/**
 * Pure-TS raster engine.
 *
 * The exact same code path is used by the renderer (live preview on a canvas)
 * and by the Electron main process (final non-destructive render), which keeps
 * previews and exports pixel-identical.
 */
export interface ImageBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp255 = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);

export function cloneImage(image: ImageBuffer): ImageBuffer {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

export function createImage(width: number, height: number, fill = 255): ImageBuffer {
  const data = new Uint8ClampedArray(Math.max(1, width * height * 4));
  if (fill !== 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill;
      data[i + 1] = fill;
      data[i + 2] = fill;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/* ------------------------------------------------------------------ */
/* Statistics helpers                                                  */
/* ------------------------------------------------------------------ */

function histogramLuma(image: ImageBuffer): Uint32Array {
  const hist = new Uint32Array(256);
  const { data } = image;
  for (let i = 0; i < data.length; i += 16) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    hist[clamp255(luma) | 0] += 1;
  }
  return hist;
}

function percentileValue(hist: Uint32Array, total: number, fraction: number): number {
  const target = total * fraction;
  let acc = 0;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

export function meanLuminance(image: ImageBuffer): number {
  const { data } = image;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    count += 1;
  }
  return count ? sum / count : 0;
}

/** Variance of the Laplacian — low values mean a blurry image. */
export function laplacianVariance(image: ImageBuffer): number {
  const { data, width, height } = image;
  if (width < 3 || height < 3) return 0;
  const gray = new Float32Array(width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    gray[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const value =
        -4 * gray[idx] + gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/* ------------------------------------------------------------------ */
/* Point operations                                                    */
/* ------------------------------------------------------------------ */

export function toGrayscale(image: ImageBuffer, intensity = 100): ImageBuffer {
  const out = cloneImage(image);
  const mix = Math.max(0, Math.min(100, intensity)) / 100;
  const { data } = out;
  for (let i = 0; i < data.length; i += 4) {
    const luma = clamp255((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
    if (mix >= 1) {
      data[i] = data[i + 1] = data[i + 2] = luma;
    } else {
      data[i] = data[i] + (luma - data[i]) * mix;
      data[i + 1] = data[i + 1] + (luma - data[i + 1]) * mix;
      data[i + 2] = data[i + 2] + (luma - data[i + 2]) * mix;
    }
  }
  return out;
}

export function applyBrightnessContrast(
  image: ImageBuffer,
  brightness = 0,
  contrast = 0,
): ImageBuffer {
  const b = (brightness / 100) * 255;
  const factor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255(factor * (data[i] - 128) + 128 + b);
    data[i + 1] = clamp255(factor * (data[i + 1] - 128) + 128 + b);
    data[i + 2] = clamp255(factor * (data[i + 2] - 128) + 128 + b);
  }
  return image;
}

export function applyGamma(image: ImageBuffer, gamma = 1): ImageBuffer {
  if (!Number.isFinite(gamma) || Math.abs(gamma - 1) < 0.001) return image;
  const safeGamma = Math.max(0.05, Math.min(5, gamma));
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = clamp255(255 * Math.pow(i / 255, 1 / safeGamma));
  }
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
  return image;
}

export function applySaturation(image: ImageBuffer, amount = 0): ImageBuffer {
  if (!amount) return image;
  const factor = 1 + amount / 100;
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    data[i] = clamp255(luma + (data[i] - luma) * factor);
    data[i + 1] = clamp255(luma + (data[i + 1] - luma) * factor);
    data[i + 2] = clamp255(luma + (data[i + 2] - luma) * factor);
  }
  return image;
}

/** Per-channel 1st/99th percentile stretch — fixes scanner color casts. */
export function applyWhiteBalance(image: ImageBuffer): ImageBuffer {
  const { data } = image;
  for (let channel = 0; channel < 3; channel += 1) {
    const hist = new Uint32Array(256);
    let samples = 0;
    for (let i = channel; i < data.length; i += 16) {
      hist[data[i]] += 1;
      samples += 1;
    }
    if (!samples) continue;
    const low = percentileValue(hist, samples, 0.01);
    const high = percentileValue(hist, samples, 0.99);
    const span = Math.max(1, high - low);
    const scale = 255 / span;
    for (let i = channel; i < data.length; i += 4) {
      data[i] = clamp255((data[i] - low) * scale);
    }
  }
  return image;
}

/** Normalizes the luminance histogram between the given percentiles. */
export function applyPercentileContrast(image: ImageBuffer, lowPct = 0.005, highPct = 0.995): ImageBuffer {
  const hist = histogramLuma(image);
  let total = 0;
  for (let i = 0; i < 256; i += 1) total += hist[i];
  if (!total) return image;
  const low = percentileValue(hist, total, lowPct);
  const high = percentileValue(hist, total, highPct);
  if (high - low < 8) return image;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = clamp255(((i - low) / (high - low)) * 255);
  }
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
  return image;
}

/** Lifts near-white paper towards pure white, keeps ink untouched. */
export function applyBackgroundWhitening(image: ImageBuffer, strength = 30): ImageBuffer {
  if (strength <= 0) return image;
  const amount = Math.min(100, strength) / 100;
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    if (luma < 120) continue;
    const t = ((luma - 120) / 135) * amount;
    data[i] = clamp255(data[i] + (255 - data[i]) * t);
    data[i + 1] = clamp255(data[i + 1] + (255 - data[i + 1]) * t);
    data[i + 2] = clamp255(data[i + 2] + (255 - data[i + 2]) * t);
  }
  return image;
}

/* ------------------------------------------------------------------ */
/* Convolution helpers                                                 */
/* ------------------------------------------------------------------ */

export function applyUnsharpMask(image: ImageBuffer, amount = 50, radius = 1): ImageBuffer {
  if (amount <= 0) return image;
  const { width, height } = image;
  const blurred = boxBlur(image, Math.max(1, Math.round(radius)));
  const strength = amount / 100;
  const src = image.data;
  const soft = blurred.data;
  for (let i = 0; i < src.length; i += 4) {
    src[i] = clamp255(src[i] + (src[i] - soft[i]) * strength * 1.6);
    src[i + 1] = clamp255(src[i + 1] + (src[i + 1] - soft[i + 1]) * strength * 1.6);
    src[i + 2] = clamp255(src[i + 2] + (src[i + 2] - soft[i + 2]) * strength * 1.6);
  }
  return { data: src, width, height };
}

export function boxBlur(image: ImageBuffer, radius = 1): ImageBuffer {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.round(radius));
  const windowSize = (r * 2 + 1) ** 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r0 = 0;
      let g0 = 0;
      let b0 = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -r; dx <= r; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const idx = (yy * width + xx) * 4;
          r0 += data[idx];
          g0 += data[idx + 1];
          b0 += data[idx + 2];
          count += 1;
        }
      }
      const target = (y * width + x) * 4;
      out[target] = r0 / Math.max(1, count);
      out[target + 1] = g0 / Math.max(1, count);
      out[target + 2] = b0 / Math.max(1, count);
      out[target + 3] = data[target + 3];
    }
  }
  void windowSize;
  return { data: out, width, height };
}

/** 3×3 median filter — removes salt & pepper / sensor grain without smearing text. */
export function medianFilter(image: ImageBuffer, strength = 1): ImageBuffer {
  if (strength <= 0) return image;
  const passes = strength > 60 ? 2 : 1;
  let current = cloneImage(image);
  for (let pass = 0; pass < passes; pass += 1) {
    const { width, height, data } = current;
    const out = new Uint8ClampedArray(data.length);
    const values = new Array<number>(9);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        for (let channel = 0; channel < 3; channel += 1) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            const yy = Math.min(height - 1, Math.max(0, y + dy));
            for (let dx = -1; dx <= 1; dx += 1) {
              const xx = Math.min(width - 1, Math.max(0, x + dx));
              values[n] = data[(yy * width + xx) * 4 + channel];
              n += 1;
            }
          }
          values.sort((a, b) => a - b);
          out[(y * width + x) * 4 + channel] = values[4];
        }
        out[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
      }
    }
    current = { data: out, width, height };
  }
  return current;
}

/**
 * Non-destructive finger-mark / smudge clean-up.
 *
 * The local paper background is estimated with a large box blur and merged only
 * inside low-gradient regions, so signatures, stamps and handwriting strokes
 * keep their original pixels.
 */
export function removeFingerMarks(image: ImageBuffer, strength = 50): ImageBuffer {
  if (strength <= 0) return image;
  const { width, height } = image;
  const background = boxBlur(image, Math.max(4, Math.round(Math.min(width, height) / 60)));
  const amount = Math.min(100, strength) / 100;
  const out = cloneImage(image);
  const src = image.data;
  const bg = background.data;
  const dst = out.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const luma = (src[idx] * 299 + src[idx + 1] * 587 + src[idx + 2] * 114) / 1000;
      const bgLuma = (bg[idx] * 299 + bg[idx + 1] * 587 + bg[idx + 2] * 114) / 1000;
      const localContrast = Math.abs(luma - bgLuma);
      const neighbour = x + 2 < width ? (y * width + (x + 2)) * 4 : idx;
      const gradient =
        Math.abs(src[idx] - src[neighbour]) +
        Math.abs(src[idx + 1] - src[neighbour + 1]) +
        Math.abs(src[idx + 2] - src[neighbour + 2]);
      // Only flatten soft, low-gradient smudges that are darker than the paper.
      if (gradient < 26 && bgLuma > 90 && luma < bgLuma - 4 && localContrast < 60) {
        const weight = amount * (1 - localContrast / 60);
        dst[idx] = src[idx] + (bg[idx] - src[idx]) * weight;
        dst[idx + 1] = src[idx + 1] + (bg[idx + 1] - src[idx + 1]) * weight;
        dst[idx + 2] = src[idx + 2] + (bg[idx + 2] - src[idx + 2]) * weight;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Thresholding                                                        */
/* ------------------------------------------------------------------ */

function integralGray(image: ImageBuffer): { integral: Float64Array; width: number; height: number } {
  const { width, height, data } = image;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      const idx = ((y - 1) * width + (x - 1)) * 4;
      const luma = (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
      rowSum += luma;
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }
  return { integral, width, height };
}

export function applyAdaptiveThreshold(image: ImageBuffer, blockSize = 31, constant = 12): ImageBuffer {
  const { width, height } = image;
  const out = cloneImage(image);
  const gray = toGrayscale(image, 100);
  const { integral } = integralGray(gray);
  const half = Math.max(3, Math.round(blockSize / 2));
  const stride = width + 1;
  const dst = out.data;
  const src = gray.data;
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * stride + (x1 + 1)] -
        integral[y0 * stride + (x1 + 1)] -
        integral[(y1 + 1) * stride + x0] +
        integral[y0 * stride + x0];
      const mean = sum / area;
      const idx = (y * width + x) * 4;
      const luma = src[idx];
      const value = luma > mean - constant ? 255 : 0;
      dst[idx] = dst[idx + 1] = dst[idx + 2] = value;
    }
  }
  return out;
}

export function applyGlobalThreshold(image: ImageBuffer, threshold = 160): ImageBuffer {
  const out = cloneImage(image);
  const { data } = out;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    const value = luma >= threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  return out;
}

export function applyInkReduction(image: ImageBuffer, threshold = 200, amount = 45): ImageBuffer {
  const strength = Math.min(100, Math.max(0, amount)) / 100;
  const out = cloneImage(image);
  const { data } = out;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    if (luma >= threshold) continue;
    // Compress the dark end of the tonal range toward the paper white.
    const t = strength * (1 - luma / threshold) * 0.85;
    data[i] = clamp255(data[i] + (255 - data[i]) * t);
    data[i + 1] = clamp255(data[i + 1] + (255 - data[i + 1]) * t);
    data[i + 2] = clamp255(data[i + 2] + (255 - data[i + 2]) * t);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export function applyFilterPreset(
  source: ImageBuffer,
  preset: FilterPreset,
  config: FilterConfig = {},
): ImageBuffer {
  let image = cloneImage(source);
  const brightness = config.brightness ?? 0;
  const contrast = config.contrast ?? 0;

  switch (preset) {
    case 'original':
      return image;
    case 'auto-enhance': {
      if (config.whiteBalance !== false) image = applyWhiteBalance(image);
      image = applyPercentileContrast(image, 0.004, 0.996);
      image = applyBrightnessContrast(image, brightness, contrast);
      if (config.saturation) image = applySaturation(image, config.saturation);
      if (config.sharpness) image = applyUnsharpMask(image, config.sharpness, 1);
      return applyBackgroundWhitening(image, 20);
    }
    case 'magic-color': {
      if (config.whiteBalance !== false) image = applyWhiteBalance(image);
      image = applySaturation(image, (config.saturation ?? 0) + (config.colorBoost ?? 0) * 0.5);
      image = applyBrightnessContrast(image, brightness, contrast);
      image = applyBackgroundWhitening(image, 30);
      return applyUnsharpMask(image, config.sharpness ?? 20, 1);
    }
    case 'gray-mode': {
      image = applyPercentileContrast(image, 0.005, 0.995);
      image = applyBrightnessContrast(image, brightness, contrast);
      return toGrayscale(image, config.grayscaleIntensity ?? 100);
    }
    case 'black-white': {
      image = applyWhiteBalance(image);
      if (config.adaptiveThreshold === false) {
        return applyGlobalThreshold(image, config.threshold ?? 160);
      }
      image = applyAdaptiveThreshold(image, 31, 12);
      return applyBrightnessContrast(image, 0, 0);
    }
    case 'lighten': {
      image = applyGamma(image, 1 + ((config.exposure ?? 10) / 100) * 0.8);
      image = applyBrightnessContrast(image, brightness, contrast);
      return applyBackgroundWhitening(image, 35);
    }
    case 'darken': {
      image = applyBrightnessContrast(image, brightness, contrast);
      return applyGamma(image, 0.85);
    }
    case 'sharpen': {
      image = applyBrightnessContrast(image, brightness, contrast);
      return applyUnsharpMask(image, config.sharpness ?? 50, config.radius ?? 1);
    }
    case 'ink-saving': {
      image = applyWhiteBalance(image);
      image = applyBrightnessContrast(image, brightness, contrast);
      return applyInkReduction(image, config.threshold ?? 200, config.inkReduction ?? 45);
    }
    case 'photo-mode': {
      image = applyBrightnessContrast(image, brightness, contrast);
      image = applySaturation(image, config.saturation ?? 8);
      return applyUnsharpMask(image, config.sharpness ?? 14, config.radius ?? 1);
    }
    default:
      return image;
  }
}

export function applyAdjustments(source: ImageBuffer, adjustments: PageAdjustments): ImageBuffer {
  let image = source;
  if (adjustments.denoise > 0) image = medianFilter(image, adjustments.denoise);
  if (adjustments.fingerMarks > 0) image = removeFingerMarks(image, adjustments.fingerMarks);
  if (adjustments.whitening > 0) image = applyBackgroundWhitening(image, adjustments.whitening);
  if (adjustments.gamma && Math.abs(adjustments.gamma - 1) > 0.001) {
    image = applyGamma(image, adjustments.gamma);
  }
  if (adjustments.brightness || adjustments.contrast) {
    image = applyBrightnessContrast(image, adjustments.brightness, adjustments.contrast);
  }
  if (adjustments.saturation) image = applySaturation(image, adjustments.saturation);
  if (adjustments.sharpness) image = applyUnsharpMask(image, adjustments.sharpness, 1);
  return image;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

export function rotateImage(image: ImageBuffer, degrees: number): ImageBuffer {
  const normalized = ((Math.round(degrees) % 360) + 360) % 360;
  if (!normalized) return image;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    const { width, height, data } = image;
    const swap = normalized === 90 || normalized === 270;
    const outWidth = swap ? height : width;
    const outHeight = swap ? width : height;
    const out = new Uint8ClampedArray(outWidth * outHeight * 4);
    for (let y = 0; y < outHeight; y += 1) {
      for (let x = 0; x < outWidth; x += 1) {
        let sx: number;
        let sy: number;
        if (normalized === 90) {
          sx = y;
          sy = height - 1 - x;
        } else if (normalized === 180) {
          sx = width - 1 - x;
          sy = height - 1 - y;
        } else {
          sx = width - 1 - y;
          sy = x;
        }
        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (y * outWidth + x) * 4;
        out[dstIdx] = data[srcIdx];
        out[dstIdx + 1] = data[srcIdx + 1];
        out[dstIdx + 2] = data[srcIdx + 2];
        out[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    return { data: out, width: outWidth, height: outHeight };
  }
  // Arbitrary rotation with white canvas.
  const radians = (normalized * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const { width, height, data } = image;
  const outWidth = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin));
  const outHeight = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos));
  const out = createImage(outWidth, outHeight);
  const dst = out.data;
  const cx = width / 2;
  const cy = height / 2;
  const outCx = outWidth / 2;
  const outCy = outHeight / 2;
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const dx = x - outCx;
      const dy = y - outCy;
      const sx = Math.round(cx + dx * cos + dy * sin);
      const sy = Math.round(cy - dx * sin + dy * cos);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (y * outWidth + x) * 4;
      dst[dstIdx] = data[srcIdx];
      dst[dstIdx + 1] = data[srcIdx + 1];
      dst[dstIdx + 2] = data[srcIdx + 2];
      dst[dstIdx + 3] = 255;
    }
  }
  return out;
}

export function resizeImage(image: ImageBuffer, targetWidth: number, targetHeight: number): ImageBuffer {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round(targetHeight));
  if (width === image.width && height === image.height) return image;
  const out = new Uint8ClampedArray(width * height * 4);
  const { data, width: srcWidth, height: srcHeight } = image;
  const xRatio = srcWidth / width;
  const yRatio = srcHeight / height;
  for (let y = 0; y < height; y += 1) {
    const srcY = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.floor(srcY));
    const y1 = Math.min(srcHeight - 1, y0 + 1);
    const wy = Math.min(1, Math.max(0, srcY - y0));
    for (let x = 0; x < width; x += 1) {
      const srcX = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.floor(srcX));
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const wx = Math.min(1, Math.max(0, srcX - x0));
      const dstIdx = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const p00 = data[(y0 * srcWidth + x0) * 4 + channel];
        const p10 = data[(y0 * srcWidth + x1) * 4 + channel];
        const p01 = data[(y1 * srcWidth + x0) * 4 + channel];
        const p11 = data[(y1 * srcWidth + x1) * 4 + channel];
        const top = p00 + (p10 - p00) * wx;
        const bottom = p01 + (p11 - p01) * wx;
        out[dstIdx + channel] = top + (bottom - top) * wy;
      }
    }
  }
  return { data: out, width, height };
}

/* ------------------------------------------------------------------ */
/* Perspective                                                         */
/* ------------------------------------------------------------------ */

export function quadToPixels(quad: Quad, width: number, height: number): Quad {
  return quad.map((point) => ({
    x: Math.round(Math.min(1, Math.max(0, point.x)) * width),
    y: Math.round(Math.min(1, Math.max(0, point.y)) * height),
  })) as Quad;
}

export function quadArea(quad: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i += 1) {
    const current = quad[i];
    const next = quad[(i + 1) % 4];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-9) return new Array(size).fill(0);
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= size; k += 1) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row, index) => row[size] / row[index]);
}

/** Homography mapping destination rectangle (0..w, 0..h) onto the source quad. */
function homographyFromRectToQuad(width: number, height: number, quad: Quad): number[] {
  const dst: Array<[number, number]> = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = dst[i];
    const { x: u, y: v } = quad[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    vector.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(v);
  }
  return solveLinearSystem(matrix, vector);
}

export function warpPerspective(
  image: ImageBuffer,
  quad: Quad,
  options: { maxWidth?: number; maxHeight?: number } = {},
): ImageBuffer {
  const pixels = quadToPixels(quad, image.width, image.height);
  const widthTop = Math.hypot(pixels[1].x - pixels[0].x, pixels[1].y - pixels[0].y);
  const widthBottom = Math.hypot(pixels[2].x - pixels[3].x, pixels[2].y - pixels[3].y);
  const heightLeft = Math.hypot(pixels[3].x - pixels[0].x, pixels[3].y - pixels[0].y);
  const heightRight = Math.hypot(pixels[2].x - pixels[1].x, pixels[2].y - pixels[1].y);
  let outWidth = Math.max(16, Math.round(Math.max(widthTop, widthBottom)));
  let outHeight = Math.max(16, Math.round(Math.max(heightLeft, heightRight)));
  const maxWidth = options.maxWidth ?? 5000;
  const maxHeight = options.maxHeight ?? 7000;
  if (outWidth > maxWidth) {
    outHeight = Math.round((outHeight * maxWidth) / outWidth);
    outWidth = maxWidth;
  }
  if (outHeight > maxHeight) {
    outWidth = Math.round((outWidth * maxHeight) / outHeight);
    outHeight = maxHeight;
  }
  const h = homographyFromRectToQuad(outWidth, outHeight, pixels);
  const src = image.data;
  const srcWidth = image.width;
  const srcHeight = image.height;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const denominator = h[6] * x + h[7] * y + 1;
      const sx = (h[0] * x + h[1] * y + h[2]) / denominator;
      const sy = (h[3] * x + h[4] * y + h[5]) / denominator;
      const dstIdx = (y * outWidth + x) * 4;
      if (sx < 0 || sy < 0 || sx >= srcWidth - 1 || sy >= srcHeight - 1) {
        out[dstIdx] = out[dstIdx + 1] = out[dstIdx + 2] = 255;
        out[dstIdx + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const wx = sx - x0;
      const wy = sy - y0;
      for (let channel = 0; channel < 4; channel += 1) {
        const p00 = src[(y0 * srcWidth + x0) * 4 + channel];
        const p10 = src[(y0 * srcWidth + x0 + 1) * 4 + channel];
        const p01 = src[((y0 + 1) * srcWidth + x0) * 4 + channel];
        const p11 = src[((y0 + 1) * srcWidth + x0 + 1) * 4 + channel];
        const top = p00 + (p10 - p00) * wx;
        const bottom = p01 + (p11 - p01) * wx;
        out[dstIdx + channel] = top + (bottom - top) * wy;
      }
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}

/**
 * Estimates the small tilt of a scanned page using projection-profile variance.
 * Returns degrees in the -10..10 range; 0 when the page is already straight.
 */
export function estimateSkew(image: ImageBuffer): number {
  const targetWidth = Math.min(600, image.width);
  const small = toGrayscale(
    resizeImage(image, targetWidth, Math.round((image.height / image.width) * targetWidth)),
    100,
  );
  const { width, height, data } = small;
  const gray = new Float32Array(width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) gray[p] = data[i];

  let bestAngle = 0;
  let bestScore = -1;
  for (let angle = -10; angle <= 10; angle += 0.5) {
    const tan = Math.tan((angle * Math.PI) / 180);
    const rows = new Float64Array(height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 2) {
        const yy = Math.round(y + (x - width / 2) * tan);
        if (yy < 0 || yy >= height) continue;
        rows[yy] += 255 - gray[y * width + x];
      }
    }
    let mean = 0;
    for (let i = 0; i < rows.length; i += 1) mean += rows[i];
    mean /= rows.length || 1;
    let variance = 0;
    for (let i = 0; i < rows.length; i += 1) variance += (rows[i] - mean) ** 2;
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = angle;
    }
  }
  return Math.abs(bestAngle) < 0.5 ? 0 : bestAngle;
}

/* ------------------------------------------------------------------ */
/* Recipe render                                                       */
/* ------------------------------------------------------------------ */

export function renderRecipe(source: ImageBuffer, recipe: PageRecipe): ImageBuffer {
  let image = source;
  if (recipe.quad) {
    image = warpPerspective(image, recipe.quad);
  }
  if (recipe.rotation) {
    image = rotateImage(image, recipe.rotation);
  }
  if (recipe.filter && recipe.filter !== 'original') {
    image = applyFilterPreset(image, recipe.filter, recipe.filterConfig || {});
  }
  image = applyAdjustments(image, recipe.adjustments || {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    gamma: 1,
    denoise: 0,
    fingerMarks: 0,
    whitening: 0,
  });
  for (const operation of recipe.operations || []) {
    switch (operation.type) {
      case 'rotate': {
        image = rotateImage(image, Number(operation.params.degrees ?? 0));
        break;
      }
      case 'resize': {
        const mode = String(operation.params.mode ?? 'percent');
        if (mode === 'percent') {
          const percent = Number(operation.params.percent ?? 100) / 100;
          image = resizeImage(image, image.width * percent, image.height * percent);
        } else {
          image = resizeImage(
            image,
            Number(operation.params.width ?? image.width),
            Number(operation.params.height ?? image.height),
          );
        }
        break;
      }
      case 'noise-reduction': {
        image = medianFilter(image, Number(operation.params.strength ?? 40));
        break;
      }
      case 'finger-marks': {
        image = removeFingerMarks(image, Number(operation.params.strength ?? 50));
        break;
      }
      case 'deskew': {
        image = rotateImage(image, -estimateSkew(image));
        break;
      }
      case 'enhance': {
        image = applyFilterPreset(image, 'auto-enhance', {});
        break;
      }
      default:
        break;
    }
  }
  if (recipe.resize) {
    const spec = recipe.resize;
    if (spec.mode === 'percent' && spec.percent) {
      image = resizeImage(image, image.width * (spec.percent / 100), image.height * (spec.percent / 100));
    } else if (spec.mode === 'pixel' && spec.width && spec.height) {
      image = resizeImage(image, spec.width, spec.height);
    }
  }
  return image;
}

export { clamp255 };
