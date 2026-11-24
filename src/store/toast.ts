import { create } from 'zustand';

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info' | 'warning';
}

interface ToastStore {
  items: ToastItem[];
  push: (item: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (item) => {
    counter += 1;
    const id = counter;
    set((state) => ({ items: [...state.items, { ...item, id }] }));
    setTimeout(() => {
      set((state) => ({ items: state.items.filter((entry) => entry.id !== id) }));
    }, item.tone === 'error' ? 7000 : 4000);
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((entry) => entry.id !== id) })),
}));
