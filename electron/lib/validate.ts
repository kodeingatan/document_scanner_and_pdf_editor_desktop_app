import { z } from 'zod';

const pointSchema = z.object({ x: z.number().min(-1).max(2), y: z.number().min(-1).max(2) });

export const quadSchema = z.tuple([pointSchema, pointSchema, pointSchema, pointSchema]);

const paperSizeSchema = z.enum(['A3', 'A4', 'A5', 'Letter', 'Legal', 'Folio', 'Original', 'Custom']);
const colorModeSchema = z.enum(['color', 'grayscale', 'black-white']);
export const filterPresetSchema = z.enum([
  'original',
  'auto-enhance',
  'magic-color',
  'gray-mode',
  'black-white',
  'lighten',
  'darken',
  'sharpen',
  'ink-saving',
  'photo-mode',
]);

export const filterConfigSchema = z
  .object({
    brightness: z.number().min(-100).max(100).optional(),
    contrast: z.number().min(-100).max(100).optional(),
    saturation: z.number().min(-100).max(200).optional(),
    sharpness: z.number().min(0).max(100).optional(),
    radius: z.number().min(1).max(20).optional(),
    threshold: z.number().min(0).max(255).optional(),
    adaptiveThreshold: z.boolean().optional(),
    denoise: z.number().min(0).max(100).optional(),
    gamma: z.number().min(0.05).max(5).optional(),
    whiteBalance: z.boolean().optional(),
    inkReduction: z.number().min(0).max(100).optional(),
    colorBoost: z.number().min(0).max(100).optional(),
    exposure: z.number().min(-100).max(100).optional(),
    grayscaleIntensity: z.number().min(0).max(100).optional(),
    whitening: z.number().min(0).max(100).optional(),
  })
  .strict();

export const adjustmentsSchema = z.object({
  brightness: z.number().min(-100).max(100).optional(),
  contrast: z.number().min(-100).max(100).optional(),
  saturation: z.number().min(-100).max(200).optional(),
  sharpness: z.number().min(0).max(100).optional(),
  gamma: z.number().min(0.05).max(5).optional(),
  denoise: z.number().min(0).max(100).optional(),
  fingerMarks: z.number().min(0).max(100).optional(),
  whitening: z.number().min(0).max(100).optional(),
});

export const resizeSpecSchema = z.object({
  mode: z.enum(['pixel', 'percent', 'paper']),
  width: z.number().int().min(16).max(20000).optional(),
  height: z.number().int().min(16).max(20000).optional(),
  percent: z.number().min(5).max(500).optional(),
  paper: paperSizeSchema.optional(),
  dpi: z.number().int().min(50).max(1200).optional(),
  maintainAspect: z.boolean(),
});

export const recipeSchema = z.object({
  rotation: z.number(),
  quad: quadSchema.nullable().optional(),
  filter: filterPresetSchema,
  filterConfig: filterConfigSchema,
  adjustments: z.object({
    brightness: z.number(),
    contrast: z.number(),
    saturation: z.number(),
    sharpness: z.number(),
    gamma: z.number(),
    denoise: z.number(),
    fingerMarks: z.number(),
    whitening: z.number(),
  }),
  operations: z.array(
    z.object({
      id: z.string().min(1).max(64),
      type: z.enum([
        'rotate',
        'crop',
        'perspective',
        'resize',
        'noise-reduction',
        'finger-marks',
        'enhance',
        'deskew',
      ]),
      params: z.record(z.union([z.number(), z.string(), z.boolean()])),
      createdAt: z.string(),
    }),
  ),
  resize: resizeSpecSchema.nullable().optional(),
});

export const idSchema = z.string().min(1).max(80);
export const idListSchema = z.array(idSchema).max(1000);
export const pathSchema = z.string().min(1).max(4096);

export const saveFileOptionsSchema = z.object({
  title: z.string().max(200).optional(),
  defaultPath: pathSchema.optional(),
  filters: z
    .array(z.object({ name: z.string().max(80), extensions: z.array(z.string().max(16)).max(30) }))
    .max(20)
    .optional(),
});

export const openFilesOptionsSchema = z.object({
  title: z.string().max(200).optional(),
  filters: saveFileOptionsSchema.shape.filters,
  multiple: z.boolean().optional(),
  defaultPath: pathSchema.optional(),
});

export const scanOptionsSchema = z.object({
  deviceId: z.string().min(1).max(400),
  driver: z.enum(['wia', 'twain', 'camera']),
  paperSource: z.enum(['feeder', 'flatbed']),
  duplex: z.boolean(),
  paperSize: paperSizeSchema,
  customSize: z
    .object({ widthMm: z.number().min(20).max(2000), heightMm: z.number().min(20).max(2000) })
    .optional(),
  resolution: z.number().int().min(75).max(1200),
  colorMode: colorModeSchema,
  bitDepth: z.enum(['1', '8', '24']),
  brightness: z.number().min(-100).max(100),
  contrast: z.number().min(-100).max(100),
  format: z.enum(['png', 'jpg', 'tiff']),
  pageCountMode: z.enum(['single', 'multiple', 'batch']),
  maxPages: z.number().int().min(1).max(500),
});

export const pdfExportOptionsSchema = z.object({
  quality: z.enum(['low', 'medium', 'high', 'maximum']),
  imageFormat: z.enum(['jpg', 'png']),
  pageSize: paperSizeSchema,
  orientation: z.enum(['auto', 'portrait', 'landscape']),
  margin: z.number().min(0).max(100),
  addPageNumbers: z.boolean(),
  outputPath: pathSchema.optional(),
  password: z.string().max(200).optional(),
});

export const compressOptionsSchema = z.object({
  preset: z.enum(['low', 'recommended', 'high', 'extreme', 'custom']),
  imageQuality: z.number().int().min(10).max(100),
  dpi: z.number().int().min(50).max(600),
  grayscale: z.boolean(),
  removeMetadata: z.boolean(),
  downsample: z.boolean(),
});

export const permissionsSchema = z.object({
  printing: z.boolean(),
  editing: z.boolean(),
  copying: z.boolean(),
  extraction: z.boolean(),
  annotation: z.boolean(),
  formFilling: z.boolean(),
  highQualityPrinting: z.boolean(),
});

export const protectOptionsSchema = z.object({
  userPassword: z.string().max(200).optional(),
  ownerPassword: z.string().max(200).optional(),
  permissions: permissionsSchema,
});

export const pageNumberOptionsSchema = z.object({
  position: z.enum(['top', 'bottom']),
  alignment: z.enum(['left', 'center', 'right']),
  fontFamily: z.string().max(80),
  fontSize: z.number().min(6).max(72),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  startNumber: z.number().int().min(1).max(100000),
  prefix: z.string().max(40),
  suffix: z.string().max(40),
  format: z.enum(['numeric', 'page-of-total', 'roman', 'word']),
  margin: z.number().min(0).max(200),
  pageRange: z.string().max(200),
  skipFirstPage: z.boolean(),
});

export const imageToPdfOptionsSchema = z.object({
  pageSize: paperSizeSchema,
  orientation: z.enum(['portrait', 'landscape', 'auto']),
  margin: z.number().min(0).max(100),
  fit: z.enum(['contain', 'cover', 'original']),
  quality: z.number().int().min(10).max(100),
  addPageNumbers: z.boolean(),
  outputPath: pathSchema.optional(),
});

export const conversionOptionsSchema = z.object({
  dpi: z.number().int().min(72).max(600),
  mode: z.enum(['text', 'visual', 'auto']),
  password: z.string().max(200).optional(),
  pageRange: z.string().max(200).optional(),
  keepLayout: z.boolean(),
});

export const splitRangeSchema = z.object({ from: z.number().int().min(1), to: z.number().int().min(1) });

export const printOptionsSchema = z.object({
  documentId: z.string().max(80),
  printerName: z.string().max(300).optional(),
  pageRange: z.string().max(200).optional(),
  copies: z.number().int().min(1).max(99),
  paperSize: paperSizeSchema,
  landscape: z.boolean(),
  color: z.boolean(),
  duplex: z.boolean(),
  silent: z.boolean(),
});

export const settingsPatchSchema = z
  .object({
    language: z.enum(['id', 'en']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    defaultScannerId: z.string().max(400).optional(),
    defaultResolution: z.number().int().min(75).max(1200).optional(),
    defaultPaperSize: paperSizeSchema.optional(),
    defaultImageFormat: z.enum(['png', 'jpg', 'tiff']).optional(),
    defaultPdfQuality: z.enum(['low', 'medium', 'high', 'maximum']).optional(),
    documentsDirectory: z.string().max(1024).optional(),
    outputDirectory: z.string().max(1024).optional(),
    autoSave: z.boolean().optional(),
    autoSaveIntervalSec: z.number().int().min(10).max(3600).optional(),
    backupEnabled: z.boolean().optional(),
    ocrLanguage: z.string().max(30).optional(),
    tempAutoCleanup: z.boolean().optional(),
    cacheLimitMb: z.number().int().min(64).max(100000).optional(),
    hardwareAcceleration: z.boolean().optional(),
    processingConcurrency: z.number().int().min(1).max(16).optional(),
    libreOfficePath: z.string().max(1024).optional(),
    twainBridgePath: z.string().max(1024).optional(),
    cameraDeviceId: z.string().max(400).optional(),
    autoCapture: z
      .object({
        enabled: z.boolean(),
        sensitivity: z.number().min(0).max(100),
        stabilityThreshold: z.number().min(0).max(100),
        captureDelayMs: z.number().int().min(0).max(10000),
        blurThreshold: z.number().min(0).max(1000),
        minDocumentSize: z.number().min(0).max(100),
        countdownMs: z.number().int().min(0).max(10000),
      })
      .optional(),
    sidebarCollapsed: z.boolean().optional(),
    lastDocumentId: z.string().max(80).nullable().optional(),
  })
  .strict();

export const pdfMetadataSchema = z
  .object({
    title: z.string().max(500).optional(),
    author: z.string().max(500).optional(),
    subject: z.string().max(500).optional(),
    keywords: z.string().max(2000).optional(),
    creator: z.string().max(500).optional(),
    producer: z.string().max(500).optional(),
    creationDate: z.string().max(80).optional(),
    modificationDate: z.string().max(80).optional(),
  })
  .strict();
