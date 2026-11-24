import { contextBridge, ipcRenderer } from 'electron';
import type { AppApi } from '../src/shared/types';

/** Only explicit, validated channels cross the bridge (PRD §9.5). */
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: AppApi = {
  app: {
    getInfo: () => invoke('app:info'),
    setTheme: (mode) => invoke('app:set-theme', mode),
    openPath: (target) => invoke('app:open-path', target),
    showItemInFolder: (target) => invoke('app:show-item', target),
    onMenuAction: (handler) => subscribe('app:menu-action', handler),
    onRequestClose: (handler) => subscribe('app:request-close', handler),
    confirmClose: () => invoke('app:confirm-close'),
    dataDirectories: () => invoke('app:data-directories'),
    dbIntegrityCheck: () => invoke('app:db-integrity'),
    cleanupTemp: () => invoke('app:cleanup-temp'),
    backup: () => invoke('app:backup'),
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (patch) => invoke('settings:update', patch),
    reset: () => invoke('settings:reset'),
    chooseDirectory: (kind) => invoke('settings:choose-directory', kind),
  },
  documents: {
    list: (query) => invoke('documents:list', query ?? ''),
    create: (input) => invoke('documents:create', input),
    open: (id) => invoke('documents:open', id),
    save: (id) => invoke('documents:save', id),
    rename: (id, name) => invoke('documents:rename', id, name),
    duplicate: (id) => invoke('documents:duplicate', id),
    remove: (id) => invoke('documents:remove', id),
    updateMetadata: (id, metadata) => invoke('documents:update-metadata', id, metadata),
    importFiles: (paths, targetId) => invoke('documents:import-files', paths, targetId),
    pickAndImport: (targetId) => invoke('documents:pick-import', targetId),
    addPagesFromBuffer: (documentId, pages, source) =>
      invoke('documents:add-buffer', documentId, pages, source),
    addPagesFromScanner: (documentId, options) => invoke('documents:add-scanner', documentId, options),
    deletePages: (documentId, pageIds) => invoke('documents:delete-pages', documentId, pageIds),
    duplicatePage: (documentId, pageId) => invoke('documents:duplicate-page', documentId, pageId),
    reorderPages: (documentId, pageIds) => invoke('documents:reorder', documentId, pageIds),
    movePage: (documentId, pageId, direction) => invoke('documents:move-page', documentId, pageId, direction),
    rotatePage: (documentId, pageIds, degrees) => invoke('documents:rotate', documentId, pageIds, degrees),
    applyFilter: (documentId, pageIds, preset, config) =>
      invoke('documents:filter', documentId, pageIds, preset, config),
    updateAdjustments: (documentId, pageIds, adjustments) =>
      invoke('documents:adjust', documentId, pageIds, adjustments),
    applyOperation: (documentId, pageIds, type, params) =>
      invoke('documents:operation', documentId, pageIds, type, params),
    setCrop: (documentId, pageId, quad) => invoke('documents:set-crop', documentId, pageId, quad),
    resetPage: (documentId, pageIds) => invoke('documents:reset', documentId, pageIds),
    undoPage: (documentId, pageId) => invoke('documents:undo', documentId, pageId),
    redoPage: (documentId, pageId) => invoke('documents:redo', documentId, pageId),
    getPagePreview: (documentId, pageId, options) =>
      invoke('documents:preview', documentId, pageId, options),
    comparePreview: (documentId, pageId, recipe) => invoke('documents:compare', documentId, pageId, recipe),
    exportPdf: (documentId, options) => invoke('documents:export-pdf', documentId, options),
    importPdf: (paths, password) => invoke('documents:import-pdf', paths, password),
    pickAndImportPdf: (password) => invoke('documents:pick-import-pdf', password),
    splitDocument: (documentId, ranges) => invoke('documents:split', documentId, ranges),
    mergeDocuments: (documentIds, name) => invoke('documents:merge', documentIds, name),
    extractPages: (documentId, pageIds) => invoke('documents:extract', documentId, pageIds),
    activity: (documentId) => invoke('documents:activity', documentId),
    recent: (limit) => invoke('documents:recent', limit ?? 8),
    stats: () => invoke('documents:stats'),
  },
  scanner: {
    listDevices: () => invoke('scanner:devices'),
    capabilities: (deviceId, driver) => invoke('scanner:capabilities', deviceId, driver),
    scan: (options) => invoke('scanner:scan', options),
    cancel: () => invoke('scanner:cancel'),
    profiles: () => invoke('scanner:profiles'),
    saveProfile: (profile) => invoke('scanner:save-profile', profile),
    deleteProfile: (id) => invoke('scanner:delete-profile', id),
  },
  pdf: {
    info: (filePath, password) => invoke('pdf:info', filePath, password),
    pickFiles: () => invoke('pdf:pick-files'),
    render: (filePath, options) => invoke('pdf:render', filePath, options),
    merge: (paths, outputPath) => invoke('pdf:merge', paths, outputPath),
    split: (filePath, mode, options) => invoke('pdf:split', filePath, mode, options),
    compress: (filePath, options, outputPath) => invoke('pdf:compress', filePath, options, outputPath),
    rotate: (filePath, pages, degrees, outputPath) => invoke('pdf:rotate', filePath, pages, degrees, outputPath),
    deletePages: (filePath, pages, outputPath) => invoke('pdf:delete-pages', filePath, pages, outputPath),
    extract: (filePath, pages, outputPath) => invoke('pdf:extract', filePath, pages, outputPath),
    reorder: (filePath, order, outputPath) => invoke('pdf:reorder', filePath, order, outputPath),
    protect: (filePath, options, outputPath) => invoke('pdf:protect', filePath, options, outputPath),
    unlock: (filePath, password, outputPath) => invoke('pdf:unlock', filePath, password, outputPath),
    addPageNumbers: (filePath, options, outputPath) => invoke('pdf:page-numbers', filePath, options, outputPath),
    updateMetadata: (filePath, metadata, outputPath) => invoke('pdf:metadata', filePath, metadata, outputPath),
    imagesToPdf: (paths, options) => invoke('pdf:images-to-pdf', paths, options),
    pdfToImages: (filePath, options) => invoke('pdf:to-images', filePath, options),
    blankPages: (filePath) => invoke('pdf:blank-pages', filePath),
  },
  office: {
    detect: () => invoke('office:detect'),
    toPdf: (paths, outputDir) => invoke('office:to-pdf', paths, outputDir),
    pdfToWord: (filePath, options) => invoke('office:pdf-to-word', filePath, options),
    pdfToExcel: (filePath, options) => invoke('office:pdf-to-excel', filePath, options),
    pdfToPpt: (filePath, options) => invoke('office:pdf-to-ppt', filePath, options),
  },
  ocr: {
    languages: () => invoke('ocr:languages'),
    document: (documentId, pageIds, language) => invoke('ocr:document', documentId, pageIds, language),
    page: (documentId, pageId, language) => invoke('ocr:page', documentId, pageId, language),
    searchablePdf: (documentId, language, outputPath) =>
      invoke('ocr:searchable-pdf', documentId, language, outputPath),
    exportText: (documentId, format) => invoke('ocr:export-text', documentId, format),
    results: (documentId) => invoke('ocr:results', documentId),
  },
  print: {
    printers: () => invoke('print:printers'),
    pdf: (filePath, options) => invoke('print:pdf', filePath, options),
    document: (documentId, options) => invoke('print:document', documentId, options),
    preview: (documentId) => invoke('print:preview', documentId),
  },
  jobs: {
    list: () => invoke('jobs:list'),
    cancel: (jobId) => invoke('jobs:cancel', jobId),
    onProgress: (handler) => subscribe('jobs:progress', handler),
  },
  dialog: {
    openFiles: (options) => invoke('dialog:open-files', options),
    saveFile: (options) => invoke('dialog:save-file', options),
    openDirectory: (options) => invoke('dialog:open-directory', options ?? {}),
  },
  images: {
    previewFilter: (request) => invoke('images:preview-filter', request),
    applyAdjustments: (dataUrl, adjustments) => invoke('settings:apply-adjustments-preview', dataUrl, adjustments),
    detect: (dataUrl, sensitivity) => invoke('images:detect', dataUrl, sensitivity ?? 55),
    warp: (dataUrl, corners) => invoke('images:warp', dataUrl, corners),
  },
};

contextBridge.exposeInMainWorld('api', api);
