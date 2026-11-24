import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Crop,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Layers,
  Maximize2,
  Minus,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import type {
  DocumentPage,
  FilterConfig,
  FilterPreset,
  PageAdjustments,
  PdfExportOptions,
  PrintOptions,
  Quad,
  ScannerCapabilities,
} from '@shared/types';
import { DEFAULT_ADJUSTMENTS } from '@shared/types';
import { FILTER_PRESETS, PAPER_SIZE_OPTIONS, formatBytes } from '@shared/constants';
import { api, errorMessage } from '../lib/api';
import { useDocumentStore } from '../store/documents';
import { useToastStore } from '../store/toast';
import { useT } from '../i18n';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionTitle,
  Segmented,
  Select,
  Slider,
  Spinner,
  Switch,
} from '../components/ui';
import { CropOverlay, FULL_QUAD } from '../components/CropOverlay';

const PARAM_RANGES: Record<string, { min: number; max: number; step?: number }> = {
  brightness: { min: -100, max: 100 },
  contrast: { min: -100, max: 100 },
  saturation: { min: -100, max: 100 },
  sharpness: { min: 0, max: 100 },
  radius: { min: 0.5, max: 5, step: 0.5 },
  threshold: { min: 0, max: 255 },
  denoise: { min: 0, max: 100 },
  gamma: { min: 0.4, max: 2.4, step: 0.05 },
  inkReduction: { min: 0, max: 100 },
  colorBoost: { min: 0, max: 100 },
  exposure: { min: -50, max: 50 },
  grayscaleIntensity: { min: 0, max: 100 },
  whitening: { min: 0, max: 100 },
};

const EXPORT_DEFAULTS: PdfExportOptions = {
  quality: 'high',
  imageFormat: 'jpg',
  pageSize: 'A4',
  orientation: 'auto',
  margin: 0,
  addPageNumbers: false,
};

export default function WorkspacePage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToastStore((state) => state.push);

  const current = useDocumentStore((state) => state.current);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const selected = useDocumentStore((state) => state.selected);
  const previews = useDocumentStore((state) => state.previews);
  const zoom = useDocumentStore((state) => state.zoom);
  const busy = useDocumentStore((state) => state.busy);
  const loadingPreview = useDocumentStore((state) => state.loadingPreview);
  const compare = useDocumentStore((state) => state.compare);

  const store = useDocumentStore.getState;
  const activePage = current?.pages.find((page) => page.id === activePageId) ?? null;
  const preview = activePageId ? previews[activePageId] : null;

  const [preset, setPreset] = React.useState<FilterPreset>('original');
  const [filterConfig, setFilterConfig] = React.useState<FilterConfig>({});
  const [scope, setScope] = React.useState<'current' | 'selected' | 'all'>('current');
  const [adjustments, setAdjustments] = React.useState<PageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [panel, setPanel] = React.useState<'filter' | 'pages'>('filter');

  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState('');
  const [cropQuad, setCropQuad] = React.useState<Quad>(FULL_QUAD);
  const [cropLoading, setCropLoading] = React.useState(false);

  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportOptions, setExportOptions] = React.useState<PdfExportOptions>(EXPORT_DEFAULTS);
  const [exportName, setExportName] = React.useState('');
  const [exportDir, setExportDir] = React.useState('');
  const [exporting, setExporting] = React.useState(false);

  const canvasRef = React.useRef<HTMLDivElement>(null);
  const panRef = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = React.useState(false);

  const [printOpen, setPrintOpen] = React.useState(false);
  const [printers, setPrinters] = React.useState<Array<{ name: string; displayName: string; isDefault: boolean }>>([]);
  const [printOptions, setPrintOptions] = React.useState<Omit<PrintOptions, 'documentId'>>({
    copies: 1,
    paperSize: 'A4',
    landscape: false,
    color: true,
    duplex: false,
    silent: false,
    pageRange: '',
  });
  const [printing, setPrinting] = React.useState(false);

  const [metaOpen, setMetaOpen] = React.useState(false);
  const [metaForm, setMetaForm] = React.useState({ title: '', author: '', subject: '', keywords: '' });

  const openExport = React.useCallback(() => setExportOpen(true), []);

  const chooseExportDir = async () => {
    try {
      const dir = await api.dialog.openDirectory({
        title: 'Pilih folder penyimpanan PDF',
        defaultPath: exportDir || undefined,
      });
      if (dir) setExportDir(dir);
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  React.useEffect(() => {
    if (!current) return;
    void store().loadList();
  }, [current, store]);

  React.useEffect(() => {
    if (!activePage) return;
    setPreset(activePage.filterPreset);
    setFilterConfig(activePage.filterConfig ?? {});
    setAdjustments({ ...DEFAULT_ADJUSTMENTS, ...activePage.adjustments });
  }, [activePage?.id]);

  React.useEffect(() => {
    const handler = () => openExport();
    window.addEventListener('docscan:export', handler);
    return () => window.removeEventListener('docscan:export', handler);
  }, [openExport]);

  // Suggest a file name and the app output folder whenever the export dialog opens.
  React.useEffect(() => {
    if (!exportOpen) return;
    setExportName(`${current?.name ?? 'dokumen'}.pdf`);
    void api.app
      .dataDirectories()
      .then((directories) => setExportDir(directories.output))
      .catch(() => undefined);
  }, [exportOpen, current?.name]);

  // Ctrl + wheel zooms the canvas around the pointer and keeps the same spot in view.
  React.useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const state = useDocumentStore.getState();
      if (state.compare || !state.current) return;
      const next = Math.max(0.25, Math.min(4, Number((state.zoom * (event.deltaY < 0 ? 1.1 : 0.9)).toFixed(2))));
      if (next === state.zoom) return;
      const rect = container.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const ratio = next / state.zoom;
      state.setZoom(next);
      requestAnimationFrame(() => {
        container.scrollLeft = (container.scrollLeft + offsetX) * ratio - offsetX;
        container.scrollTop = (container.scrollTop + offsetY) * ratio - offsetY;
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [current?.id]);

  React.useEffect(() => {
    if (!printOpen) return;
    api.print
      .printers()
      .then((list) => {
        setPrinters(list);
        setPrintOptions((state) => ({ ...state, printerName: state.printerName ?? list.find((item) => item.isDefault)?.name }));
      })
      .catch((error) => toast({ title: errorMessage(error), tone: 'error' }));
  }, [printOpen, toast]);

  const presetDef = FILTER_PRESETS.find((entry) => entry.id === preset) ?? FILTER_PRESETS[0];

  const openCrop = async () => {
    if (!current || !activePage) return;
    setCropLoading(true);
    setCropOpen(true);
    try {
      const src = await api.documents.getPagePreview(current.id, activePage.id, {
        processed: false,
        maxWidth: 1400,
      });
      setCropSrc(src);
      setCropQuad(activePage.recipe?.quad ?? FULL_QUAD);
    } catch (error) {
      setCropOpen(false);
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setCropLoading(false);
    }
  };

  const applyCrop = async () => {
    await store().setCrop(cropQuad);
    setCropOpen(false);
  };

  const runExport = async () => {
    if (!current) return;
    const baseName = (exportName.trim() || current.name)
      .replace(/\.pdf$/i, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .trim();
    if (!baseName) {
      toast({ title: 'Nama file tidak valid', tone: 'error' });
      return;
    }
    const folder = exportDir.trim().replace(/[\\/]+$/, '');
    const outputPath = folder ? `${folder}\\${baseName}.pdf` : undefined;
    setExporting(true);
    try {
      const result = await api.documents.exportPdf(current.id, { ...exportOptions, outputPath });
      if (result) {
        toast({ title: `PDF diekspor: ${result.path}`, tone: 'success' });
        setExportOpen(false);
        void api.app.showItemInFolder(result.path).catch(() => undefined);
      }
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const runPrint = async () => {
    if (!current) return;
    setPrinting(true);
    try {
      const result = await api.print.document(current.id, { ...printOptions, documentId: current.id });
      if (result.ok) {
        toast({ title: result.message ?? 'Dokumen dikirim ke printer', tone: 'success' });
        setPrintOpen(false);
      } else {
        toast({ title: result.message ?? 'Cetak dibatalkan', tone: 'info' });
      }
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setPrinting(false);
    }
  };

  const moveThumbnail = (from: number, to: number) => {
    if (!current || from === to) return;
    const ids = current.pages.map((page) => page.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    void store().reorder(ids);
  };

  const setNumericParam = (key: keyof FilterConfig, value: number) =>
    setFilterConfig((state) => ({ ...state, [key]: value }));

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = event.currentTarget;
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: container.scrollLeft,
      top: container.scrollTop,
    };
    container.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panRef.current;
    if (!start) return;
    const container = event.currentTarget;
    container.scrollLeft = start.left - (event.clientX - start.x);
    container.scrollTop = start.top - (event.clientY - start.y);
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    panRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const numericKeys = (presetDef.params as Array<keyof FilterConfig>).filter(
    (key) => key !== 'adaptiveThreshold' && key !== 'whiteBalance',
  );

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={FileText}
          title="Belum ada dokumen aktif"
          description="Pindai dokumen baru, impor file, atau buka dokumen dari library untuk mulai mengedit."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => navigate('/scanner')}>
                {t('home.quickScan')}
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const record = await store().create();
                  if (record) navigate('/workspace');
                }}
              >
                {t('common.new')}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-[var(--hairline)] px-3">
        <div className="flex items-center gap-1">
          <IconButton icon={Undo2} label={`${t('common.undo')} (Ctrl+Z)`} onClick={() => void store().undo()} />
          <IconButton icon={Redo2} label={`${t('common.redo')} (Ctrl+Y)`} onClick={() => void store().redo()} />
          <span className="mx-1 h-5 w-px bg-[var(--hairline)]" />
          <IconButton icon={RotateCcw} label="Rotasi kiri" onClick={() => void store().rotate(-90)} />
          <IconButton icon={RotateCw} label="Rotasi kanan" onClick={() => void store().rotate(90)} />
          <IconButton icon={Crop} label={t('workspace.crop')} onClick={() => void openCrop()} />
          <IconButton icon={Copy} label={t('common.duplicate')} onClick={() => void store().duplicateActive()} />
          <IconButton icon={Trash2} label={t('common.delete')} onClick={() => void store().deleteSelected()} />
          <span className="mx-1 h-5 w-px bg-[var(--hairline)]" />
          <IconButton icon={Minus} label={t('common.zoomOut')} onClick={() => store().setZoom(zoom - 0.15)} />
          <span className="w-[42px] text-center font-mono text-[11px] text-[var(--muted)]">{Math.round(zoom * 100)}%</span>
          <IconButton icon={Plus} label={t('common.zoomIn')} onClick={() => store().setZoom(zoom + 0.15)} />
          <IconButton icon={Maximize2} label={t('common.fit')} onClick={() => store().setZoom(1)} />
          <IconButton icon={Eye} label={t('workspace.compare')} onClick={() => void store().loadCompare(null)} />
        </div>
        <div className="flex items-center gap-2">
          {busy || loadingPreview ? (
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <Spinner size={11} /> {t('common.processing')}
            </span>
          ) : null}
          <Button size="sm" variant="ghost" icon={Save} onClick={() => void store().save()}>
            {t('common.save')}
          </Button>
          <Button size="sm" variant="secondary" icon={Printer} onClick={() => setPrintOpen(true)}>
            {t('common.print')}
          </Button>
          <Button size="sm" variant="primary" icon={Download} onClick={openExport}>
            {t('common.export')}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Thumbnails */}
        <aside className="flex w-[148px] shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--surface-soft)]">
          <div className="flex h-8 items-center justify-between px-2.5 text-[10.5px] text-[var(--muted)]">
            <span>{current.pages.length} {t('common.pages')}</span>
            <button className="focus-ring rounded px-1 hover:text-[var(--ink)]" onClick={() => store().selectAll()}>
              Semua
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-3">
            {current.pages.map((page, index) => (
              <div
                key={page.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveThumbnail(Number(event.dataTransfer.getData('text/plain')), index);
                }}
                onClick={(event) => store().select(page.id, event.ctrlKey ? 'toggle' : 'single')}
                className={`cursor-pointer rounded-md border p-1 transition-colors ${
                  page.id === activePageId
                    ? 'border-[var(--ink)] bg-[var(--canvas)]'
                    : selected.includes(page.id)
                      ? 'border-[var(--muted)] bg-[var(--canvas)]'
                      : 'border-[var(--hairline)] bg-[var(--canvas)]/60 hover:border-[var(--muted)]'
                }`}
              >
                <div className="flex h-[150px] items-center justify-center overflow-hidden rounded bg-[var(--surface-soft)]">
                  {previews[page.id] ? (
                    <img src={previews[page.id]} alt={`Halaman ${page.pageNumber}`} className="h-full w-full object-contain" />
                  ) : (
                    <FileText size={16} className="text-[var(--muted-soft)]" />
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between px-0.5 text-[10px] text-[var(--muted)]">
                  <span>#{page.pageNumber}</span>
                  <span>{page.filterPreset === 'original' ? 'orig' : page.filterPreset.replace('-', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-soft)]">
          <div
            ref={canvasRef}
            className={`min-h-0 flex-1 overflow-auto p-6 ${
              !compare && preview ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''
            } ${!compare && preview ? 'select-none' : ''}`}
            onPointerDown={!compare && preview ? startPan : undefined}
            onPointerMove={!compare && preview ? movePan : undefined}
            onPointerUp={!compare && preview ? endPan : undefined}
            onPointerCancel={!compare && preview ? endPan : undefined}
          >
            {compare ? (
              <div className="mx-auto flex max-w-[1000px] gap-3">
                {[
                  { label: t('editor.before'), src: compare.before },
                  { label: t('editor.after'), src: compare.after },
                ].map((item) => (
                  <div key={item.label} className="flex-1">
                    <p className="mb-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      {item.label}
                    </p>
                    <div className="flex justify-center rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] p-2">
                      <img src={item.src} alt={item.label} className="max-h-[62vh] w-auto object-contain" />
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="self-start" onClick={() => store().clearCompare()}>
                  Tutup
                </Button>
              </div>
            ) : preview ? (
              <div className={`flex min-h-full items-start ${zoom > 1 ? 'justify-start' : 'justify-center'}`}>
                <img
                  src={preview}
                  alt={`Halaman ${activePage?.pageNumber ?? 1}`}
                  draggable={false}
                  style={{ width: `${Math.round(zoom * 100)}%` }}
                  className="h-auto max-w-none shrink-0 rounded-md border border-[var(--hairline)] bg-white shadow-soft"
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Spinner size={18} />
              </div>
            )}
          </div>
          <div className="flex h-[30px] shrink-0 items-center justify-between border-t border-[var(--hairline)] bg-[var(--canvas)] px-4 text-[10.5px] text-[var(--muted)]">
            <span>
              {activePage
                ? `Halaman ${activePage.pageNumber} · ${activePage.width}×${activePage.height}px · ${activePage.dpi} DPI`
                : 'Tidak ada halaman aktif'}
            </span>
            <span className="hidden lg:inline text-[var(--muted-soft)]">
              Ctrl + scroll untuk zoom · klik &amp; geser untuk menggeser halaman
            </span>
            <span>{formatBytes(current.sizeBytes)}</span>
          </div>
        </div>

        {/* Right panel */}
        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-[var(--hairline)] p-3">
          <Segmented
            value={panel}
            onChange={setPanel}
            options={[
              { value: 'filter', label: t('workspace.filters') },
              { value: 'pages', label: t('workspace.pageOps') },
            ]}
          />

          {panel === 'filter' ? (
            <div className="mt-3 space-y-4">
              <div>
                <SectionTitle title="Preset" description="10 preset pemrosesan dokumen" />
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {FILTER_PRESETS.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setPreset(entry.id);
                        setFilterConfig({ ...entry.config });
                        void store().applyFilter(entry.id, { ...entry.config }, scope);
                      }}
                      className={`focus-ring rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                        preset === entry.id
                          ? 'border-[var(--ink)] bg-[var(--surface-card)] font-semibold text-[var(--ink)]'
                          : 'border-[var(--hairline)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                      title={entry.descriptionId}
                    >
                      {entry.index}. {entry.labelId}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">Parameter</p>
                {numericKeys.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--muted)]">Preset ini tidak memiliki parameter tambahan.</p>
                ) : null}
                {numericKeys.map((key) => {
                  const range = PARAM_RANGES[key as string] ?? { min: 0, max: 100 };
                  return (
                    <Slider
                      key={key as string}
                      label={String(key)}
                      value={Number(filterConfig[key] ?? range.min)}
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      onChange={(value) => setNumericParam(key, value)}
                    />
                  );
                })}
                {'adaptiveThreshold' in filterConfig || preset === 'black-white' ? (
                  <Switch
                    checked={Boolean(filterConfig.adaptiveThreshold)}
                    onChange={(value) => setFilterConfig((state) => ({ ...state, adaptiveThreshold: value }))}
                    label="Adaptive threshold"
                  />
                ) : null}
                {presetDef.params.includes('whiteBalance') ? (
                  <Switch
                    checked={Boolean(filterConfig.whiteBalance)}
                    onChange={(value) => setFilterConfig((state) => ({ ...state, whiteBalance: value }))}
                    label="White balance"
                  />
                ) : null}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
                  {t('workspace.filtersScope')}
                </p>
                <Select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
                  <option value="current">{t('workspace.scopeCurrent')}</option>
                  <option value="selected">{t('workspace.scopeSelected')} ({selected.length})</option>
                  <option value="all">{t('workspace.scopeAll')}</option>
                </Select>
                <Button
                  block
                  variant="primary"
                  size="sm"
                  className="mt-2"
                  icon={Sparkles}
                  onClick={() => void store().applyFilter(preset, filterConfig, scope)}
                >
                  {t('workspace.applyFilter')}
                </Button>
              </div>

              <div className="border-t border-[var(--hairline)] pt-3">
                <SectionTitle title={t('workspace.adjustments')} description="Berlaku untuk halaman aktif" />
                <div className="mt-2 space-y-2">
                  <Slider label="Brightness" value={adjustments.brightness} min={-100} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, brightness: value }))} onReset={() => setAdjustments((state) => ({ ...state, brightness: 0 }))} />
                  <Slider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, contrast: value }))} onReset={() => setAdjustments((state) => ({ ...state, contrast: 0 }))} />
                  <Slider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, saturation: value }))} onReset={() => setAdjustments((state) => ({ ...state, saturation: 0 }))} />
                  <Slider label="Sharpness" value={adjustments.sharpness} min={0} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, sharpness: value }))} onReset={() => setAdjustments((state) => ({ ...state, sharpness: 0 }))} />
                  <Slider label="Denoise" value={adjustments.denoise} min={0} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, denoise: value }))} onReset={() => setAdjustments((state) => ({ ...state, denoise: 0 }))} />
                  <Slider label="Whiteness" value={adjustments.whitening} min={0} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, whitening: value }))} onReset={() => setAdjustments((state) => ({ ...state, whitening: 0 }))} />
                  <Button size="sm" block icon={SlidersHorizontal} onClick={() => void store().adjust(adjustments)}>
                    {t('common.apply')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <SectionTitle title={t('workspace.pageOps')} description={`${selected.length} halaman dipilih`} />
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" icon={ChevronUp} onClick={() => void store().moveActive('up')}>Naik</Button>
                <Button size="sm" icon={ChevronDown} onClick={() => void store().moveActive('down')}>Turun</Button>
                <Button size="sm" onClick={() => void store().moveActive('first')}>Ke awal</Button>
                <Button size="sm" onClick={() => void store().moveActive('last')}>Ke akhir</Button>
                <Button size="sm" icon={RotateCcw} onClick={() => void store().rotate(-90)}>Rotasi -90°</Button>
                <Button size="sm" icon={RotateCw} onClick={() => void store().rotate(90)}>Rotasi 90°</Button>
                <Button size="sm" icon={Copy} onClick={() => void store().duplicateActive()}>{t('common.duplicate')}</Button>
                <Button size="sm" icon={Trash2} onClick={() => void store().deleteSelected()}>{t('common.delete')}</Button>
              </div>

              <Card className="space-y-2 bg-[var(--surface-soft)]" padded>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">Koreksi geometri</p>
                <Button size="sm" block icon={Crop} onClick={() => void openCrop()}>{t('workspace.crop')}</Button>
                <Button size="sm" block variant="ghost" onClick={() => void store().setCrop(null)}>
                  Reset crop
                </Button>
                <Button size="sm" block variant="ghost" icon={RotateCcw} onClick={() => void store().resetPage()}>
                  Reset ke original
                </Button>
              </Card>

              <Card className="space-y-2 bg-[var(--surface-soft)]" padded>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">Reduksi noise</p>
                <Button
                  size="sm"
                  block
                  onClick={() => void store().operation('noise-reduction', { strength: 40 })}
                >
                  Noise reduction
                </Button>
                <Button size="sm" block onClick={() => void store().operation('finger-marks', { strength: 50 })}>
                  Hapus finger mark
                </Button>
                <Button size="sm" block onClick={() => void store().operation('deskew', {})}>
                  Auto deskew
                </Button>
              </Card>

              <Card className="space-y-2 bg-[var(--surface-soft)]" padded>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">Metadata</p>
                <Button
                  size="sm"
                  block
                  icon={FileText}
                  onClick={() => {
                    setMetaForm({
                      title: current.metadata.title || current.name,
                      author: current.metadata.author || '',
                      subject: current.metadata.subject || '',
                      keywords: current.metadata.keywords || '',
                    });
                    setMetaOpen(true);
                  }}
                >
                  Edit metadata
                </Button>
                <Button size="sm" block variant="ghost" icon={Layers} onClick={() => navigate('/ocr')}>
                  Jalankan OCR
                </Button>
              </Card>
            </div>
          )}
        </aside>
      </div>

      {/* Crop modal */}
      <Modal
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        title={t('workspace.crop')}
        description="Geser keempat sudut mengikuti tepi dokumen."
        width="max-w-3xl"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setCropQuad(FULL_QUAD)}>
              Reset sudut
            </Button>
            <Button size="sm" onClick={() => setCropOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" variant="primary" onClick={() => void applyCrop()} disabled={!cropSrc}>
              {t('common.apply')}
            </Button>
          </>
        }
      >
        {cropLoading || !cropSrc ? (
          <div className="flex justify-center py-10"><Spinner size={18} /></div>
        ) : (
          <div className="flex justify-center">
            <CropOverlay src={cropSrc} quad={cropQuad} onChange={setCropQuad} />
          </div>
        )}
      </Modal>

      {/* Export modal */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={t('workspace.exportOptions')}
        description="Pengaturan kualitas dan tata letak PDF."
        footer={
          <>
            <Button size="sm" onClick={() => setExportOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" variant="primary" icon={Download} loading={exporting} onClick={() => void runExport()}>
              {t('common.export')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama file" className="col-span-2" hint="Nama file PDF tanpa atau dengan akhiran .pdf.">
            <Input
              value={exportName}
              placeholder={`${current.name}.pdf`}
              onChange={(event) => setExportName(event.target.value)}
            />
          </Field>
          <Field label="Lokasi penyimpanan" className="col-span-2" hint={exportDir || 'Folder ekspor default aplikasi'}>
            <div className="flex gap-2">
              <Input
                value={exportDir}
                placeholder="Folder tujuan"
                onChange={(event) => setExportDir(event.target.value)}
              />
              <Button size="sm" icon={FolderOpen} onClick={() => void chooseExportDir()}>
                Pilih…
              </Button>
            </div>
          </Field>
          <Field label="Kualitas">
            <Select
              value={exportOptions.quality}
              onChange={(event) =>
                setExportOptions((state) => ({ ...state, quality: event.target.value as PdfExportOptions['quality'] }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="maximum">Maximum</option>
            </Select>
          </Field>
          <Field label="Format gambar">
            <Select
              value={exportOptions.imageFormat}
              onChange={(event) =>
                setExportOptions((state) => ({ ...state, imageFormat: event.target.value as 'jpg' | 'png' }))
              }
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </Select>
          </Field>
          <Field label="Ukuran halaman">
            <Select
              value={exportOptions.pageSize}
              onChange={(event) =>
                setExportOptions((state) => ({ ...state, pageSize: event.target.value as PdfExportOptions['pageSize'] }))
              }
            >
              {PAPER_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </Select>
          </Field>
          <Field label="Orientasi">
            <Select
              value={exportOptions.orientation}
              onChange={(event) =>
                setExportOptions((state) => ({
                  ...state,
                  orientation: event.target.value as PdfExportOptions['orientation'],
                }))
              }
            >
              <option value="auto">Auto</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </Field>
          <Field label="Margin (mm)">
            <Input
              type="number"
              min={0}
              max={50}
              value={exportOptions.margin}
              onChange={(event) =>
                setExportOptions((state) => ({ ...state, margin: Math.max(0, Number(event.target.value) || 0) }))
              }
            />
          </Field>
          <Field label="Password (opsional)" hint="Kosongkan untuk PDF tanpa proteksi.">
            <Input
              type="password"
              value={exportOptions.password ?? ''}
              onChange={(event) =>
                setExportOptions((state) => ({ ...state, password: event.target.value || undefined }))
              }
            />
          </Field>
          <div className="col-span-2">
            <Switch
              checked={exportOptions.addPageNumbers}
              onChange={(value) => setExportOptions((state) => ({ ...state, addPageNumbers: value }))}
              label="Tambahkan nomor halaman"
            />
          </div>
        </div>
      </Modal>

      {/* Print modal */}
      <Modal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={t('common.print')}
        description={current.name}
        footer={
          <>
            <Button size="sm" onClick={() => setPrintOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" variant="primary" icon={Printer} loading={printing} onClick={() => void runPrint()}>
              {t('common.print')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Printer" className="col-span-2">
            <Select
              value={printOptions.printerName ?? ''}
              onChange={(event) => setPrintOptions((state) => ({ ...state, printerName: event.target.value }))}
            >
              <option value="">Printer default</option>
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName || printer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jumlah salinan">
            <Input
              type="number"
              min={1}
              max={99}
              value={printOptions.copies}
              onChange={(event) =>
                setPrintOptions((state) => ({ ...state, copies: Math.max(1, Number(event.target.value) || 1) }))
              }
            />
          </Field>
          <Field label="Rentang halaman" hint="Contoh: 1-3,5">
            <Input
              value={printOptions.pageRange ?? ''}
              placeholder="Semua halaman"
              onChange={(event) => setPrintOptions((state) => ({ ...state, pageRange: event.target.value }))}
            />
          </Field>
          <Field label="Ukuran kertas">
            <Select
              value={printOptions.paperSize}
              onChange={(event) =>
                setPrintOptions((state) => ({ ...state, paperSize: event.target.value as PrintOptions['paperSize'] }))
              }
            >
              {PAPER_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </Select>
          </Field>
          <div className="space-y-2 pt-5">
            <Switch
              checked={printOptions.landscape}
              onChange={(value) => setPrintOptions((state) => ({ ...state, landscape: value }))}
              label="Landscape"
            />
            <Switch
              checked={printOptions.color}
              onChange={(value) => setPrintOptions((state) => ({ ...state, color: value }))}
              label="Warna"
            />
            <Switch
              checked={printOptions.duplex}
              onChange={(value) => setPrintOptions((state) => ({ ...state, duplex: value }))}
              label="Duplex"
            />
          </div>
        </div>
      </Modal>

      {/* Metadata modal */}
      <Modal
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        title="Metadata dokumen"
        footer={
          <>
            <Button size="sm" onClick={() => setMetaOpen(false)}>{t('common.cancel')}</Button>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                try {
                  const record = await api.documents.updateMetadata(current.id, metaForm);
                  store().setCurrent(record);
                  setMetaOpen(false);
                  toast({ title: 'Metadata diperbarui', tone: 'success' });
                } catch (error) {
                  toast({ title: errorMessage(error), tone: 'error' });
                }
              }}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Judul" className="col-span-2">
            <Input value={metaForm.title} onChange={(event) => setMetaForm((state) => ({ ...state, title: event.target.value }))} />
          </Field>
          <Field label="Penulis">
            <Input value={metaForm.author} onChange={(event) => setMetaForm((state) => ({ ...state, author: event.target.value }))} />
          </Field>
          <Field label="Subjek">
            <Input value={metaForm.subject} onChange={(event) => setMetaForm((state) => ({ ...state, subject: event.target.value }))} />
          </Field>
          <Field label="Kata kunci" className="col-span-2">
            <Input value={metaForm.keywords} onChange={(event) => setMetaForm((state) => ({ ...state, keywords: event.target.value }))} />
          </Field>
        </div>
        <div className="mt-3">
          <Alert tone="info">
            Dokumen ini memiliki {current.pages.length} halaman dan tersimpan lokal di direktori dokumen.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}
