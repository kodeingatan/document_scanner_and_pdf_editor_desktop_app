import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Clock,
  FileText,
  FolderOpen,
  ImageIcon,
  Layers,
  ScanLine,
  ScanText,
  ShieldCheck,
  Sparkles,
  Stamp,
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { useDocumentStore } from '../store/documents';
import { useToastStore } from '../store/toast';
import { api, errorMessage } from '../lib/api';
import { Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { formatBytes } from '@shared/constants';
import { useT } from '../i18n';

const workflow = [
  { icon: ScanLine, title: 'Pindai', body: 'Scanner WIA/TWAIN atau kamera dengan deteksi tepi otomatis.' },
  { icon: Sparkles, title: 'Perbaiki', body: '10 preset filter, koreksi perspektif, dan noise reduction.' },
  { icon: Layers, title: 'Kelola', body: 'Urutkan, rotasi, gabung, dan pisahkan halaman dokumen.' },
  { icon: ScanText, title: 'OCR', body: 'Ekstraksi teks offline dan searchable PDF.' },
  { icon: BookOpen, title: 'Ekspor', body: 'PDF final dengan metadata, proteksi, dan kualitas terpilih.' },
];

export default function HomePage() {
  const t = useT();
  const navigate = useNavigate();
  const info = useAppStore((state) => state.info);
  const refreshInfo = useAppStore((state) => state.refreshInfo);
  const list = useDocumentStore((state) => state.list);
  const loadList = useDocumentStore((state) => state.loadList);
  const create = useDocumentStore((state) => state.create);
  const setCurrent = useDocumentStore((state) => state.setCurrent);
  const open = useDocumentStore((state) => state.open);
  const toast = useToastStore((state) => state.push);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void loadList();
    void refreshInfo();
  }, [loadList, refreshInfo]);

  const recent = list.slice(0, 6);
  const stats = [
    { label: t('home.stats.documents'), value: info?.totalDocuments ?? 0, icon: FileText },
    { label: t('home.stats.pages'), value: info?.totalPages ?? 0, icon: Layers },
    {
      label: t('home.stats.scanned'),
      value: list.filter((doc) => doc.category === 'scanned').length,
      icon: ScanLine,
    },
    {
      label: t('home.stats.converted'),
      value: list.filter((doc) => ['converted', 'edited'].includes(doc.category)).length,
      icon: Sparkles,
    },
  ];

  const newDocument = async () => {
    setBusy(true);
    const record = await create();
    setBusy(false);
    if (record) navigate('/workspace');
  };

  const importFiles = async () => {
    setBusy(true);
    try {
      const record = await api.documents.pickAndImport();
      if (record) {
        setCurrent(record);
        await loadList();
        void refreshInfo();
        navigate('/workspace');
      }
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1160px] px-8 py-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-soft)]">
              {t('app.tagline')}
            </p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--ink)]">
              {t('home.title')}
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-6 text-[var(--muted)]">{t('home.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-pill border border-[var(--hairline)] bg-[var(--surface-soft)] px-3.5 py-2 text-[11px] text-[var(--muted)]">
            <ShieldCheck size={13} className="text-[var(--success)]" />
            {t('home.offline')}
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <Card className="relative overflow-hidden bg-[var(--surface-card)] dark:bg-[var(--surface-card)]">
            <div className="flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--canvas)] text-[var(--ink)]">
                <ScanLine size={16} />
              </span>
              <span className="rounded-pill bg-[var(--canvas)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                P0 · Scanner
              </span>
            </div>
            <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {t('home.quickScan')}
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
              Deteksi dokumen otomatis, koreksi perspektif, dan batch scanning dalam satu alur.
            </p>
            <Button variant="primary" size="sm" className="mt-4" onClick={() => navigate('/scanner')}>
              {t('nav.scanner')} <ArrowRight size={13} />
            </Button>
          </Card>

          <Card className="bg-[var(--surface-card)]">
            <div className="flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--canvas)] text-[var(--ink)]">
                <FolderOpen size={16} />
              </span>
              <span className="rounded-pill bg-[var(--canvas)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                Import
              </span>
            </div>
            <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {t('home.import')}
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
              Impor PDF, JPG, PNG, TIFF, atau BMP. Setiap halaman dikelola dalam workspace yang sama.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={importFiles} loading={busy}>
                {t('common.import')}
              </Button>
              <Button size="sm" variant="ghost" onClick={newDocument} loading={busy}>
                {t('common.new')}
              </Button>
            </div>
          </Card>

          <Card className="bg-[var(--surface-dark)] text-white">
            <div className="flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-dark-elevated)] text-white">
                <BookOpen size={16} />
              </span>
              <span className="rounded-pill bg-[var(--surface-dark-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--on-dark-soft)]">
                23 tools
              </span>
            </div>
            <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-white">PDF Tools Center</h3>
            <p className="mt-1 text-[12px] leading-5 text-[var(--on-dark-soft)]">
              Konversi dua arah, kompresi, proteksi password, page numbering, dan metadata.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-4 border-transparent bg-white text-[#111] hover:bg-white/90"
              onClick={() => navigate('/pdf')}
            >
              {t('home.openPdf')} <ArrowRight size={13} />
            </Button>
          </Card>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="flex items-center gap-3 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-card)] text-[var(--muted)]">
                <stat.icon size={16} />
              </span>
              <div>
                <p className="text-[19px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">{stat.label}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-9 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <SectionTitle
              title={t('home.recent')}
              description="Dokumen yang terakhir Anda kerjakan"
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/library')}>
                  {t('home.viewAll')} <ArrowRight size={12} />
                </Button>
              }
            />
            <div className="mt-3 space-y-2">
              {recent.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Belum ada dokumen"
                  description="Mulai dengan memindai dokumen atau mengimpor file yang sudah ada."
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => navigate('/scanner')}>
                        <Camera size={14} /> {t('home.quickScan')}
                      </Button>
                      <Button size="sm" onClick={importFiles}>
                        {t('common.import')}
                      </Button>
                    </div>
                  }
                />
              ) : (
                recent.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={async () => {
                      await open(doc.id);
                      navigate('/workspace');
                    }}
                    className="focus-ring group flex w-full items-center gap-3 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] p-2.5 text-left transition-colors hover:bg-[var(--surface-soft)]"
                  >
                    <div className="flex h-[52px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--hairline)] bg-[var(--surface-soft)]">
                      {doc.thumbnailDataUrl ? (
                        <img src={doc.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <FileText size={16} className="text-[var(--muted-soft)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-[var(--ink)]">{doc.name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                        <span>{doc.pageCount} {t('common.pages')}</span>
                        <span className="h-2.5 w-px bg-[var(--hairline)]" />
                        <span>{formatBytes(doc.sizeBytes)}</span>
                        <span className="h-2.5 w-px bg-[var(--hairline)]" />
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(doc.updatedAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-[var(--muted-soft)] opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <SectionTitle title={t('home.workflow')} description="Alur dokumen dari pindai hingga ekspor" />
            <div className="mt-3 space-y-1.5">
              {workflow.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-3 rounded-lg border border-[var(--hairline)] px-3 py-2.5"
                >
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-card)] text-[10px] font-semibold text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink)]">
                      <step.icon size={12} className="text-[var(--muted)]" /> {step.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="subtle" onClick={() => navigate('/editor')}>
                <ImageIcon size={13} /> {t('nav.editor')}
              </Button>
              <Button size="sm" variant="subtle" onClick={() => navigate('/ocr')}>
                <Stamp size={13} /> {t('nav.ocr')}
              </Button>
            </div>
          </div>
        </div>
        {busy ? (
          <div className="mt-6 flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Spinner size={12} /> {t('common.processing')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
