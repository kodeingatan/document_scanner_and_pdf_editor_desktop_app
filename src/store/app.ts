import { create } from 'zustand';
import type { AppInfo, AppSettings } from '@shared/types';
import { api, errorMessage } from '../lib/api';
import { useI18nStore } from '../i18n';

interface AppStore {
  settings: AppSettings | null;
  info: AppInfo | null;
  ready: boolean;
  init: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
  refreshInfo: () => Promise<void>;
}

function applyTheme(mode: AppSettings['theme']): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

export const useAppStore = create<AppStore>((set, get) => ({
  settings: null,
  info: null,
  ready: false,
  async init() {
    try {
      const [settings, info] = await Promise.all([api.settings.get(), api.app.getInfo()]);
      applyTheme(settings.theme);
      useI18nStore.getState().setLanguage(settings.language);
      set({ settings, info, ready: true });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const current = get().settings;
        if (current) applyTheme(current.theme);
      });
    } catch (error) {
      console.error('Failed to initialise app', errorMessage(error));
      set({ ready: true });
    }
  },
  async update(patch) {
    const next = await api.settings.update(patch);
    applyTheme(next.theme);
    useI18nStore.getState().setLanguage(next.language);
    set({ settings: next });
  },
  async reset() {
    const next = await api.settings.reset();
    applyTheme(next.theme);
    useI18nStore.getState().setLanguage(next.language);
    set({ settings: next });
  },
  async refreshInfo() {
    const info = await api.app.getInfo();
    set({ info });
  },
}));
