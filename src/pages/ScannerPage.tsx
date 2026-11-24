import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Check,
  FilePlus2,
  Layers,
  RefreshCw,
  ScanLine,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ColorMode,
  DriverKind,
  PaperSizeName,
  PaperSource,
  ScanFormat,
  ScanOptions,
  ScanProfile,
  ScannerCapabilities,
  ScannerDevice,
  ScanPageResult,
} from '@shared/types';
import {
  COLOR_MODE_LABELS,
  PAPER_SIZE_OPTIONS,
  RESOLUTION_OPTIONS,
  SCAN_FORMAT_LABELS,
  formatBytes,
} from '@shared/constants';
import { api, errorMessage } from '../lib/api';
import { useAppStore } from '../store/app';
import { useDocumentStore } from '../store/documents';
import { useToastStore } from '../store/toast';
import { useT } from '../i18n';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Segmented, SectionTitle, Select, Slider, Switch, Tabs } from '../components/ui';
import { CameraCapture } from '../components/CameraCapture';

const DEFAULT_OPTIONS: ScanOptions = {
  deviceId: '',
  driver: 'wia',
  paperSource: 'feeder',
  duplex: false,
  paperSize: 'A4',
  resolution: 300,
  colorMode: 'color',
  bitDepth: '24',
  brightness: 0,
  contrast: 0,
  format: 'png',
  pageCountMode: 'multiple',
  maxPages: 10,
};

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round((base64.length * 3) / 4);
}

export default function ScannerPage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToastStore((state) => state.push);
  const settings = useAppStore((state) => state.settings);

  const [tab, setTab] = React.useState<'device' | 'camera'>('device');
  const [devices, setDevices] = React.useState<ScannerDevice[]>([]);
  const [capabilities, setCapabilities] = React.useState<ScannerCapabilities | null>(null);
  const [profiles, setProfiles] = React.useState<ScanProfile[]>([]);
  const [options, setOptions] = React.useState<ScanOptions>(DEFAULT_OPTIONS);
  const [profileName, setProfileName] = React.useState('');
  const [loadingDevices, setLoadingDevices] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [pages, setPages] = React.useState<ScanPageResult[]>([]);
  const [warning, setWarning] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const update = <K extends keyof ScanOptions>(key: K, value: ScanOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  const loadProfiles = React.useCallback(async () => {
    try {
      setProfiles(await api.scanner.profiles());
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  }, [toast]);

  const loadDevices = React.useCallback(async () => {
    setLoadingDevices(true);
    try {
      const list = await api.scanner.listDevices();
      setDevices(list);
      setOptions((current) => {
        const preferred =
          list.find((device) => device.id === current.deviceId) ??
          list.find((device) => device.isDefault) ??
          list[0];
        return preferred
          ? { ...current, deviceId: preferred.id, driver: preferred.driver }
          : current;
      });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setLoadingDevices(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadDevices();
    void loadProfiles();
  }, [loadDevices, loadProfiles]);

  React.useEffect(() => {
    if (settings?.defaultScannerId) {
      setOptions((current) =>
        current.deviceId ? current : { ...current, deviceId: settings.defaultScannerId },
      );
    }
  }, [settings?.defaultScannerId]);

  React.useEffect(() => {
    if (!options.deviceId) {
      setCapabilities(null);
      return;
    }
    let cancelled = false;
    api.scanner
      .capabilities(options.deviceId, options.driver)
      .then((result) => {
        if (!cancelled) setCapabilities(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [options.deviceId, options.driver]);

  const device = devices.find((entry) => entry.id === options.deviceId) ?? null;

  const startScan = async () => {
    if (!device) {
      toast({ title: 'Pilih scanner terlebih dahulu', tone: 'error' });
      return;
    }
    setScanning(true);
    setWarning('');
    try {
      const result = await api.scanner.scan(options);
      setPages(result.pages);
      setWarning(result.warning ?? '');
      if (!result.pages.length) toast({ title: 'Scanner tidak menghasilkan halaman', tone: 'error' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const cancelScan = async () => {
    try {
      await api.scanner.cancel();
      toast({ title: 'Pemindaian dibatalkan', tone: 'info' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const appendPages = async (dataUrls: string[]) => {
    if (!dataUrls.length) return;
    setSaving(true);
    const store = useDocumentStore.getState();
    try {
      let documentId = store.current?.id;
      if (!documentId) {
        const created = await store.create();
        if (!created) return;
        documentId = created.id;
      }
      const record = await api.documents.addPagesFromBuffer(
        documentId,
        dataUrls.map((dataUrl) => ({ dataUrl })),
        'scanner',
      );
      useDocumentStore.getState().setCurrentKeepingPreview(record);
      await useDocumentStore.getState().loadList();
      useAppStore.getState().refreshInfo().catch(() => undefined);
      toast({ title: `${dataUrls.length} halaman ditambahkan ke dokumen`, tone: 'success' });
      navigate('/workspace');
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    const name = profileName.trim() || `Profil ${profiles.length + 1}`;
    try {
      const list = await api.scanner.saveProfile({
        name,
        resolution: options.resolution,
        colorMode: options.colorMode,
        paperSize: options.paperSize,
        paperSource: options.paperSource,
        duplex: options.duplex,
        isDefault: false,
      });
      setProfiles(list);
      setProfileName('');
      toast({ title: `Profil "${name}" disimpan`, tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  const applyProfile = (profile: ScanProfile) => {
    setOptions((current) => ({
      ...current,
      resolution: profile.resolution,
      colorMode: profile.colorMode,
      paperSize: profile.paperSize,
      paperSource: profile.paperSource,
      duplex: profile.duplex,
    }));
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[330px] shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] p-4">
        <div className="flex items-center justify-between">
          <SectionTitle title={t('scanner.title')} description={t('scanner.configuration')} />
        </div>

        <Tabs
          className="mt-3"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'device', label: 'Scanner' },
            { value: 'camera', label: 'Kamera' },
          ]}
        />

        {tab === 'device' ? (
          <div className="mt-4 space-y-3">
            <Field label={t('scanner.devices')}>
              <Select
                value={options.deviceId}
                onChange={(event) => {
                  const next = devices.find((entry) => entry.id === event.target.value);
                  setOptions((current) => ({
                    ...current,
                    deviceId: event.target.value,
                    driver: (next?.driver ?? current.driver) as DriverKind,
                  }));
                }}
              >
                {devices.length === 0 ? <option value="">{t('scanner.noDevice')}</option> : null}
                {devices.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} {entry.driver === 'twain' ? '(TWAIN)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-2">
              <Badge tone={device ? 'success' : 'warning'}>
                {device ? `${device.driver.toUpperCase()} siap` : 'Tidak terdeteksi'}
              </Badge>
              <Button size="sm" variant="ghost" icon={RefreshCw} loading={loadingDevices} onClick={() => void loadDevices()}>
                {t('scanner.refresh')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Sumber kertas">
                <Select
                  value={options.paperSource}
                  onChange={(event) => update('paperSource', event.target.value as PaperSource)}
                >
                  <option value="feeder">Feeder / ADF</option>
                  <option value="flatbed">Flatbed</option>
                </Select>
              </Field>
              <Field label="Mode halaman">
                <Select
                  value={options.pageCountMode}
                  onChange={(event) => update('pageCountMode', event.target.value as ScanOptions['pageCountMode'])}
                >
                  <option value="single">Satu halaman</option>
                  <option value="multiple">Multi halaman</option>
                  <option value="batch">Batch</option>
                </Select>
              </Field>
            </div>

            <Switch
              checked={options.duplex}
              onChange={(value) => update('duplex', value)}
              label="Duplex (bolak-balik)"
              description="Jika didukung driver scanner."
            />

            <div className="grid grid-cols-2 gap-2">
              <Field label="Ukuran kertas">
                <Select
                  value={options.paperSize}
                  onChange={(event) => update('paperSize', event.target.value as PaperSizeName)}
                >
                  {PAPER_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Resolusi (DPI)">
                <Select
                  value={options.resolution}
                  onChange={(event) => update('resolution', Number(event.target.value))}
                >
                  {RESOLUTION_OPTIONS.filter((dpi) => !capabilities || dpi <= capabilities.maxDpi).map((dpi) => (
                    <option key={dpi} value={dpi}>
                      {dpi}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Mode warna">
                <Select
                  value={options.colorMode}
                  onChange={(event) => update('colorMode', event.target.value as ColorMode)}
                >
                  {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {COLOR_MODE_LABELS[mode]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bit depth">
                <Select
                  value={options.bitDepth}
                  onChange={(event) => update('bitDepth', event.target.value as ScanOptions['bitDepth'])}
                >
                  <option value="1">1-bit</option>
                  <option value="8">8-bit</option>
                  <option value="24">24-bit</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Format">
                <Select
                  value={options.format}
                  onChange={(event) => update('format', event.target.value as ScanFormat)}
                >
                  {(Object.keys(SCAN_FORMAT_LABELS) as ScanFormat[]).map((format) => (
                    <option key={format} value={format}>
                      {SCAN_FORMAT_LABELS[format]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Maks. halaman">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={options.maxPages}
                  onChange={(event) => update('maxPages', Math.max(1, Number(event.target.value) || 1))}
                />
              </Field>
            </div>

            <Slider
              label="Brightness"
              value={options.brightness}
              min={-100}
              max={100}
              onChange={(value) => update('brightness', value)}
              onReset={() => update('brightness', 0)}
            />
            <Slider
              label="Contrast"
              value={options.contrast}
              min={-100}
              max={100}
              onChange={(value) => update('contrast', value)}
              onReset={() => update('contrast', 0)}
            />

            <div className="flex gap-2 pt-1">
              <Button
                variant="primary"
                block
                icon={scanning ? X : ScanLine}
                loading={scanning}
                onClick={() => (scanning ? void cancelScan() : void startScan())}
                disabled={!device}
              >
                {scanning ? t('scanner.cancel') : t('scanner.capture')}
              </Button>
            </div>

            <div className="rounded-md border border-[var(--hairline)] p-2.5">
              <p className="text-[11.5px] font-medium text-[var(--ink)]">{t('scanner.saveProfile')}</p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={profileName}
                  placeholder="Nama profil"
                  onChange={(event) => setProfileName(event.target.value)}
                />
                <Button size="sm" icon={Save} onClick={() => void saveProfile()}>
                  {t('common.save')}
                </Button>
              </div>
              <div className="mt-2 space-y-1">
                {profiles.map((profile) => (
                  <div key={profile.id} className="flex items-center gap-1">
                    <button
                      onClick={() => applyProfile(profile)}
                      className="focus-ring flex-1 truncate rounded px-1.5 py-1 text-left text-[11.5px] text-[var(--body-text)] hover:bg-[var(--surface-card)]"
                      title="Terapkan profil"
                    >
                      {profile.name} · {profile.resolution} DPI · {profile.paperSize}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          setProfiles(await api.scanner.deleteProfile(profile.id));
                        } catch (error) {
                          toast({ title: errorMessage(error), tone: 'error' });
                        }
                      }}
                      className="focus-ring rounded p-1 text-[var(--muted-soft)] hover:text-[var(--error)]"
                      title={t('common.delete')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {profiles.length === 0 ? (
                  <p className="text-[11px] text-[var(--muted-soft)]">Belum ada profil tersimpan.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <CameraCapture
              autoCapture={
                settings?.autoCapture ?? {
                  enabled: true,
                  sensitivity: 60,
                  stabilityThreshold: 2.5,
                  captureDelayMs: 900,
                  blurThreshold: 60,
                  minDocumentSize: 18,
                  countdownMs: 700,
                }
              }
              onCapture={async (dataUrl) => {
                const response = await api.images.warp(dataUrl, [
                  { x: 0, y: 0 },
                  { x: 1, y: 0 },
                  { x: 1, y: 1 },
                  { x: 0, y: 1 },
                ]);
                await appendPages([response.dataUrl]);
              }}
            />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-[var(--muted)]" />
            <p className="text-[12.5px] font-medium text-[var(--ink)]">
              Pratinjau hasil scan
            </p>
            {pages.length ? <Badge tone="info">{pages.length} halaman</Badge> : null}
            {pages.length ? (
              <span className="text-[11px] text-[var(--muted)]">
                {formatBytes(pages.reduce((total, page) => total + dataUrlBytes(page.dataUrl), 0))}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {pages.length ? (
              <Button size="sm" variant="ghost" onClick={() => setPages([])}>
                Bersihkan
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              icon={FilePlus2}
              loading={saving}
              disabled={!pages.length}
              onClick={() => void appendPages(pages.map((page) => page.dataUrl))}
            >
              Tambahkan ke dokumen
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {warning ? (
            <Alert tone="warning" title="Catatan">
              {warning}
            </Alert>
          ) : null}

          {scanning ? (
            <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
              <p className="text-[13px] font-medium text-[var(--ink)]">Memindai dokumen…</p>
              <p className="max-w-sm text-[12px] text-[var(--muted)]">
                Jangan ubah pengaturan scanner selama proses berjalan. Tekan Batalkan untuk menghentikan.
              </p>
              <Button size="sm" variant="secondary" onClick={() => void cancelScan()}>
                {t('scanner.cancel')}
              </Button>
            </Card>
          ) : pages.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="Belum ada hasil pemindaian"
              description="Atur konfigurasi di panel kiri lalu klik Scan. Hasil akan tampil di sini sebelum ditambahkan ke dokumen."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {pages.map((page, index) => (
                <div
                  key={`${page.path}-${index}`}
                  className="group relative overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface-soft)]"
                >
                  <img src={page.dataUrl} alt={`Halaman ${index + 1}`} className="h-[260px] w-full object-contain" />
                  <div className="flex items-center justify-between border-t border-[var(--hairline)] bg-[var(--canvas)] px-2 py-1.5">
                    <span className="text-[11px] text-[var(--muted)]">
                      #{index + 1} · {page.width}×{page.height}
                    </span>
                    <button
                      onClick={() => setPages((current) => current.filter((_, i) => i !== index))}
                      className="focus-ring rounded p-1 text-[var(--muted-soft)] hover:text-[var(--error)]"
                      title="Hapus halaman"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setTab('camera')}
                className="focus-ring flex h-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--hairline)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
              >
                <Camera size={20} />
                <span className="text-[11.5px]">Tambah dari kamera</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex h-[40px] shrink-0 items-center justify-between border-t border-[var(--hairline)] px-5 text-[11px] text-[var(--muted)]">
          <span>
            {device ? `${device.name} · ${device.driver.toUpperCase()}` : 'Scanner belum dipilih'}
            {capabilities ? ` · ${capabilities.minDpi}–${capabilities.maxDpi} DPI` : ''}
          </span>
          <span className="flex items-center gap-1">
            <Check size={11} className="text-[var(--success)]" /> Mode offline — tidak ada data keluar dari perangkat
          </span>
        </div>
      </div>
    </div>
  );
}
