import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import type { PrintOptions, PrinterInfo } from '../../src/shared/types';
import { PAPER_SIZES, parsePageRange } from '../../src/shared/constants';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { documents } from './documents';
import { renderPdfPage } from './pdf';

const PRINTABLE_PAPER: Record<string, string> = {
  A3: 'A3',
  A4: 'A4',
  A5: 'A5',
  Letter: 'Letter',
  Legal: 'Legal',
  Folio: 'Folio',
  Original: 'A4',
  Custom: 'A4',
};

/** Printing via a hidden renderer window so print preview matches the output. */
class PrintService {
  private getHostWebContents(): Electron.WebContents | null {
    const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    return focused?.webContents ?? null;
  }

  async printers(): Promise<PrinterInfo[]> {
    const contents = this.getHostWebContents();
    if (!contents) return [];
    try {
      const printers = await contents.getPrintersAsync();
      const defaultPrinter = printers.find((printer) => printer.isDefault);
      return printers.map((printer) => ({
        name: printer.name,
        displayName: printer.displayName || printer.name,
        description: printer.description || '',
        status: printer.status,
        isDefault: printer.isDefault ?? printer.name === defaultPrinter?.name,
        options: printer.options as Record<string, string> | undefined,
      }));
    } catch (error) {
      logger.warn('print', 'printer enumeration failed', { error: String(error) });
      return [];
    }
  }

  private async writeHtml(images: string[], options: PrintOptions, title: string): Promise<string> {
    const paper = PAPER_SIZES[options.paperSize] ?? PAPER_SIZES.A4;
    const cssSize = `${paper.widthMm}mm ${paper.heightMm}mm`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: ${cssSize}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { page-break-after: always; break-after: page; display: flex; align-items: center; justify-content: center; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page img { max-width: 100%; max-height: 100vh; object-fit: contain; display: block; }
</style></head><body>
${images.map((src) => `<div class="page"><img src="${src}" /></div>`).join('\n')}
</body></html>`;
    const target = path.join(paths.temp, `print-${randomUUID()}.html`);
    await fs.promises.writeFile(target, html, 'utf8');
    return target;
  }

  private async printImages(images: string[], options: PrintOptions, title: string): Promise<{ ok: boolean; message?: string }> {
    if (!images.length) throw new Error('Tidak ada halaman untuk dicetak.');
    const file = await this.writeHtml(images, options, title);
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        images: true,
      },
    });
    try {
      await window.loadFile(file);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return await new Promise((resolve, reject) => {
        window.webContents.print(
          {
            silent: options.silent,
            printBackground: true,
            deviceName: options.printerName || undefined,
            color: options.color,
            landscape: options.landscape,
            copies: Math.max(1, options.copies),
            pageSize: (PRINTABLE_PAPER[options.paperSize] ?? 'A4') as 'A4',
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            if (success) resolve({ ok: true });
            else if (failureReason === 'Print job canceled') resolve({ ok: false, message: 'Pencetakan dibatalkan.' });
            else reject(new Error(failureReason || 'Pencetakan gagal.'));
          },
        );
      });
    } finally {
      window.destroy();
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }

  async document(documentId: string, options: PrintOptions): Promise<{ ok: boolean; message?: string }> {
    const record = documents.open(documentId);
    if (!record.pages.length) throw new Error('Dokumen tidak memiliki halaman.');
    const selected = options.pageRange?.trim()
      ? new Set(parsePageRange(options.pageRange, record.pages.length))
      : null;
    const pages = record.pages.filter((_, index) => !selected || selected.has(index));
    const images: string[] = [];
    for (const page of pages) {
      images.push(await documents.pagePreview(documentId, page.id, { maxWidth: 2200 }));
    }
    return this.printImages(images, options, record.name);
  }

  async pdf(filePath: string, options: PrintOptions): Promise<{ ok: boolean; message?: string }> {
    const { getPdfInfo } = await import('./pdf');
    const info = await getPdfInfo(filePath, undefined, false);
    const selected = options.pageRange?.trim()
      ? new Set(parsePageRange(options.pageRange, info.pageCount))
      : null;
    const images: string[] = [];
    for (let index = 0; index < info.pageCount; index += 1) {
      if (selected && !selected.has(index)) continue;
      const rendered = await renderPdfPage(filePath, { pageIndex: index, dpi: 150, format: 'jpg' });
      images.push(rendered.dataUrl);
    }
    return this.printImages(images, options, info.fileName);
  }

  async preview(documentId: string): Promise<string> {
    const record = documents.open(documentId);
    const images: string[] = [];
    const limited = record.pages.slice(0, 12);
    for (const page of limited) {
      images.push(await documents.pagePreview(documentId, page.id, { maxWidth: 900 }));
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:16px;background:#f5f5f5;font-family:Inter,Segoe UI,sans-serif}
      .sheet{background:#fff;margin:0 auto 12px;box-shadow:0 1px 2px rgba(0,0,0,.12);max-width:640px}
      img{width:100%;display:block}
    </style></head><body>${images
      .map((src) => `<div class="sheet"><img src="${src}" /></div>`)
      .join('')}</body></html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export const printService = new PrintService();
