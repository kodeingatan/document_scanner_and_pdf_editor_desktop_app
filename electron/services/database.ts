import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type BindParams, type Database, type SqlJsStatic } from 'sql.js';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';

type Row = Record<string, unknown>;

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scanner_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  driver TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  description TEXT,
  manufacturer TEXT,
  port TEXT,
  info TEXT,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  resolution INTEGER DEFAULT 300,
  color_mode TEXT DEFAULT 'color',
  paper_size TEXT DEFAULT 'A4',
  paper_source TEXT DEFAULT 'feeder',
  duplex INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_sessions (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  device_id TEXT,
  driver TEXT,
  pages INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  options TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'general',
  source_type TEXT NOT NULL DEFAULT 'import',
  category TEXT NOT NULL DEFAULT 'imported',
  original_path TEXT,
  source_path TEXT,
  thumbnail_path TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  page_count INTEGER DEFAULT 0,
  size_bytes INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  original_image_path TEXT NOT NULL,
  processed_image_path TEXT,
  thumbnail_path TEXT,
  width INTEGER,
  height INTEGER,
  dpi INTEGER DEFAULT 300,
  rotation INTEGER DEFAULT 0,
  filter_preset TEXT DEFAULT 'original',
  filter_config TEXT,
  adjustments TEXT,
  recipe TEXT,
  has_processed INTEGER DEFAULT 0,
  is_dirty INTEGER DEFAULT 1,
  source_pdf_page INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_processing (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  parameters TEXT,
  operation_order INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(page_id) REFERENCES document_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_history (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  recipe TEXT NOT NULL,
  label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(page_id) REFERENCES document_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS filter_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT,
  is_builtin INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocr_results (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  language TEXT,
  extracted_text TEXT,
  confidence REAL,
  words TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(page_id) REFERENCES document_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pdf_jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  operation TEXT NOT NULL,
  input_path TEXT,
  output_path TEXT,
  status TEXT NOT NULL,
  params TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME
);

CREATE TABLE IF NOT EXISTS conversion_jobs (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  output_path TEXT,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  status TEXT NOT NULL,
  params TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS export_history (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  path TEXT NOT NULL,
  format TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  pages INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_tags (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_activity (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_document ON document_pages(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_history_page ON page_history(page_id, seq);
CREATE INDEX IF NOT EXISTS idx_ocr_page ON ocr_results(page_id);
CREATE INDEX IF NOT EXISTS idx_activity_document ON document_activity(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at);
`;

class DatabaseService {
  private db: Database | null = null;
  private sql: SqlJsStatic | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  async init(): Promise<void> {
    paths.ensureAll();
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    const wasmFile = fs.readFileSync(wasmPath);
    const wasmBinary = wasmFile.buffer.slice(
      wasmFile.byteOffset,
      wasmFile.byteOffset + wasmFile.byteLength,
    ) as ArrayBuffer;
    this.sql = await initSqlJs({ wasmBinary, useOldExtensionFunctions: true });
    const existing = fs.existsSync(paths.dbFile) ? fs.readFileSync(paths.dbFile) : null;
    try {
      this.db = existing ? new this.sql.Database(existing) : new this.sql.Database();
    } catch (error) {
      logger.error('db', 'database corrupt, restoring backup', { error: String(error) });
      const backup = this.latestBackup();
      this.db = backup ? new this.sql.Database(fs.readFileSync(backup)) : new this.sql.Database();
    }
    this.db.exec(SCHEMA);
    this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    this.backup();
    this.seedFilterPresets();
    const integrity = this.integrityCheck();
    if (!integrity.ok) logger.warn('db', 'integrity check warning', integrity);
    logger.info('db', 'database ready', { file: paths.dbFile });
  }

  private get handle(): Database {
    if (!this.db) throw new Error('Database belum diinisialisasi.');
    return this.db;
  }

  private seedFilterPresets(): void {
    const count = this.scalar('SELECT COUNT(*) as total FROM filter_presets');
    if (count > 0) return;
    const presets = [
      ['original', 'Original'],
      ['auto-enhance', 'Auto Enhance'],
      ['magic-color', 'Magic Color'],
      ['gray-mode', 'Gray Mode'],
      ['black-white', 'Black & White'],
      ['lighten', 'Lighten'],
      ['darken', 'Darken'],
      ['sharpen', 'Sharpen'],
      ['ink-saving', 'Ink Saving'],
      ['photo-mode', 'Photo Mode'],
    ];
    for (const [id, name] of presets) {
      this.run('INSERT INTO filter_presets (id, name, config) VALUES (?, ?, ?)', [id, name, '{}']);
    }
    this.flush();
  }

  run(sql: string, params: BindParams = []): void {
    this.handle.run(sql, params);
    this.scheduleSave();
  }

  all<T = Row>(sql: string, params: BindParams = []): T[] {
    const statement = this.handle.prepare(sql, params);
    const rows: T[] = [];
    try {
      while (statement.step()) rows.push(statement.getAsObject() as unknown as T);
    } finally {
      statement.free();
    }
    return rows;
  }

  get<T = Row>(sql: string, params: BindParams = []): T | null {
    const rows = this.all<T>(sql, params);
    return rows.length ? rows[0] : null;
  }

  scalar(sql: string, params: BindParams = []): number {
    const row = this.get<Record<string, unknown>>(sql, params);
    if (!row) return 0;
    const value = Object.values(row)[0];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  transaction<T>(fn: () => T): T {
    this.handle.exec('BEGIN');
    try {
      const result = fn();
      this.handle.exec('COMMIT');
      this.scheduleSave();
      return result;
    } catch (error) {
      try {
        this.handle.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 300);
  }

  /** Atomic write: temp file then rename, so a crash cannot truncate the database. */
  flush(): void {
    if (!this.db || !this.dirty) return;
    try {
      const data = Buffer.from(this.db.export());
      fs.mkdirSync(paths.dbDir, { recursive: true });
      const tmp = `${paths.dbFile}.tmp`;
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, paths.dbFile);
      this.dirty = false;
    } catch (error) {
      logger.error('db', 'persist failed', { error: String(error) });
    }
  }

  immediate<T>(fn: () => T): T {
    const result = fn();
    this.flush();
    return result;
  }

  backup(): void {
    try {
      fs.mkdirSync(paths.backups, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const target = path.join(paths.backups, `application-${stamp}.db`);
      const data = this.db ? Buffer.from(this.db.export()) : null;
      if (data) fs.writeFileSync(target, data);
      const backups = fs
        .readdirSync(paths.backups)
        .filter((name) => name.endsWith('.db'))
        .map((name) => ({ name, at: fs.statSync(path.join(paths.backups, name)).mtimeMs }))
        .sort((a, b) => b.at - a.at);
      for (const extra of backups.slice(5)) {
        fs.unlinkSync(path.join(paths.backups, extra.name));
      }
    } catch (error) {
      logger.warn('db', 'backup failed', { error: String(error) });
    }
  }

  private latestBackup(): string | null {
    try {
      const files = fs
        .readdirSync(paths.backups)
        .filter((name) => name.endsWith('.db'))
        .map((name) => ({ path: path.join(paths.backups, name), at: fs.statSync(path.join(paths.backups, name)).mtimeMs }))
        .sort((a, b) => b.at - a.at);
      return files[0]?.path ?? null;
    } catch {
      return null;
    }
  }

  integrityCheck(): { ok: boolean; messages: string[] } {
    try {
      const rows = this.all<{ integrity_check: string }>('PRAGMA integrity_check');
      const messages = rows.map((row) => String(row.integrity_check ?? ''));
      return { ok: messages.every((message) => message.toLowerCase() === 'ok'), messages };
    } catch (error) {
      return { ok: false, messages: [String(error)] };
    }
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.flush();
    this.backup();
    this.db?.close();
    this.db = null;
  }
}

export const db = new DatabaseService();
