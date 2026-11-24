import React from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Toasts } from './components/Toasts';
import { Button, Modal } from './components/ui';
import { useAppStore } from './store/app';
import { useDocumentStore } from './store/documents';
import { useJobStore } from './store/jobs';
import { useToastStore } from './store/toast';
import { api, errorMessage } from './lib/api';
import { useT } from './i18n';
import HomePage from './pages/HomePage';
import ScannerPage from './pages/ScannerPage';
import WorkspacePage from './pages/WorkspacePage';
import ImageEditorPage from './pages/ImageEditorPage';
import PdfToolsPage from './pages/PdfToolsPage';
import OcrPage from './pages/OcrPage';
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const init = useAppStore((state) => state.init);
  const ready = useAppStore((state) => state.ready);
  const info = useAppStore((state) => state.info);
  const navigate = useNavigate();
  const t = useT();
  const toast = useToastStore((state) => state.push);
  const [closeRequested, setCloseRequested] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);

  React.useEffect(() => {
    void init();
    void useDocumentStore.getState().loadList();
  }, [init]);

  React.useEffect(() => {
    const unsubscribe = useJobStore.getState().subscribe();
    return unsubscribe;
  }, []);

  const importFromDialog = React.useCallback(
    async (mode: 'auto' | 'pdf' = 'auto') => {
      try {
        const record =
          mode === 'pdf'
            ? (await api.documents.pickAndImportPdf())?.[0] ?? null
            : await api.documents.pickAndImport();
        if (record) {
          useDocumentStore.getState().setCurrent(record);
          await useDocumentStore.getState().loadList();
          navigate('/workspace');
        }
      } catch (error) {
        toast({ title: errorMessage(error), tone: 'error' });
      }
    },
    [navigate, toast],
  );

  React.useEffect(() => {
    const unsubscribe = api.app.onMenuAction(async (action) => {
      const store = useDocumentStore.getState();
      switch (action) {
        case 'new': {
          const record = await store.create();
          if (record) navigate('/workspace');
          break;
        }
        case 'open':
        case 'import':
          await importFromDialog('auto');
          break;
        case 'save':
          await store.save();
          break;
        case 'save-as':
        case 'export': {
          navigate('/workspace');
          window.dispatchEvent(new CustomEvent('docscan:export'));
          break;
        }
        case 'print': {
          const current = store.current;
          if (!current) return;
          try {
            await api.print.document(current.id, {
              documentId: current.id,
              copies: 1,
              paperSize: 'A4',
              landscape: false,
              color: true,
              duplex: false,
              silent: false,
            });
          } catch (error) {
            toast({ title: errorMessage(error), tone: 'error' });
          }
          break;
        }
        case 'undo':
          await store.undo();
          break;
        case 'redo':
          await store.redo();
          break;
        case 'delete-page':
          await store.deleteSelected();
          break;
        case 'zoom-in':
          store.setZoom(store.zoom + 0.15);
          break;
        case 'zoom-out':
          store.setZoom(store.zoom - 0.15);
          break;
        case 'zoom-reset':
          store.setZoom(1);
          break;
        case 'search':
          navigate('/library');
          break;
        case 'nav-home':
          navigate('/');
          break;
        case 'nav-scanner':
          navigate('/scanner');
          break;
        case 'nav-pdf':
          navigate('/pdf');
          break;
        case 'nav-editor':
          navigate('/editor');
          break;
        case 'nav-library':
          navigate('/library');
          break;
        case 'nav-ocr':
          navigate('/ocr');
          break;
        case 'nav-settings':
          navigate('/settings');
          break;
        case 'about':
          setAboutOpen(true);
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, [importFromDialog, navigate, toast]);

  React.useEffect(() => {
    return api.app.onRequestClose(() => setCloseRequested(true));
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        useDocumentStore.getState().clearCompare();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
          <p className="text-[12px] text-[var(--muted)]">Menyiapkan aplikasi…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/editor" element={<ImageEditorPage />} />
          <Route path="/pdf" element={<PdfToolsPage />} />
          <Route path="/ocr" element={<OcrPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <Toasts />

      <Modal
        open={closeRequested}
        onClose={() => setCloseRequested(false)}
        title={t('dialog.unsavedTitle')}
        description={t('dialog.unsavedBody')}
        width="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCloseRequested(false);
                void useDocumentStore.getState().save();
              }}
            >
              {t('common.save')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.app.confirmClose();
                window.close();
              }}
            >
              Keluar tanpa simpan
            </Button>
          </>
        }
      >
        <p className="text-[12px] leading-5 text-[var(--muted)]">
          Dokumen Anda tersimpan otomatis di penyimpanan lokal, namun status dokumen masih memiliki perubahan
          yang belum difinalisasi. Menutup aplikasi tidak akan menghapus file asli.
        </p>
      </Modal>

      <Modal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title={t('app.name')}
        description="Professional offline document digitization suite"
        width="max-w-lg"
      >
        <div className="space-y-3 text-[12px] text-[var(--muted)]">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Versi aplikasi', info?.version ?? '-'],
              ['Electron', info?.electron ?? '-'],
              ['Chromium', info?.chrome ?? '-'],
              ['Node.js', info?.node ?? '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[var(--hairline)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-soft)]">{label}</p>
                <p className="text-[12px] font-medium text-[var(--ink)]">{value}</p>
              </div>
            ))}
          </div>
          <p>
            Data direktori: <span className="font-mono text-[11px] text-[var(--ink)]">{info?.dataDirectory}</span>
          </p>
          <p>
            Semua pemrosesan dokumen, OCR, dan konversi dilakukan secara lokal. Tidak ada dokumen yang dikirim
            ke server.
          </p>
        </div>
      </Modal>
    </>
  );
}
