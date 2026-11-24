import { create } from 'zustand';
import type {
  DocumentRecord,
  DocumentSummary,
  FilterConfig,
  FilterPreset,
  PageAdjustments,
  PageOperationType,
  PageRecipe,
  Quad,
} from '@shared/types';
import { api, errorMessage } from '../lib/api';
import { useToastStore } from './toast';

interface DocumentStore {
  current: DocumentRecord | null;
  list: DocumentSummary[];
  selected: string[];
  activePageId: string | null;
  zoom: number;
  previews: Record<string, string>;
  compare: { before: string; after: string } | null;
  busy: boolean;
  loadingPreview: string | null;
  setCurrent: (record: DocumentRecord | null) => void;
  loadList: (query?: string) => Promise<void>;
  open: (id: string) => Promise<DocumentRecord | null>;
  create: (name?: string) => Promise<DocumentRecord | null>;
  refresh: () => Promise<void>;
  select: (pageId: string, mode?: 'single' | 'toggle' | 'range') => void;
  selectAll: () => void;
  clearSelection: () => void;
  setZoom: (zoom: number) => void;
  loadPreview: (pageId: string, maxWidth?: number) => Promise<string | null>;
  loadCompare: (recipe: PageRecipe | null) => Promise<void>;
  clearCompare: () => void;
  rotate: (degrees: number) => Promise<void>;
  applyFilter: (preset: FilterPreset, config: FilterConfig, scope: 'current' | 'selected' | 'all') => Promise<void>;
  adjust: (adjustments: Partial<PageAdjustments>) => Promise<void>;
  operation: (type: PageOperationType, params: Record<string, number | string | boolean>) => Promise<void>;
  setCrop: (quad: Quad | null) => Promise<void>;
  resetPage: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  duplicateActive: () => Promise<void>;
  moveActive: (direction: 'up' | 'down' | 'first' | 'last') => Promise<void>;
  reorder: (pageIds: string[]) => Promise<void>;
  save: () => Promise<void>;
  setCurrentKeepingPreview: (record: DocumentRecord, options?: { keepCompare?: boolean }) => void;
}

function toast(message: string, tone: 'success' | 'error' | 'info' = 'success') {
  useToastStore.getState().push({ title: message, tone });
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  current: null,
  list: [],
  selected: [],
  activePageId: null,
  zoom: 1,
  previews: {},
  compare: null,
  busy: false,
  loadingPreview: null,

  setCurrent(record) {
    const keep = record
      ? record.pages.find((page) => page.id === get().activePageId)?.id ?? record.pages[0]?.id ?? null
      : null;
    set({
      current: record,
      activePageId: keep,
      selected: keep ? [keep] : [],
      previews: {},
      zoom: 1,
      compare: null,
    });
    if (keep) void get().loadPreview(keep);
  },

  async loadList(query = '') {
    try {
      const list = await api.documents.list(query);
      set({ list });
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async open(id) {
    set({ busy: true });
    try {
      const record = await api.documents.open(id);
      get().setCurrent(record);
      void api.settings.update({ lastDocumentId: id });
      return record;
    } catch (error) {
      toast(errorMessage(error), 'error');
      return null;
    } finally {
      set({ busy: false });
    }
  },

  async create(name) {
    set({ busy: true });
    try {
      const record = await api.documents.create({ name });
      get().setCurrent(record);
      await get().loadList();
      return record;
    } catch (error) {
      toast(errorMessage(error), 'error');
      return null;
    } finally {
      set({ busy: false });
    }
  },

  async refresh() {
    const current = get().current;
    if (!current) return;
    try {
      const record = await api.documents.open(current.id);
      const previousActive = get().activePageId;
      const previews = get().previews;
      const stillExists = record.pages.some((page) => page.id === previousActive);
      set({
        current: record,
        activePageId: stillExists ? previousActive : record.pages[0]?.id ?? null,
        selected: get().selected.filter((id) => record.pages.some((page) => page.id === id)),
        previews: Object.fromEntries(
          Object.entries(previews).filter(([pageId]) => record.pages.some((page) => page.id === pageId)),
        ),
      });
      const active = get().activePageId;
      if (active) await get().loadPreview(active);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  select(pageId, mode = 'single') {
    const { selected } = get();
    if (mode === 'toggle') {
      set({
        selected: selected.includes(pageId) ? selected.filter((id) => id !== pageId) : [...selected, pageId],
        activePageId: pageId,
      });
    } else {
      set({ selected: [pageId], activePageId: pageId });
    }
    void get().loadPreview(pageId);
  },

  selectAll() {
    const pages = get().current?.pages ?? [];
    set({ selected: pages.map((page) => page.id) });
  },

  clearSelection() {
    set({ selected: [], compare: null });
  },

  setZoom(zoom) {
    set({ zoom: Math.max(0.25, Math.min(4, Number(zoom.toFixed(2)))) });
  },

  async loadPreview(pageId, maxWidth = 1500) {
    const current = get().current;
    if (!current) return null;
    set({ loadingPreview: pageId });
    try {
      const dataUrl = await api.documents.getPagePreview(current.id, pageId, { maxWidth });
      set((state) => ({ previews: { ...state.previews, [pageId]: dataUrl } }));
      return dataUrl;
    } catch (error) {
      toast(errorMessage(error), 'error');
      return null;
    } finally {
      set((state) => (state.loadingPreview === pageId ? { loadingPreview: null } : {}));
    }
  },

  async loadCompare(recipe) {
    const current = get().current;
    const pageId = get().activePageId;
    if (!current || !pageId) return;
    try {
      const result = await api.documents.comparePreview(current.id, pageId, recipe);
      set({ compare: result });
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  clearCompare() {
    set({ compare: null });
  },

  async rotate(degrees) {
    const { current, selected } = get();
    if (!current || !selected.length) return;
    set({ busy: true });
    try {
      const record = await api.documents.rotatePage(current.id, selected, degrees);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      set({ busy: false });
    }
  },

  async applyFilter(preset, config, scope) {
    const { current, selected, activePageId } = get();
    if (!current) return;
    const targets =
      scope === 'all'
        ? current.pages.map((page) => page.id)
        : scope === 'current'
          ? activePageId
            ? [activePageId]
            : []
          : selected;
    if (!targets.length) {
      toast('Pilih halaman terlebih dahulu', 'error');
      return;
    }
    set({ busy: true });
    try {
      const record = await api.documents.applyFilter(current.id, targets, preset, config);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      set({ busy: false });
    }
  },

  async adjust(adjustments) {
    const { current, activePageId } = get();
    if (!current || !activePageId) return;
    set({ busy: true });
    try {
      const record = await api.documents.updateAdjustments(current.id, [activePageId], adjustments);
      get().setCurrentKeepingPreview(record, { keepCompare: true });
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      set({ busy: false });
    }
  },

  async operation(type, params) {
    const { current, selected } = get();
    if (!current || !selected.length) return;
    set({ busy: true });
    try {
      const record = await api.documents.applyOperation(current.id, selected, type, params);
      get().setCurrentKeepingPreview(record);
      toast('Operasi diterapkan');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      set({ busy: false });
    }
  },

  async setCrop(quad) {
    const { current, activePageId } = get();
    if (!current || !activePageId) return;
    set({ busy: true });
    try {
      const record = await api.documents.setCrop(current.id, activePageId, quad);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      set({ busy: false });
    }
  },

  async resetPage() {
    const { current, selected } = get();
    if (!current || !selected.length) return;
    set({ busy: true });
    try {
      const record = await api.documents.resetPage(current.id, selected);
      get().setCurrentKeepingPreview(record);
      toast('Halaman direset ke original');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      set({ busy: false });
    }
  },

  async undo() {
    const { current, activePageId } = get();
    if (!current || !activePageId) return;
    try {
      const record = await api.documents.undoPage(current.id, activePageId);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async redo() {
    const { current, activePageId } = get();
    if (!current || !activePageId) return;
    try {
      const record = await api.documents.redoPage(current.id, activePageId);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async deleteSelected() {
    const { current, selected } = get();
    if (!current || !selected.length) return;
    try {
      const record = await api.documents.deletePages(current.id, selected);
      get().setCurrent(record);
      await get().loadList();
      toast('Halaman dihapus');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async duplicateActive() {
    const { current, activePageId } = get();
    if (!current || !activePageId) return;
    try {
      const record = await api.documents.duplicatePage(current.id, activePageId);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async moveActive(direction) {
    const { current, activePageId } = get();
    if (!current || !activePageId) return;
    try {
      const record = await api.documents.movePage(current.id, activePageId, direction);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async reorder(pageIds) {
    const current = get().current;
    if (!current) return;
    try {
      const record = await api.documents.reorderPages(current.id, pageIds);
      get().setCurrentKeepingPreview(record);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  async save() {
    const current = get().current;
    if (!current) return;
    try {
      const record = await api.documents.save(current.id);
      set({ current: record });
      await get().loadList();
      toast('Dokumen disimpan');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  },

  setCurrentKeepingPreview(record, options = {}) {
    const activeId = get().activePageId;
    const nextActive = record.pages.some((page) => page.id === activeId)
      ? activeId
      : record.pages[0]?.id ?? null;
    set({
      current: record,
      activePageId: nextActive,
      selected: get().selected.filter((id) => record.pages.some((page) => page.id === id)),
      previews: {},
      compare: options.keepCompare ? get().compare : null,
    });
    if (nextActive) void get().loadPreview(nextActive);
  },
}));
