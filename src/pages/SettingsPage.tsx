import React from 'react';
import {
  AlertTriangle,
  Check,
  FolderOpen,
  Gauge,
  Info,
  Languages,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { AppSettings, OcrLanguageInfo, PaperSizeName } from '@shared/types';
import { PAPER_SIZES, PAPER_SIZE_OPTIONS, RESOLUTION_OPTIONS } from '@shared/constants';
import { useAppStore } from '../store/app';
import { useToastStore } from '../store/toast';
import { api, errorMessage } from '../lib/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Slider,
  Switch,
  Tabs,
} from '../components/ui';
import { useT } from '../i18n';

type Tab = 'general' | 'scan' | 'storage' | 'ocr' | 'performance' | 'about';

export default function SettingsPage() {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const info = useAppStore((state) => state.info);
  const update = useAppStore((state) => state.update);
  const reset = useAppStore((state) => state.reset);
  const refreshInfo = useAppStore((state) => state.refreshInfo);
  const toast = useToastStore((state) => state.push);
  const [tab, setTab] = React.useState<Tab>('general');
  const [languages, setLanguages] = React.useState<OcrLanguageInfo[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  React.useEffect(() => {
    void api.ocr.languages().then(setLanguages).catch(() => undefined);
  }, []);

  if (!settings) {
    return <div className="p-8 text-[12px] text-[var(--muted)]">{t('common.loading')}</div>;
  }

  const patch = async (next: Partial<AppSettings>) => {
    setSaving(true);
    try {
      await update(next);
      toast({ title: t('settings.saved'), tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[900px] px-8 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink)]">{t('settings.title')}</h1>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">
              Semua pengaturan disimpan lokal dan diterapkan tanpa koneksi internet.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void refreshInfo()} icon={RefreshCw}>
            Refresh
          </Button>
        </div>

        <Tabs
          className="mt-5"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'general', label: t('settings.general') },
            { value: 'scan', label: t('settings.scan') },
            { value: 'storage', label: t('settings.storage') },
            { value: 'ocr', label: t('settings.ocr') },
            { value: 'performance', label: t('settings.performance') },
            { value: 'about', label: t('settings.about') },
          ]}
        />

        <div className="mt-5 space-y-4">
          {tab === 'general' ? (
            <>
              <Card className="space-y-5">
                <SectionTitle title={t('settings.general')} description="Bahasa dan tampilan aplikasi" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('settings.language')}>
                    <Select
                      value={settings.language}
                      onChange={(event) => void patch({ language: event.target.value as 'id' | 'en' })}
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </Select>
                  </Field>
                  <Field label={t('settings.theme')}>
                    <Select
                      value={settings.theme}
                      onChange={(event) => void patch({ theme: event.target.value as AppSettings['theme'] })}
                    >
                      <option value="light">{t('settings.light')}</option>
                      <option value="dark">{t('settings.dark')}</option>
                      <option value="system">{t('settings.system')}</option>
                    </Select>
                  </Field>
                  <Field label="Default scanner" hint="Perangkat yang dipilih otomatis pada halaman Scanner">
                    <Input
                      value={settings.defaultScannerId}
                      onChange={(event) => void patch({ defaultScannerId: event.target.value })}
                      placeholder="Device ID scanner WIA"
                    />
                  </Field>
                  <Field label="Kamera default" hint="Device ID kamera (kosongkan untuk otomatis)">
                    <Input
                      value={settings.cameraDeviceId}
                      onChange={(event) => void patch({ cameraDeviceId: event.target.value })}
                      placeholder="Otomatis"
                    />
                  </Field>
                </div>
                <Switch
                  checked={settings.autoSave}
                  onChange={(value) => void patch({ autoSave: value })}
                  label={t('settings.autoSave')}
                  description="Simpan status dokumen dan database secara berkala"
                />
                <Slider
                  label="Interval auto-save"
                  value={settings.autoSaveIntervalSec}
                  min={15}
                  max={600}
                  step={15}
                  suffix=" detik"
                  onChange={(value) => void patch({ autoSaveIntervalSec: value })}
                />
                <Switch
                  checked={settings.sidebarCollapsed}
                  onChange={(value) => void patch({ sidebarCollapsed: value })}
                  label="Sidebar ringkas"
                  description="Tampilkan navigasi dalam mode ikon"
                />
              </Card>
              <Card className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--ink)]">Reset pengaturan aplikasi</p>
                  <p className="text-[11.5px] text-[var(--muted)]">
                    Mengembalikan semua preferensi ke nilai default. Dokumen tidak terhapus.
                  </p>
                </div>
                <Button variant={confirmReset ? 'danger' : 'secondary'} size="sm" onClick={async () => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  await reset();
                  setConfirmReset(false);
                  toast({ title: 'Pengaturan direset', tone: 'success' });
                }}>
                  {confirmReset ? 'Konfirmasi reset' : t('settings.reset')}
                </Button>
              </Card>
            </>
          ) : null}

          {tab === 'scan' ? (
            <>
              <Card className="space-y-4">
                <SectionTitle title={t('settings.scan')} description="Nilai default untuk sesi pemindaian baru" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('settings.defaultResolution')}>
                    <Select
                      value={settings.defaultResolution}
                      onChange={(event) => void patch({ defaultResolution: Number(event.target.value) })}
                    >
                      {RESOLUTION_OPTIONS.map((dpi) => (
                        <option key={dpi} value={dpi}>
                          {dpi} DPI
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('settings.defaultPaper')}>
                    <Select
                      value={settings.defaultPaperSize}
                      onChange={(event) =>
                        void patch({ defaultPaperSize: event.target.value as PaperSizeName })
                      }
                    >
                      {PAPER_SIZE_OPTIONS.map((paper) => (
                        <option key={paper} value={paper}>
                          {PAPER_SIZES[paper].label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Format gambar default">
                    <Select
                      value={settings.defaultImageFormat}
                      onChange={(event) =>
                        void patch({ defaultImageFormat: event.target.value as 'png' | 'jpg' | 'tiff' })
                      }
                    >
                      <option value="png">PNG</option>
                      <option value="jpg">JPG</option>
                      <option value="tiff">TIFF</option>
                    </Select>
                  </Field>
                  <Field label="Kualitas PDF default">
                    <Select
                      value={settings.defaultPdfQuality}
                      onChange={(event) =>
                        void patch({ defaultPdfQuality: event.target.value as AppSettings['defaultPdfQuality'] })
                      }
                    >
                      <option value="low">Low (ukuran kecil)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (rekomendasi)</option>
                      <option value="maximum">Maximum</option>
                    </Select>
                  </Field>
                </div>
              </Card>

              <Card className="space-y-4">
                <SectionTitle title="Auto capture kamera" description="Ambang batas deteksi dokumen otomatis" />
                <Switch
                  checked={settings.autoCapture.enabled}
                  onChange={(value) =>
                    void patch({ autoCapture: { ...settings.autoCapture, enabled: value } })
                  }
                  label={t('scanner.autoCapture')}
                  description="Ambil gambar otomatis ketika dokumen stabil dan fokus"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Slider
                    label="Sensitivitas deteksi"
                    value={settings.autoCapture.sensitivity}
                    min={1}
                    max={100}
                    onChange={(value) =>
                      void patch({ autoCapture: { ...settings.autoCapture, sensitivity: value } })
                    }
                  />
                  <Slider
                    label="Ambang stabilitas"
                    value={settings.autoCapture.stabilityThreshold}
                    min={0.5}
                    max={10}
                    step={0.5}
                    onChange={(value) =>
                      void patch({ autoCapture: { ...settings.autoCapture, stabilityThreshold: value } })
                    }
                  />
                  <Slider
                    label="Delay capture"
                    value={settings.autoCapture.captureDelayMs}
                    min={0}
                    max={3000}
                    step={100}
                    suffix=" ms"
                    onChange={(value) =>
                      void patch({ autoCapture: { ...settings.autoCapture, captureDelayMs: value } })
                    }
                  />
                  <Slider
                    label="Ambang blur"
                    value={settings.autoCapture.blurThreshold}
                    min={0}
                    max={300}
                    step={5}
                    onChange={(value) =>
                      void patch({ autoCapture: { ...settings.autoCapture, blurThreshold: value } })
                    }
                  />
                  <Slider
                    label="Ukuran dokumen minimum"
                    value={settings.autoCapture.minDocumentSize}
                    min={5}
                    max={90}
                    suffix="%"
                    onChange={(value) =>
                      void patch({ autoCapture: { ...settings.autoCapture, minDocumentSize: value } })
                    }
                  />
                  <Slider
                    label="Countdown capture"
                    value={settings.autoCapture.countdownMs}
                    min={0}
                    max={3000}
                    step={100}
                    suffix=" ms"
                    onChange={(value) =>
                      void patch({ autoCapture: { ...settings.autoCapture, countdownMs: value } })
                    }
                  />
                </div>
              </Card>

              <Card className="space-y-3">
                <SectionTitle title="Integrasi perangkat" description="Path eksternal untuk driver dan konversi" />
                <Field
                  label="LibreOffice (soffice.exe)"
                  hint="Diperlukan untuk konversi Word/Excel/PPT ke PDF"
                >
                  <div className="flex gap-2">
                    <Input
                      value={settings.libreOfficePath}
                      onChange={(event) => void patch({ libreOfficePath: event.target.value })}
                      placeholder="C:\Program Files\LibreOffice\program\soffice.exe"
                    />
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={async () => {
                        const chosen = await api.dialog.openFiles({
                          title: 'Pilih soffice.exe',
                          filters: [{ name: 'Executable', extensions: ['exe'] }],
                        });
                        if (chosen[0]) await patch({ libreOfficePath: chosen[0] });
                      }}
                    >
                      <FolderOpen size={14} /> Browse
                    </Button>
                  </div>
                </Field>
                <Field label="TWAIN bridge CLI" hint="Path executable bridge TWAIN (opsional)">
                  <div className="flex gap-2">
                    <Input
                      value={settings.twainBridgePath}
                      onChange={(event) => void patch({ twainBridgePath: event.target.value })}
                      placeholder="C:\Tools\naps2.console.exe"
                    />
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={async () => {
                        const chosen = await api.dialog.openFiles({
                          title: 'Pilih TWAIN bridge',
                          filters: [{ name: 'Executable', extensions: ['exe'] }],
                        });
                        if (chosen[0]) await patch({ twainBridgePath: chosen[0] });
                      }}
                    >
                      <FolderOpen size={14} /> Browse
                    </Button>
                  </div>
                </Field>
                <Alert tone={info?.libreOfficeDetected ? 'success' : 'warning'}>
                  {info?.libreOfficeDetected
                    ? `LibreOffice terdeteksi di ${info.libreOfficePath}`
                    : 'LibreOffice tidak terdeteksi. Konversi Office ke PDF akan dinonaktifkan sampai path diatur.'}
                </Alert>
              </Card>
            </>
          ) : null}

          {tab === 'storage' ? (
            <>
              <Card className="space-y-4">
                <SectionTitle title={t('settings.storage')} description="Lokasi penyimpanan dokumen dan hasil ekspor" />
                <Field label={t('settings.documentsDir')} hint="Menyimpan file original, processed, dan thumbnail">
                  <div className="flex gap-2">
                    <Input value={settings.documentsDirectory || info?.documentsDirectory || ''} readOnly />
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={async () => {
                        const chosen = await api.settings.chooseDirectory('documents');
                        if (chosen) toast({ title: 'Direktori dokumen diperbarui', tone: 'success' });
                      }}
                    >
                      <FolderOpen size={14} /> Ubah
                    </Button>
                  </div>
                </Field>
                <Field label={t('settings.outputDir')} hint="Default lokasi ekspor PDF dan hasil konversi">
                  <div className="flex gap-2">
                    <Input value={settings.outputDirectory || info?.outputDirectory || ''} readOnly />
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={async () => {
                        const chosen = await api.settings.chooseDirectory('output');
                        if (chosen) toast({ title: 'Direktori output diperbarui', tone: 'success' });
                      }}
                    >
                      <FolderOpen size={14} /> Ubah
                    </Button>
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await api.app.backup();
                      toast({ title: 'Backup database dibuat', tone: 'success' });
                    }}
                    icon={ShieldCheck}
                  >
                    Backup database
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const result = await api.app.dbIntegrityCheck();
                      toast({
                        title: result.ok ? 'Integritas database OK' : 'Database perlu perhatian',
                        description: result.messages.slice(0, 2).join(' · '),
                        tone: result.ok ? 'success' : 'error',
                      });
                    }}
                  >
                    Cek integritas
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const removed = await api.app.cleanupTemp();
                      toast({ title: `${removed} file temporary dibersihkan`, tone: 'success' });
                    }}
                    icon={Trash2}
                  >
                    Bersihkan temporary
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void api.app.openPath(info?.dataDirectory ?? '')}
                    icon={FolderOpen}
                  >
                    Buka folder data
                  </Button>
                </div>
              </Card>
              <Card className="space-y-4">
                <SectionTitle title="Backup & recovery" description="Perlindungan data otomatis" />
                <Switch
                  checked={settings.backupEnabled}
                  onChange={(value) => void patch({ backupEnabled: value })}
                  label="Backup berkala"
                  description="Backup database setiap 30 menit, menyimpan 5 versi terakhir"
                />
                <Switch
                  checked={settings.tempAutoCleanup}
                  onChange={(value) => void patch({ tempAutoCleanup: value })}
                  label="Bersihkan temporary otomatis saat startup"
                />
              </Card>
            </>
          ) : null}

          {tab === 'ocr' ? (
            <Card className="space-y-4">
              <SectionTitle title={t('settings.ocr')} description="Tesseract berjalan sepenuhnya offline" />
              <Field label={t('settings.ocrLanguage')}>
                <Select
                  value={settings.ocrLanguage}
                  onChange={(event) => void patch({ ocrLanguage: event.target.value })}
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code} disabled={!language.installed}>
                      {language.label} {language.installed ? '' : '(language pack belum tersedia)'}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--body-text)]">
                  <Languages size={13} /> Language packs
                </p>
                {languages.map((language) => (
                  <div
                    key={language.code}
                    className="flex items-center justify-between rounded-md border border-[var(--hairline)] px-3 py-2 text-[12px]"
                  >
                    <span className="text-[var(--ink)]">
                      {language.label} <span className="font-mono text-[11px] text-[var(--muted)]">({language.code})</span>
                    </span>
                    <Badge tone={language.installed ? 'success' : 'warning'}>
                      {language.installed ? (
                        <>
                          <Check size={10} /> Terpasang
                        </>
                      ) : (
                        'Belum tersedia'
                      )}
                    </Badge>
                  </div>
                ))}
                <Alert tone={info?.tessdataAvailable ? 'success' : 'warning'}>
                  {info?.tessdataAvailable
                    ? 'Language pack tersedia secara lokal. OCR dapat berjalan tanpa internet.'
                    : 'Language pack tidak ditemukan. Jalankan "npm run prepare:assets" untuk mengunduh eng/ind.'}
                </Alert>
              </div>
            </Card>
          ) : null}

          {tab === 'performance' ? (
            <Card className="space-y-5">
              <SectionTitle title={t('settings.performance')} description="Akselerasi dan batas resource" />
              <Switch
                checked={settings.hardwareAcceleration}
                onChange={async (value) => {
                  await patch({ hardwareAcceleration: value });
                  toast({
                    title: 'Perubahan akselerasi hardware memerlukan restart aplikasi',
                    tone: 'info',
                  });
                }}
                label="Hardware acceleration"
                description="Gunakan GPU untuk rendering antarmuka"
              />
              <Slider
                label="Concurrency pemrosesan batch"
                value={settings.processingConcurrency}
                min={1}
                max={8}
                onChange={(value) => void patch({ processingConcurrency: value })}
              />
              <Slider
                label="Batas cache"
                value={settings.cacheLimitMb}
                min={128}
                max={8192}
                step={128}
                suffix=" MB"
                onChange={(value) => void patch({ cacheLimitMb: value })}
              />
              <Alert tone="info">
                Pemrosesan gambar dijalankan secara sekuensial per halaman untuk menjaga penggunaan memori
                tetap terukur pada batch besar.
              </Alert>
            </Card>
          ) : null}

          {tab === 'about' ? (
            <Card className="space-y-4">
              <SectionTitle title={t('settings.about')} description={t('app.name')} />
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Versi', info?.version ?? '-'],
                  ['Electron', info?.electron ?? '-'],
                  ['Chromium', info?.chrome ?? '-'],
                  ['Node', info?.node ?? '-'],
                  ['Platform', info?.platform ?? '-'],
                  ['Scanner backend', info?.scannerBackend ?? '-'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-[var(--hairline)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--muted-soft)]">{label}</p>
                    <p className="text-[12px] font-medium text-[var(--ink)]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-md bg-[var(--surface-card)] px-3 py-2.5 text-[11.5px] leading-5 text-[var(--muted)]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--success)]" />
                <p>
                  Aplikasi ini memproses seluruh dokumen secara lokal. Tidak ada telemetri, cloud OCR, atau
                  pengiriman file keluar dari perangkat Anda.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <Info size={12} />
                <span className="font-mono">{info?.dataDirectory}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <Gauge size={12} />
                <span>
                  {info?.totalDocuments ?? 0} dokumen · {info?.totalPages ?? 0} halaman terindex
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                <ScanLine size={12} />
                <span>{saving ? 'Menyimpan…' : 'Semua perubahan tersimpan otomatis'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--warning)]">
                <AlertTriangle size={12} />
                <span>
                  MuPDF, Tesseract, LibreOffice, dan komponen lain memiliki lisensi masing-masing — periksa
                  sebelum distribusi komersial.
                </span>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
