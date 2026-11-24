import { BrowserWindow, app, dialog, ipcMain, nativeTheme, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type {
  AppInfo,
  FilterPreviewRequest,
  ImageToPdfOptions,
  PageNumberOptions,
  PdfExportOptions,
  PdfMetadata,
  PrintOptions,
  ProtectOptions,
  ThemeMode,
} from '../src/shared/types';
import { paths } from './lib/paths';
import { logger } from './lib/logger';
import { jobs } from './lib/jobs';
import {
  adjustmentsSchema,
  compressOptionsSchema,
  conversionOptionsSchema,
  filterConfigSchema,
  filterPresetSchema,
  idListSchema,
  idSchema,
  imageToPdfOptionsSchema,
  openFilesOptionsSchema,
  pageNumberOptionsSchema,
  pathSchema,
  pdfExportOptionsSchema,
  pdfMetadataSchema,
  printOptionsSchema,
  protectOptionsSchema,
  quadSchema,
  recipeSchema,
  saveFileOptionsSchema,
  scanOptionsSchema,
  settingsPatchSchema,
  splitRangeSchema,
} from './lib/validate';
import { db } from './services/database';
import { settings } from './services/settings';
import { documents } from './services/documents';
import { scanner } from './services/scanner';
import * as pdf from './services/pdf';
import { office } from './services/office';
import { pdfToExcel, pdfToPpt, pdfToWord } from './services/convert';
import { ocr } from './services/ocr';
import { printService } from './services/print';
import {
  applyAdjustmentsToImage,
  applyPresetToImage,
  decodeDataUrl,
  detectFromBuffer,
  toDataUrl,
  warpImage,
} from './services/imageEngine';

type Handler = (...args: never[]) => unknown;

function normalizeError(error: unknown): Error {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return new Error(`Input tidak valid: ${first?.path.join('.') || 'data'} — ${first?.message ?? 'periksa kembali'}`);
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') return new Error(error.message);
    return new Error(error.message.replace(/^Error:\s*/, ''));
  }
  return new Error(String(error));
}

function handle(channel: string, handler: Handler): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await (handler as (...params: unknown[]) => unknown)(...args);
    } catch (error) {
      const normalized = normalizeError(error);
      logger.warn('ipc', `${channel} failed`, { message: normalized.message });
      throw new Error(normalized.message);
    }
  });
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

let allowClose = false;

export function allowWindowClose(): void {
  allowClose = true;
}

export function registerIpc(): void {
  jobs.subscribe((job) => broadcast('jobs:progress', job));
  paths.assertAllowedWrite(path.join(paths.exports, 'probe'));

  /* ---------------------------- App ---------------------------- */
  handle('app:info', async (): Promise<AppInfo> => {
    const officeInfo = await office.detect();
    const stats = documents.stats();
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: `${process.platform} ${process.arch}`,
      arch: process.arch,
      dataDirectory: paths.root,
      documentsDirectory: settings.documentsDirectory,
      outputDirectory: settings.outputDirectory,
      libreOfficeDetected: officeInfo.available,
      libreOfficePath: officeInfo.path,
      twainBridgeDetected: Boolean(settings.get().twainBridgePath && fs.existsSync(settings.get().twainBridgePath)),
      scannerBackend: process.platform === 'win32' ? 'Windows Image Acquisition (WIA)' : 'Tidak tersedia di platform ini',
      tessdataAvailable: fs.existsSync(paths.tessdata) && fs.readdirSync(paths.tessdata).length > 0,
      totalDocuments: stats.documents,
      totalPages: stats.pages,
    };
  });

  handle('app:set-theme', (mode: ThemeMode) => {
    nativeTheme.themeSource = mode;
  });

  handle('app:open-path', async (target: string) => {
    const resolved = path.parse(z.string().parse(target)).ext ? z.string().parse(target) : target;
    if (!paths.isAllowedRead(resolved)) throw new Error('Path tidak diizinkan.');
    return shell.openPath(resolved);
  });

  handle('app:show-item', (target: string) => {
    const resolved = pathSchema.parse(target);
    if (!paths.isAllowedRead(resolved)) throw new Error('Path tidak diizinkan.');
    shell.showItemInFolder(resolved);
  });

  handle('app:confirm-close', () => {
    allowClose = true;
    return undefined;
  });

  /* ------------------------- Settings -------------------------- */
  handle('settings:get', () => settings.get());
  handle('settings:update', (patch: unknown) => {
    const parsed = settingsPatchSchema.parse(patch);
    const next = settings.update(parsed as never);
    if (parsed.theme) nativeTheme.themeSource = parsed.theme;
    if (parsed.libreOfficePath) office.detect().catch(() => undefined);
    return next;
  });
  handle('settings:reset', () => settings.reset());
  handle('settings:choose-directory', async (kind: 'documents' | 'output') => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window!, {
      title: kind === 'documents' ? 'Pilih direktori dokumen' : 'Pilih direktori output',
      defaultPath: kind === 'documents' ? settings.documentsDirectory : settings.outputDirectory,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const chosen = path.resolve(result.filePaths[0]);
    settings.update(kind === 'documents' ? { documentsDirectory: chosen } : { outputDirectory: chosen });
    return chosen;
  });

  /* ------------------------- Documents ------------------------- */
  handle('documents:list', (query: string) => documents.list(String(query ?? '')));
  handle('documents:create', (input: { name?: string; category?: string }) =>
    documents.create({ name: input?.name, category: input?.category as never }),
  );
  handle('documents:open', (id: string) => documents.open(idSchema.parse(id)));
  handle('documents:save', (id: string) => documents.save(idSchema.parse(id)));
  handle('documents:rename', (id: string, name: string) =>
    documents.rename(idSchema.parse(id), z.string().max(160).parse(name)),
  );
  handle('documents:duplicate', (id: string) => documents.duplicate(idSchema.parse(id)));
  handle('documents:remove', (id: string) => documents.remove(idSchema.parse(id)));
  handle('documents:update-metadata', (id: string, metadata: PdfMetadata) =>
    documents.updateMetadata(idSchema.parse(id), pdfMetadataSchema.partial().parse(metadata)),
  );
  handle('documents:import-files', (filePaths: string[], targetId?: string) => {
    const list = z.array(pathSchema).max(500).parse(filePaths);
    return documents.importFiles(list, targetId ? idSchema.parse(targetId) : undefined);
  });
  handle('documents:pick-import', async (targetId?: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window!, {
      title: 'Impor dokumen',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Dokumen & Gambar', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tif', 'tiff', 'webp'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return documents.importFiles(result.filePaths, targetId ? idSchema.parse(targetId) : undefined);
  });
  handle('documents:add-buffer', (documentId: string, pages: Array<{ dataUrl: string; sourcePage?: number }>, source?: string) =>
    documents.addPagesFromBuffers(
      idSchema.parse(documentId),
      z.array(z.object({ dataUrl: z.string().max(60_000_000), sourcePage: z.number().optional() })).max(50).parse(pages),
      (source as never) ?? 'camera',
    ),
  );
  handle('documents:add-scanner', (documentId: string, options: unknown) => {
    const parsed = scanOptionsSchema.parse(options);
    return (async () => {
      const session = await scanner.scan(parsed);
      const record = await documents.addPagesFromScanner(idSchema.parse(documentId), async () =>
        session.pages.map((page) => page.path),
      );
      return record;
    })();
  });
  handle('documents:delete-pages', (documentId: string, pageIds: string[]) =>
    documents.deletePages(idSchema.parse(documentId), idListSchema.parse(pageIds)),
  );
  handle('documents:duplicate-page', (documentId: string, pageId: string) =>
    documents.duplicatePage(idSchema.parse(documentId), idSchema.parse(pageId)),
  );
  handle('documents:reorder', (documentId: string, pageIds: string[]) =>
    documents.reorderPages(idSchema.parse(documentId), idListSchema.parse(pageIds)),
  );
  handle('documents:move-page', (documentId: string, pageId: string, direction: 'up' | 'down' | 'first' | 'last') =>
    documents.movePage(idSchema.parse(documentId), idSchema.parse(pageId), direction),
  );
  handle('documents:rotate', (documentId: string, pageIds: string[], degrees: number) =>
    documents.rotatePages(idSchema.parse(documentId), idListSchema.parse(pageIds), z.number().parse(degrees)),
  );
  handle('documents:filter', (documentId: string, pageIds: string[], preset: string, config: unknown) =>
    documents.applyFilter(
      idSchema.parse(documentId),
      idListSchema.parse(pageIds),
      filterPresetSchema.parse(preset),
      filterConfigSchema.parse(config),
    ),
  );
  handle('documents:adjust', (documentId: string, pageIds: string[], adjustments: unknown) =>
    documents.updateAdjustments(
      idSchema.parse(documentId),
      idListSchema.parse(pageIds),
      adjustmentsSchema.parse(adjustments),
    ),
  );
  handle('documents:operation', (documentId: string, pageIds: string[], type: string, params: unknown) =>
    documents.applyOperation(
      idSchema.parse(documentId),
      idListSchema.parse(pageIds),
      type as never,
      z.record(z.union([z.number(), z.string(), z.boolean()])).parse(params),
    ),
  );
  handle('documents:set-crop', (documentId: string, pageId: string, quad: unknown) =>
    documents.setCrop(
      idSchema.parse(documentId),
      idSchema.parse(pageId),
      quad === null ? null : quadSchema.parse(quad),
    ),
  );
  handle('documents:reset', (documentId: string, pageIds: string[]) =>
    documents.resetPage(idSchema.parse(documentId), idListSchema.parse(pageIds)),
  );
  handle('documents:undo', (documentId: string, pageId: string) =>
    documents.undoPage(idSchema.parse(documentId), idSchema.parse(pageId)),
  );
  handle('documents:redo', (documentId: string, pageId: string) =>
    documents.redoPage(idSchema.parse(documentId), idSchema.parse(pageId)),
  );
  handle(
    'documents:preview',
    (documentId: string, pageId: string, options?: { processed?: boolean; maxWidth?: number }) =>
      documents.pagePreview(idSchema.parse(documentId), idSchema.parse(pageId), options ?? {}),
  );
  handle('documents:compare', (documentId: string, pageId: string, recipe: unknown) =>
    documents.comparePreview(
      idSchema.parse(documentId),
      idSchema.parse(pageId),
      recipe ? recipeSchema.parse(recipe) : null,
    ),
  );
  handle('documents:export-pdf', (documentId: string, options: unknown) =>
    documents.exportPdf(idSchema.parse(documentId), pdfExportOptionsSchema.parse(options) as PdfExportOptions),
  );
  handle('documents:import-pdf', (filePaths: string[], password?: string) =>
    documents.importPdfFiles(z.array(pathSchema).max(50).parse(filePaths), password ? z.string().max(200).parse(password) : undefined),
  );
  handle('documents:pick-import-pdf', async (password?: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window!, {
      title: 'Impor PDF',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return documents.importPdfFiles(result.filePaths, password);
  });
  handle('documents:split', (documentId: string, ranges: unknown) =>
    documents.splitDocument(
      idSchema.parse(documentId),
      z.array(splitRangeSchema).min(1).max(200).parse(ranges),
    ),
  );
  handle('documents:merge', (documentIds: string[], name: string) =>
    documents.mergeDocuments(idListSchema.parse(documentIds), z.string().max(160).parse(name)),
  );
  handle('documents:extract', (documentId: string, pageIds: string[]) =>
    documents.extractPages(idSchema.parse(documentId), idListSchema.parse(pageIds)),
  );
  handle('documents:activity', (documentId: string) => documents.activity(idSchema.parse(documentId)));
  handle('documents:recent', (limit: number) => documents.recent(Math.min(50, Math.max(1, Number(limit) || 8))));
  handle('documents:stats', () => documents.stats());

  /* -------------------------- Scanner -------------------------- */
  handle('scanner:devices', () => scanner.listDevices());
  handle('scanner:capabilities', (deviceId: string, driver: string) =>
    scanner.capabilities(deviceId, driver as never),
  );
  handle('scanner:scan', async (options: unknown) => {
    const parsed = scanOptionsSchema.parse(options);
    const job = jobs.create('scan', parsed.pageCountMode === 'single' ? 1 : parsed.maxPages).start('Memindai');
    try {
      const session = await scanner.scan(parsed);
      job.update(session.pages.length, `${session.pages.length} halaman diperoleh`);
      job.complete('Pemindaian selesai');
      return session;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  handle('scanner:cancel', () => scanner.cancel());
  handle('scanner:profiles', () => scanner.profiles());
  handle('scanner:save-profile', (profile: unknown) =>
    scanner.saveProfile(
      z
        .object({
          id: z.string().optional(),
          name: z.string().min(1).max(80),
          resolution: z.number().int().min(75).max(1200),
          colorMode: z.enum(['color', 'grayscale', 'black-white']),
          paperSize: z.enum(['A3', 'A4', 'A5', 'Letter', 'Legal', 'Folio', 'Custom']),
          paperSource: z.enum(['feeder', 'flatbed']),
          duplex: z.boolean(),
          isDefault: z.boolean(),
        })
        .parse(profile),
    ),
  );
  handle('scanner:delete-profile', (id: string) => scanner.deleteProfile(idSchema.parse(id)));

  /* ---------------------------- PDF ---------------------------- */
  handle('pdf:info', (filePath: string, password?: string) =>
    pdf.getPdfInfo(pathSchema.parse(filePath), password),
  );
  handle('pdf:pick-files', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window!, {
      title: 'Pilih file PDF',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return result.canceled ? [] : result.filePaths;
  });
  handle('pdf:render', (filePath: string, options: { pageIndex: number; dpi?: number; password?: string; format?: 'png' | 'jpg' }) =>
    pdf.renderPdfPage(pathSchema.parse(filePath), {
      pageIndex: Math.max(0, Number(options?.pageIndex ?? 0)),
      dpi: options?.dpi ?? 120,
      password: options?.password,
      format: options?.format ?? 'jpg',
    }),
  );
  handle('pdf:merge', async (filePaths: string[], outputPath?: string) => {
    const list = z.array(pathSchema).min(2).max(100).parse(filePaths);
    const job = jobs.create('pdf-merge', list.length).start('Menggabungkan PDF');
    try {
      const result = await pdf.mergePdfs(list, outputPath);
      job.complete('PDF berhasil digabung');
      return result;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  handle('pdf:split', (filePath: string, mode: string, options: unknown) =>
    pdf.splitPdf(
      pathSchema.parse(filePath),
      mode as never,
      z
        .object({
          ranges: z.array(splitRangeSchema).optional(),
          interval: z.number().int().min(1).max(5000).optional(),
          pages: z.array(z.number().int().min(0)).optional(),
          outputDir: pathSchema.optional(),
        })
        .parse(options ?? {}),
    ),
  );
  handle('pdf:compress', async (filePath: string, options: unknown, outputPath?: string) => {
    const parsed = compressOptionsSchema.parse(options);
    const job = jobs.create('pdf-compress', 1).start('Mengompres PDF');
    try {
      const result = await pdf.compressPdf(pathSchema.parse(filePath), parsed, outputPath);
      job.complete(`Ukuran akhir ${(result.outputSize / 1024 / 1024).toFixed(2)} MB`);
      return result;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  handle('pdf:rotate', (filePath: string, pages: number[], degrees: number, outputPath?: string) =>
    pdf.rotatePdf(pathSchema.parse(filePath), z.array(z.number().int()).parse(pages), degrees, outputPath),
  );
  handle('pdf:delete-pages', (filePath: string, pages: number[], outputPath?: string) =>
    pdf.deletePdfPages(pathSchema.parse(filePath), z.array(z.number().int()).parse(pages), outputPath),
  );
  handle('pdf:extract', (filePath: string, pages: number[], outputPath?: string) =>
    pdf.extractPdfPageFile(pathSchema.parse(filePath), z.array(z.number().int()).parse(pages), outputPath),
  );
  handle('pdf:reorder', (filePath: string, order: number[], outputPath?: string) =>
    pdf.reorderPdf(pathSchema.parse(filePath), z.array(z.number().int()).parse(order), outputPath),
  );
  handle('pdf:protect', (filePath: string, options: unknown, outputPath?: string) =>
    pdf.protectPdf(pathSchema.parse(filePath), protectOptionsSchema.parse(options) as ProtectOptions, outputPath),
  );
  handle('pdf:unlock', (filePath: string, password: string, outputPath?: string) =>
    pdf.unlockPdf(pathSchema.parse(filePath), z.string().max(200).parse(password), outputPath),
  );
  handle('pdf:page-numbers', (filePath: string, options: unknown, outputPath?: string) =>
    pdf.addPdfPageNumbers(
      pathSchema.parse(filePath),
      pageNumberOptionsSchema.parse(options) as PageNumberOptions,
      outputPath,
    ),
  );
  handle('pdf:metadata', (filePath: string, metadata: unknown, outputPath?: string) =>
    pdf.updatePdfMetadata(
      pathSchema.parse(filePath),
      pdfMetadataSchema.parse(metadata) as Partial<PdfMetadata>,
      outputPath,
    ),
  );
  handle('pdf:images-to-pdf', async (filePaths: string[], options: unknown) => {
    const list = z.array(pathSchema).min(1).max(500).parse(filePaths);
    const parsed = imageToPdfOptionsSchema.parse(options) as ImageToPdfOptions;
    const job = jobs.create('images-to-pdf', list.length).start('Membuat PDF dari gambar');
    try {
      const result = await pdf.imagesToPdf(list, parsed);
      job.complete('PDF berhasil dibuat');
      return result;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  handle('pdf:to-images', async (filePath: string, options: { pages?: number[]; dpi: number; format: 'jpg' | 'png'; outputDir?: string }) => {
    const job = jobs.create('pdf-to-images', 1).start('Mengekspor halaman PDF');
    try {
      const result = await pdf.pdfToImages(pathSchema.parse(filePath), options);
      job.complete(`${result.outputPaths?.length ?? 0} gambar dibuat`);
      return result;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  handle('pdf:blank-pages', (filePath: string) => pdf.findBlankPages(pathSchema.parse(filePath)));

  /* --------------------------- Office -------------------------- */
  handle('office:detect', () => office.detect());
  handle('office:to-pdf', async (filePaths: string[], outputDir?: string) => {
    const list = z.array(pathSchema).min(1).max(50).parse(filePaths);
    const job = jobs.create('office-to-pdf', list.length).start('Mengonversi dokumen Office');
    try {
      const results = await office.toPdf(list, outputDir);
      job.complete('Konversi selesai');
      return results;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  const conversionJob = async (type: string, run: () => Promise<unknown>) => {
    const job = jobs.create(type, 1).start('Mengonversi PDF');
    try {
      const result = await run();
      job.complete('Konversi selesai');
      return result;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  };
  handle('office:pdf-to-word', (filePath: string, options: unknown) =>
    conversionJob('pdf-to-word', () =>
      pdfToWord(pathSchema.parse(filePath), conversionOptionsSchema.parse(options) as never),
    ),
  );
  handle('office:pdf-to-excel', (filePath: string, options: unknown) =>
    conversionJob('pdf-to-excel', () =>
      pdfToExcel(pathSchema.parse(filePath), conversionOptionsSchema.parse(options) as never),
    ),
  );
  handle('office:pdf-to-ppt', (filePath: string, options: unknown) =>
    conversionJob('pdf-to-ppt', () =>
      pdfToPpt(pathSchema.parse(filePath), conversionOptionsSchema.parse(options) as never),
    ),
  );

  /* ----------------------------- OCR --------------------------- */
  handle('ocr:languages', () => ocr.languages());
  handle('ocr:document', async (documentId: string, pageIds: string[] | null, language: string) => {
    const job = jobs.create('ocr', 1).start('Menjalankan OCR');
    try {
      const result = await ocr.document(
        idSchema.parse(documentId),
        pageIds ? idListSchema.parse(pageIds) : null,
        z.string().max(30).parse(language),
        (current, total) => job.update(current, `Halaman ${Math.min(current + 1, total)} dari ${total}`),
      );
      job.complete(`OCR selesai (${result.averageConfidence.toFixed(1)}% confidence)`);
      return result;
    } catch (error) {
      job.fail(error);
      throw error;
    }
  });
  handle('ocr:page', (documentId: string, pageId: string, language: string) =>
    ocr.page(idSchema.parse(documentId), idSchema.parse(pageId), z.string().max(30).parse(language)),
  );
  handle('ocr:searchable-pdf', (documentId: string, language: string, outputPath?: string) =>
    conversionJob('searchable-pdf', () =>
      ocr.searchablePdf(idSchema.parse(documentId), z.string().max(30).parse(language), outputPath),
    ),
  );
  handle('ocr:export-text', (documentId: string, format: 'txt' | 'docx') =>
    ocr.exportText(idSchema.parse(documentId), format === 'docx' ? 'docx' : 'txt'),
  );
  handle('ocr:results', (documentId: string) => ocr.results(idSchema.parse(documentId)));

  /* ---------------------------- Print -------------------------- */
  handle('print:printers', () => printService.printers());
  handle('print:document', (documentId: string, options: unknown) =>
    printService.document(idSchema.parse(documentId), printOptionsSchema.parse(options) as PrintOptions),
  );
  handle('print:pdf', (filePath: string, options: unknown) =>
    printService.pdf(pathSchema.parse(filePath), printOptionsSchema.parse(options) as PrintOptions),
  );
  handle('print:preview', (documentId: string) => printService.preview(idSchema.parse(documentId)));

  /* ---------------------------- Jobs --------------------------- */
  handle('jobs:list', () => jobs.list());
  handle('jobs:cancel', (jobId: string) => jobs.cancel(idSchema.parse(jobId)));

  /* --------------------------- Dialog -------------------------- */
  handle('dialog:open-files', async (options: unknown) => {
    const parsed = openFilesOptionsSchema.parse(options ?? {});
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window!, {
      title: parsed.title,
      defaultPath: parsed.defaultPath,
      filters: parsed.filters,
      properties: parsed.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    });
    return result.canceled ? [] : result.filePaths;
  });
  handle('dialog:save-file', async (options: unknown) => {
    const parsed = saveFileOptionsSchema.parse(options ?? {});
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(window!, {
      title: parsed.title,
      defaultPath: parsed.defaultPath,
      filters: parsed.filters,
    });
    if (result.canceled || !result.filePath) return null;
    // The user picked this destination explicitly, so allow writing to it.
    paths.allowUserPath(result.filePath);
    return result.filePath;
  });
  handle('dialog:open-directory', async (options: { title?: string; defaultPath?: string }) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(window!, {
      title: options?.title,
      defaultPath: options?.defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    // The user picked this destination explicitly, so allow writing to it.
    paths.allowUserPath(result.filePaths[0]);
    return result.filePaths[0];
  });

  /* --------------------------- Images -------------------------- */
  handle('images:preview-filter', async (request: unknown) => {
    const parsed = z
      .object({ preset: filterPresetSchema, config: filterConfigSchema, imageDataUrl: z.string().max(80_000_000) })
      .parse(request) as FilterPreviewRequest;
    const image = await decodeDataUrl(parsed.imageDataUrl);
    const result = applyPresetToImage(image, parsed.preset, parsed.config);
    return toDataUrl(result, 'jpg', 88);
  });
  handle('images:detect', async (dataUrl: string, sensitivity: number) => {
    const image = await decodeDataUrl(z.string().max(80_000_000).parse(dataUrl));
    return detectFromBuffer(image, Number(sensitivity) || 55);
  });
  handle('images:warp', async (dataUrl: string, corners: unknown) => {
    const image = await decodeDataUrl(z.string().max(80_000_000).parse(dataUrl));
    const quad = quadSchema.parse(corners);
    const warped = warpImage(image, quad);
    return { dataUrl: toDataUrl(warped, 'png'), width: warped.width, height: warped.height };
  });

  /* ------------------------- Lifecycle ------------------------- */
  ipcMain.handle('app:close-requested', () => {
    allowClose = true;
  });

  handle('settings:apply-adjustments-preview', (dataUrl: string, adjustments: unknown) => {
    const parsed = adjustmentsSchema.parse(adjustments);
    return decodeDataUrl(z.string().max(80_000_000).parse(dataUrl)).then((image) =>
      toDataUrl(applyAdjustmentsToImage(image, parsed), 'jpg', 88),
    );
  });

  handle('app:data-directories', () => ({
    data: paths.root,
    documents: settings.documentsDirectory,
    output: settings.outputDirectory,
    backup: paths.backups,
    logs: paths.logs,
    temp: paths.temp,
  }));

  handle('app:db-integrity', () => db.integrityCheck());
  handle('app:cleanup-temp', async () => paths.cleanupTemp());
  handle('app:backup', () => {
    db.backup();
    return true;
  });
}

export function shouldAllowClose(): boolean {
  return allowClose;
}

export function resetCloseGuard(): void {
  allowClose = false;
}
