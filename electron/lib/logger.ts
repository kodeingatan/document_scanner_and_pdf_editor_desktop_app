import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { paths } from './paths';

type Level = 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimal structured logger. Never writes document content, OCR text or
 * passwords — only operation metadata (PRD §8.4).
 */
class Logger {
  private stream: fs.WriteStream | null = null;

  private writer(): fs.WriteStream | null {
    if (this.stream) return this.stream;
    try {
      fs.mkdirSync(paths.logs, { recursive: true });
      this.stream = fs.createWriteStream(path.join(paths.logs, 'application.log'), { flags: 'a' });
    } catch {
      return null;
    }
    return this.stream;
  }

  private write(level: Level, scope: string, message: string, meta?: unknown): void {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      level,
      scope,
      message,
      meta: meta === undefined ? undefined : meta,
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    this.writer()?.write(`${line}\n`);
  }

  debug(scope: string, message: string, meta?: unknown): void {
    this.write('debug', scope, message, meta);
  }
  info(scope: string, message: string, meta?: unknown): void {
    this.write('info', scope, message, meta);
  }
  warn(scope: string, message: string, meta?: unknown): void {
    this.write('warn', scope, message, meta);
  }
  error(scope: string, message: string, meta?: unknown): void {
    this.write('error', scope, message, meta);
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }

  get info_(): { version: string; platform: string } {
    return { version: app.getVersion(), platform: process.platform };
  }
}

export const logger = new Logger();
