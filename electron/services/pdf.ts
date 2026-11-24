import fs from 'node:fs';
import path from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from '@cantoo/pdf-lib';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import type {
  CompressOptions,
  ImageToPdfOptions,
  PageNumberOptions,
  PdfExportOptions,
  PdfInfo,
  PdfMetadata,
  PdfOpResult,
  ProtectOptions,
  SplitRange,
} from '../../src/shared/types';
import { PAPER_SIZES, mmToPixels, parsePageRange, toRoman } from '../../src/shared/constants';
import { applyFilterPreset } from '../../src/shared/filters';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { decodeFile, encodeImage, fitWithin, writeImage } from './imageEngine';
import { sanitizeFileName } from '../lib/filenames';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** pdfjs-dist v4 is ESM-only; load it without letting the bundler rewrite import(). */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<PdfjsModule>;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      (globalThis as Record<string, unknown>).ImageData ??= ImageData;
      (globalThis as Record<string, unknown>).Path2D ??= Path2D;
      (globalThis as Record<string, unknown>).DOMMatrix ??= DOMMatrix;
      const module = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
      return module;
    })();
  }
  return pdfjsPromise;
}

function pdfjsResources(): { standardFontDataUrl: string; cMapUrl: string } {
  try {
    const base = path.dirname(require.resolve('pdfjs-dist/package.json'));
    return {
      standardFontDataUrl: path.join(base, 'standard_fonts') + path.sep,
      cMapUrl: path.join(base, 'cmaps') + path.sep,
    };
  } catch {
    return { standardFontDataUrl: '', cMapUrl: '' };
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function safeOutputPath(candidate: string | undefined, defaultName: string, dir?: string): string {
  const target =
    candidate && candidate.trim()
      ? path.resolve(candidate)
      : paths.uniqueFilePath(path.join(dir ?? paths.exports, `${sanitizeFileName(defaultName)}`));
  paths.assertAllowedWrite(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

function friendlyPdfError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/password/i.test(message)) return new Error('PDF dilindungi password. Masukkan password yang benar.');
  if (/Invalid PDF|InvalidPDF|no pdf header/i.test(message)) {
    return new Error('File PDF rusak atau bukan format PDF yang valid.');
  }
  return new Error(message);
}

async function openPdfjs(filePath: string, password?: string) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await fs.promises.readFile(filePath));
  const resources = pdfjsResources();
  try {
    const task = pdfjs.getDocument({
      data,
      password,
      isEvalSupported: false,
      useSystemFonts: false,
      cMapPacked: true,
      ...resources,
    } as Parameters<typeof pdfjs.getDocument>[0]);
    return await task.promise;
  } catch (error) {
    throw friendlyPdfError(error);
  }
}

export async function getPdfInfo(filePath: string, password?: string, includePages = true): Promise<PdfInfo> {
  const resolved = path.resolve(filePath);
  const stat = await fs.promises.stat(resolved);
  let encrypted = false;
  let pageSizes: Array<{ index: number; width: number; height: number; rotation: number }> = [];
  let metadata: PdfMetadata = {
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creationDate: '',
    modificationDate: '',
  };
  let pageCount = 0;
  try {
    const pdf = await PDFDocument.load(await fs.promises.readFile(resolved), {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    encrypted = pdf.isEncrypted;
    pageCount = pdf.getPageCount();
    metadata = {
      title: pdf.getTitle() ?? '',
      author: pdf.getAuthor() ?? '',
      subject: pdf.getSubject() ?? '',
      keywords: pdf.getKeywords() ?? '',
      creator: pdf.getCreator() ?? '',
      producer: pdf.getProducer() ?? '',
      creationDate: pdf.getCreationDate()?.toISOString() ?? '',
      modificationDate: pdf.getModificationDate()?.toISOString() ?? '',
    };
    if (includePages && (!encrypted || password !== undefined)) {
      const readable = encrypted
        ? await PDFDocument.load(await fs.promises.readFile(resolved), { password, updateMetadata: false })
        : pdf;
      pageSizes = readable.getPages().map((page, index) => ({
        index,
        width: Math.round(page.getWidth()),
        height: Math.round(page.getHeight()),
        rotation: page.getRotation().angle,
      }));
    }
  } catch (error) {
    throw friendlyPdfError(error);
  }
  return {
    path: resolved,
    fileName: path.basename(resolved),
    pageCount,
    fileSize: stat.size,
    encrypted,
    metadata,
    pages: pageSizes,
  };
}

interface RenderPageOptions {
  pageIndex: number;
  dpi?: number;
  password?: string;
  format?: 'png' | 'jpg';
  quality?: number;
  grayscale?: boolean;
}

export async function renderPdfPage(
  filePath: string,
  options: RenderPageOptions,
): Promise<{ buffer: Buffer; width: number; height: number; pageCount: number; dataUrl: string }> {
  const doc = await openPdfjs(filePath, options.password);
  try {
    const pageNumber = Math.min(Math.max(1, options.pageIndex + 1), doc.numPages);
    const page = await doc.getPage(pageNumber);
    const dpi = Math.min(600, Math.max(48, options.dpi ?? 150));
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
    let buffer: Buffer;
    const format = options.format ?? 'jpg';
    if (options.grayscale) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const processed = applyFilterPreset(
        { data: new Uint8ClampedArray(imageData.data), width: canvas.width, height: canvas.height },
        'gray-mode',
        {},
      );
      const outCanvas = createCanvas(processed.width, processed.height);
      const outCtx = outCanvas.getContext('2d');
      const outImage = outCtx.createImageData(processed.width, processed.height);
      outImage.data.set(processed.data);
      outCtx.putImageData(outImage, 0, 0);
      buffer = outCanvas.toBuffer('image/jpeg', options.quality ?? 82);
    } else {
      buffer =
        format === 'png'
          ? canvas.toBuffer('image/png')
          : canvas.toBuffer('image/jpeg', options.quality ?? 85);
    }
    return {
      buffer,
      width: canvas.width,
      height: canvas.height,
      pageCount: doc.numPages,
      dataUrl: `data:image/${format === 'png' ? 'png' : 'jpeg'};base64,${buffer.toString('base64')}`,
    };
  } finally {
    await doc.destroy();
  }
}

export async function extractPdfPages(
  filePath: string,
  options: { dpi?: number; password?: string; pages?: number[] },
): Promise<Array<{ index: number; buffer: Buffer; width: number; height: number }>> {
  const doc = await openPdfjs(filePath, options.password);
  try {
    const targets = options.pages?.length
      ? options.pages.map((index) => index + 1).filter((page) => page >= 1 && page <= doc.numPages)
      : Array.from({ length: doc.numPages }, (_, index) => index + 1);
    const results: Array<{ index: number; buffer: Buffer; width: number; height: number }> = [];
    for (const pageNumber of targets) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: (options.dpi ?? 200) / 72 });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
      results.push({
        index: pageNumber - 1,
        buffer: canvas.toBuffer('image/png'),
        width: canvas.width,
        height: canvas.height,
      });
    }
    return results;
  } finally {
    await doc.destroy();
  }
}

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface PdfTextPage {
  index: number;
  width: number;
  height: number;
  items: PdfTextItem[];
  text: string;
  hasText: boolean;
}

export async function extractPdfText(
  filePath: string,
  options: { password?: string; pages?: number[] } = {},
): Promise<PdfTextPage[]> {
  const doc = await openPdfjs(filePath, options.password);
  try {
    const targets = options.pages?.length
      ? options.pages.map((index) => index + 1).filter((page) => page >= 1 && page <= doc.numPages)
      : Array.from({ length: doc.numPages }, (_, index) => index + 1);
    const pages: PdfTextPage[] = [];
    for (const pageNumber of targets) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const raw of content.items as Array<Record<string, unknown>>) {
        const text = String(raw.str ?? '');
        if (!text.trim()) continue;
        const transform = (raw.transform as number[]) ?? [1, 0, 0, 1, 0, 0];
        const fontSize = Math.hypot(transform[2] ?? 0, transform[3] ?? 0) || Number(raw.height ?? 10);
        items.push({
          text,
          x: transform[4] ?? 0,
          y: transform[5] ?? 0,
          width: Number(raw.width ?? text.length * fontSize * 0.5),
          height: Number(raw.height ?? fontSize),
          fontSize: fontSize || 10,
        });
      }
      const text = items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
      pages.push({
        index: pageNumber - 1,
        width: viewport.width,
        height: viewport.height,
        items,
        text,
        hasText: text.length > 20,
      });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/* ------------------------------------------------------------------ */
/* Images → PDF                                                        */
/* ------------------------------------------------------------------ */

export interface PdfImageInput {
  path: string;
  width?: number;
  height?: number;
}

export async function createPdfFromImages(input: {
  images: PdfImageInput[];
  outputPath: string;
  options: PdfExportOptions;
  metadata?: PdfMetadata;
  job?: (current: number, total: number) => void;
}): Promise<{ size: number; warnings: string[] }> {
  const { images, outputPath, options } = input;
  if (!images.length) throw new Error('Tidak ada gambar untuk dibuat PDF.');
  const pdf = await PDFDocument.create();
  const warnings: string[] = [];
  const qualityMap = { low: 45, medium: 68, high: 82, maximum: 94 } as const;
  const dpiMap = { low: 96, medium: 144, high: 200, maximum: 300 } as const;
  const jpegQuality = qualityMap[options.quality] ?? 82;
  const targetDpi = dpiMap[options.quality] ?? 200;
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    let bitmap = await decodeFile(image.path);
    if (options.imageFormat === 'jpg') {
      const scale = Math.min(1, (targetDpi / 96) * 1.4);
      bitmap = fitWithin(bitmap, Math.min(bitmap.width * scale, 4000), 6000);
      const encoded = encodeImage(bitmap, 'jpg', jpegQuality);
      const embedded = await pdf.embedJpg(encoded);
      addImagePage(pdf, embedded, bitmap.width, bitmap.height, options);
    } else {
      const encoded = encodeImage(bitmap, 'png');
      const embedded = await pdf.embedPng(encoded);
      addImagePage(pdf, embedded, bitmap.width, bitmap.height, options);
    }
    input.job?.(index + 1, images.length);
  }

  if (options.addPageNumbers) {
    const pages = pdf.getPages();
    pages.forEach((page, index) => {
      const { width } = page.getSize();
      page.drawText(`${index + 1} / ${pages.length}`, {
        x: width / 2 - 18,
        y: 16,
        size: 9,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    });
  }

  pdf.setTitle(input.metadata?.title || path.parse(outputPath).name);
  pdf.setAuthor(input.metadata?.author || 'Document Scanner & PDF Editor');
  pdf.setSubject(input.metadata?.subject || '');
  pdf.setKeywords((input.metadata?.keywords || '').split(/[,;]/).map((keyword) => keyword.trim()).filter(Boolean));
  pdf.setCreator(input.metadata?.creator || 'Document Scanner & PDF Editor');
  pdf.setProducer('Document Scanner & PDF Editor');
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  if (options.password) {
    pdf.encrypt({
      userPassword: options.password,
      ownerPassword: options.password,
      permissions: { printing: 'highResolution', copying: true, modifying: false },
    });
    warnings.push('PDF dilindungi dengan password AES-256.');
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  await fs.promises.writeFile(outputPath, bytes);
  return { size: bytes.length, warnings };
}

function addImagePage(
  pdf: PDFDocument,
  embedded: Awaited<ReturnType<PDFDocument['embedJpg']>>,
  width: number,
  height: number,
  options: PdfExportOptions,
): void {
  const margin = Math.max(0, options.margin);
  const imageRatio = width / height;
  let pageWidth: number;
  let pageHeight: number;
  if (options.pageSize === 'Original') {
    pageWidth = width * 0.75 + margin * 2;
    pageHeight = height * 0.75 + margin * 2;
  } else {
    const def = PAPER_SIZES[options.pageSize] ?? PAPER_SIZES.A4;
    const mm = (value: number) => (value / 25.4) * 72;
    let w = mm(def.widthMm);
    let h = mm(def.heightMm);
    const orientation =
      options.orientation === 'auto'
        ? imageRatio > 1.02
          ? 'landscape'
          : 'portrait'
        : options.orientation;
    if (orientation === 'landscape') [w, h] = [h, w];
    pageWidth = w;
    pageHeight = h;
  }
  const page = pdf.addPage([pageWidth, pageHeight]);
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(availableWidth / width, availableHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  page.drawImage(embedded, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

/* ------------------------------------------------------------------ */
/* PDF structural operations                                           */
/* ------------------------------------------------------------------ */

async function loadForEdit(filePath: string, password?: string): Promise<PDFDocument> {
  try {
    const bytes = await fs.promises.readFile(path.resolve(filePath));
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, password });
  } catch (error) {
    throw friendlyPdfError(error);
  }
}

async function savePdf(pdf: PDFDocument, outputPath: string): Promise<number> {
  const bytes = await pdf.save({ useObjectStreams: true });
  await fs.promises.writeFile(outputPath, bytes);
  return bytes.length;
}

function defaultOutputName(filePath: string, suffix: string): string {
  return `${sanitizeFileName(path.parse(filePath).name)}-${suffix}.pdf`;
}

export async function mergePdfs(filePaths: string[], outputPath?: string, password?: string): Promise<PdfOpResult> {
  if (filePaths.length < 2) throw new Error('Pilih minimal dua file PDF untuk digabung.');
  const merged = await PDFDocument.create();
  const warnings: string[] = [];
  for (const file of filePaths) {
    const source = await loadForEdit(file, password);
    const indexes = source.getPageIndices();
    const copied = await merged.copyPages(source, indexes);
    copied.forEach((page) => merged.addPage(page));
  }
  const target = safeOutputPath(
    outputPath,
    defaultOutputName(filePaths[0], 'merged'),
  );
  const size = await savePdf(merged, target);
  const originalSize = filePaths.reduce((total, file) => {
    try {
      return total + fs.statSync(file).size;
    } catch {
      return total;
    }
  }, 0);
  if (originalSize && size > originalSize) {
    warnings.push('Ukuran hasil gabungan lebih besar dari total sumber karena metadata objek ditulis ulang.');
  }
  return {
    outputPath: target,
    outputSize: size,
    originalSize,
    pageCount: merged.getPageCount(),
    warnings,
  };
}

export async function splitPdf(
  filePath: string,
  mode: 'every' | 'ranges' | 'interval' | 'selected',
  options: { ranges?: SplitRange[]; interval?: number; pages?: number[]; outputDir?: string },
): Promise<PdfOpResult> {
  const source = await loadForEdit(filePath);
  const total = source.getPageCount();
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : paths.uniqueFilePath(path.join(paths.exports, `${sanitizeFileName(path.parse(filePath).name)}-split`));
  fs.mkdirSync(outputDir, { recursive: true });
  paths.assertAllowedWrite(path.join(outputDir, 'probe.pdf'));

  const groups: Array<{ label: string; pages: number[] }> = [];
  if (mode === 'every') {
    for (let index = 0; index < total; index += 1) groups.push({ label: `page-${index + 1}`, pages: [index] });
  } else if (mode === 'ranges') {
    for (const range of options.ranges ?? []) {
      const pages: number[] = [];
      for (let page = Math.max(1, range.from); page <= Math.min(total, range.to); page += 1) pages.push(page - 1);
      if (pages.length) groups.push({ label: `${range.from}-${range.to}`, pages });
    }
  } else if (mode === 'interval') {
    const size = Math.max(1, options.interval ?? 10);
    for (let start = 0; start < total; start += size) {
      const pages = [];
      for (let page = start; page < Math.min(total, start + size); page += 1) pages.push(page);
      groups.push({ label: `${start + 1}-${Math.min(total, start + size)}`, pages });
    }
  } else {
    const pages = (options.pages ?? []).filter((page) => page >= 0 && page < total).sort((a, b) => a - b);
    if (!pages.length) throw new Error('Tidak ada halaman yang dipilih.');
    groups.push({ label: 'selected', pages });
  }
  if (!groups.length) throw new Error('Tidak ada halaman untuk dipisahkan.');

  const outputPaths: string[] = [];
  let totalSize = 0;
  for (const group of groups) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, group.pages);
    copied.forEach((page) => out.addPage(page));
    const target = paths.uniqueFilePath(
      path.join(outputDir, `${sanitizeFileName(path.parse(filePath).name)}-${group.label}.pdf`),
    );
    totalSize += await savePdf(out, target);
    outputPaths.push(target);
  }
  return {
    outputPath: outputDir,
    outputPaths,
    outputSize: totalSize,
    originalSize: fs.statSync(filePath).size,
    pageCount: total,
  };
}

export async function compressPdf(
  filePath: string,
  options: CompressOptions,
  outputPath?: string,
): Promise<PdfOpResult> {
  const originalSize = fs.statSync(filePath).size;
  const doc = await openPdfjs(filePath);
  const rebuilt = await PDFDocument.create();
  const pages = rebuilt;
  try {
    for (let index = 1; index <= doc.numPages; index += 1) {
      const page = await doc.getPage(index);
      const viewport = page.getViewport({ scale: options.dpi / 72 });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
      let buffer = canvas.toBuffer('image/jpeg', options.imageQuality);
      if (options.grayscale) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const processed = applyFilterPreset(
          { data: new Uint8ClampedArray(imageData.data), width: canvas.width, height: canvas.height },
          'gray-mode',
          {},
        );
        const grayCanvas = createCanvas(processed.width, processed.height);
        const grayCtx = grayCanvas.getContext('2d');
        const grayData = grayCtx.createImageData(processed.width, processed.height);
        grayData.data.set(processed.data);
        grayCtx.putImageData(grayData, 0, 0);
        buffer = grayCanvas.toBuffer('image/jpeg', options.imageQuality);
      }
      const embedded = await pages.embedJpg(buffer);
      const { width, height } = page.getViewport({ scale: 1 });
      const pdfPage = pages.addPage([width, height]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width, height });
    }
  } finally {
    await doc.destroy();
  }
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'compressed'));
  pages.setTitle(path.parse(filePath).name);
  pages.setProducer('Document Scanner & PDF Editor');
  if (options.removeMetadata) {
    pages.setAuthor('');
    pages.setSubject('');
    pages.setKeywords([]);
    pages.setCreator('Document Scanner & PDF Editor');
  }
  const size = await savePdf(pages, target);
  return {
    outputPath: target,
    outputSize: size,
    originalSize,
    compressionRatio: originalSize ? 1 - size / originalSize : 0,
    pageCount: pages.getPageCount(),
    warnings:
      size >= originalSize
        ? ['Compression tidak mengurangi ukuran file karena dokumen sudah sangat terkompresi atau berisi teks vektor.']
        : [],
  };
}

export async function rotatePdf(
  filePath: string,
  pages: number[],
  amount: number,
  outputPath?: string,
): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  const targets = pages.length ? pages : pdf.getPageIndices();
  for (const index of targets) {
    if (index < 0 || index >= pdf.getPageCount()) continue;
    const page = pdf.getPage(index);
    page.setRotation(degrees((page.getRotation().angle + amount + 360) % 360));
  }
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'rotated'));
  const size = await savePdf(pdf, target);
  return { outputPath: target, outputSize: size, originalSize: fs.statSync(filePath).size, pageCount: pdf.getPageCount() };
}

export async function deletePdfPages(filePath: string, pages: number[], outputPath?: string): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  const remove = [...new Set(pages)].sort((a, b) => b - a);
  if (remove.length >= pdf.getPageCount()) throw new Error('Tidak dapat menghapus semua halaman dokumen.');
  for (const index of remove) {
    if (index >= 0 && index < pdf.getPageCount()) pdf.removePage(index);
  }
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'deleted'));
  const size = await savePdf(pdf, target);
  return { outputPath: target, outputSize: size, pageCount: pdf.getPageCount() };
}

export async function extractPdfPageFile(filePath: string, pages: number[], outputPath?: string): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  const source = pdf;
  const out = await PDFDocument.create();
  const valid = pages.filter((index) => index >= 0 && index < source.getPageCount());
  if (!valid.length) throw new Error('Tidak ada halaman yang dipilih.');
  const copied = await out.copyPages(source, valid);
  copied.forEach((page) => out.addPage(page));
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'extract'));
  const size = await savePdf(out, target);
  return { outputPath: target, outputSize: size, pageCount: out.getPageCount(), originalSize: fs.statSync(filePath).size };
}

export async function reorderPdf(filePath: string, order: number[], outputPath?: string): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  const total = pdf.getPageCount();
  const sequence = order.filter((index) => index >= 0 && index < total);
  if (sequence.length !== total) throw new Error('Urutan halaman harus memuat seluruh halaman.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(pdf, sequence);
  copied.forEach((page) => out.addPage(page));
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'reordered'));
  const size = await savePdf(out, target);
  return { outputPath: target, outputSize: size, pageCount: total };
}

export async function protectPdf(
  filePath: string,
  options: ProtectOptions,
  outputPath?: string,
): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  if (pdf.isEncrypted) throw new Error('PDF sudah terproteksi. Buka proteksi terlebih dahulu.');
  const userPassword = options.userPassword?.trim() || undefined;
  const ownerPassword = options.ownerPassword?.trim() || userPassword || `owner-${Date.now()}`;
  pdf.encrypt({
    userPassword,
    ownerPassword,
    permissions: {
      printing: options.permissions.printing
        ? options.permissions.highQualityPrinting
          ? 'highResolution'
          : 'lowResolution'
        : false,
      modifying: options.permissions.editing,
      copying: options.permissions.copying,
      annotating: options.permissions.annotation,
      fillingForms: options.permissions.formFilling,
      documentAssembly: options.permissions.extraction,
      contentAccessibility: true,
    },
  });
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'protected'));
  const size = await savePdf(pdf, target);
  return {
    outputPath: target,
    outputSize: size,
    pageCount: pdf.getPageCount(),
    warnings: [
      'Password tidak disimpan oleh aplikasi. Simpan password Anda di tempat aman.',
      'Beberapa pembaca PDF mungkin tidak menegakkan pembatasan izin secara konsisten.',
    ],
  };
}

export async function unlockPdf(filePath: string, password: string, outputPath?: string): Promise<PdfOpResult> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(await fs.promises.readFile(path.resolve(filePath)), {
      password,
      updateMetadata: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message)) throw new Error('Password salah. Periksa kembali password PDF.');
    throw friendlyPdfError(error);
  }
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'unlocked'));
  const size = await savePdf(pdf, target);
  return {
    outputPath: target,
    outputSize: size,
    pageCount: pdf.getPageCount(),
    warnings: ['File sumber tidak diubah. Hasil disimpan sebagai file baru tanpa proteksi.'],
  };
}

function formatPageNumber(index: number, total: number, options: PageNumberOptions): string {
  const value = options.startNumber + index;
  let body: string;
  switch (options.format) {
    case 'page-of-total':
      body = `${value} / ${options.startNumber + total - 1}`;
      break;
    case 'roman':
      body = toRoman(value);
      break;
    case 'word':
      body = numberToWords(value);
      break;
    default:
      body = String(value);
  }
  return `${options.prefix}${body}${options.suffix}`;
}

const NUMBER_WORDS = [
  'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
  'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas',
  'delapan belas', 'sembilan belas',
];

function numberToWords(value: number): string {
  if (value < 20) return NUMBER_WORDS[value] ?? String(value);
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const rest = value % 10;
    const names = ['', '', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh', 'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh'];
    return `${names[tens]}${rest ? ` ${numberToWords(rest)}` : ''}`.trim();
  }
  return String(value);
}

export async function addPdfPageNumbers(
  filePath: string,
  options: PageNumberOptions,
  outputPath?: string,
): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const selected = new Set(
    options.pageRange.trim()
      ? parsePageRange(options.pageRange, pages.length)
      : pages.map((_, index) => index),
  );
  const color = hexToRgb(options.color);
  const total = pages.length;
  pages.forEach((page, index) => {
    if (!selected.has(index)) return;
    if (options.skipFirstPage && index === 0) return;
    const text = formatPageNumber(index, total, options);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    const margin = options.margin;
    const x =
      options.alignment === 'left'
        ? margin
        : options.alignment === 'right'
          ? width - margin - textWidth
          : (width - textWidth) / 2;
    const y = options.position === 'top' ? height - margin - options.fontSize : margin;
    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  });
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'numbered'));
  const size = await savePdf(pdf, target);
  return { outputPath: target, outputSize: size, pageCount: total, originalSize: fs.statSync(filePath).size };
}

export async function updatePdfMetadata(
  filePath: string,
  metadata: Partial<PdfMetadata>,
  outputPath?: string,
): Promise<PdfOpResult> {
  const pdf = await loadForEdit(filePath);
  if (metadata.title !== undefined) pdf.setTitle(metadata.title);
  if (metadata.author !== undefined) pdf.setAuthor(metadata.author);
  if (metadata.subject !== undefined) pdf.setSubject(metadata.subject);
  if (metadata.keywords !== undefined) {
    pdf.setKeywords(metadata.keywords.split(/[,;]/).map((keyword) => keyword.trim()).filter(Boolean));
  }
  if (metadata.creator !== undefined) pdf.setCreator(metadata.creator);
  if (metadata.producer !== undefined) pdf.setProducer(metadata.producer);
  pdf.setModificationDate(new Date());
  const target = safeOutputPath(outputPath, defaultOutputName(filePath, 'metadata'));
  const size = await savePdf(pdf, target);
  return { outputPath: target, outputSize: size, pageCount: pdf.getPageCount() };
}

export async function imagesToPdf(
  filePaths: string[],
  options: ImageToPdfOptions,
): Promise<PdfOpResult> {
  if (!filePaths.length) throw new Error('Pilih minimal satu gambar.');
  const outputPath = safeOutputPath(
    options.outputPath,
    `${sanitizeFileName(path.parse(filePaths[0]).name)}.pdf`,
  );
  const result = await createPdfFromImages({
    images: filePaths.map((file) => ({ path: file })),
    outputPath,
    options: {
      quality: options.quality > 80 ? 'maximum' : options.quality > 60 ? 'high' : 'medium',
      imageFormat: 'jpg',
      pageSize: options.pageSize,
      orientation: options.orientation,
      margin: options.margin,
      addPageNumbers: options.addPageNumbers,
    },
  });
  return {
    outputPath,
    outputSize: result.size,
    pageCount: filePaths.length,
    warnings: result.warnings,
  };
}

export async function pdfToImages(
  filePath: string,
  options: { pages?: number[]; dpi: number; format: 'jpg' | 'png'; outputDir?: string },
): Promise<PdfOpResult> {
  const doc = await openPdfjs(filePath);
  const outputPaths: string[] = [];
  let totalSize = 0;
  try {
    const dir = options.outputDir
      ? path.resolve(options.outputDir)
      : paths.uniqueFilePath(path.join(paths.exports, `${sanitizeFileName(path.parse(filePath).name)}-images`));
    fs.mkdirSync(dir, { recursive: true });
    paths.assertAllowedWrite(path.join(dir, 'probe.png'));
    const targets = options.pages?.length
      ? options.pages.map((index) => index + 1).filter((page) => page >= 1 && page <= doc.numPages)
      : Array.from({ length: doc.numPages }, (_, index) => index + 1);
    for (const pageNumber of targets) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: options.dpi / 72 });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
      const buffer =
        options.format === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', 90);
      const target = path.join(
        dir,
        `${sanitizeFileName(path.parse(filePath).name)}-${String(pageNumber).padStart(3, '0')}.${options.format}`,
      );
      await fs.promises.writeFile(target, buffer);
      totalSize += buffer.length;
      outputPaths.push(target);
    }
  } finally {
    await doc.destroy();
  }
  return {
    outputPath: outputPaths[0] ? path.dirname(outputPaths[0]) : '',
    outputPaths,
    outputSize: totalSize,
    originalSize: fs.statSync(filePath).size,
  };
}

export async function findBlankPages(filePath: string, threshold = 0.995): Promise<number[]> {
  const doc = await openPdfjs(filePath);
  const blanks: number[] = [];
  try {
    for (let index = 1; index <= doc.numPages; index += 1) {
      const page = await doc.getPage(index);
      const viewport = page.getViewport({ scale: 72 / 72 });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] < 235) ink += 1;
      }
      const ratio = ink / (data.length / 16);
      if (ratio < 1 - threshold + 0.0005) blanks.push(index - 1);
    }
  } finally {
    await doc.destroy();
  }
  return blanks;
}

export function paperSizePoints(paper: keyof typeof PAPER_SIZES): { width: number; height: number } {
  const def = PAPER_SIZES[paper];
  return {
    width: mmToPixels(def.widthMm || 210, 72) / 1,
    height: mmToPixels(def.heightMm || 297, 72) / 1,
  };
}

export async function writeImageJob(
  sourcePath: string,
  targetPath: string,
  format: 'jpg' | 'png',
  quality: number,
  maxWidth?: number,
): Promise<number> {
  const image = await decodeFile(sourcePath);
  const scaled = maxWidth ? fitWithin(image, maxWidth) : image;
  const result = await writeImage(scaled, targetPath, format, quality);
  return result.size;
}

export { logger };
