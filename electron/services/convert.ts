import fs from 'node:fs';
import path from 'node:path';
import { Document, HeadingLevel, Packer, Paragraph, PageBreak, TextRun, ImageRun } from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import type { ConversionOptions, PdfOpResult } from '../../src/shared/types';
import { parsePageRange } from '../../src/shared/constants';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { sanitizeFileName } from '../lib/filenames';
import { extractPdfText, type PdfTextPage } from './pdf';
import { renderPdfPage } from './pdf';

interface Line {
  y: number;
  items: PdfTextPage['items'];
  text: string;
  fontSize: number;
}

function buildLines(page: PdfTextPage): Line[] {
  const sorted = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const tolerance = Math.max(2, item.fontSize * 0.45);
    const current = lines.find((line) => Math.abs(line.y - item.y) <= tolerance);
    if (current) {
      current.items.push(item);
      current.y = (current.y + item.y) / 2;
      current.fontSize = Math.max(current.fontSize, item.fontSize);
    } else {
      lines.push({ y: item.y, items: [item], text: '', fontSize: item.fontSize });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
  }
  return lines.filter((line) => line.text).sort((a, b) => b.y - a.y);
}

function medianFontSize(lines: Line[]): number {
  const sizes = lines.map((line) => line.fontSize).sort((a, b) => a - b);
  return sizes.length ? sizes[Math.floor(sizes.length / 2)] : 11;
}

/** Groups lines into paragraphs using vertical gaps. */
function toParagraphs(lines: Line[]): Array<{ text: string; heading: boolean }> {
  const base = medianFontSize(lines);
  const paragraphs: Array<{ text: string; heading: boolean }> = [];
  let buffer = '';
  let previousY: number | null = null;
  let previousSize = base;
  for (const line of lines) {
    const gap = previousY === null ? 0 : previousY - line.y;
    const heading = line.fontSize > base * 1.45 && line.text.length < 120;
    const newParagraph = previousY !== null && (gap > line.fontSize * 1.9 || heading || previousSize > base * 1.45);
    if (newParagraph && buffer.trim()) {
      paragraphs.push({ text: buffer.trim(), heading: previousSize > base * 1.45 });
      buffer = '';
    }
    buffer += (buffer ? ' ' : '') + line.text;
    previousY = line.y;
    previousSize = line.fontSize;
  }
  if (buffer.trim()) paragraphs.push({ text: buffer.trim(), heading: previousSize > base * 1.45 });
  return paragraphs;
}

function resolvePages(options: ConversionOptions, pageCount: number): number[] {
  if (options.pageRange && options.pageRange.trim()) return parsePageRange(options.pageRange, pageCount);
  return Array.from({ length: pageCount }, (_, index) => index);
}

async function prepare(
  filePath: string,
  options: ConversionOptions,
): Promise<{ pages: PdfTextPage[]; selected: number[]; visual: boolean; warnings: string[] }> {
  const textPages = await extractPdfText(filePath, { password: options.password });
  const selected = resolvePages(options, textPages.length);
  const chosen = textPages.filter((page) => selected.includes(page.index));
  const textCoverage = chosen.filter((page) => page.hasText).length / Math.max(1, chosen.length);
  const visual = options.mode === 'visual' || (options.mode === 'auto' && textCoverage < 0.5);
  const warnings: string[] = [];
  if (visual) {
    warnings.push(
      'Mode visual digunakan: halaman dirender sebagai gambar. Teks tidak dapat diedit, tetapi tata letak paling mendekati aslinya.',
    );
  } else if (textCoverage < 1) {
    warnings.push('Sebagian halaman tidak memiliki text layer dan direkonstruksi dari hasil deteksi layout.');
  }
  warnings.push('Tata letak hasil konversi tidak dijamin identik dengan PDF sumber, khususnya dokumen kompleks.');
  return { pages: chosen, selected, visual, warnings };
}

function outputTarget(filePath: string, extension: string): string {
  const target = paths.uniqueFilePath(
    path.join(paths.exports, `${sanitizeFileName(path.parse(filePath).name)}.${extension}`),
  );
  paths.assertAllowedWrite(target);
  return target;
}

async function visualPageImage(filePath: string, pageIndex: number, dpi: number): Promise<Buffer> {
  const rendered = await renderPdfPage(filePath, { pageIndex, dpi, format: 'png' });
  return rendered.buffer;
}

export async function pdfToWord(filePath: string, options: ConversionOptions): Promise<PdfOpResult> {
  const { pages, visual, warnings } = await prepare(filePath, options);
  if (!pages.length) throw new Error('Tidak ada halaman yang dikonversi.');
  const children: Paragraph[] = [];
  for (const page of pages) {
    if (visual) {
      const buffer = await visualPageImage(filePath, page.index, options.dpi);
      const widthPoints = page.width;
      const heightPoints = page.height;
      children.push(
        new Paragraph({
          alignment: 'center',
          children: [
            new ImageRun({
              data: buffer,
              transformation: {
                width: Math.round(widthPoints * 0.9),
                height: Math.round((heightPoints / widthPoints) * widthPoints * 0.9),
              },
              type: 'png',
            }),
          ],
        }),
      );
    } else {
      const paragraphs = toParagraphs(buildLines(page));
      for (const paragraph of paragraphs) {
        children.push(
          new Paragraph({
            text: paragraph.text,
            heading: paragraph.heading ? HeadingLevel.HEADING_2 : undefined,
            spacing: { after: 120 },
          }),
        );
      }
      if (!paragraphs.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: '[Halaman tanpa teks]', italics: true })] }));
      }
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  if (children[children.length - 1] instanceof Paragraph) children.pop();
  const doc = new Document({
    creator: 'Document Scanner & PDF Editor',
    title: path.parse(filePath).name,
    sections: [{ properties: {}, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  const target = outputTarget(filePath, 'docx');
  await fs.promises.writeFile(target, buffer);
  logger.info('convert', 'pdf to word complete', { target });
  return { outputPath: target, outputSize: buffer.length, pageCount: pages.length, warnings };
}

/* ------------------------------------------------------------------ */
/* PDF → Excel                                                         */
/* ------------------------------------------------------------------ */

interface TableCell {
  column: number;
  text: string;
}

function lineToCells(line: Line, averageCharWidth: number): TableCell[] {
  const cells: TableCell[] = [];
  let current = { column: 0, text: '', x: 0, end: 0 };
  const sorted = [...line.items].sort((a, b) => a.x - b.x);
  for (const item of sorted) {
    const gap = item.x - current.end;
    if (current.text && gap > Math.max(8, averageCharWidth * 2.5)) {
      cells.push({ column: current.column, text: current.text.trim() });
      current = { column: current.column + 1, text: item.text, x: item.x, end: item.x + item.width };
    } else {
      current.text += (current.text ? ' ' : '') + item.text;
      current.end = item.x + item.width;
    }
  }
  if (current.text.trim()) cells.push({ column: current.column, text: current.text.trim() });
  return cells;
}

export async function pdfToExcel(filePath: string, options: ConversionOptions): Promise<PdfOpResult> {
  const { pages, visual, warnings } = await prepare(filePath, options);
  if (!pages.length) throw new Error('Tidak ada halaman yang dikonversi.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Document Scanner & PDF Editor';
  workbook.created = new Date();

  for (const page of pages) {
    const worksheet = workbook.addWorksheet(`Halaman ${page.index + 1}`);
    if (visual) {
      const buffer = await visualPageImage(filePath, page.index, options.dpi);
      const imageId = workbook.addImage({ buffer: buffer as unknown as ExcelJS.Buffer, extension: 'png' });
      worksheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 800, height: 1000 } });
      warnings.push(`Halaman ${page.index + 1}: tabel tidak dapat dibaca, halaman disisipkan sebagai gambar.`);
      continue;
    }
    const lines = buildLines(page);
    if (!lines.length) {
      worksheet.getCell('A1').value = '[Halaman tanpa teks]';
      continue;
    }
    const charWidths = page.items.map((item) => (item.width / Math.max(1, item.text.length)) || 6);
    const averageCharWidth = charWidths.length ? charWidths.reduce((a, b) => a + b, 0) / charWidths.length : 6;
    lines.forEach((line, rowIndex) => {
      const cells = lineToCells(line, averageCharWidth);
      cells.forEach((cell) => {
        worksheet.getCell(rowIndex + 1, cell.column + 1).value = cell.text;
      });
    });
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        maxLength = Math.max(maxLength, String(cell.value ?? '').length);
      });
      column.width = Math.min(70, maxLength + 2);
    });
    worksheet.getRow(1).font = { bold: true };
  }
  const files = pages.length;
  if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1');
  warnings.push(`Terdeteksi ${files} halaman. Struktur tabel direkonstruksi berdasarkan posisi teks.`);
  const buffer = await workbook.xlsx.writeBuffer();
  const target = outputTarget(filePath, 'xlsx');
  await fs.promises.writeFile(target, Buffer.from(buffer as ArrayBuffer));
  return {
    outputPath: target,
    outputSize: Buffer.from(buffer as ArrayBuffer).length,
    pageCount: pages.length,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* PDF → PowerPoint                                                    */
/* ------------------------------------------------------------------ */

export async function pdfToPpt(filePath: string, options: ConversionOptions): Promise<PdfOpResult> {
  const { pages, visual, warnings } = await prepare(filePath, options);
  if (!pages.length) throw new Error('Tidak ada halaman yang dikonversi.');
  const pptx = new PptxGenJS();
  const first = pages[0];
  const widthInches = Math.max(4, (first.width / 72) * 1.0);
  const heightInches = Math.max(3, (first.height / 72) * 1.0);
  pptx.defineLayout({ name: 'PDF_PAGE', width: widthInches, height: heightInches });
  pptx.layout = 'PDF_PAGE';
  pptx.author = 'Document Scanner & PDF Editor';
  pptx.title = path.parse(filePath).name;

  for (const page of pages) {
    const slide = pptx.addSlide();
    if (visual) {
      const buffer = await visualPageImage(filePath, page.index, options.dpi);
      slide.addImage({
        data: `image/png;base64,${buffer.toString('base64')}`,
        x: 0,
        y: 0,
        w: widthInches,
        h: heightInches,
      });
      continue;
    }
    const lines = buildLines(page);
    const scale = widthInches / page.width;
    if (!lines.length) {
      slide.addText('[Halaman tanpa teks]', { x: 0.3, y: 0.3, w: widthInches - 0.6, h: 0.5, italic: true });
      continue;
    }
    const base = medianFontSize(lines);
    for (const line of lines) {
      const x = Math.max(0, line.items[0].x * scale);
      const y = Math.max(0, (page.height - line.y - line.fontSize) * scale);
      const size = Math.max(6, Math.min(40, line.fontSize * scale * 72));
      const w = Math.max(0.5, Math.min(widthInches - x, (line.items[line.items.length - 1].x + line.items[line.items.length - 1].width) * scale - x));
      slide.addText(line.text, {
        x,
        y,
        w,
        h: Math.max(0.2, size / 72 * 1.6),
        fontSize: size,
        bold: line.fontSize > base * 1.4,
        color: '111111',
        valign: 'top',
        margin: 0,
        fit: 'shrink',
      });
    }
  }
  const target = outputTarget(filePath, 'pptx');
  await pptx.writeFile({ fileName: target });
  const stat = await fs.promises.stat(target);
  return { outputPath: target, outputSize: stat.size, pageCount: pages.length, warnings };
}
