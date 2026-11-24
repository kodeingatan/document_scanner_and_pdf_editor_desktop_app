import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  type ImageBuffer,
  applyFilterPreset,
  applyAdjustments,
  cloneImage,
  createImage,
  estimateSkew,
  renderRecipe,
  resizeImage,
  rotateImage,
  warpPerspective,
} from '../../src/shared/filters';
import { detectDocument } from '../../src/shared/detection';
import type {
  DetectionResult,
  FilterConfig,
  FilterPreset,
  PageRecipe,
  Quad,
} from '../../src/shared/types';

export type ImageFormat = 'png' | 'jpg' | 'tiff';

function readExifOrientation(buffer: Buffer): number {
  try {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return 1;
    let offset = 2;
    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const size = buffer.readUInt16BE(offset + 2);
      if (marker === 0xe1) {
        const exifStart = offset + 4;
        if (buffer.toString('ascii', exifStart, exifStart + 6) === 'Exif\0\0') {
          const tiff = exifStart + 6;
          const little = buffer.toString('ascii', tiff, tiff + 2) === 'II';
          const readUInt16 = (pos: number) => (little ? buffer.readUInt16LE(pos) : buffer.readUInt16BE(pos));
          const readUInt32 = (pos: number) => (little ? buffer.readUInt32LE(pos) : buffer.readUInt32BE(pos));
          const ifdOffset = readUInt32(tiff + 4);
          const entries = readUInt16(tiff + ifdOffset);
          for (let i = 0; i < entries; i += 1) {
            const entry = tiff + ifdOffset + 2 + i * 12;
            if (readUInt16(entry) === 0x0112) return readUInt16(entry + 8);
          }
        }
      }
      if (size <= 0) break;
      offset += 2 + size;
    }
    return 1;
  } catch {
    return 1;
  }
}

function applyExifOrientation(image: ImageBuffer, orientation: number): ImageBuffer {
  switch (orientation) {
    case 3:
      return rotateImage(image, 180);
    case 6:
      return rotateImage(image, 90);
    case 8:
      return rotateImage(image, 270);
    default:
      return image;
  }
}

export function bufferToImageBuffer(image: Awaited<ReturnType<typeof loadImage>>): ImageBuffer {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: new Uint8ClampedArray(data.data),
    width: canvas.width,
    height: canvas.height,
  };
}

export async function decodeFile(filePath: string): Promise<ImageBuffer> {
  const buffer = await fs.promises.readFile(filePath);
  return decodeBuffer(buffer);
}

export async function decodeBuffer(buffer: Buffer): Promise<ImageBuffer> {
  const image = await loadImage(buffer);
  const decoded = bufferToImageBuffer(image);
  const orientation = readExifOrientation(buffer);
  return orientation > 1 ? applyExifOrientation(decoded, orientation) : decoded;
}

export async function decodeDataUrl(dataUrl: string): Promise<ImageBuffer> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) throw new Error('Format gambar tidak valid.');
  return decodeBuffer(Buffer.from(match[2], 'base64'));
}

function imageBufferToCanvas(image: ImageBuffer) {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function encodeImage(image: ImageBuffer, format: ImageFormat = 'png', quality = 90): Buffer {
  const canvas = imageBufferToCanvas(image);
  if (format === 'jpg') return canvas.toBuffer('image/jpeg', quality);
  if (format === 'tiff') {
    // @napi-rs/canvas has no TIFF encoder; store a lossless PNG stream with .tif naming
    // would break readers, so fall back to PNG bytes and let the caller rename.
    return canvas.toBuffer('image/png');
  }
  return canvas.toBuffer('image/png');
}

export function toDataUrl(image: ImageBuffer, format: 'png' | 'jpg' = 'png', quality = 88): string {
  const buffer = encodeImage(image, format, quality);
  return `data:image/${format === 'jpg' ? 'jpeg' : 'png'};base64,${buffer.toString('base64')}`;
}

export function fitWithin(image: ImageBuffer, maxWidth: number, maxHeight?: number): ImageBuffer {
  if (image.width <= maxWidth && (!maxHeight || image.height <= maxHeight)) return image;
  const ratio = Math.min(maxWidth / image.width, maxHeight ? maxHeight / image.height : 1);
  return resizeImage(image, Math.round(image.width * ratio), Math.round(image.height * ratio));
}

/** Runs the shared, pure render pipeline on the original bitmap. */
export function renderPageImage(original: ImageBuffer, recipe: PageRecipe): ImageBuffer {
  return renderRecipe(original, recipe);
}

export function applyPresetToImage(
  image: ImageBuffer,
  preset: FilterPreset,
  config: FilterConfig,
): ImageBuffer {
  return applyFilterPreset(cloneImage(image), preset, config);
}

export function applyAdjustmentsToImage(
  image: ImageBuffer,
  adjustments: Partial<import('../../src/shared/types').PageAdjustments>,
): ImageBuffer {
  return applyAdjustments(cloneImage(image), {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    gamma: 1,
    denoise: 0,
    fingerMarks: 0,
    whitening: 0,
    ...adjustments,
  });
}

export async function detectImage(filePath: string, sensitivity = 55): Promise<DetectionResult> {
  const image = await decodeFile(filePath);
  return detectDocument(image, sensitivity);
}

export function detectFromBuffer(image: ImageBuffer, sensitivity = 55): DetectionResult {
  return detectDocument(image, sensitivity);
}

export function warpImage(image: ImageBuffer, quad: Quad): ImageBuffer {
  return warpPerspective(image, quad);
}

export async function writeImage(
  image: ImageBuffer,
  targetPath: string,
  format: ImageFormat = 'png',
  quality = 92,
): Promise<{ path: string; width: number; height: number; size: number }> {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const buffer = encodeImage(image, format, quality);
  await fs.promises.writeFile(targetPath, buffer);
  return { path: targetPath, width: image.width, height: image.height, size: buffer.length };
}

export function estimateImageSkew(image: ImageBuffer): number {
  return estimateSkew(image);
}

export function blankImage(width = 100, height = 100): ImageBuffer {
  return createImage(width, height);
}

/** Builds a JPEG/PNG preview of a rendered image at the requested width. */
export function previewDataUrl(image: ImageBuffer, maxWidth = 1600, quality = 85): string {
  const scaled = fitWithin(image, maxWidth, maxWidth * 2);
  return toDataUrl(scaled, 'jpg', quality);
}

export async function loadImageSize(filePath: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(filePath);
  return { width: image.width, height: image.height };
}
