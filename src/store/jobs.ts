import { create } from 'zustand';
import type { JobProgress } from '@shared/types';
import { api } from '../lib/api';

interface JobStore {
  jobs: JobProgress[];
  subscribe: () => () => void;
  refresh: () => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  subscribe() {
    const unsubscribe = api.jobs.onProgress((progress) => {
      set((state) => {
        const others = state.jobs.filter((job) => job.jobId !== progress.jobId);
        return { jobs: [progress, ...others].slice(0, 10) };
      });
    });
    void api.jobs.list().then((jobs) => set({ jobs: jobs.slice(0, 10) })).catch(() => undefined);
    return unsubscribe;
  },
  async refresh() {
    try {
      const jobs = await api.jobs.list();
      set({ jobs: jobs.slice(0, 10) });
    } catch {
      /* ignore */
    }
  },
  async cancel(jobId) {
    await api.jobs.cancel(jobId);
  },
}));
