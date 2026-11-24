import type { AppApi } from '@shared/types';

declare global {
  interface Window {
    api: AppApi;
  }
}

export const api: AppApi = window.api;

/** Electron prefixes rejected invokes; strip it so the UI shows a clean message. */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim() || 'Terjadi kesalahan yang tidak diketahui.';
}

export async function attempt<T>(operation: () => Promise<T>, onError?: (message: string) => void): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const message = errorMessage(error);
    onError?.(message);
    return null;
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
