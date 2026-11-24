import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { PdfOpResult } from '../../src/shared/types';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { settings } from './settings';
import { sanitizeFileName } from '../lib/filenames';

const CANDIDATE_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
  '/usr/bin/soffice',
  '/usr/lib/libreoffice/program/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
];

/** LibreOffice headless bridge for Office → PDF conversion (PRD §6.6). */
class OfficeService {
  private cachedPath: string | null = null;

  async detect(): Promise<{ available: boolean; path: string; version?: string }> {
    const configured = settings.get().libreOfficePath;
    const candidates = [configured, this.cachedPath ?? '', ...CANDIDATE_PATHS].filter(Boolean) as string[];
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const stat = fs.statSync(candidate);
        if (!stat.isFile()) continue;
        this.cachedPath = candidate;
        return { available: true, path: candidate };
      } catch {
        continue;
      }
    }
    const fromPath = await this.findOnPath();
    if (fromPath) {
      this.cachedPath = fromPath;
      return { available: true, path: fromPath };
    }
    return { available: false, path: '' };
  }

  private findOnPath(): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(
        process.platform === 'win32' ? 'where' : 'which',
        ['soffice'],
        { timeout: 4000, windowsHide: true },
        (error, stdout) => {
          if (error) {
            resolve(null);
            return;
          }
          const first = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
          resolve(first && fs.existsSync(first) ? first : null);
        },
      );
    });
  }

  async toPdf(filePaths: string[], outputDir?: string): Promise<PdfOpResult[]> {
    const detection = await this.detect();
    if (!detection.available) {
      throw new Error(
        'LibreOffice tidak ditemukan. Instal LibreOffice lalu atur path-nya di Settings untuk konversi Office ke PDF.',
      );
    }
    const dir = outputDir ? path.resolve(outputDir) : paths.uniqueFilePath(path.join(paths.exports, 'office-conversion'));
    fs.mkdirSync(dir, { recursive: true });
    paths.assertAllowedWrite(path.join(dir, 'probe.pdf'));
    const results: PdfOpResult[] = [];
    for (const file of filePaths) {
      const resolved = path.resolve(file);
      if (!fs.existsSync(resolved)) throw new Error(`File tidak ditemukan: ${path.basename(resolved)}`);
      const ext = path.extname(resolved).toLowerCase();
      if (!['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt'].includes(ext)) {
        throw new Error(`Format ${ext} tidak didukung untuk konversi Office.`);
      }
      const target = path.join(dir, `${sanitizeFileName(path.parse(resolved).name)}.pdf`);
      const finalTarget = paths.uniqueFilePath(target);
      await this.runConversion(detection.path, resolved, path.dirname(finalTarget));
      const produced = path.join(path.dirname(finalTarget), `${path.parse(resolved).name}.pdf`);
      if (!fs.existsSync(produced)) throw new Error(`Konversi gagal untuk ${path.basename(resolved)}.`);
      if (produced !== finalTarget) fs.renameSync(produced, finalTarget);
      const stat = fs.statSync(finalTarget);
      results.push({
        outputPath: finalTarget,
        outputSize: stat.size,
        originalSize: fs.statSync(resolved).size,
        warnings: ['Tata letak hasil konversi bergantung pada font yang tersedia di sistem.'],
      });
    }
    return results;
  }

  private runConversion(sofficePath: string, input: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--norestore',
        '--convert-to',
        'pdf:writer_pdf_Export',
        '--outdir',
        outputDir,
        input,
      ];
      const child = execFile(sofficePath, args, { timeout: 120_000, windowsHide: true }, (error, _stdout, stderr) => {
        if (error) {
          logger.error('office', 'conversion failed', { error: String(error), stderr: String(stderr).slice(0, 500) });
          reject(new Error(`Konversi Office gagal: ${error.message}`));
          return;
        }
        resolve();
      });
      child.on('error', (error) => reject(new Error(`Tidak dapat menjalankan LibreOffice: ${error.message}`)));
    });
  }
}

export const office = new OfficeService();
