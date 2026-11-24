import { randomUUID } from 'node:crypto';
import type { JobProgress, JobStatus } from '../../src/shared/types';
import { logger } from './logger';

type Listener = (job: JobProgress) => void;

export class Job {
  readonly id = randomUUID();
  readonly progress: JobProgress;
  cancelled = false;
  private onCancelHooks: Array<() => void> = [];

  constructor(
    readonly type: string,
    total: number,
    private readonly emit: (job: JobProgress) => void,
  ) {
    this.progress = {
      jobId: this.id,
      type,
      status: 'queued',
      progress: 0,
      message: '',
      total,
      current: 0,
      startedAt: new Date().toISOString(),
    };
  }

  private push(): void {
    this.emit({ ...this.progress });
  }

  start(message = ''): this {
    this.progress.status = 'running';
    this.progress.message = message;
    this.push();
    return this;
  }

  update(current: number, message?: string): void {
    if (this.cancelled) return;
    this.progress.current = current;
    this.progress.progress = this.progress.total
      ? Math.min(1, Math.max(0, current / this.progress.total))
      : 0;
    if (message !== undefined) this.progress.message = message;
    this.push();
  }

  message(text: string): void {
    this.progress.message = text;
    this.push();
  }

  complete(message = 'Selesai', result?: unknown): void {
    this.progress.status = 'completed';
    this.progress.progress = 1;
    this.progress.message = message;
    this.progress.finishedAt = new Date().toISOString();
    if (result !== undefined) (this.progress as JobProgress & { result?: unknown }).result = result;
    this.push();
  }

  fail(error: unknown): void {
    this.progress.status = 'failed';
    this.progress.error = error instanceof Error ? error.message : String(error);
    this.progress.message = this.progress.error;
    this.progress.finishedAt = new Date().toISOString();
    this.push();
    logger.error('job', `job failed: ${this.type}`, { id: this.id, error: this.progress.error });
  }

  cancel(message = 'Dibatalkan'): void {
    this.cancelled = true;
    this.progress.status = 'cancelled';
    this.progress.message = message;
    this.progress.finishedAt = new Date().toISOString();
    this.push();
    for (const hook of this.onCancelHooks) {
      try {
        hook();
      } catch {
        /* ignore */
      }
    }
  }

  onCancel(hook: () => void): void {
    this.onCancelHooks.push(hook);
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      const error = new Error('Operasi dibatalkan oleh pengguna.');
      error.name = 'AbortError';
      throw error;
    }
  }
}

class JobRegistry {
  private jobs = new Map<string, Job>();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit = (job: JobProgress): void => {
    for (const listener of this.listeners) listener(job);
  };

  create(type: string, total = 0): Job {
    const job = new Job(type, total, this.emit);
    this.jobs.set(job.id, job);
    if (this.jobs.size > 120) {
      const oldest = [...this.jobs.values()].find((entry) =>
        ['completed', 'failed', 'cancelled'].includes(entry.progress.status as JobStatus),
      );
      if (oldest) this.jobs.delete(oldest.id);
    }
    return job;
  }

  list(): JobProgress[] {
    return [...this.jobs.values()].map((job) => ({ ...job.progress })).reverse();
  }

  cancel(jobId: string): void {
    this.jobs.get(jobId)?.cancel();
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) {
      if (job.progress.status === 'running' || job.progress.status === 'queued') job.cancel();
    }
  }
}

export const jobs = new JobRegistry();
