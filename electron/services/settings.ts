import type { AppSettings } from '../../src/shared/types';
import { paths } from '../lib/paths';
import { db } from './database';

const DEFAULTS: AppSettings = {
  language: 'id',
  theme: 'light',
  defaultScannerId: '',
  defaultResolution: 300,
  defaultPaperSize: 'A4',
  defaultImageFormat: 'jpg',
  defaultPdfQuality: 'high',
  documentsDirectory: '',
  outputDirectory: '',
  autoSave: true,
  autoSaveIntervalSec: 60,
  backupEnabled: true,
  ocrLanguage: 'ind+eng',
  tempAutoCleanup: true,
  cacheLimitMb: 1024,
  hardwareAcceleration: true,
  processingConcurrency: 2,
  libreOfficePath: '',
  twainBridgePath: '',
  cameraDeviceId: '',
  autoCapture: {
    enabled: true,
    sensitivity: 60,
    stabilityThreshold: 2.5,
    captureDelayMs: 900,
    blurThreshold: 60,
    minDocumentSize: 18,
    countdownMs: 700,
  },
  sidebarCollapsed: false,
  lastDocumentId: null,
};

class SettingsService {
  private cache: AppSettings = { ...DEFAULTS };

  load(): AppSettings {
    const rows = db.all<{ key: string; value: string }>('SELECT key, value FROM app_settings');
    const stored: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        stored[row.key] = row.value;
      }
    }
    this.cache = {
      ...DEFAULTS,
      ...stored,
      autoCapture: { ...DEFAULTS.autoCapture, ...(stored.autoCapture as object | undefined) },
    } as AppSettings;
    paths.setDocumentsRoot(this.cache.documentsDirectory || null);
    return this.get();
  }

  get(): AppSettings {
    return { ...this.cache, autoCapture: { ...this.cache.autoCapture } };
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const next: AppSettings = {
      ...this.cache,
      ...patch,
      autoCapture: { ...this.cache.autoCapture, ...(patch.autoCapture ?? {}) },
    };
    for (const [key, value] of Object.entries(patch)) {
      db.run(
        'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
        [key, JSON.stringify((next as unknown as Record<string, unknown>)[key] ?? value)],
      );
    }
    this.cache = next;
    paths.setDocumentsRoot(next.documentsDirectory || null);
    return this.get();
  }

  reset(): AppSettings {
    db.run('DELETE FROM app_settings');
    this.cache = { ...DEFAULTS };
    paths.setDocumentsRoot(null);
    return this.get();
  }

  get outputDirectory(): string {
    return this.cache.outputDirectory || paths.exports;
  }

  get documentsDirectory(): string {
    return this.cache.documentsDirectory || paths.documents;
  }

  get defaults(): AppSettings {
    return { ...DEFAULTS };
  }
}

export const settings = new SettingsService();
