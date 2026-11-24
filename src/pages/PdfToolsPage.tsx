import React from 'react';
import {
  ArrowRightLeft,
  BookOpen,
  Combine,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Gauge,
  Hash,
  Info,
  LayoutGrid,
  Lock,
  LockOpen,
  Merge,
  Presentation,
  RotateCw,
  Scissors,
  ShieldCheck,
  Trash2,
  Unlock,
  FileMinus2,
} from 'lucide-react';
import type {
  CompressOptions,
  ConversionOptions,
  ImageToPdfOptions,
  PageNumberOptions,
  PdfInfo,
  PdfMetadata,
  PdfOpResult,
  ProtectPermissions,
} from '@shared/types';
import { PAPER_SIZE_OPTIONS, formatBytes } from '@shared/constants';
import { api, errorMessage } from '../lib/api';
import { useToastStore } from '../store/toast';
import { useT } from '../i18n';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  SectionTitle,
  Segmented,
  Select,
  Slider,
  Spinner,
  Switch,
  Tabs,
} from '../components/ui';

type ToolId =
  | 'images-to-pdf'
  | 'office-to-pdf'
  | 'pdf-to-word'
  | 'pdf-to-excel'
  | 'pdf-to-ppt'
  | 'pdf-to-images'
  | 'merge'
  | 'split'
  | 'compress'
  | 'rotate'
  | 'delete'
  | 'extract'
  | 'reorder'
  | 'protect'
  | 'unlock'
  | 'page-numbers'
  | 'metadata'
  | 'blank-pages';

type Accept = 'pdf' | 'images' | 'office';

interface ToolDef {
  id: ToolId;
  label: string;
  description: string;
  group: 'convert' | 'organize' | 'secure' | 'info';
  accept: Accept;
  multiple?: boolean;
  icon: typeof FileText;
}

const TOOLS: ToolDef[] = [
  { id: 'images-to-pdf', label: 'Gambar → PDF', description: 'JPG, PNG, BMP, TIFF, WebP', group: 'convert', accept: 'images', multiple: true, icon: FileImage },
  { id: 'office-to-pdf', label: 'Office → PDF', description: 'Word, Excel, PowerPoint', group: 'convert', accept: 'office', multiple: true, icon: FileType2 },
  { id: 'pdf-to-word', label: 'PDF → Word', description: 'Rekonstruksi teks ke DOCX', group: 'convert', accept: 'pdf', icon: FileText },
  { id: 'pdf-to-excel', label: 'PDF → Excel', description: 'Tabel dan teks ke XLSX', group: 'convert', accept: 'pdf', icon: FileSpreadsheet },
  { id: 'pdf-to-ppt', label: 'PDF → PowerPoint', description: 'Setiap halaman menjadi slide', group: 'convert', accept: 'pdf', icon: Presentation },
  { id: 'pdf-to-images', label: 'PDF → Gambar', description: 'Ekspor halaman sebagai JPG/PNG', group: 'convert', accept: 'pdf', icon: FileImage },
  { id: 'merge', label: 'Gabung PDF', description: 'Satukan beberapa file', group: 'organize', accept: 'pdf', multiple: true, icon: Merge },
  { id: 'split', label: 'Pisah PDF', description: 'Per halaman, rentang, atau interval', group: 'organize', accept: 'pdf', icon: Scissors },
  { id: 'compress', label: 'Kompres PDF', description: 'Perkecil ukuran file', group: 'organize', accept: 'pdf', icon: Gauge },
  { id: 'rotate', label: 'Rotasi halaman', description: '90°, 180°, 270°', group: 'organize', accept: 'pdf', icon: RotateCw },
  { id: 'delete', label: 'Hapus halaman', description: 'Buang halaman terpilih', group: 'organize', accept: 'pdf', icon: Trash2 },
  { id: 'extract', label: 'Ekstrak halaman', description: 'Simpan halaman ke PDF baru', group: 'organize', accept: 'pdf', icon: FileMinus2 },
  { id: 'reorder', label: 'Urutkan halaman', description: 'Susun ulang urutan halaman', group: 'organize', accept: 'pdf', icon: LayoutGrid },
  { id: 'protect', label: 'Proteksi PDF', description: 'Password dan permission', group: 'secure', accept: 'pdf', icon: Lock },
  { id: 'unlock', label: 'Buka proteksi', description: 'Hapus password PDF', group: 'secure', accept: 'pdf', icon: Unlock },
  { id: 'page-numbers', label: 'Nomor halaman', description: 'Tambahkan penomoran', group: 'secure', accept: 'pdf', icon: Hash },
  { id: 'metadata', label: 'Metadata PDF', description: 'Judul, penulis, kata kunci', group: 'secure', accept: 'pdf', icon: BookOpen },
  { id: 'blank-pages', label: 'Deteksi halaman kosong', description: 'Temukan halaman tanpa konten', group: 'info', accept: 'pdf', icon: ShieldCheck },
];

const PERMISSIONS: ProtectPermissions = {
  printing: true,
  editing: false,
  copying: false,
  extraction: false,
  annotation: true,
  formFilling: true,
  highQualityPrinting: true,
};

const PAGE_NUMBER_DEFAULTS: PageNumberOptions = {
  position: 'bottom',
  alignment: 'center',
  fontFamily: 'Helvetica',
  fontSize: 11,
  color: '#111111',
  startNumber: 1,
  prefix: '',
  suffix: '',
  format: 'numeric',
  margin: 24,
  pageRange: '',
  skipFirstPage: false,
};

const IMAGE_PDF_DEFAULTS: ImageToPdfOptions = {
  pageSize: 'A4',
  orientation: 'auto',
  margin: 0,
  fit: 'contain',
  quality: 85,
  addPageNumbers: false,
};

const COMPRESS_DEFAULTS: CompressOptions = {
  preset: 'recommended',
  imageQuality: 70,
  dpi: 150,
  grayscale: false,
  removeMetadata: false,
  downsample: true,
};

const CONVERSION_DEFAULTS: ConversionOptions = { dpi: 200, mode: 'auto', keepLayout: true };

export default function PdfToolsPage() {
  const t = useT();
  const toast = useToastStore((state) => state.push);

  const [toolId, setToolId] = React.useState<ToolId>('images-to-pdf');
  const [files, setFiles] = React.useState<string[]>([]);
  const [info, setInfo] = React.useState<PdfInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<PdfOpResult[]>([]);
  const [blankPages, setBlankPages] = React.useState<number[] | null>(null);
  const [officeStatus, setOfficeStatus] = React.useState<{ available: boolean; path: string; version?: string } | null>(null);

  const [pagesInput, setPagesInput] = React.useState('');
  const [ordersInput, setOrdersInput] = React.useState('');
  const [degrees, setDegrees] = React.useState(90);
  const [splitMode, setSplitMode] = React.useState<'every' | 'ranges' | 'interval' | 'selected'>('every');
  const [interval, setInterval] = React.useState(10);
  const [rangesInput, setRangesInput] = React.useState('1-1');
  const [compress, setCompress] = React.useState<CompressOptions>(COMPRESS_DEFAULTS);
  const [imageOptions, setImageOptions] = React.useState<ImageToPdfOptions>(IMAGE_PDF_DEFAULTS);
  const [conversion, setConversion] = React.useState<ConversionOptions>(CONVERSION_DEFAULTS);
  const [protect, setProtect] = React.useState({ userPassword: '', ownerPassword: '', permissions: PERMISSIONS });
  const [pageNumbers, setPageNumbers] = React.useState<PageNumberOptions>(PAGE_NUMBER_DEFAULTS);
  const [metadata, setMetadata] = React.useState<Partial<PdfMetadata>>({ title: '', author: '', subject: '', keywords: '' });
  const [counts, setCounts] = React.useState({ dpi: 200, format: 'png' as 'png' | 'jpg' });

  const tool = TOOLS.find((entry) => entry.id === toolId) ?? TOOLS[0];

  React.useEffect(() => {
    api.office
      .detect()
      .then(setOfficeStatus)
      .catch(() => setOfficeStatus({ available: false, path: '' }));
  }, []);

  const loadInfo = React.useCallback(
    async (filePath: string, pass?: string) => {
      setLoadingInfo(true);
      setInfo(null);
      try {
        const result = await api.pdf.info(filePath, pass);
        setInfo(result);
        setMetadata({
          title: result.metadata.title,
          author: result.metadata.author,
          subject: result.metadata.subject,
          keywords: result.metadata.keywords,
        });
      } catch (error) {
        toast({ title: errorMessage(error), tone: 'error' });
      } finally {
        setLoadingInfo(false);
      }
    },
    [toast],
  );

  const chooseTool = (next: ToolDef) => {
    setToolId(next.id);
    setFiles([]);
    setInfo(null);
    setResults([]);
    setBlankPages(null);
    setPagesInput('');
    setOrdersInput('');
  };

  const pickFiles = async () => {
    const filters =
      tool.accept === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : tool.accept === 'images'
          ? [{ name: 'Gambar', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tif', 'tiff', 'webp'] }]
          : [{ name: 'Dokumen Office', extensions: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt'] }];
    try {
      const picked = await api.dialog.openFiles({ title: tool.label, filters, multiple: tool.multiple });
      if (!picked.length) return;
      setFiles(picked);
      setResults([]);
      setBlankPages(null);
      if (tool.accept === 'pdf' && picked[0]) {
        await loadInfo(picked[0], password || undefined);
      }
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  const pageIndices = (): number[] => {
    const total = info?.pageCount ?? 0;
    const indices = new Set<number>();
    if (!pagesInput.trim()) {
      for (let index = 0; index < total; index += 1) indices.add(index);
      return [...indices];
    }
    for (const part of pagesInput.split(',')) {
      const segment = part.trim();
      if (!segment) continue;
      const match = segment.match(/^(\d+)?\s*-\s*(\d+)?$/);
      if (match) {
        const from = Math.max(1, Number(match[1] ?? 1));
        const to = Math.min(total, Number(match[2] ?? total));
        for (let page = from; page <= to; page += 1) indices.add(page - 1);
      } else {
        const page = Number(segment);
        if (Number.isFinite(page) && page >= 1 && page <= total) indices.add(page - 1);
      }
    }
    return [...indices].sort((a, b) => a - b);
  };

  const run = async () => {
    if (!files.length) {
      toast({ title: 'Pilih file terlebih dahulu', tone: 'error' });
      return;
    }
    setRunning(true);
    setResults([]);
    setBlankPages(null);
    try {
      switch (toolId) {
        case 'images-to-pdf': {
          const result = await api.pdf.imagesToPdf(files, imageOptions);
          setResults([result]);
          break;
        }
        case 'office-to-pdf': {
          const list = await api.office.toPdf(files);
          setResults(list);
          break;
        }
        case 'pdf-to-word':
          setResults([await api.office.pdfToWord(files[0], conversion)]);
          break;
        case 'pdf-to-excel':
          setResults([await api.office.pdfToExcel(files[0], conversion)]);
          break;
        case 'pdf-to-ppt':
          setResults([await api.office.pdfToPpt(files[0], conversion)]);
          break;
        case 'pdf-to-images': {
          const result = await api.pdf.pdfToImages(files[0], {
            dpi: counts.dpi,
            format: counts.format,
            pages: pagesInput.trim() ? pageIndices() : undefined,
          });
          setResults([result]);
          break;
        }
        case 'merge': {
          if (files.length < 2) throw new Error('Pilih minimal dua file PDF untuk digabung.');
          setResults([await api.pdf.merge(files)]);
          break;
        }
        case 'split': {
          const ranges = rangesInput
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
              const [from, to] = part.split('-').map((value) => Number(value.trim()));
              return { from: from || 1, to: to || from || 1 };
            });
          const result = await api.pdf.split(files[0], splitMode, {
            ranges: splitMode === 'ranges' ? ranges : undefined,
            interval: splitMode === 'interval' ? interval : undefined,
            pages: splitMode === 'selected' ? pageIndices() : undefined,
          });
          setResults([result]);
          break;
        }
        case 'compress':
          setResults([await api.pdf.compress(files[0], compress)]);
          break;
        case 'rotate':
          setResults([await api.pdf.rotate(files[0], pagesInput.trim() ? pageIndices() : [], degrees)]);
          break;
        case 'delete':
          setResults([await api.pdf.deletePages(files[0], pageIndices())]);
          break;
        case 'extract':
          setResults([await api.pdf.extract(files[0], pageIndices())]);
          break;
        case 'reorder': {
          const order = ordersInput
            .split(',')
            .map((part) => Number(part.trim()))
            .filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => value - 1);
          if (!order.length) throw new Error('Masukkan urutan halaman, contoh: 3,1,2.');
          setResults([await api.pdf.reorder(files[0], order)]);
          break;
        }
        case 'protect':
          setResults([
            await api.pdf.protect(files[0], {
              userPassword: protect.userPassword || undefined,
              ownerPassword: protect.ownerPassword || undefined,
              permissions: protect.permissions,
            }),
          ]);
          break;
        case 'unlock':
          if (!password) throw new Error('Masukkan password PDF.');
          setResults([await api.pdf.unlock(files[0], password)]);
          break;
        case 'page-numbers':
          setResults([await api.pdf.addPageNumbers(files[0], pageNumbers)]);
          break;
        case 'metadata':
          setResults([await api.pdf.updateMetadata(files[0], metadata)]);
          break;
        case 'blank-pages': {
          const pages = await api.pdf.blankPages(files[0]);
          setBlankPages(pages);
          toast({
            title: pages.length ? `${pages.length} halaman kosong ditemukan` : 'Tidak ada halaman kosong',
            tone: pages.length ? 'info' : 'success',
          });
          break;
        }
        default:
          break;
      }
      toast({ title: 'Operasi selesai', tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const groups: Array<{ key: ToolDef['group']; label: string }> = [
    { key: 'convert', label: t('pdf.convertToPdf') + ' / ' + t('pdf.convertFromPdf') },
    { key: 'organize', label: t('pdf.editOrganize') },
    { key: 'secure', label: 'Keamanan & metadata' },
    { key: 'info', label: 'Inspeksi' },
  ];

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] p-3">
        <SectionTitle title={t('pdf.title')} description={t('pdf.subtitle')} />
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-1.5 px-1 text-[10px] uppercase tracking-[0.12em] text-[var(--muted-soft)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {TOOLS.filter((entry) => entry.group === group.key).map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => chooseTool(entry)}
                    className={`focus-ring flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                      toolId === entry.id
                        ? 'border-[var(--ink)] bg-[var(--surface-card)]'
                        : 'border-transparent hover:bg-[var(--surface-soft)]'
                    }`}
                  >
                    <entry.icon size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{entry.label}</span>
                      <span className="block truncate text-[10.5px] text-[var(--muted)]">{entry.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--ink)]">{tool.label}</h1>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">{tool.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {tool.accept === 'office' ? (
              <Badge tone={officeStatus?.available ? 'success' : 'warning'}>
                LibreOffice {officeStatus?.available ? 'terdeteksi' : 'tidak tersedia'}
              </Badge>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void pickFiles()}>
              Pilih file
            </Button>
            <Button size="sm" variant="primary" icon={Download} loading={running} onClick={() => void run()}>
              Jalankan
            </Button>
          </div>
        </div>

        {tool.accept === 'office' && officeStatus && !officeStatus.available ? (
          <div className="mt-3">
            <Alert tone="warning" title="LibreOffice tidak terdeteksi">
              Konversi Word/Excel/PowerPoint ke PDF memerlukan LibreOffice. Pasang LibreOffice, lalu atur path
              <code className="mx-1 rounded bg-[var(--surface-card)] px-1">soffice.exe</code>
              di Settings.
            </Alert>
          </div>
        ) : null}

        <Card className="mt-3 space-y-2 bg-[var(--surface-soft)]">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--ink)]">File sumber</p>
            {files.length ? (
              <button
                className="text-[11px] text-[var(--muted)] underline decoration-dotted"
                onClick={() => {
                  setFiles([]);
                  setInfo(null);
                  setResults([]);
                }}
              >
                Bersihkan
              </button>
            ) : null}
          </div>
          {files.length === 0 ? (
            <p className="text-[11.5px] text-[var(--muted)]">Belum ada file dipilih.</p>
          ) : (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file} className="truncate rounded border border-[var(--hairline)] bg-[var(--canvas)] px-2 py-1 font-mono text-[11px] text-[var(--body-text)]">
                  {file}
                </li>
              ))}
            </ul>
          )}
          {loadingInfo ? (
            <p className="flex items-center gap-2 text-[11.5px] text-[var(--muted)]">
              <Spinner size={11} /> Membaca informasi PDF…
            </p>
          ) : info ? (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1"><Info size={11} /> {info.pageCount} halaman</span>
              <span>{formatBytes(info.fileSize)}</span>
              {info.encrypted ? <Badge tone="warning">Terproteksi</Badge> : <Badge tone="success">Tidak terproteksi</Badge>}
            </div>
          ) : null}
        </Card>

        <Card className="mt-3 space-y-3">
          <p className="text-[12px] font-medium text-[var(--ink)]">Opsi</p>

          {tool.accept === 'pdf' && toolId !== 'images-to-pdf' ? (
            <Field label="Password PDF" hint="Isi jika file terproteksi, lalu klik Pilih file kembali untuk memuat.">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password (opsional)"
              />
            </Field>
          ) : null}

          {toolId === 'images-to-pdf' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ukuran halaman">
                <Select
                  value={imageOptions.pageSize}
                  onChange={(event) =>
                    setImageOptions((state) => ({ ...state, pageSize: event.target.value as ImageToPdfOptions['pageSize'] }))
                  }
                >
                  {PAPER_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </Select>
              </Field>
              <Field label="Orientasi">
                <Select
                  value={imageOptions.orientation}
                  onChange={(event) =>
                    setImageOptions((state) => ({ ...state, orientation: event.target.value as ImageToPdfOptions['orientation'] }))
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </Select>
              </Field>
              <Field label="Fit">
                <Select
                  value={imageOptions.fit}
                  onChange={(event) => setImageOptions((state) => ({ ...state, fit: event.target.value as ImageToPdfOptions['fit'] }))}
                >
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                  <option value="original">Original</option>
                </Select>
              </Field>
              <Field label="Margin (mm)">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={imageOptions.margin}
                  onChange={(event) => setImageOptions((state) => ({ ...state, margin: Number(event.target.value) || 0 }))}
                />
              </Field>
              <div className="col-span-2">
                <Slider
                  label="Kualitas gambar"
                  value={imageOptions.quality}
                  min={30}
                  max={100}
                  suffix="%"
                  onChange={(value) => setImageOptions((state) => ({ ...state, quality: value }))}
                />
              </div>
              <div className="col-span-2">
                <Switch
                  checked={imageOptions.addPageNumbers}
                  onChange={(value) => setImageOptions((state) => ({ ...state, addPageNumbers: value }))}
                  label="Tambahkan nomor halaman"
                />
              </div>
            </div>
          ) : null}

          {['pdf-to-word', 'pdf-to-excel', 'pdf-to-ppt', 'office-to-pdf'].includes(toolId) ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="DPI render">
                <Input
                  type="number"
                  min={72}
                  max={600}
                  value={conversion.dpi}
                  onChange={(event) => setConversion((state) => ({ ...state, dpi: Number(event.target.value) || 150 }))}
                />
              </Field>
              <Field label="Mode konversi">
                <Select
                  value={conversion.mode}
                  onChange={(event) => setConversion((state) => ({ ...state, mode: event.target.value as ConversionOptions['mode'] }))}
                >
                  <option value="auto">Auto</option>
                  <option value="text">Teks (rekonstruksi)</option>
                  <option value="visual">Visual (gambar)</option>
                </Select>
              </Field>
              <div className="col-span-2">
                <Switch
                  checked={conversion.keepLayout}
                  onChange={(value) => setConversion((state) => ({ ...state, keepLayout: value }))}
                  label="Pertahankan tata letak"
                />
              </div>
            </div>
          ) : null}

          {toolId === 'pdf-to-images' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="DPI">
                <Input
                  type="number"
                  min={72}
                  max={600}
                  value={counts.dpi}
                  onChange={(event) => setCounts((state) => ({ ...state, dpi: Number(event.target.value) || 150 }))}
                />
              </Field>
              <Field label="Format">
                <Select
                  value={counts.format}
                  onChange={(event) => setCounts((state) => ({ ...state, format: event.target.value as 'png' | 'jpg' }))}
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </Select>
              </Field>
              <Field label="Halaman" className="col-span-2" hint="Kosongkan untuk semua halaman. Contoh: 1-3,5">
                <Input value={pagesInput} onChange={(event) => setPagesInput(event.target.value)} placeholder="Semua halaman" />
              </Field>
            </div>
          ) : null}

          {toolId === 'split' ? (
            <div className="space-y-2">
              <Tabs
                value={splitMode}
                onChange={setSplitMode}
                tabs={[
                  { value: 'every', label: 'Per halaman' },
                  { value: 'ranges', label: 'Rentang' },
                  { value: 'interval', label: 'Interval' },
                  { value: 'selected', label: 'Terpilih' },
                ]}
              />
              {splitMode === 'ranges' ? (
                <Field label="Rentang" hint="Contoh: 1-3,4-6">
                  <Input value={rangesInput} onChange={(event) => setRangesInput(event.target.value)} />
                </Field>
              ) : null}
              {splitMode === 'interval' ? (
                <Field label="Halaman per file">
                  <Input type="number" min={1} value={interval} onChange={(event) => setInterval(Math.max(1, Number(event.target.value) || 1))} />
                </Field>
              ) : null}
              {splitMode === 'selected' ? (
                <Field label="Halaman" hint="Contoh: 1-3,5">
                  <Input value={pagesInput} onChange={(event) => setPagesInput(event.target.value)} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {toolId === 'compress' ? (
            <div className="space-y-3">
              <Segmented
                value={compress.preset}
                onChange={(value) => {
                  const options: Record<string, Partial<CompressOptions>> = {
                    low: { imageQuality: 85, dpi: 200 },
                    recommended: { imageQuality: 70, dpi: 150 },
                    high: { imageQuality: 55, dpi: 120 },
                    extreme: { imageQuality: 40, dpi: 96 },
                  };
                  setCompress((state) => ({ ...state, preset: value, ...(options[value] ?? {}) }));
                }}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'recommended', label: 'Rekomendasi' },
                  { value: 'high', label: 'Tinggi' },
                  { value: 'extreme', label: 'Ekstrem' },
                ]}
              />
              <Slider label="Kualitas gambar" value={compress.imageQuality} min={20} max={100} onChange={(value) => setCompress((state) => ({ ...state, imageQuality: value, preset: 'custom' }))} />
              <Slider label="Downsample DPI" value={compress.dpi} min={72} max={300} onChange={(value) => setCompress((state) => ({ ...state, dpi: value, preset: 'custom' }))} />
              <Switch checked={compress.grayscale} onChange={(value) => setCompress((state) => ({ ...state, grayscale: value }))} label="Konversi ke grayscale" />
              <Switch checked={compress.removeMetadata} onChange={(value) => setCompress((state) => ({ ...state, removeMetadata: value }))} label="Hapus metadata" />
              <Switch checked={compress.downsample} onChange={(value) => setCompress((state) => ({ ...state, downsample: value }))} label="Downsample gambar" />
            </div>
          ) : null}

          {['rotate', 'delete', 'extract'].includes(toolId) ? (
            <div className="space-y-3">
              {toolId === 'rotate' ? (
                <Field label="Sudut rotasi">
                  <Select value={degrees} onChange={(event) => setDegrees(Number(event.target.value))}>
                    <option value={90}>90° searah jarum jam</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </Select>
                </Field>
              ) : null}
              <Field
                label="Halaman"
                hint={toolId === 'delete' ? 'Kosongkan untuk semua halaman. Contoh: 2,4-5' : 'Kosongkan untuk semua halaman.'}
              >
                <Input value={pagesInput} onChange={(event) => setPagesInput(event.target.value)} placeholder="Semua halaman" />
              </Field>
            </div>
          ) : null}

          {toolId === 'reorder' ? (
            <Field label="Urutan baru" hint="Tulis nomor halaman dipisah koma, contoh: 3,1,2">
              <Input value={ordersInput} onChange={(event) => setOrdersInput(event.target.value)} placeholder="3,1,2" />
            </Field>
          ) : null}

          {toolId === 'protect' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="User password">
                  <Input type="password" value={protect.userPassword} onChange={(event) => setProtect((state) => ({ ...state, userPassword: event.target.value }))} />
                </Field>
                <Field label="Owner password">
                  <Input type="password" value={protect.ownerPassword} onChange={(event) => setProtect((state) => ({ ...state, ownerPassword: event.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['printing', 'Izinkan cetak'],
                    ['highQualityPrinting', 'Cetak kualitas tinggi'],
                    ['editing', 'Izinkan edit'],
                    ['copying', 'Izinkan copy teks'],
                    ['extraction', 'Izinkan ekstraksi'],
                    ['annotation', 'Izinkan anotasi'],
                    ['formFilling', 'Isi form'],
                  ] as Array<[keyof ProtectPermissions, string]>
                ).map(([key, label]) => (
                  <Switch
                    key={key}
                    checked={protect.permissions[key]}
                    onChange={(value) =>
                      setProtect((state) => ({ ...state, permissions: { ...state.permissions, [key]: value } }))
                    }
                    label={label}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {toolId === 'unlock' ? (
            <Field label="Password saat ini" hint="PDF tanpa password tidak perlu dibuka proteksinya.">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
          ) : null}

          {toolId === 'page-numbers' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Posisi">
                <Select
                  value={pageNumbers.position}
                  onChange={(event) => setPageNumbers((state) => ({ ...state, position: event.target.value as PageNumberOptions['position'] }))}
                >
                  <option value="bottom">Bawah</option>
                  <option value="top">Atas</option>
                </Select>
              </Field>
              <Field label="Perataan">
                <Select
                  value={pageNumbers.alignment}
                  onChange={(event) => setPageNumbers((state) => ({ ...state, alignment: event.target.value as PageNumberOptions['alignment'] }))}
                >
                  <option value="left">Kiri</option>
                  <option value="center">Tengah</option>
                  <option value="right">Kanan</option>
                </Select>
              </Field>
              <Field label="Format">
                <Select
                  value={pageNumbers.format}
                  onChange={(event) => setPageNumbers((state) => ({ ...state, format: event.target.value as PageNumberOptions['format'] }))}
                >
                  <option value="numeric">1, 2, 3</option>
                  <option value="page-of-total">1 / N</option>
                  <option value="roman">i, ii, iii</option>
                  <option value="word">satu, dua</option>
                </Select>
              </Field>
              <Field label="Ukuran font">
                <Input
                  type="number"
                  min={6}
                  max={36}
                  value={pageNumbers.fontSize}
                  onChange={(event) => setPageNumbers((state) => ({ ...state, fontSize: Number(event.target.value) || 11 }))}
                />
              </Field>
              <Field label="Mulai dari">
                <Input
                  type="number"
                  min={1}
                  value={pageNumbers.startNumber}
                  onChange={(event) => setPageNumbers((state) => ({ ...state, startNumber: Number(event.target.value) || 1 }))}
                />
              </Field>
              <Field label="Margin (pt)">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={pageNumbers.margin}
                  onChange={(event) => setPageNumbers((state) => ({ ...state, margin: Number(event.target.value) || 0 }))}
                />
              </Field>
              <Field label="Prefix">
                <Input value={pageNumbers.prefix} onChange={(event) => setPageNumbers((state) => ({ ...state, prefix: event.target.value }))} />
              </Field>
              <Field label="Suffix">
                <Input value={pageNumbers.suffix} onChange={(event) => setPageNumbers((state) => ({ ...state, suffix: event.target.value }))} />
              </Field>
              <Field label="Rentang halaman" className="col-span-2" hint="Kosongkan untuk semua halaman.">
                <Input value={pageNumbers.pageRange} onChange={(event) => setPageNumbers((state) => ({ ...state, pageRange: event.target.value }))} />
              </Field>
              <div className="col-span-2">
                <Switch
                  checked={pageNumbers.skipFirstPage}
                  onChange={(value) => setPageNumbers((state) => ({ ...state, skipFirstPage: value }))}
                  label="Lewati halaman pertama"
                />
              </div>
            </div>
          ) : null}

          {toolId === 'metadata' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Judul" className="col-span-2">
                <Input value={metadata.title ?? ''} onChange={(event) => setMetadata((state) => ({ ...state, title: event.target.value }))} />
              </Field>
              <Field label="Penulis">
                <Input value={metadata.author ?? ''} onChange={(event) => setMetadata((state) => ({ ...state, author: event.target.value }))} />
              </Field>
              <Field label="Subjek">
                <Input value={metadata.subject ?? ''} onChange={(event) => setMetadata((state) => ({ ...state, subject: event.target.value }))} />
              </Field>
              <Field label="Kata kunci" className="col-span-2">
                <Input value={metadata.keywords ?? ''} onChange={(event) => setMetadata((state) => ({ ...state, keywords: event.target.value }))} />
              </Field>
            </div>
          ) : null}

          {toolId === 'blank-pages' ? (
            <p className="text-[11.5px] text-[var(--muted)]">
              Jalankan untuk memindai seluruh halaman dan menampilkan daftar halaman kosong.
            </p>
          ) : null}

          {['merge', 'office-to-pdf', 'images-to-pdf'].includes(toolId) ? (
            <div className="flex items-center gap-2 rounded-md border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 py-2 text-[11.5px] text-[var(--muted)]">
              <Combine size={13} />
              Pilih beberapa file sekaligus. Urutan file mengikuti urutan pemilihan.
              <ArrowRightLeft size={13} />
            </div>
          ) : null}
        </Card>

        {blankPages !== null ? (
          <Card className="mt-3">
            <SectionTitle title="Hasil deteksi halaman kosong" description={`${blankPages.length} halaman`} />
            {blankPages.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {blankPages.map((page) => (
                  <Badge key={page} tone="warning">Halaman {page + 1}</Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-[var(--muted)]">Semua halaman memiliki konten.</p>
            )}
          </Card>
        ) : null}

        {results.length ? (
          <Card className="mt-3 space-y-2">
            <SectionTitle title="Hasil" description="File tersimpan di direktori output" />
            {results.map((result) => (
              <div key={result.outputPath} className="rounded-md border border-[var(--hairline)] bg-[var(--surface-soft)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11.5px] text-[var(--ink)]">{result.outputPath}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      {formatBytes(result.outputSize)}
                      {result.pageCount ? ` · ${result.pageCount} halaman` : ''}
                      {result.compressionRatio !== undefined
                        ? ` · ${Math.max(0, Math.round(result.compressionRatio * 100))}% lebih kecil`
                        : ''}
                    </p>
                    {result.outputPaths?.length ? (
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{result.outputPaths.length} file dihasilkan</p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void api.app.showItemInFolder(result.outputPath)}>
                    Buka folder
                  </Button>
                </div>
                {result.warnings?.length ? (
                  <ul className="mt-2 space-y-0.5">
                    {result.warnings.map((warning) => (
                      <li key={warning} className="text-[11px] text-[#b45309]">• {warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </Card>
        ) : null}

        {!files.length ? (
          <div className="mt-4">
            <EmptyState
              icon={tool.icon}
              title={`Pilih file untuk ${tool.label.toLowerCase()}`}
              description="Semua pemrosesan dilakukan offline di komputer ini. Hasil disimpan di direktori output yang diatur di Settings."
              action={
                <Button size="sm" onClick={() => void pickFiles()}>
                  Pilih file
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
