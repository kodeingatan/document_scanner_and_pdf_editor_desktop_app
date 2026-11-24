import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, FileText, Languages, RefreshCw, ScanText, Search, Sparkles } from 'lucide-react';
import type { OcrLanguageInfo, OcrPageResult } from '@shared/types';
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
  Progress,
  SectionTitle,
  Select,
  Spinner,
  Tabs,
} from '../components/ui';

export default function OcrPage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToastStore((state) => state.push);
  const current = useDocumentStore((state) => state.current);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const selected = useDocumentStore((state) => state.selected);

  const [languages, setLanguages] = React.useState<OcrLanguageInfo[]>([]);
  const [language, setLanguage] = React.useState('ind+eng');
  const [scope, setScope] = React.useState<'page' | 'selected' | 'document'>('document');
  const [results, setResults] = React.useState<OcrPageResult[]>([]);
  const [running, setRunning] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState('');
  const [selectedResult, setSelectedResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.ocr
      .languages()
      .then((list) => {
        setLanguages(list);
        const installed = list.filter((item) => item.installed);
        if (installed.length) setLanguage(installed.map((item) => item.code).join('+'));
      })
      .catch((error) => toast({ title: errorMessage(error), tone: 'error' }));
  }, [toast]);

  const loadResults = React.useCallback(async () => {
    if (!current) {
      setResults([]);
      return;
    }
    try {
      const list = await api.ocr.results(current.id);
      setResults(list);
    } catch {
      setResults([]);
    }
  }, [current]);

  React.useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const run = async () => {
    if (!current) return;
    setRunning(true);
    try {
      const pageIds: string[] | null =
        scope === 'page' ? (activePageId ? [activePageId] : []) : scope === 'selected' ? selected : null;
      if (pageIds !== null && pageIds.length === 0) {
        toast({ title: 'Pilih halaman terlebih dahulu', tone: 'error' });
        return;
      }
      const result = await api.ocr.document(current.id, pageIds, language);
      setResults(result.pages);
      setSelectedResult(result.pages[0]?.pageId ?? null);
      toast({
        title: `OCR selesai · ${result.pages.length} halaman · confidence ${Math.round(result.averageConfidence)}%`,
        tone: 'success',
      });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const exportText = async (format: 'txt' | 'docx') => {
    if (!current) return;
    setBusyAction(format);
    try {
      const result = await api.ocr.exportText(current.id, format);
      if (result) toast({ title: `Teks diekspor: ${result.outputPath}`, tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const searchablePdf = async () => {
    if (!current) return;
    setBusyAction('pdf');
    try {
      const result = await api.ocr.searchablePdf(current.id, language);
      toast({ title: `Searchable PDF dibuat: ${result.outputPath}`, tone: 'success' });
      void api.app.showItemInFolder(result.outputPath).catch(() => undefined);
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const active = results.find((result) => result.pageId === selectedResult) ?? results[0] ?? null;
  const installed = languages.filter((item) => item.installed);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5">
        <div>
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{t('ocr.title')}</h1>
          <p className="text-[11.5px] text-[var(--muted)]">{t('ocr.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={installed.length ? 'success' : 'warning'}>
            {installed.length ? `${installed.length} bahasa tersedia` : 'Language pack tidak ditemukan'}
          </Badge>
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void loadResults()}>
            Muat ulang hasil
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr]">
        <div className="min-h-0 space-y-4 overflow-y-auto border-r border-[var(--hairline)] p-4">
          <Card className="space-y-3 bg-[var(--surface-soft)]">
            <SectionTitle title="Pengaturan OCR" description="Tesseract berjalan lokal tanpa koneksi" />
            <Field label={t('ocr.language')}>
              <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {languages.length === 0 ? <option value={language}>{language}</option> : null}
                {languages.map((item) => (
                  <option key={item.code} value={item.code} disabled={!item.installed}>
                    {item.label} {item.installed ? '' : '(tidak terpasang)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Tabs
              value={scope}
              onChange={setScope}
              tabs={[
                { value: 'page', label: 'Halaman' },
                { value: 'selected', label: 'Terpilih' },
                { value: 'document', label: 'Dokumen' },
              ]}
            />
            <Button
              block
              variant="primary"
              icon={ScanText}
              loading={running}
              disabled={!current}
              onClick={() => void run()}
            >
              {t('ocr.run')}
            </Button>
            {!current ? <Alert tone="warning">Buka dokumen di Workspace terlebih dahulu.</Alert> : null}
          </Card>

          <Card className="space-y-2 bg-[var(--surface-soft)]">
            <SectionTitle title="Ekspor hasil" description="Butuh hasil OCR terlebih dahulu" />
            <Button size="sm" block icon={FileText} disabled={!current || !results.length || busyAction === 'txt'} onClick={() => void exportText('txt')}>
              {t('ocr.exportTxt')}
            </Button>
            <Button size="sm" block icon={FileDown} disabled={!current || !results.length || busyAction === 'docx'} onClick={() => void exportText('docx')}>
              {t('ocr.exportDocx')}
            </Button>
            <Button
              size="sm"
              block
              icon={Search}
              loading={busyAction === 'pdf'}
              disabled={!current || !results.length}
              onClick={() => void searchablePdf()}
            >
              {t('ocr.searchable')}
            </Button>
            <Button size="sm" block variant="ghost" icon={Languages} onClick={() => navigate('/settings')}>
              Kelola language pack
            </Button>
          </Card>

          {results.length ? (
            <div className="rounded-lg border border-[var(--hairline)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">Ringkasan</p>
              <div className="mt-2 space-y-1.5 text-[12px] text-[var(--body-text)]">
                <div className="flex justify-between">
                  <span>Halaman diproses</span>
                  <span className="font-medium">{results.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rata-rata confidence</span>
                  <span className="font-medium">
                    {Math.round(results.reduce((total, item) => total + item.confidence, 0) / results.length)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total karakter</span>
                  <span className="font-medium">{results.reduce((total, item) => total + item.text.length, 0)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          {running ? (
            <div className="border-b border-[var(--hairline)] px-5 py-3">
              <p className="mb-2 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                <Spinner size={12} /> Memproses OCR dengan bahasa {language}…
              </p>
              <Progress value={0.4} />
            </div>
          ) : null}

          {results.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                icon={ScanText}
                title={t('ocr.empty')}
                description="Pilih bahasa lalu jalankan OCR untuk mengekstrak teks dari halaman dokumen."
                action={
                  <Button size="sm" variant="primary" icon={Sparkles} disabled={!current} onClick={() => void run()}>
                    {t('ocr.run')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
              <div className="min-h-0 overflow-y-auto border-r border-[var(--hairline)] p-2">
                {results.map((result) => (
                  <button
                    key={result.pageId}
                    onClick={() => setSelectedResult(result.pageId)}
                    className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                      active?.pageId === result.pageId
                        ? 'border-[var(--ink)] bg-[var(--surface-card)]'
                        : 'border-transparent hover:bg-[var(--surface-soft)]'
                    }`}
                  >
                    <p className="text-[12px] font-medium text-[var(--ink)]">Halaman {result.pageNumber}</p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                      {result.text.length} karakter · {Math.round(result.confidence)}%
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-medium text-[var(--ink)]">
                      Halaman {active?.pageNumber ?? '-'}
                    </p>
                    <Badge tone={((active?.confidence ?? 0) >= 80 ? 'success' : (active?.confidence ?? 0) >= 60 ? 'warning' : 'error')}>
                      {t('ocr.confidence')} {Math.round(active?.confidence ?? 0)}%
                    </Badge>
                    <span className="text-[11px] text-[var(--muted)]">
                      {active ? `${(active.durationMs / 1000).toFixed(1)} s · ${active.language}` : ''}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (active) {
                        void navigator.clipboard.writeText(active.text);
                        toast({ title: 'Teks disalin', tone: 'success' });
                      }
                    }}
                  >
                    {t('common.copy')}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={active?.text ?? ''}
                  className="min-h-0 flex-1 resize-none border-0 bg-[var(--canvas)] p-5 font-mono text-[12.5px] leading-6 text-[var(--ink)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
