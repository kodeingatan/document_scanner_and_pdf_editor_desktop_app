import fs from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { Document as DocxDocument, Packer, Paragraph, TextRun } from 'docx';
import { randomUUID } from 'node:crypto';
import type {
  OcrDocumentResult,
  OcrLanguageInfo,
  OcrPageResult,
  OcrWord,
  PdfOpResult,
} from '../../src/shared/types';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { sanitizeFileName } from '../lib/filenames';
import { db } from './database';
import { settings } from './settings';
import { documents } from './documents';
import { renderPdfPage } from './pdf';
import { decodeFile, previewDataUrl, toDataUrl } from './imageEngine';

const LANGUAGE_LABELS: Record<string, string> = {
  ind: 'Indonesian',
  eng: 'English',
};

/** Characters the PDF standard Helvetica font can encode. */
function toWinAnsi(text: string): string {
  return text.replace(/[\u0100-\uffff]/g, '?').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
}

class OcrService {
  private languageInstalled(code: string): boolean {
    return code
      .split('+')
      .every((part) => fs.existsSync(path.join(paths.tessdata, `${part}.traineddata.gz`)));
  }

  languages(): OcrLanguageInfo[] {
    const result: OcrLanguageInfo[] = [];
    for (const code of Object.keys(LANGUAGE_LABELS)) {
      result.push({ code, label: LANGUAGE_LABELS[code], installed: this.languageInstalled(code) });
    }
    const combined = 'ind+eng';
    result.push({
      code: combined,
      label: 'Indonesian + English',
      installed: this.languageInstalled(combined),
    });
    return result;
  }

  private async createTesseract(language: string, onProgress?: (progress: number) => void) {
    if (!this.languageInstalled(language)) {
      throw new Error(
        `Language pack OCR "${language}" belum tersedia. Jalankan "npm run prepare:assets" atau tambahkan file .traineddata.gz ke folder language-packs.`,
      );
    }
    return createWorker(language, 1, {
      langPath: paths.tessdata,
      cachePath: paths.cache,
      gzip: true,
      logger: (message: { status?: string; progress?: number }) => {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          onProgress?.(message.progress);
        }
      },
      errorHandler: (error: unknown) => logger.error('ocr', 'tesseract error', { error: String(error) }),
    });
  }

  private async recognize(
    imagePath: string,
    language: string,
    onProgress?: (progress: number) => void,
  ): Promise<{ text: string; confidence: number; words: OcrWord[] }> {
    const worker = await this.createTesseract(language, onProgress);
    try {
      const result = await worker.recognize(imagePath);
      const data = result.data as unknown as {
        text: string;
        confidence: number;
        words?: Array<{
          text: string;
          confidence: number;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }>;
      };
      const words: OcrWord[] = (data.words ?? []).map((word) => ({
        text: word.text,
        confidence: word.confidence,
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: Math.max(1, word.bbox.x1 - word.bbox.x0),
        height: Math.max(1, word.bbox.y1 - word.bbox.y0),
      }));
      return {
        text: (data.text ?? '').trim(),
        confidence: Number(data.confidence ?? 0),
        words,
      };
    } finally {
      await worker.terminate();
    }
  }

  private storeResult(pageId: string, documentId: string, language: string, result: { text: string; confidence: number; words: OcrWord[] }): void {
    db.run('DELETE FROM ocr_results WHERE page_id = ?', [pageId]);
    db.run(
      'INSERT INTO ocr_results (id, page_id, document_id, language, extracted_text, confidence, words) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        pageId,
        documentId,
        language,
        result.text,
        result.confidence,
        JSON.stringify(result.words),
      ],
    );
  }

  async page(
    documentId: string,
    pageId: string,
    language: string,
    onProgress?: (progress: number) => void,
  ): Promise<OcrPageResult> {
    const page = documents.open(documentId).pages.find((entry) => entry.id === pageId);
    if (!page) throw new Error('Halaman tidak ditemukan pada dokumen.');
    const preview = await documents.pagePreview(documentId, pageId, { maxWidth: 2400 });
    const temp = path.join(paths.temp, `ocr-${pageId}.png`);
    fs.writeFileSync(temp, Buffer.from(preview.split(',')[1], 'base64'));
    const started = Date.now();
    try {
      const recognized = await this.recognize(temp, language, onProgress);
      this.storeResult(pageId, documentId, language, recognized);
      db.flush();
      return {
        pageId,
        pageNumber: page.pageNumber,
        text: recognized.text,
        confidence: recognized.confidence,
        language,
        words: recognized.words,
        durationMs: Date.now() - started,
      };
    } finally {
      try {
        fs.unlinkSync(temp);
      } catch {
        /* ignore */
      }
    }
  }

  async document(
    documentId: string,
    pageIds: string[] | null,
    language: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<OcrDocumentResult> {
    const record = documents.open(documentId);
    const targets = record.pages.filter((page) => !pageIds || pageIds.includes(page.id));
    if (!targets.length) throw new Error('Tidak ada halaman untuk OCR.');
    const started = Date.now();
    const results: OcrPageResult[] = [];
    for (let index = 0; index < targets.length; index += 1) {
      const page = targets[index];
      onProgress?.(index, targets.length);
      results.push(await this.page(documentId, page.id, language));
    }
    onProgress?.(targets.length, targets.length);
    const text = results
      .map((result) => `--- Halaman ${result.pageNumber} ---\n${result.text}`)
      .join('\n\n');
    const averageConfidence = results.length
      ? results.reduce((total, result) => total + result.confidence, 0) / results.length
      : 0;
    return {
      documentId,
      language,
      pages: results,
      text,
      averageConfidence,
      durationMs: Date.now() - started,
    };
  }

  results(documentId: string): OcrPageResult[] {
    return db
      .all<{
        page_id: string;
        language: string;
        extracted_text: string;
        confidence: number;
        words: string;
        page_number: number;
      }>(
        `SELECT o.page_id, o.language, o.extracted_text, o.confidence, o.words, p.page_number
         FROM ocr_results o JOIN document_pages p ON p.id = o.page_id
         WHERE o.document_id = ? ORDER BY p.page_number`,
        [documentId],
      )
      .map((row) => ({
        pageId: row.page_id,
        pageNumber: row.page_number,
        text: row.extracted_text,
        confidence: row.confidence,
        language: row.language,
        words: JSON.parse(row.words || '[]') as OcrWord[],
        durationMs: 0,
      }));
  }

  /** Builds a searchable PDF: original page image + invisible, selectable text layer. */
  async searchablePdf(documentId: string, language: string, outputPath?: string): Promise<PdfOpResult> {
    const record = documents.open(documentId);
    if (!record.pages.length) throw new Error('Dokumen tidak memiliki halaman.');
    const existing = this.results(documentId);
    const missing = record.pages.filter((page) => !existing.some((entry) => entry.pageId === page.id));
    if (missing.length) {
      await this.document(documentId, missing.map((page) => page.id), language);
    }
    const allResults = this.results(documentId);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    for (const page of record.pages) {
      const preview = await documents.pagePreview(documentId, page.id, { maxWidth: 2600 });
      const image = await pdf.embedJpg(Buffer.from(preview.split(',')[1], 'base64'));
      const imageWidth = image.width;
      const imageHeight = image.height;
      const scale = 0.75; // 96 dpi → PDF points
      const pageWidth = imageWidth * scale;
      const pageHeight = imageHeight * scale;
      const pdfPage = pdf.addPage([pageWidth, pageHeight]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      const result = allResults.find((entry) => entry.pageId === page.id);
      if (!result) continue;
      for (const word of result.words) {
        const text = toWinAnsi(word.text).trim();
        if (!text) continue;
        const size = Math.max(4, word.height * scale);
        const x = word.x * scale;
        const y = pageHeight - (word.y + word.height) * scale;
        try {
          pdfPage.drawText(text, {
            x,
            y,
            size,
            font,
            color: rgb(0, 0, 0),
            opacity: 0,
          });
        } catch {
          /* skip unencodable glyphs, the visible image stays intact */
        }
      }
    }
    pdf.setTitle(`${record.name} (OCR)`);
    pdf.setProducer('Document Scanner & PDF Editor');
    pdf.setCreator('Document Scanner & PDF Editor');
    const target = paths.uniqueFilePath(
      outputPath
        ? path.resolve(outputPath)
        : path.join(paths.exports, `${sanitizeFileName(record.name)}-ocr.pdf`),
    );
    paths.assertAllowedWrite(target);
    const bytes = await pdf.save({ useObjectStreams: true });
    await fs.promises.writeFile(target, bytes);
    db.run(
      'INSERT INTO export_history (id, document_id, path, format, size_bytes, pages) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), documentId, target, 'pdf-searchable', bytes.length, record.pages.length],
    );
    return {
      outputPath: target,
      outputSize: bytes.length,
      pageCount: record.pages.length,
      warnings: ['Lapisan teks OCR bersifat invisible; akurasi bergantung pada kualitas pindaian.'],
    };
  }

  async exportText(documentId: string, format: 'txt' | 'docx'): Promise<PdfOpResult | null> {
    const record = documents.open(documentId);
    const results = this.results(documentId);
    if (!results.length) throw new Error('Belum ada hasil OCR untuk dokumen ini.');
    const text = results
      .map((result) => `--- Halaman ${result.pageNumber} ---\n${result.text}`)
      .join('\n\n');
    if (format === 'txt') {
      const target = paths.uniqueFilePath(
        path.join(paths.exports, `${sanitizeFileName(record.name)}-ocr.txt`),
      );
      paths.assertAllowedWrite(target);
      await fs.promises.writeFile(target, text, 'utf8');
      return { outputPath: target, outputSize: Buffer.byteLength(text), pageCount: results.length };
    }
    const children = results.flatMap((result) => [
      new Paragraph({ children: [new TextRun({ text: `Halaman ${result.pageNumber}`, bold: true })] }),
      ...result.text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph) => new Paragraph({ children: [new TextRun(paragraph)], spacing: { after: 120 } })),
    ]);
    const docx = new DocxDocument({
      creator: 'Document Scanner & PDF Editor',
      title: record.name,
      sections: [{ children }],
    });
    const buffer = await Packer.toBuffer(docx);
    const target = paths.uniqueFilePath(
      path.join(paths.exports, `${sanitizeFileName(record.name)}-ocr.docx`),
    );
    paths.assertAllowedWrite(target);
    await fs.promises.writeFile(target, buffer);
    return { outputPath: target, outputSize: buffer.length, pageCount: results.length };
  }

  /** OCR helper used by visual→text conversion for image-only PDFs. */
  async recognizePdfPage(filePath: string, pageIndex: number, language: string): Promise<string> {
    const rendered = await renderPdfPage(filePath, { pageIndex, dpi: 300, format: 'png' });
    const temp = path.join(paths.temp, `ocr-pdf-${randomUUID()}.png`);
    fs.writeFileSync(temp, rendered.buffer);
    try {
      const result = await this.recognize(temp, language);
      return result.text;
    } finally {
      try {
        fs.unlinkSync(temp);
      } catch {
        /* ignore */
      }
    }
  }

  /** Convenience for the renderer: page preview data URL used in OCR review. */
  async pagePreview(documentId: string, pageId: string): Promise<string> {
    const image = await decodeFile(
      path.join(paths.documentDir(documentId), 'original', `${pageId}.png`),
    ).catch(() => null);
    if (!image) return '';
    return toDataUrl(image, 'jpg', 70) || previewDataUrl(image, 900);
  }

  get defaultLanguage(): string {
    return settings.get().ocrLanguage;
  }
}

export const ocr = new OcrService();
