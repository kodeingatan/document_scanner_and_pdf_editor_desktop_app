import React from 'react';
import clsx from 'clsx';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileStack,
  FolderOpen,
  Home,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  ScanText,
  Settings as SettingsIcon,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useDocumentStore } from '../store/documents';
import { useJobStore } from '../store/jobs';
import { useI18nStore, useT } from '../i18n';
import { Badge, IconButton, Progress, Spinner } from './ui';
import { formatBytes } from '@shared/constants';

const navItems: Array<{ to: string; key: string; icon: LucideIcon; end?: boolean; shortcut: string }> = [
  { to: '/', key: 'nav.home', icon: Home, end: true, shortcut: 'Ctrl 1' },
  { to: '/scanner', key: 'nav.scanner', icon: ScanLine, shortcut: 'Ctrl 2' },
  { to: '/workspace', key: 'nav.workspace', icon: FileStack, shortcut: '' },
  { to: '/editor', key: 'nav.editor', icon: ImageIcon, shortcut: 'Ctrl 4' },
  { to: '/pdf', key: 'nav.pdf', icon: BookOpen, shortcut: 'Ctrl 3' },
  { to: '/ocr', key: 'nav.ocr', icon: ScanText, shortcut: 'Ctrl 6' },
  { to: '/library', key: 'nav.library', icon: FolderOpen, shortcut: 'Ctrl 5' },
];

function StatusBadge() {
  const current = useDocumentStore((state) => state.current);
  const t = useT();
  if (!current) return null;
  const tone =
    current.status === 'saved' || current.status === 'completed'
      ? 'success'
      : current.status === 'failed'
        ? 'error'
        : current.status === 'processing' || current.status === 'exporting'
          ? 'info'
          : 'warning';
  const labels: Record<string, string> = {
    new: 'Baru',
    unsaved: t('status.unsaved'),
    saved: t('status.saved'),
    processing: 'Memproses',
    exporting: 'Mengekspor',
    completed: 'Selesai',
    failed: 'Gagal',
  };
  return <Badge tone={tone}>{labels[current.status] ?? current.status}</Badge>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const info = useAppStore((state) => state.info);
  const update = useAppStore((state) => state.update);
  const current = useDocumentStore((state) => state.current);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const openDocument = useDocumentStore((state) => state.open);
  const language = useI18nStore((state) => state.language);
  const jobs = useJobStore((state) => state.jobs);
  const collapse = settings?.sidebarCollapsed ?? false;

  const activePage = current?.pages.find((page) => page.id === activePageId) ?? null;
  const runningJob = jobs.find((job) => job.status === 'running');
  const recent = useAppStore((state) => state.settings?.lastDocumentId ?? null);
  const documents = useDocumentStore((state) => state.list);

  React.useEffect(() => {
    if (current || recent) return;
    if (documents.length) void openDocument(documents[0].id);
  }, [current, recent, documents, openDocument]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--hairline)] px-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ink)] text-[var(--on-primary)]">
              <ScanLine size={15} strokeWidth={2.2} />
            </span>
            <div className="leading-tight">
              <p className="text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                Document Scanner
              </p>
              <p className="text-[10px] text-[var(--muted-soft)]">PDF Editor · Offline</p>
            </div>
          </div>
          <span className="mx-1 h-5 w-px bg-[var(--hairline)]" />
          <div className="flex min-w-0 items-center gap-2">
            <p className="max-w-[280px] truncate text-[12.5px] font-medium text-[var(--ink)]">
              {current?.name ?? 'Tidak ada dokumen'}
            </p>
            <StatusBadge />
            {current ? (
              <span className="text-[11px] text-[var(--muted)]">
                {current.pages.length} {t('common.pages')}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {runningJob ? (
            <div className="flex w-[210px] items-center gap-2 rounded-md border border-[var(--hairline)] px-2.5 py-1.5">
              <Spinner size={12} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] text-[var(--muted)]">
                  {runningJob.message || runningJob.type}
                </p>
                <Progress value={runningJob.progress} className="mt-1 h-1" />
              </div>
            </div>
          ) : null}
          <div className="hidden items-center gap-1 rounded-pill border border-[var(--hairline)] px-2.5 py-1 text-[10.5px] text-[var(--muted)] md:flex">
            <ShieldCheck size={12} className="text-[var(--success)]" />
            Offline
          </div>
          <IconButton
            icon={language === 'id' ? SettingsIcon : SettingsIcon}
            label={t('nav.settings')}
            onClick={() => navigate('/settings')}
          />
          <button
            onClick={() => void update({ sidebarCollapsed: !collapse })}
            className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--body-text)] hover:bg-[var(--surface-card)]"
            title="Toggle sidebar"
          >
            {collapse ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={clsx(
            'flex shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--surface-soft)] transition-all',
            collapse ? 'w-[60px]' : 'w-[218px]',
          )}
        >
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={t(item.key)}
                className={({ isActive }) =>
                  clsx(
                    'focus-ring group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-soft'
                      : 'text-[var(--muted)] hover:bg-[var(--canvas)]/60 hover:text-[var(--ink)]',
                  )
                }
              >
                <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                {!collapse ? (
                  <>
                    <span className="flex-1 truncate">{t(item.key)}</span>
                    {item.shortcut ? (
                      <span className="text-[9.5px] text-[var(--muted-soft)] opacity-0 transition-opacity group-hover:opacity-100">
                        {item.shortcut.replace('Ctrl', '⌃')}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-[var(--hairline)] p-2">
            <NavLink
              to="/settings"
              title={t('nav.settings')}
              className={({ isActive }) =>
                clsx(
                  'focus-ring flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium',
                  isActive
                    ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-soft'
                    : 'text-[var(--muted)] hover:bg-[var(--canvas)]/60 hover:text-[var(--ink)]',
                )
              }
            >
              <SettingsIcon size={16} strokeWidth={1.8} className="shrink-0" />
              {!collapse ? <span>{t('nav.settings')}</span> : null}
            </NavLink>
            {!collapse ? (
              <p className="px-2.5 pt-2 text-[9.5px] leading-4 text-[var(--muted-soft)]">
                v{info?.version ?? '1.0.0'} · {info?.scannerBackend?.includes('WIA') ? 'WIA ready' : 'Scanner offline'}
              </p>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden bg-[var(--canvas)]">{children}</main>
      </div>

      <footer className="flex h-[30px] shrink-0 items-center justify-between border-t border-[var(--hairline)] bg-[var(--surface-soft)] px-3 text-[10.5px] text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span>
            {current ? `${current.pages.length} ${t('common.pages')}` : t('status.ready')}
          </span>
          {activePage ? (
            <>
              <span className="h-3 w-px bg-[var(--hairline)]" />
              <span>
                {t('common.page')} {activePage.pageNumber} · {activePage.width}×{activePage.height}px ·{' '}
                {activePage.dpi} DPI
              </span>
              <span className="h-3 w-px bg-[var(--hairline)]" />
              <span className="capitalize">{activePage.filterPreset.replace('-', ' ')}</span>
            </>
          ) : null}
          {current ? (
            <>
              <span className="h-3 w-px bg-[var(--hairline)]" />
              <span>{formatBytes(current.sizeBytes)}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span>{info?.platform}</span>
          <span className="h-3 w-px bg-[var(--hairline)]" />
          <span className={info?.libreOfficeDetected ? 'text-[var(--success)]' : ''}>
            LibreOffice {info?.libreOfficeDetected ? 'terdeteksi' : 'tidak tersedia'}
          </span>
          <span className="h-3 w-px bg-[var(--hairline)]" />
          <span>OCR {info?.tessdataAvailable ? 'siap' : 'tanpa language pack'}</span>
        </div>
      </footer>
    </div>
  );
}
