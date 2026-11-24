/**
 * Shared domain types for the Document Scanner & PDF Editor.
 * These types are the contract between the Electron main process and the React renderer.
 */

export type AppLanguage = 'id' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

export type PaperSizeName =
  | 'A3'
  | 'A4'
  | 'A5'
  | 'Letter'
  | 'Legal'
  | 'Folio'
  | 'Original'
  | 'Custom';

export type ColorMode = 'color' | 'grayscale' | 'black-white';
export type BitDepth = '1' | '8' | '24';
export type ScanFormat = 'png' | 'jpg' | 'tiff';
export type PaperSource = 'feeder' | 'flatbed';
export type DriverKind = 'wia' | 'twain' | 'camera';

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export type FilterPreset =
  | 'original'
  | 'auto-enhance'
  | 'magic-color'
  | 'gray-mode'
  | 'black-white'
  | 'lighten'
  | 'darken'
  | 'sharpen'
  | 'ink-saving'
  | 'photo-mode';

export interface FilterConfig {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
  radius?: number;
  threshold?: number;
  adaptiveThreshold?: boolean;
  denoise?: number;
  gamma?: number;
  whiteBalance?: boolean;
  inkReduction?: number;
  colorBoost?: number;
  exposure?: number;
  grayscaleIntensity?: number;
  whitening?: number;
}

export interface FilterPreviewRequest {
  preset: FilterPreset;
  config: FilterConfig;
  imageDataUrl: string;
}

/* ------------------------------------------------------------------ */
/* Page pipeline                                                       */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}

/** Four normalized corners (0..1) in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export interface PageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  gamma: number;
  denoise: number;
  fingerMarks: number;
  whitening: number;
}

export type PageOperationType =
  | 'rotate'
  | 'crop'
  | 'perspective'
  | 'resize'
  | 'noise-reduction'
  | 'finger-marks'
  | 'enhance'
  | 'deskew';

export interface PageOperation {
  id: string;
  type: PageOperationType;
  params: Record<string, number | string | boolean>;
  createdAt: string;
}

export interface ResizeSpec {
  mode: 'pixel' | 'percent' | 'paper';
  width?: number;
  height?: number;
  percent?: number;
  paper?: PaperSizeName;
  dpi?: number;
  maintainAspect: boolean;
}

export interface PageRecipe {
  /** Rotation in degrees, multiples of 90 (0/90/180/270). */
  rotation: number;
  /** Normalized quad used for perspective correction / cropping of the original. */
  quad?: Quad | null;
  filter: FilterPreset;
  filterConfig: FilterConfig;
  adjustments: PageAdjustments;
  operations: PageOperation[];
  resize?: ResizeSpec | null;
}

export const DEFAULT_ADJUSTMENTS: PageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  gamma: 1,
  denoise: 0,
  fingerMarks: 0,
  whitening: 0,
};

export const DEFAULT_RECIPE: PageRecipe = {
  rotation: 0,
  quad: null,
  filter: 'original',
  filterConfig: {},
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  operations: [],
  resize: null,
};

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type DocumentStatus =
  | 'new'
  | 'unsaved'
  | 'saved'
  | 'processing'
  | 'exporting'
  | 'completed'
  | 'failed';

export type DocumentCategory =
  | 'scanned'
  | 'imported'
  | 'converted'
  | 'edited'
  | 'exported';

export type DocumentSourceType = 'scanner' | 'camera' | 'import' | 'pdf' | 'conversion';

export interface OcrSummary {
  language: string;
  confidence: number;
  textPreview: string;
  createdAt: string;
}

export interface DocumentPage {
  id: string;
  documentId: string;
  pageNumber: number;
  width: number;
  height: number;
  dpi: number;
  rotation: number;
  filterPreset: FilterPreset;
  filterConfig: FilterConfig;
  adjustments: PageAdjustments;
  operations: PageOperation[];
  recipe: PageRecipe;
  hasProcessed: boolean;
  isDirty: boolean;
  ocr?: OcrSummary | null;
  thumbnailDataUrl?: string | null;
  previewDataUrl?: string | null;
  createdAt: string;
}

export interface DocumentMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

export interface DocumentSummary {
  id: string;
  name: string;
  documentType: string;
  sourceType: DocumentSourceType;
  category: DocumentCategory;
  status: DocumentStatus;
  pageCount: number;
  sizeBytes: number;
  thumbnailDataUrl?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord extends DocumentSummary {
  pages: DocumentPage[];
  metadata: DocumentMetadata;
  sourcePath: string | null;
  notes: string;
}

export interface ActivityEntry {
  id: string;
  documentId: string;
  action: string;
  detail: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Scanner                                                             */
/* ------------------------------------------------------------------ */

export type ScannerStatus = 'ready' | 'busy' | 'offline' | 'unknown' | 'unsupported';

export interface ScannerDevice {
  id: string;
  name: string;
  driver: DriverKind;
  status: ScannerStatus;
  description: string;
  manufacturer: string;
  port: string;
  isDefault?: boolean;
}

export interface ScannerCapabilities {
  driver: DriverKind;
  minDpi: number;
  maxDpi: number;
  resolutions: number[];
  colorModes: ColorMode[];
  paperSizes: PaperSizeName[];
  paperSources: PaperSource[];
  duplex: boolean;
  feeder: boolean;
  flatbed: boolean;
  bitDepths: BitDepth[];
  brightnessRange: [number, number];
  contrastRange: [number, number];
  formats: ScanFormat[];
  notes: string[];
}

export interface ScanOptions {
  deviceId: string;
  driver: DriverKind;
  paperSource: PaperSource;
  duplex: boolean;
  paperSize: PaperSizeName;
  customSize?: { widthMm: number; heightMm: number };
  resolution: number;
  colorMode: ColorMode;
  bitDepth: BitDepth;
  brightness: number;
  contrast: number;
  format: ScanFormat;
  pageCountMode: 'single' | 'multiple' | 'batch';
  maxPages: number;
}

export interface ScanPageResult {
  index: number;
  width: number;
  height: number;
  dataUrl: string;
  path: string;
}

export interface ScanSessionResult {
  sessionId: string;
  pages: ScanPageResult[];
  warning?: string;
}

export interface ScanProfile {
  id: string;
  name: string;
  resolution: number;
  colorMode: ColorMode;
  paperSize: PaperSizeName;
  paperSource: PaperSource;
  duplex: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface AutoCaptureSettings {
  enabled: boolean;
  sensitivity: number;
  stabilityThreshold: number;
  captureDelayMs: number;
  blurThreshold: number;
  minDocumentSize: number;
  countdownMs: number;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

export interface PdfInfo {
  path: string;
  fileName: string;
  pageCount: number;
  fileSize: number;
  encrypted: boolean;
  metadata: PdfMetadata;
  pages: Array<{ index: number; width: number; height: number; rotation: number }>;
}

export interface PdfOpResult {
  jobId?: string;
  outputPath: string;
  outputPaths?: string[];
  outputSize: number;
  originalSize?: number;
  compressionRatio?: number;
  pageCount?: number;
  warnings?: string[];
  message?: string;
}

export type CompressionPreset = 'low' | 'recommended' | 'high' | 'extreme' | 'custom';

export interface CompressOptions {
  preset: CompressionPreset;
  imageQuality: number;
  dpi: number;
  grayscale: boolean;
  removeMetadata: boolean;
  downsample: boolean;
}

export interface ProtectPermissions {
  printing: boolean;
  editing: boolean;
  copying: boolean;
  extraction: boolean;
  annotation: boolean;
  formFilling: boolean;
  highQualityPrinting: boolean;
}

export interface ProtectOptions {
  userPassword?: string;
  ownerPassword?: string;
  permissions: ProtectPermissions;
}

export interface PageNumberOptions {
  position: 'top' | 'bottom';
  alignment: 'left' | 'center' | 'right';
  fontFamily: string;
  fontSize: number;
  color: string;
  startNumber: number;
  prefix: string;
  suffix: string;
  format: 'numeric' | 'page-of-total' | 'roman' | 'word';
  margin: number;
  pageRange: string;
  skipFirstPage: boolean;
}

export interface ImageToPdfOptions {
  pageSize: PaperSizeName;
  orientation: 'portrait' | 'landscape' | 'auto';
  margin: number;
  fit: 'contain' | 'cover' | 'original';
  quality: number;
  addPageNumbers: boolean;
  outputPath?: string;
}

export interface PdfRenderResult {
  dataUrl: string;
  width: number;
  height: number;
  pageCount: number;
}

export interface SplitRange {
  from: number;
  to: number;
}

export interface ConversionOptions {
  dpi: number;
  mode: 'text' | 'visual' | 'auto';
  password?: string;
  pageRange?: string;
  keepLayout: boolean;
}

/* ------------------------------------------------------------------ */
/* OCR                                                                 */
/* ------------------------------------------------------------------ */

export const OCR_LANGUAGES = [
  { code: 'ind', label: 'Indonesian' },
  { code: 'eng', label: 'English' },
  { code: 'ind+eng', label: 'Indonesian + English' },
] as const;

export interface OcrLanguageInfo {
  code: string;
  label: string;
  installed: boolean;
}

export interface OcrWord {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrPageResult {
  pageId: string;
  pageNumber: number;
  text: string;
  confidence: number;
  language: string;
  words: OcrWord[];
  durationMs: number;
}

export interface OcrDocumentResult {
  documentId: string;
  language: string;
  pages: OcrPageResult[];
  text: string;
  averageConfidence: number;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Printing                                                            */
/* ------------------------------------------------------------------ */

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
  options?: Record<string, string>;
}

export interface PrintOptions {
  documentId: string;
  printerName?: string;
  pageRange?: string;
  copies: number;
  paperSize: PaperSizeName;
  landscape: boolean;
  color: boolean;
  duplex: boolean;
  silent: boolean;
}

/* ------------------------------------------------------------------ */
/* Jobs & progress                                                     */
/* ------------------------------------------------------------------ */

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  jobId: string;
  type: string;
  status: JobStatus;
  progress: number;
  message: string;
  total?: number;
  current?: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface AppSettings {
  language: AppLanguage;
  theme: ThemeMode;
  defaultScannerId: string;
  defaultResolution: number;
  defaultPaperSize: PaperSizeName;
  defaultImageFormat: ScanFormat;
  defaultPdfQuality: 'low' | 'medium' | 'high' | 'maximum';
  documentsDirectory: string;
  outputDirectory: string;
  autoSave: boolean;
  autoSaveIntervalSec: number;
  backupEnabled: boolean;
  ocrLanguage: string;
  tempAutoCleanup: boolean;
  cacheLimitMb: number;
  hardwareAcceleration: boolean;
  processingConcurrency: number;
  libreOfficePath: string;
  twainBridgePath: string;
  cameraDeviceId: string;
  autoCapture: AutoCaptureSettings;
  sidebarCollapsed: boolean;
  lastDocumentId: string | null;
}

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
  dataDirectory: string;
  documentsDirectory: string;
  outputDirectory: string;
  libreOfficeDetected: boolean;
  libreOfficePath: string;
  twainBridgeDetected: boolean;
  scannerBackend: string;
  tessdataAvailable: boolean;
  totalDocuments: number;
  totalPages: number;
  diskFree?: number;
}

/* ------------------------------------------------------------------ */
/* Dialog & file helpers                                               */
/* ------------------------------------------------------------------ */

export interface OpenFilesOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiple?: boolean;
  defaultPath?: string;
}

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface ExportResult {
  path: string;
  size: number;
  pages: number;
  warnings: string[];
}

export interface PdfExportOptions {
  quality: 'low' | 'medium' | 'high' | 'maximum';
  imageFormat: 'jpg' | 'png';
  pageSize: PaperSizeName;
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: number;
  addPageNumbers: boolean;
  outputPath?: string;
  password?: string;
}

export interface DetectionResult {
  found: boolean;
  confidence: number;
  corners: Quad;
  areaRatio: number;
  brightness: number;
  blur: number;
  stability?: number;
}

/* ------------------------------------------------------------------ */
/* IPC API surface                                                     */
/* ------------------------------------------------------------------ */

export interface AppApi {
  app: {
    getInfo(): Promise<AppInfo>;
    setTheme(mode: ThemeMode): Promise<void>;
    openPath(target: string): Promise<string>;
    showItemInFolder(target: string): Promise<void>;
    onMenuAction(handler: (action: string) => void): () => void;
    onRequestClose(handler: () => void): () => void;
    confirmClose(): Promise<void>;
    dataDirectories(): Promise<{
      data: string;
      documents: string;
      output: string;
      backup: string;
      logs: string;
      temp: string;
    }>;
    dbIntegrityCheck(): Promise<{ ok: boolean; messages: string[] }>;
    cleanupTemp(): Promise<number>;
    backup(): Promise<boolean>;
  };
  settings: {
    get(): Promise<AppSettings>;
    update(patch: Partial<AppSettings>): Promise<AppSettings>;
    reset(): Promise<AppSettings>;
    chooseDirectory(kind: 'documents' | 'output'): Promise<string | null>;
  };
  documents: {
    list(query?: string): Promise<DocumentSummary[]>;
    create(input: { name?: string; category?: DocumentCategory }): Promise<DocumentRecord>;
    open(id: string): Promise<DocumentRecord>;
    save(id: string): Promise<DocumentRecord>;
    rename(id: string, name: string): Promise<DocumentSummary>;
    duplicate(id: string): Promise<DocumentSummary>;
    remove(id: string): Promise<void>;
    updateMetadata(id: string, metadata: Partial<DocumentMetadata>): Promise<DocumentRecord>;
    importFiles(paths: string[], targetDocumentId?: string): Promise<DocumentRecord>;
    pickAndImport(targetDocumentId?: string): Promise<DocumentRecord | null>;
    addPagesFromBuffer(
      documentId: string,
      pages: Array<{ dataUrl: string; sourcePage?: number }>,
      source?: DocumentSourceType,
    ): Promise<DocumentRecord>;
    addPagesFromScanner(documentId: string, options: ScanOptions): Promise<DocumentRecord>;
    deletePages(documentId: string, pageIds: string[]): Promise<DocumentRecord>;
    duplicatePage(documentId: string, pageId: string): Promise<DocumentRecord>;
    reorderPages(documentId: string, pageIds: string[]): Promise<DocumentRecord>;
    movePage(documentId: string, pageId: string, direction: 'up' | 'down' | 'first' | 'last'): Promise<DocumentRecord>;
    rotatePage(documentId: string, pageIds: string[], degrees: number): Promise<DocumentRecord>;
    applyFilter(documentId: string, pageIds: string[], preset: FilterPreset, config: FilterConfig): Promise<DocumentRecord>;
    updateAdjustments(documentId: string, pageIds: string[], adjustments: Partial<PageAdjustments>): Promise<DocumentRecord>;
    applyOperation(documentId: string, pageIds: string[], type: PageOperationType, params: Record<string, number | string | boolean>): Promise<DocumentRecord>;
    setCrop(documentId: string, pageId: string, quad: Quad | null): Promise<DocumentRecord>;
    resetPage(documentId: string, pageIds: string[]): Promise<DocumentRecord>;
    undoPage(documentId: string, pageId: string): Promise<DocumentRecord>;
    redoPage(documentId: string, pageId: string): Promise<DocumentRecord>;
    getPagePreview(documentId: string, pageId: string, options?: { processed?: boolean; maxWidth?: number; quality?: number }): Promise<string>;
    comparePreview(documentId: string, pageId: string, recipe: PageRecipe | null): Promise<{ before: string; after: string }>;
    exportPdf(documentId: string, options: PdfExportOptions): Promise<ExportResult | null>;
    importPdf(paths: string[], password?: string): Promise<DocumentRecord[]>;
    pickAndImportPdf(password?: string): Promise<DocumentRecord[] | null>;
    splitDocument(documentId: string, ranges: SplitRange[]): Promise<Array<{ path: string; pages: number }>>;
    mergeDocuments(documentIds: string[], name: string): Promise<DocumentSummary>;
    extractPages(documentId: string, pageIds: string[]): Promise<DocumentSummary>;
    activity(documentId: string): Promise<ActivityEntry[]>;
    recent(limit?: number): Promise<DocumentSummary[]>;
    stats(): Promise<{ documents: number; pages: number; scanned: number; converted: number; exportBytes: number }>;
  };
  scanner: {
    listDevices(): Promise<ScannerDevice[]>;
    capabilities(deviceId: string, driver: DriverKind): Promise<ScannerCapabilities>;
    scan(options: ScanOptions): Promise<ScanSessionResult>;
    cancel(): Promise<void>;
    profiles(): Promise<ScanProfile[]>;
    saveProfile(profile: Omit<ScanProfile, 'id' | 'createdAt'> & { id?: string }): Promise<ScanProfile[]>;
    deleteProfile(id: string): Promise<ScanProfile[]>;
  };
  pdf: {
    info(path: string, password?: string): Promise<PdfInfo>;
    pickFiles(): Promise<string[]>;
    render(path: string, options: { pageIndex: number; dpi?: number; password?: string; format?: 'png' | 'jpg' }): Promise<PdfRenderResult>;
    merge(paths: string[], outputPath?: string): Promise<PdfOpResult>;
    split(path: string, mode: 'every' | 'ranges' | 'interval' | 'selected', options: { ranges?: SplitRange[]; interval?: number; pages?: number[]; outputDir?: string }): Promise<PdfOpResult>;
    compress(path: string, options: CompressOptions, outputPath?: string): Promise<PdfOpResult>;
    rotate(path: string, pages: number[], degrees: number, outputPath?: string): Promise<PdfOpResult>;
    deletePages(path: string, pages: number[], outputPath?: string): Promise<PdfOpResult>;
    extract(path: string, pages: number[], outputPath?: string): Promise<PdfOpResult>;
    reorder(path: string, order: number[], outputPath?: string): Promise<PdfOpResult>;
    protect(path: string, options: ProtectOptions, outputPath?: string): Promise<PdfOpResult>;
    unlock(path: string, password: string, outputPath?: string): Promise<PdfOpResult>;
    addPageNumbers(path: string, options: PageNumberOptions, outputPath?: string): Promise<PdfOpResult>;
    updateMetadata(path: string, metadata: Partial<PdfMetadata>, outputPath?: string): Promise<PdfOpResult>;
    imagesToPdf(paths: string[], options: ImageToPdfOptions): Promise<PdfOpResult>;
    pdfToImages(path: string, options: { pages?: number[]; dpi: number; format: 'jpg' | 'png'; outputDir?: string }): Promise<PdfOpResult>;
    blankPages(path: string): Promise<number[]>;
  };
  office: {
    detect(): Promise<{ available: boolean; path: string; version?: string }>;
    toPdf(paths: string[], outputDir?: string): Promise<PdfOpResult[]>;
    pdfToWord(path: string, options: ConversionOptions): Promise<PdfOpResult>;
    pdfToExcel(path: string, options: ConversionOptions): Promise<PdfOpResult>;
    pdfToPpt(path: string, options: ConversionOptions): Promise<PdfOpResult>;
  };
  ocr: {
    languages(): Promise<OcrLanguageInfo[]>;
    document(documentId: string, pageIds: string[] | null, language: string): Promise<OcrDocumentResult>;
    page(documentId: string, pageId: string, language: string): Promise<OcrPageResult>;
    searchablePdf(documentId: string, language: string, outputPath?: string): Promise<PdfOpResult>;
    exportText(documentId: string, format: 'txt' | 'docx'): Promise<PdfOpResult | null>;
    results(documentId: string): Promise<OcrPageResult[]>;
  };
  print: {
    printers(): Promise<PrinterInfo[]>;
    pdf(path: string, options: PrintOptions): Promise<{ ok: boolean; message?: string }>;
    document(documentId: string, options: PrintOptions): Promise<{ ok: boolean; message?: string }>;
    preview(documentId: string): Promise<string>;
  };
  jobs: {
    list(): Promise<JobProgress[]>;
    cancel(jobId: string): Promise<void>;
    onProgress(handler: (progress: JobProgress) => void): () => void;
  };
  dialog: {
    openFiles(options: OpenFilesOptions): Promise<string[]>;
    saveFile(options: SaveFileOptions): Promise<string | null>;
    openDirectory(options?: { title?: string; defaultPath?: string }): Promise<string | null>;
  };
  images: {
    previewFilter(request: FilterPreviewRequest): Promise<string>;
    applyAdjustments(dataUrl: string, adjustments: Partial<PageAdjustments>): Promise<string>;
    detect(dataUrl: string, sensitivity?: number): Promise<DetectionResult>;
    warp(dataUrl: string, corners: Quad): Promise<{ dataUrl: string; width: number; height: number }>;
  };
}
