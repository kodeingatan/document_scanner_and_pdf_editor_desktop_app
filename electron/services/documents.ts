import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_RECIPE,
  type ActivityEntry,
  type DocumentCategory,
  type DocumentMetadata,
  type DocumentPage,
  type DocumentRecord,
  type DocumentSourceType,
  type DocumentStatus,
  type DocumentSummary,
  type ExportResult,
  type FilterConfig,
  type FilterPreset,
  type PageAdjustments,
  type PageOperationType,
  type PageRecipe,
  type PdfExportOptions,
  type Quad,
  type SplitRange,
} from '../../src/shared/types';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { settings } from './settings';
import { db } from './database';
import {
  decodeFile,
  detectFromBuffer,
  encodeImage,
  fitWithin,
  previewDataUrl,
  renderPageImage,
  toDataUrl,
  writeImage,
} from './imageEngine';
import { createPdfFromImages, extractPdfPages, getPdfInfo } from './pdf';
import { sanitizeFileName } from '../lib/filenames';

interface DocumentRow {
  id: string;
  name: string;
  document_type: string;
  source_type: string;
  category: string;
  original_path: string | null;
  source_path: string | null;
  thumbnail_path: string | null;
  status: string;
  page_count: number;
  size_bytes: number;
  notes: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface PageRow {
  id: string;
  document_id: string;
  page_number: number;
  original_image_path: string;
  processed_image_path: string | null;
  thumbnail_path: string | null;
  width: number;
  height: number;
  dpi: number;
  rotation: number;
  filter_preset: string;
  filter_config: string | null;
  adjustments: string | null;
  recipe: string | null;
  has_processed: number;
  is_dirty: number;
  source_pdf_page: number | null;
  created_at: string;
  updated_at: string;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp']);

const previewCache = new Map<string, string>();
const thumbnailCache = new Map<string, string>();
const redoStacks = new Map<string, PageRecipe[]>();
const dataUrlCache = new Map<string, string>();

function cacheSet(cache: Map<string, string>, key: string, value: string, limit = 120): void {
  if (cache.size > limit) cache.clear();
  cache.set(key, value);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(value) as object) } as T;
  } catch {
    return fallback;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapPage(row: PageRow): DocumentPage {
  const recipe = parseJson<PageRecipe>(row.recipe, DEFAULT_RECIPE);
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    width: row.width,
    height: row.height,
    dpi: row.dpi,
    rotation: recipe.rotation ?? row.rotation ?? 0,
    filterPreset: recipe.filter ?? (row.filter_preset as FilterPreset) ?? 'original',
    filterConfig: parseJson<FilterConfig>(row.filter_config, {}),
    adjustments: parseJson<PageAdjustments>(row.adjustments, { ...DEFAULT_ADJUSTMENTS }),
    operations: recipe.operations ?? [],
    recipe: {
      ...DEFAULT_RECIPE,
      ...recipe,
      filterConfig: recipe.filterConfig ?? {},
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...(recipe.adjustments ?? {}) },
      operations: recipe.operations ?? [],
    },
    hasProcessed: row.has_processed === 1,
    isDirty: row.is_dirty === 1,
    thumbnailDataUrl: getThumbnailDataUrl(row),
    previewDataUrl: null,
    createdAt: row.created_at,
  };
}

function getThumbnailDataUrl(row: PageRow): string | null {
  if (!row.thumbnail_path) return null;
  try {
    const stat = fs.statSync(row.thumbnail_path);
    const key = `${row.thumbnail_path}:${stat.mtimeMs}`;
    const cached = thumbnailCache.get(key);
    if (cached) return cached;
    const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(row.thumbnail_path).toString('base64')}`;
    cacheSet(thumbnailCache, key, dataUrl, 300);
    return dataUrl;
  } catch {
    return null;
  }
}

function fileDataUrl(filePath: string, mime = 'image/jpeg'): string {
  const stat = fs.statSync(filePath);
  const key = `${filePath}:${stat.mtimeMs}`;
  const cached = dataUrlCache.get(key);
  if (cached) return cached;
  const dataUrl = `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  cacheSet(dataUrlCache, key, dataUrl, 60);
  return dataUrl;
}

function mapSummary(row: DocumentRow): DocumentSummary {
  const tags = db
    .all<{ tag: string }>('SELECT tag FROM document_tags WHERE document_id = ?', [row.id])
    .map((entry) => entry.tag);
  let thumbnailDataUrl: string | null = null;
  if (row.thumbnail_path) {
    try {
      thumbnailDataUrl = fileDataUrl(row.thumbnail_path);
    } catch {
      thumbnailDataUrl = null;
    }
  }
  return {
    id: row.id,
    name: row.name,
    documentType: row.document_type,
    sourceType: row.source_type as DocumentSourceType,
    category: row.category as DocumentCategory,
    status: row.status as DocumentStatus,
    pageCount: row.page_count,
    sizeBytes: row.size_bytes,
    thumbnailDataUrl,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function defaultMetadata(name: string): DocumentMetadata {
  return {
    title: name,
    author: '',
    subject: '',
    keywords: '',
    creator: 'Document Scanner & PDF Editor',
    producer: 'Document Scanner & PDF Editor',
    creationDate: nowIso(),
    modificationDate: nowIso(),
  };
}

export class DocumentService {
  private logActivity(documentId: string, action: string, detail = ''): void {
    db.run('INSERT INTO document_activity (id, document_id, action, detail) VALUES (?, ?, ?, ?)', [
      randomUUID(),
      documentId,
      action,
      detail,
    ]);
  }

  private touch(documentId: string, status: DocumentStatus = 'unsaved'): void {
    db.run('UPDATE documents SET updated_at = ?, status = ? WHERE id = ?', [nowIso(), status, documentId]);
  }

  private getDocumentRow(documentId: string): DocumentRow {
    const row = db.get<DocumentRow>('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!row) throw new Error('Dokumen tidak ditemukan.');
    return row;
  }

  private getPageRows(documentId: string): PageRow[] {
    return db.all<PageRow>(
      'SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_number ASC',
      [documentId],
    );
  }

  private getPageRow(pageId: string): PageRow {
    const row = db.get<PageRow>('SELECT * FROM document_pages WHERE id = ?', [pageId]);
    if (!row) throw new Error('Halaman tidak ditemukan.');
    return row;
  }

  private renumber(documentId: string): void {
    const rows = this.getPageRows(documentId);
    rows.forEach((row, index) => {
      db.run('UPDATE document_pages SET page_number = ? WHERE id = ?', [index + 1, row.id]);
    });
    db.run('UPDATE documents SET page_count = ? WHERE id = ?', [rows.length, documentId]);
  }

  private computeSize(documentId: string): number {
    let total = 0;
    for (const page of this.getPageRows(documentId)) {
      for (const candidate of [page.original_image_path, page.processed_image_path, page.thumbnail_path]) {
        if (!candidate) continue;
        try {
          total += fs.statSync(candidate).size;
        } catch {
          /* ignore */
        }
      }
    }
    return total;
  }

  private writeThumbnail(documentId: string, pageId: string, image: Parameters<typeof fitWithin>[0]): string {
    const dir = paths.documentSub(documentId, 'thumbnails');
    const target = path.join(dir, `${pageId}.jpg`);
    const small = fitWithin(image, 300, 420);
    fs.writeFileSync(target, encodeImage(small, 'jpg', 78));
    return target;
  }

  /** Re-renders a page from its original bitmap + recipe and stores the result. */
  async renderPage(page: PageRow): Promise<PageRow> {
    const documentId = page.document_id;
    const original = await decodeFile(page.original_image_path);
    const rendered = renderPageImage(original, parseJson<PageRecipe>(page.recipe, DEFAULT_RECIPE));
    const simpleOutput = ['gray-mode', 'black-white'].includes(page.filter_preset);
    const format = simpleOutput ? 'png' : 'jpg';
    const outPath = path.join(paths.documentSub(documentId, 'processed'), `${page.id}.${format === 'png' ? 'png' : 'jpg'}`);
    if (page.processed_image_path && page.processed_image_path !== outPath) {
      try {
        fs.unlinkSync(page.processed_image_path);
      } catch {
        /* ignore */
      }
    }
    await writeImage(rendered, outPath, format, 92);
    const thumbnailPath = this.writeThumbnail(documentId, page.id, rendered);
    db.run(
      `UPDATE document_pages SET processed_image_path = ?, thumbnail_path = ?, width = ?, height = ?,
       has_processed = 1, is_dirty = 0, updated_at = ? WHERE id = ?`,
      [outPath, thumbnailPath, rendered.width, rendered.height, nowIso(), page.id],
    );
    return this.getPageRow(page.id);
  }

  private pushHistory(page: PageRow, label: string): void {
    const seq = db.scalar('SELECT COALESCE(MAX(seq), 0) + 1 FROM page_history WHERE page_id = ?', [page.id]);
    db.run('INSERT INTO page_history (id, page_id, seq, recipe, label) VALUES (?, ?, ?, ?, ?)', [
      randomUUID(),
      page.id,
      seq,
      page.recipe ?? JSON.stringify(DEFAULT_RECIPE),
      label,
    ]);
    db.run(
      'DELETE FROM page_history WHERE page_id = ? AND seq <= (SELECT seq - 60 FROM page_history WHERE page_id = ? ORDER BY seq DESC LIMIT 1)',
      [page.id, page.id],
    );
    redoStacks.delete(page.id);
  }

  private updatePageRecipe(page: PageRow, recipe: PageRecipe): void {
    db.run(
      `UPDATE document_pages SET recipe = ?, rotation = ?, filter_preset = ?, filter_config = ?,
       adjustments = ?, is_dirty = 1, updated_at = ? WHERE id = ?`,
      [
        JSON.stringify(recipe),
        recipe.rotation,
        recipe.filter,
        JSON.stringify(recipe.filterConfig ?? {}),
        JSON.stringify(recipe.adjustments),
        nowIso(),
        page.id,
      ],
    );
  }

  list(query = ''): DocumentSummary[] {
    const rows = query.trim()
      ? db.all<DocumentRow>(
          'SELECT * FROM documents WHERE name LIKE ? OR category LIKE ? ORDER BY updated_at DESC',
          [`%${query.trim()}%`, `%${query.trim()}%`],
        )
      : db.all<DocumentRow>('SELECT * FROM documents ORDER BY updated_at DESC');
    return rows.map(mapSummary);
  }

  recent(limit = 8): DocumentSummary[] {
    return db
      .all<DocumentRow>('SELECT * FROM documents ORDER BY updated_at DESC LIMIT ?', [limit])
      .map(mapSummary);
  }

  stats(): { documents: number; pages: number; scanned: number; converted: number; exportBytes: number } {
    return {
      documents: db.scalar('SELECT COUNT(*) FROM documents'),
      pages: db.scalar('SELECT COUNT(*) FROM document_pages'),
      scanned: db.scalar("SELECT COUNT(*) FROM documents WHERE category = 'scanned'"),
      converted: db.scalar("SELECT COUNT(*) FROM documents WHERE category IN ('converted','edited')"),
      exportBytes: db.scalar('SELECT COALESCE(SUM(size_bytes), 0) FROM export_history'),
    };
  }

  create(input: { name?: string; category?: DocumentCategory; sourceType?: DocumentSourceType }): DocumentRecord {
    const id = randomUUID();
    const name = (input.name ?? 'Dokumen Baru').trim() || 'Dokumen Baru';
    const metadata = defaultMetadata(name);
    fs.mkdirSync(paths.documentSub(id, 'original'), { recursive: true });
    fs.mkdirSync(paths.documentSub(id, 'processed'), { recursive: true });
    fs.mkdirSync(paths.documentSub(id, 'thumbnails'), { recursive: true });
    db.run(
      `INSERT INTO documents (id, name, document_type, source_type, category, status, page_count, metadata, created_at, updated_at)
       VALUES (?, ?, 'general', ?, ?, 'new', 0, ?, ?, ?)`,
      [id, name, input.sourceType ?? 'import', input.category ?? 'scanned', JSON.stringify(metadata), nowIso(), nowIso()],
    );
    this.logActivity(id, 'document.create', name);
    return this.open(id);
  }

  open(documentId: string): DocumentRecord {
    const row = this.getDocumentRow(documentId);
    const pages = this.getPageRows(documentId).map(mapPage);
    const metadata = parseJson<DocumentMetadata>(row.metadata, defaultMetadata(row.name));
    return {
      ...mapSummary(row),
      pages,
      metadata,
      sourcePath: row.source_path,
      notes: row.notes ?? '',
    };
  }

  save(documentId: string): DocumentRecord {
    const size = this.computeSize(documentId);
    const pages = this.getPageRows(documentId);
    const firstThumb = pages.find((page) => page.thumbnail_path)?.thumbnail_path ?? null;
    db.run(
      'UPDATE documents SET status = ?, size_bytes = ?, thumbnail_path = COALESCE(?, thumbnail_path), updated_at = ? WHERE id = ?',
      ['saved', size, firstThumb, nowIso(), documentId],
    );
    this.logActivity(documentId, 'document.save', `${pages.length} halaman`);
    return this.open(documentId);
  }

  rename(documentId: string, name: string): DocumentSummary {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nama dokumen tidak boleh kosong.');
    if (trimmed.length > 160) throw new Error('Nama dokumen terlalu panjang.');
    db.run('UPDATE documents SET name = ?, updated_at = ? WHERE id = ?', [trimmed, nowIso(), documentId]);
    this.logActivity(documentId, 'document.rename', trimmed);
    return mapSummary(this.getDocumentRow(documentId));
  }

  duplicate(documentId: string): DocumentSummary {
    const source = this.getDocumentRow(documentId);
    const newId = randomUUID();
    fs.mkdirSync(paths.documentSub(newId, 'original'), { recursive: true });
    db.run(
      `INSERT INTO documents (id, name, document_type, source_type, category, status, page_count, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'unsaved', 0, ?, ?, ?)`,
      [
        newId,
        `${source.name} (copy)`,
        source.document_type,
        source.source_type,
        source.category,
        source.metadata,
        nowIso(),
        nowIso(),
      ],
    );
    const pages = this.getPageRows(documentId);
    for (const page of pages) {
      const target = path.join(paths.documentSub(newId, 'original'), `${page.id}.png`);
      fs.copyFileSync(page.original_image_path, target);
      db.run(
        `INSERT INTO document_pages (id, document_id, page_number, original_image_path, width, height, dpi, recipe,
          filter_preset, filter_config, adjustments, has_processed, is_dirty, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
        [
          randomUUID(),
          newId,
          page.page_number,
          target,
          page.width,
          page.height,
          page.dpi,
          page.recipe,
          page.filter_preset,
          page.filter_config,
          page.adjustments,
          nowIso(),
          nowIso(),
        ],
      );
    }
    this.renumber(newId);
    for (const page of this.getPageRows(newId)) void this.renderPage(page);
    this.logActivity(documentId, 'document.duplicate', newId);
    return mapSummary(this.getDocumentRow(newId));
  }

  remove(documentId: string): void {
    this.getDocumentRow(documentId);
    db.run('DELETE FROM document_pages WHERE document_id = ?', [documentId]);
    db.run('DELETE FROM document_activity WHERE document_id = ?', [documentId]);
    db.run('DELETE FROM document_tags WHERE document_id = ?', [documentId]);
    db.run('DELETE FROM ocr_results WHERE document_id = ?', [documentId]);
    db.run('DELETE FROM documents WHERE id = ?', [documentId]);
    try {
      fs.rmSync(paths.documentDir(documentId), { recursive: true, force: true });
    } catch (error) {
      logger.warn('documents', 'failed to remove files', { documentId, error: String(error) });
    }
    db.flush();
  }

  updateMetadata(documentId: string, patch: Partial<DocumentMetadata>): DocumentRecord {
    const row = this.getDocumentRow(documentId);
    const current = parseJson<DocumentMetadata>(row.metadata, defaultMetadata(row.name));
    const next: DocumentMetadata = { ...current, ...patch, modificationDate: nowIso() };
    db.run('UPDATE documents SET metadata = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(next),
      nowIso(),
      documentId,
    ]);
    if (patch.title) db.run('UPDATE documents SET name = ? WHERE id = ?', [patch.title, documentId]);
    this.logActivity(documentId, 'document.metadata', '');
    return this.open(documentId);
  }

  activity(documentId: string): ActivityEntry[] {
    return db
      .all<{ id: string; document_id: string; action: string; detail: string; created_at: string }>(
        'SELECT * FROM document_activity WHERE document_id = ? ORDER BY created_at DESC LIMIT 100',
        [documentId],
      )
      .map((row) => ({
        id: row.id,
        documentId: row.document_id,
        action: row.action,
        detail: row.detail,
        createdAt: row.created_at,
      }));
  }

  /* ---------------------------------------------------------------- */
  /* Pages                                                             */
  /* ---------------------------------------------------------------- */

  async addPageFromImage(
    documentId: string,
    imagePath: string,
    options: { sourcePage?: number; dpi?: number; category?: DocumentCategory; sourceType?: DocumentSourceType } = {},
  ): Promise<string> {
    this.getDocumentRow(documentId);
    const original = await decodeFile(imagePath);
    const pageId = randomUUID();
    const target = path.join(paths.documentSub(documentId, 'original'), `${pageId}.png`);
    await writeImage(original, target, 'png');
    const count = this.getPageRows(documentId).length;
    const recipe: PageRecipe = { ...DEFAULT_RECIPE };
    db.run(
      `INSERT INTO document_pages (id, document_id, page_number, original_image_path, width, height, dpi, recipe,
        filter_preset, filter_config, adjustments, source_pdf_page, has_processed, is_dirty, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'original', '{}', ?, ?, 0, 1, ?, ?)`,
      [
        pageId,
        documentId,
        count + 1,
        target,
        original.width,
        original.height,
        options.dpi ?? 300,
        JSON.stringify(recipe),
        JSON.stringify(DEFAULT_ADJUSTMENTS),
        options.sourcePage ?? null,
        nowIso(),
        nowIso(),
      ],
    );
    this.renumber(documentId);
    await this.renderPage(this.getPageRow(pageId));
    if (options.category) {
      db.run('UPDATE documents SET category = ?, source_type = ? WHERE id = ?', [
        options.category,
        options.sourceType ?? 'import',
        documentId,
      ]);
    }
    const page = this.getPageRow(pageId);
    const docMeta = this.getDocumentRow(documentId);
    if (!docMeta.thumbnail_path && page.thumbnail_path) {
      db.run('UPDATE documents SET thumbnail_path = ? WHERE id = ?', [page.thumbnail_path, documentId]);
    }
    this.touch(documentId);
    return pageId;
  }

  async addPagesFromBuffers(
    documentId: string,
    pages: Array<{ dataUrl: string; sourcePage?: number }>,
    source: DocumentSourceType = 'camera',
  ): Promise<DocumentRecord> {
    for (const page of pages) {
      const match = page.dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/);
      if (!match) throw new Error('Data halaman tidak valid.');
      const temp = path.join(paths.temp, `${randomUUID()}.png`);
      fs.mkdirSync(paths.temp, { recursive: true });
      fs.writeFileSync(temp, Buffer.from(match[1], 'base64'));
      await this.addPageFromImage(documentId, temp, {
        sourcePage: page.sourcePage,
        category: 'scanned',
        sourceType: source,
      });
      try {
        fs.unlinkSync(temp);
      } catch {
        /* ignore */
      }
    }
    this.logActivity(documentId, 'page.add', `${pages.length} halaman`);
    db.flush();
    return this.open(documentId);
  }

  async importFiles(filePaths: string[], targetDocumentId?: string): Promise<DocumentRecord> {
    let documentId = targetDocumentId;
    if (!documentId) {
      const baseName = path.parse(filePaths[0] ?? 'Dokumen').name;
      const created = this.create({ name: baseName, category: 'imported', sourceType: 'import' });
      documentId = created.id;
    }
    let imported = 0;
    for (const filePath of filePaths) {
      const resolved = path.resolve(filePath);
      if (!fs.existsSync(resolved)) throw new Error(`File tidak ditemukan: ${path.basename(resolved)}`);
      const ext = path.extname(resolved).toLowerCase();
      if (ext === '.pdf') {
        const info = await getPdfInfo(resolved).catch(() => null);
        if (info?.encrypted) {
          throw new Error('PDF terproteksi password. Gunakan PDF Tools untuk membuka dengan password.');
        }
        const pages = await extractPdfPages(resolved, { dpi: 200 });
        for (const page of pages) {
          const temp = path.join(paths.temp, `${randomUUID()}.png`);
          fs.mkdirSync(paths.temp, { recursive: true });
          fs.writeFileSync(temp, page.buffer);
          await this.addPageFromImage(documentId, temp, {
            sourcePage: page.index,
            dpi: 200,
            category: 'imported',
            sourceType: 'pdf',
          });
          fs.unlinkSync(temp);
          imported += 1;
        }
        db.run('UPDATE documents SET source_path = ? WHERE id = ?', [resolved, documentId]);
      } else if (IMAGE_EXTENSIONS.has(ext)) {
        await this.addPageFromImage(documentId, resolved, { category: 'imported', sourceType: 'import' });
        imported += 1;
      } else {
        throw new Error(`Format file tidak didukung: ${ext || path.basename(resolved)}`);
      }
    }
    this.logActivity(documentId, 'document.import', `${imported} halaman`);
    db.flush();
    return this.open(documentId);
  }

  async importPdfFiles(filePaths: string[], password?: string): Promise<DocumentRecord[]> {
    const records: DocumentRecord[] = [];
    for (const filePath of filePaths) {
      const name = path.parse(filePath).name;
      const created = this.create({ name, category: 'imported', sourceType: 'pdf' });
      const pages = await extractPdfPages(filePath, { dpi: 200, password });
      for (const page of pages) {
        const temp = path.join(paths.temp, `${randomUUID()}.png`);
        fs.mkdirSync(paths.temp, { recursive: true });
        fs.writeFileSync(temp, page.buffer);
        await this.addPageFromImage(created.id, temp, {
          sourcePage: page.index,
          dpi: 200,
          category: 'imported',
          sourceType: 'pdf',
        });
        fs.unlinkSync(temp);
      }
      db.run('UPDATE documents SET source_path = ?, status = ? WHERE id = ?', [filePath, 'saved', created.id]);
      this.logActivity(created.id, 'pdf.import', path.basename(filePath));
      records.push(this.open(created.id));
    }
    db.flush();
    return records;
  }

  deletePages(documentId: string, pageIds: string[]): DocumentRecord {
    for (const pageId of pageIds) {
      const row = this.getPageRow(pageId);
      if (row.document_id !== documentId) throw new Error('Halaman bukan milik dokumen ini.');
      try {
        fs.unlinkSync(row.original_image_path);
        if (row.processed_image_path) fs.unlinkSync(row.processed_image_path);
        if (row.thumbnail_path) fs.unlinkSync(row.thumbnail_path);
      } catch {
        /* ignore */
      }
      db.run('DELETE FROM document_pages WHERE id = ?', [pageId]);
    }
    this.renumber(documentId);
    this.touch(documentId);
    this.logActivity(documentId, 'page.delete', `${pageIds.length} halaman`);
    return this.open(documentId);
  }

  duplicatePage(documentId: string, pageId: string): DocumentRecord {
    const page = this.getPageRow(pageId);
    const newId = randomUUID();
    const target = path.join(paths.documentSub(documentId, 'original'), `${newId}.png`);
    fs.copyFileSync(page.original_image_path, target);
    const count = this.getPageRows(documentId).length;
    db.run(
      `INSERT INTO document_pages (id, document_id, page_number, original_image_path, width, height, dpi, recipe,
        filter_preset, filter_config, adjustments, has_processed, is_dirty, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      [
        newId,
        documentId,
        count + 1,
        target,
        page.width,
        page.height,
        page.dpi,
        page.recipe,
        page.filter_preset,
        page.filter_config,
        page.adjustments,
        nowIso(),
        nowIso(),
      ],
    );
    void this.renderPage(this.getPageRow(newId));
    this.touch(documentId);
    this.logActivity(documentId, 'page.duplicate', String(page.page_number));
    return this.open(documentId);
  }

  reorderPages(documentId: string, pageIds: string[]): DocumentRecord {
    const existing = this.getPageRows(documentId);
    if (pageIds.length !== existing.length) throw new Error('Urutan halaman tidak lengkap.');
    const set = new Set(pageIds);
    if (existing.some((page) => !set.has(page.id))) throw new Error('Halaman tidak dikenal.');
    pageIds.forEach((id, index) => {
      db.run('UPDATE document_pages SET page_number = ? WHERE id = ? AND document_id = ?', [
        index + 1,
        id,
        documentId,
      ]);
    });
    this.touch(documentId);
    this.logActivity(documentId, 'page.reorder', '');
    return this.open(documentId);
  }

  movePage(documentId: string, pageId: string, direction: 'up' | 'down' | 'first' | 'last'): DocumentRecord {
    const pages = this.getPageRows(documentId).map((page) => page.id);
    const index = pages.indexOf(pageId);
    if (index < 0) throw new Error('Halaman tidak ditemukan.');
    pages.splice(index, 1);
    if (direction === 'up') pages.splice(Math.max(0, index - 1), 0, pageId);
    else if (direction === 'down') pages.splice(Math.min(pages.length, index + 1), 0, pageId);
    else if (direction === 'first') pages.unshift(pageId);
    else pages.push(pageId);
    return this.reorderPages(documentId, pages);
  }

  private mutatePages(documentId: string, pageIds: string[], mutate: (recipe: PageRecipe) => PageRecipe, label: string): DocumentRecord {
    const pages = this.getPageRows(documentId).filter((page) => pageIds.includes(page.id));
    if (!pages.length) throw new Error('Tidak ada halaman yang dipilih.');
    for (const page of pages) {
      this.pushHistory(page, label);
      const recipe = parseJson<PageRecipe>(page.recipe, DEFAULT_RECIPE);
      this.updatePageRecipe(page, mutate(recipe));
    }
    this.touch(documentId);
    this.logActivity(documentId, label, `${pages.length} halaman`);
    return this.open(documentId);
  }

  rotatePages(documentId: string, pageIds: string[], degrees: number): DocumentRecord {
    const delta = ((Math.round(degrees) % 360) + 360) % 360;
    return this.mutatePages(
      documentId,
      pageIds,
      (recipe) => ({ ...recipe, rotation: (((recipe.rotation ?? 0) + delta) % 360 + 360) % 360 }),
      'page.rotate',
    );
  }

  applyFilter(documentId: string, pageIds: string[], preset: FilterPreset, config: FilterConfig): DocumentRecord {
    return this.mutatePages(
      documentId,
      pageIds,
      (recipe) => ({ ...recipe, filter: preset, filterConfig: { ...config } }),
      'page.filter',
    );
  }

  updateAdjustments(documentId: string, pageIds: string[], adjustments: Partial<PageAdjustments>): DocumentRecord {
    return this.mutatePages(
      documentId,
      pageIds,
      (recipe) => ({ ...recipe, adjustments: { ...recipe.adjustments, ...adjustments } }),
      'page.adjust',
    );
  }

  applyOperation(
    documentId: string,
    pageIds: string[],
    type: PageOperationType,
    params: Record<string, number | string | boolean>,
  ): DocumentRecord {
    return this.mutatePages(
      documentId,
      pageIds,
      (recipe) => ({
        ...recipe,
        operations: [
          ...recipe.operations,
          { id: randomUUID(), type, params, createdAt: nowIso() },
        ],
      }),
      `page.${type}`,
    );
  }

  setCrop(documentId: string, pageId: string, quad: Quad | null): DocumentRecord {
    return this.mutatePages(
      documentId,
      [pageId],
      (recipe) => ({ ...recipe, quad }),
      'page.crop',
    );
  }

  resetPage(documentId: string, pageIds: string[]): DocumentRecord {
    const record = this.mutatePages(documentId, pageIds, () => ({ ...DEFAULT_RECIPE, adjustments: { ...DEFAULT_ADJUSTMENTS } }), 'page.reset');
    for (const pageId of pageIds) {
      const page = this.getPageRow(pageId);
      void this.renderPage(page);
    }
    return record;
  }

  undoPage(documentId: string, pageId: string): DocumentRecord {
    const page = this.getPageRow(pageId);
    const last = db.get<{ id: string; recipe: string }>(
      'SELECT id, recipe FROM page_history WHERE page_id = ? ORDER BY seq DESC LIMIT 1',
      [pageId],
    );
    if (!last) throw new Error('Tidak ada langkah yang dapat dibatalkan.');
    const stack = redoStacks.get(pageId) ?? [];
    stack.push(parseJson<PageRecipe>(page.recipe, DEFAULT_RECIPE));
    redoStacks.set(pageId, stack.slice(-40));
    db.run('DELETE FROM page_history WHERE id = ?', [last.id]);
    db.run('UPDATE document_pages SET recipe = ?, is_dirty = 1 WHERE id = ?', [last.recipe, pageId]);
    void this.renderPage(this.getPageRow(pageId));
    this.touch(documentId);
    return this.open(documentId);
  }

  redoPage(documentId: string, pageId: string): DocumentRecord {
    const stack = redoStacks.get(pageId);
    if (!stack?.length) throw new Error('Tidak ada langkah yang dapat diulang.');
    const next = stack.pop() as PageRecipe;
    const page = this.getPageRow(pageId);
    this.pushHistory(page, 'redo');
    db.run('UPDATE document_pages SET recipe = ?, is_dirty = 1 WHERE id = ?', [JSON.stringify(next), pageId]);
    void this.renderPage(this.getPageRow(pageId));
    this.touch(documentId);
    return this.open(documentId);
  }

  async pagePreview(
    documentId: string,
    pageId: string,
    options: { processed?: boolean; maxWidth?: number; quality?: number } = {},
  ): Promise<string> {
    const page = this.getPageRow(pageId);
    if (page.document_id !== documentId) throw new Error('Halaman tidak valid.');
    const maxWidth = Math.min(4000, Math.max(200, options.maxWidth ?? 1400));
    const cacheKey = `${pageId}:${page.recipe}:${page.updated_at}:${options.processed === false ? 'raw' : 'proc'}:${maxWidth}`;
    const cached = previewCache.get(cacheKey);
    if (cached) return cached;
    let dataUrl: string;
    if (options.processed === false) {
      const original = await decodeFile(page.original_image_path);
      dataUrl = previewDataUrl(original, maxWidth);
    } else if (!page.is_dirty && page.processed_image_path && fs.existsSync(page.processed_image_path)) {
      const original = await decodeFile(page.processed_image_path);
      dataUrl = previewDataUrl(original, maxWidth);
    } else {
      const original = await decodeFile(page.original_image_path);
      const rendered = renderPageImage(original, parseJson<PageRecipe>(page.recipe, DEFAULT_RECIPE));
      dataUrl = previewDataUrl(rendered, maxWidth);
    }
    cacheSet(previewCache, cacheKey, dataUrl, 40);
    return dataUrl;
  }

  async comparePreview(
    documentId: string,
    pageId: string,
    recipe: PageRecipe | null,
  ): Promise<{ before: string; after: string }> {
    const page = this.getPageRow(pageId);
    if (page.document_id !== documentId) throw new Error('Halaman tidak valid.');
    const original = await decodeFile(page.original_image_path);
    const target = recipe ?? parseJson<PageRecipe>(page.recipe, DEFAULT_RECIPE);
    const rendered = renderPageImage(original, target);
    return {
      before: previewDataUrl(original, 1400),
      after: previewDataUrl(rendered, 1400),
    };
  }

  async rerenderDocument(documentId: string): Promise<void> {
    const pages = this.getPageRows(documentId);
    for (const page of pages) {
      if (page.is_dirty || !page.processed_image_path || !fs.existsSync(page.processed_image_path)) {
        await this.renderPage(page);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Export / merge / split                                            */
  /* ---------------------------------------------------------------- */

  async exportPdf(documentId: string, options: PdfExportOptions): Promise<ExportResult | null> {
    const record = this.open(documentId);
    if (!record.pages.length) throw new Error('Dokumen tidak memiliki halaman untuk diekspor.');
    await this.rerenderDocument(documentId);
    const pages = this.getPageRows(documentId);
    const outputPath =
      options.outputPath ??
      paths.assertAllowedWrite(
        paths.uniqueFilePath(path.join(settings.outputDirectory, `${sanitizeFileName(record.name)}.pdf`)),
      );
    const result = await createPdfFromImages({
      images: pages.map((page) => ({
        path: page.processed_image_path ?? page.original_image_path,
        width: page.width,
        height: page.height,
      })),
      outputPath,
      options,
      metadata: record.metadata,
    });
    db.run(
      'INSERT INTO export_history (id, document_id, path, format, size_bytes, pages) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), documentId, outputPath, 'pdf', result.size, pages.length],
    );
    db.run('UPDATE documents SET status = ?, size_bytes = ?, updated_at = ? WHERE id = ?', [
      'completed',
      this.computeSize(documentId),
      nowIso(),
      documentId,
    ]);
    this.logActivity(documentId, 'document.exportPdf', outputPath);
    db.flush();
    return { path: outputPath, size: result.size, pages: pages.length, warnings: result.warnings };
  }

  async splitDocument(
    documentId: string,
    ranges: SplitRange[],
  ): Promise<Array<{ path: string; pages: number }>> {
    const record = this.open(documentId);
    await this.rerenderDocument(documentId);
    const pages = this.getPageRows(documentId);
    const outputs: Array<{ path: string; pages: number }> = [];
    const outDir = path.join(settings.outputDirectory, `${sanitizeFileName(record.name)}-split`);
    fs.mkdirSync(outDir, { recursive: true });
    for (const range of ranges) {
      const selected = pages.filter(
        (page) => page.page_number >= range.from && page.page_number <= range.to,
      );
      if (!selected.length) continue;
      const outputPath = paths.uniqueFilePath(
        path.join(outDir, `${sanitizeFileName(record.name)}-${range.from}-${range.to}.pdf`),
      );
      const result = await createPdfFromImages({
        images: selected.map((page) => ({
          path: page.processed_image_path ?? page.original_image_path,
          width: page.width,
          height: page.height,
        })),
        outputPath,
        options: {
          quality: 'high',
          imageFormat: 'jpg',
          pageSize: 'Original',
          orientation: 'auto',
          margin: 0,
          addPageNumbers: false,
        },
        metadata: record.metadata,
      });
      outputs.push({ path: outputPath, pages: selected.length });
      db.run(
        'INSERT INTO export_history (id, document_id, path, format, size_bytes, pages) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), documentId, outputPath, 'pdf', result.size, selected.length],
      );
    }
    this.logActivity(documentId, 'document.split', `${outputs.length} file`);
    db.flush();
    return outputs;
  }

  async mergeDocuments(documentIds: string[], name: string): Promise<DocumentSummary> {
    if (documentIds.length < 2) throw new Error('Pilih minimal dua dokumen untuk digabung.');
    const created = this.create({ name: name || 'Dokumen Gabungan', category: 'converted', sourceType: 'conversion' });
    for (const documentId of documentIds) {
      await this.rerenderDocument(documentId);
      const pages = this.getPageRows(documentId);
      for (const page of pages) {
        await this.addPageFromImage(created.id, page.processed_image_path ?? page.original_image_path, {
          category: 'converted',
          sourceType: 'conversion',
        });
      }
    }
    this.save(created.id);
    this.logActivity(created.id, 'document.merge', documentIds.join(','));
    return mapSummary(this.getDocumentRow(created.id));
  }

  async extractPages(documentId: string, pageIds: string[]): Promise<DocumentSummary> {
    const record = this.open(documentId);
    if (!pageIds.length) throw new Error('Pilih halaman yang akan diekstrak.');
    const created = this.create({
      name: `${record.name} (extract)`,
      category: 'converted',
      sourceType: 'conversion',
    });
    await this.rerenderDocument(documentId);
    const pages = this.getPageRows(documentId).filter((page) => pageIds.includes(page.id));
    for (const page of pages) {
      await this.addPageFromImage(created.id, page.processed_image_path ?? page.original_image_path, {
        category: 'converted',
        sourceType: 'conversion',
      });
    }
    this.save(created.id);
    return mapSummary(this.getDocumentRow(created.id));
  }

  async addPagesFromScanner(documentId: string, scanRunner: () => Promise<string[]>): Promise<DocumentRecord> {
    const files = await scanRunner();
    for (const file of files) {
      await this.addPageFromImage(documentId, file, { category: 'scanned', sourceType: 'scanner' });
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
    this.logActivity(documentId, 'page.scan', `${files.length} halaman`);
    return this.open(documentId);
  }

  detectDocument = detectFromBuffer;
}

export { sanitizeFileName };

export const documents = new DocumentService();
