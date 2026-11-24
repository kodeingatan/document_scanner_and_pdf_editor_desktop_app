import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/** Application data layout (PRD §7.4). */
class PathService {
  private documentsRoot: string | null = null;

  get root(): string {
    return app.getPath('userData');
  }

  get dbDir(): string {
    return path.join(this.root, 'database');
  }

  get dbFile(): string {
    return path.join(this.dbDir, 'application.db');
  }

  get documents(): string {
    return this.documentsRoot ?? path.join(this.root, 'documents');
  }

  get imports(): string {
    return path.join(this.root, 'imports');
  }

  get exports(): string {
    return path.join(this.root, 'exports');
  }

  get temp(): string {
    return path.join(this.root, 'temp');
  }

  get cache(): string {
    return path.join(this.root, 'cache');
  }

  get backups(): string {
    return path.join(this.root, 'backups');
  }

  get logs(): string {
    return path.join(this.root, 'logs');
  }

  get tessdata(): string {
    const candidates = [
      path.join(process.resourcesPath ?? '', 'tessdata'),
      path.join(app.getAppPath(), 'resources', 'tessdata'),
      path.join(this.root, 'language-packs'),
    ];
    return candidates.find((candidate) => {
      try {
        return fs.existsSync(candidate) && fs.readdirSync(candidate).length > 0;
      } catch {
        return false;
      }
    }) ?? candidates[2];
  }

  setDocumentsRoot(target: string | null): void {
    this.documentsRoot = target && target.trim() ? target : null;
  }

  ensureAll(): void {
    for (const dir of [
      this.root,
      this.dbDir,
      this.documents,
      this.imports,
      this.exports,
      this.temp,
      this.cache,
      this.backups,
      this.logs,
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  documentDir(documentId: string): string {
    return path.join(this.documents, documentId);
  }

  documentSub(documentId: string, sub: 'original' | 'processed' | 'thumbnails' | 'exports'): string {
    const dir = path.join(this.documentDir(documentId), sub);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Rejects any path that escapes the given base directory. */
  assertInside(base: string, target: string): string {
    const resolvedBase = path.resolve(base);
    const resolvedTarget = path.resolve(target);
    const relative = path.relative(resolvedBase, resolvedTarget);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path akses ditolak: di luar direktori yang diizinkan.');
    }
    return resolvedTarget;
  }

  isInside(base: string, target: string): boolean {
    const relative = path.relative(path.resolve(base), path.resolve(target));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  /** User-selected files (open dialogs) and app-managed storage are valid read roots. */
  isAllowedRead(target: string): boolean {
    const resolved = path.resolve(target);
    return this.allowedReadRoots().some((base) => this.isInside(base, resolved));
  }

  private allowedReadRoots(): string[] {
    return [
      this.root,
      this.documents,
      this.imports,
      this.exports,
      this.temp,
      this.cache,
      app.getPath('home'),
      app.getPath('desktop'),
      app.getPath('documents'),
      app.getPath('downloads'),
      app.getPath('pictures'),
    ];
  }

  /**
   * Folders the user explicitly picked in a native dialog. Saving there is
   * expected behaviour even when the folder lives outside the app folders.
   */
  private userWriteRoots = new Set<string>();

  allowUserPath(target: string): void {
    const resolved = path.resolve(target);
    try {
      this.userWriteRoots.add(fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved));
    } catch {
      this.userWriteRoots.add(path.dirname(resolved));
    }
  }

  assertAllowedWrite(target: string): string {
    const resolved = path.resolve(target);
    const roots = [
      this.root,
      this.documents,
      this.exports,
      app.getPath('home'),
      app.getPath('documents'),
      app.getPath('desktop'),
      app.getPath('downloads'),
      app.getPath('pictures'),
      ...this.userWriteRoots,
    ];
    if (!roots.some((base) => this.isInside(base, resolved))) {
      throw new Error('Lokasi penyimpanan tidak diizinkan.');
    }
    return resolved;
  }

  uniqueFilePath(target: string): string {
    if (!fs.existsSync(target)) return target;
    const parsed = path.parse(target);
    let index = 1;
    let candidate = target;
    while (fs.existsSync(candidate)) {
      candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
      index += 1;
    }
    return candidate;
  }

  async cleanupTemp(maxAgeMs = 1000 * 60 * 60 * 12): Promise<number> {
    let removed = 0;
    const now = Date.now();
    const walk = (dir: string): void => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) walk(full);
          else {
            const stat = fs.statSync(full);
            if (now - stat.mtimeMs > maxAgeMs) {
              fs.unlinkSync(full);
              removed += 1;
            }
          }
        } catch {
          /* ignore locked files */
        }
      }
    };
    walk(this.temp);
    return removed;
  }
}

export const paths = new PathService();
