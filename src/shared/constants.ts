import type {
  ColorMode,
  FilterConfig,
  FilterPreset,
  PaperSizeName,
  ScanFormat,
} from './types';

export interface PaperSizeDef {
  key: PaperSizeName;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<PaperSizeName, PaperSizeDef> = {
  A3: { key: 'A3', label: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  A4: { key: 'A4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  A5: { key: 'A5', label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  Letter: { key: 'Letter', label: 'Letter (8.5 × 11 in)', widthMm: 215.9, heightMm: 279.4 },
  Legal: { key: 'Legal', label: 'Legal (8.5 × 14 in)', widthMm: 215.9, heightMm: 355.6 },
  Folio: { key: 'Folio', label: 'Folio (8.5 × 13 in)', widthMm: 215.9, heightMm: 330.2 },
  Original: { key: 'Original', label: 'Original image size', widthMm: 0, heightMm: 0 },
  Custom: { key: 'Custom', label: 'Custom size', widthMm: 210, heightMm: 297 },
};

export const PAPER_SIZE_OPTIONS: PaperSizeName[] = [
  'A3',
  'A4',
  'A5',
  'Letter',
  'Legal',
  'Folio',
  'Custom',
];

export const RESOLUTION_OPTIONS = [75, 100, 150, 200, 300, 400, 600, 800, 1200];

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  color: 'Color',
  grayscale: 'Grayscale',
  'black-white': 'Black & White',
};

export const SCAN_FORMAT_LABELS: Record<ScanFormat, string> = {
  png: 'PNG',
  jpg: 'JPG',
  tiff: 'TIFF',
};

export interface FilterPresetDef {
  id: FilterPreset;
  index: number;
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
  config: FilterConfig;
  params: Array<keyof FilterConfig>;
}

/**
 * The ten scan presets required by the PRD. Each preset carries a default
 * configuration that the user can tune; the renderer exposes the listed params.
 */
export const FILTER_PRESETS: FilterPresetDef[] = [
  {
    id: 'original',
    index: 1,
    labelId: 'Original',
    labelEn: 'Original',
    descriptionId: 'Tanpa enhancement, warna asli dokumen',
    descriptionEn: 'No enhancement, original document colors',
    config: {},
    params: [],
  },
  {
    id: 'auto-enhance',
    index: 2,
    labelId: 'Auto Enhance',
    labelEn: 'Auto Enhance',
    descriptionId: 'Koreksi otomatis warna, kontras, dan kecerahan',
    descriptionEn: 'Automatic color, contrast and brightness correction',
    config: { brightness: 4, contrast: 16, saturation: 6, sharpness: 18, whiteBalance: true },
    params: ['brightness', 'contrast', 'saturation', 'sharpness', 'whiteBalance'],
  },
  {
    id: 'magic-color',
    index: 3,
    labelId: 'Magic Color',
    labelEn: 'Magic Color',
    descriptionId: 'Meningkatkan warna dan kejernihan dokumen',
    descriptionEn: 'Boosts color vividness and document clarity',
    config: { colorBoost: 30, saturation: 18, contrast: 14, whiteBalance: true, whitening: 20 } as FilterConfig,
    params: ['colorBoost', 'saturation', 'contrast', 'whiteBalance'],
  },
  {
    id: 'gray-mode',
    index: 4,
    labelId: 'Gray Mode',
    labelEn: 'Gray Mode',
    descriptionId: 'Mengubah gambar menjadi grayscale',
    descriptionEn: 'Converts the image to grayscale',
    config: { grayscaleIntensity: 100, contrast: 8 },
    params: ['grayscaleIntensity', 'contrast', 'brightness'],
  },
  {
    id: 'black-white',
    index: 5,
    labelId: 'Black & White',
    labelEn: 'Black & White',
    descriptionId: 'Konversi hitam putih berbasis threshold',
    descriptionEn: 'Threshold based black and white conversion',
    config: { threshold: 160, adaptiveThreshold: true },
    params: ['threshold', 'adaptiveThreshold'],
  },
  {
    id: 'lighten',
    index: 6,
    labelId: 'Lighten',
    labelEn: 'Lighten',
    descriptionId: 'Mencerahkan dokumen',
    descriptionEn: 'Brightens the document',
    config: { brightness: 18, exposure: 12, contrast: -4 },
    params: ['brightness', 'exposure', 'contrast'],
  },
  {
    id: 'darken',
    index: 7,
    labelId: 'Darken',
    labelEn: 'Darken',
    descriptionId: 'Menggelapkan dokumen',
    descriptionEn: 'Darkens the document',
    config: { brightness: -18, contrast: 10 },
    params: ['brightness', 'contrast'],
  },
  {
    id: 'sharpen',
    index: 8,
    labelId: 'Sharpen',
    labelEn: 'Sharpen',
    descriptionId: 'Mempertajam teks dan garis',
    descriptionEn: 'Sharpens text and lines',
    config: { sharpness: 55, radius: 1, contrast: 6 },
    params: ['sharpness', 'radius', 'contrast'],
  },
  {
    id: 'ink-saving',
    index: 9,
    labelId: 'Ink Saving',
    labelEn: 'Ink Saving',
    descriptionId: 'Mengurangi penggunaan area tinta gelap',
    descriptionEn: 'Reduces dark ink coverage for printing',
    config: { threshold: 200, inkReduction: 45 },
    params: ['threshold', 'inkReduction'],
  },
  {
    id: 'photo-mode',
    index: 10,
    labelId: 'Photo Mode',
    labelEn: 'Photo Mode',
    descriptionId: 'Mempertahankan kualitas warna foto',
    descriptionEn: 'Preserves photographic color quality',
    config: { saturation: 8, sharpness: 14, contrast: 6 },
    params: ['saturation', 'sharpness', 'contrast'],
  },
];

export const FILTER_PRESET_MAP = FILTER_PRESETS.reduce<Record<string, FilterPresetDef>>(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {},
);

export const FILTER_LABELS: Record<FilterPreset, { id: string; en: string }> = FILTER_PRESETS.reduce(
  (acc, preset) => {
    acc[preset.id] = { id: preset.labelId, en: preset.labelEn };
    return acc;
  },
  {} as Record<FilterPreset, { id: string; en: string }>,
);

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'bmp', 'tif', 'tiff', 'webp'];

export const PDF_QUALITY_PRESETS = {
  low: { dpi: 96, quality: 45 },
  medium: { dpi: 144, quality: 68 },
  high: { dpi: 200, quality: 82 },
  maximum: { dpi: 300, quality: 94 },
} as const;

export const APP_NAME = 'Document Scanner & PDF Editor';
export const APP_SHORT_NAME = 'DocScanner';

export function mmToPixels(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

export function paperPixelSize(
  paper: PaperSizeName,
  dpi: number,
  orientation: 'portrait' | 'landscape' = 'portrait',
): { width: number; height: number } {
  const def = PAPER_SIZES[paper];
  const width = mmToPixels(def.widthMm || PAPER_SIZES.A4.widthMm, dpi);
  const height = mmToPixels(def.heightMm || PAPER_SIZES.A4.heightMm, dpi);
  return orientation === 'landscape' ? { width: height, height: width } : { width, height };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function toRoman(value: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = Math.max(1, Math.round(value));
  let out = '';
  for (const [number, numeral] of table) {
    while (rest >= number) {
      out += numeral;
      rest -= number;
    }
  }
  return out;
}

/** Parse a page-range string such as "1-3,5,8-" into zero-based page indexes. */
export function parsePageRange(input: string, pageCount: number): number[] {
  const result = new Set<number>();
  const trimmed = (input || '').trim();
  if (!trimmed) {
    for (let i = 0; i < pageCount; i += 1) result.add(i);
    return [...result];
  }
  for (const part of trimmed.split(',')) {
    const segment = part.trim();
    if (!segment) continue;
    const match = segment.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (match) {
      const start = Math.max(1, Number(match[1] ?? 1));
      const end = Math.min(pageCount, Number(match[2] ?? pageCount));
      for (let page = start; page <= end; page += 1) result.add(page - 1);
    } else {
      const page = Number(segment);
      if (Number.isFinite(page) && page >= 1 && page <= pageCount) result.add(page - 1);
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function pageRangeToLabel(pages: number[]): string {
  if (!pages.length) return '';
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const segments: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current !== previous + 1) {
      const from = start + 1;
      const to = previous + 1;
      segments.push(from === to ? `${from}` : `${from}-${to}`);
      start = current;
    }
    previous = current;
  }
  return segments.join(', ');
}
