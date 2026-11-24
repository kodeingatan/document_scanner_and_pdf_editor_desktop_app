import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  Copy,
  FileText,
  FolderOpen,
  Info,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { DocumentSummary } from '@shared/types';
import { useDocumentStore } from '../store/documents';
import { useAppStore } from '../store/app';
import { useToastStore } from '../store/toast';
import { api, errorMessage } from '../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  Tabs,
} from '../components/ui';
import { formatBytes } from '@shared/constants';
import { useT } from '../i18n';

type SortKey = 'date' | 'name' | 'size';
type CategoryFilter = 'all' | 'scanned' | 'imported' | 'converted' | 'edited';

export default function LibraryPage() {
  const t = useT();
  const navigate = useNavigate();
  const list = useDocumentStore((state) => state.list);
  const loadList = useDocumentStore((state) => state.loadList);
  const open = useDocumentStore((state) => state.open);
  const toast = useToastStore((state) => state.push);
  const refreshInfo = useAppStore((state) => state.refreshInfo);
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<SortKey>('date');
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<DocumentSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [detail, setDetail] = React.useState<DocumentSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DocumentSummary | null>(null);

  React.useEffect(() => {
    void loadList(query);
  }, [loadList, query]);

  const filtered = React.useMemo(() => {
    const items = list.filter((doc) => (category === 'all' ? true : doc.category === category));
    const sorted = [...items];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.sizeBytes - a.sizeBytes;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [list, category, sort]);

  const openInWorkspace = async (id: string) => {
    const record = await open(id);
    if (record) navigate('/workspace');
  };

  const rename = async () => {
    if (!renameTarget) return;
    try {
      await api.documents.rename(renameTarget.id, renameValue);
      setRenameTarget(null);
      await loadList(query);
      toast({ title: 'Nama dokumen diperbarui', tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  const duplicate = async (doc: DocumentSummary) => {
    try {
      await api.documents.duplicate(doc.id);
      await loadList(query);
      void refreshInfo();
      toast({ title: 'Dokumen diduplikasi', tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.documents.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadList(query);
      void refreshInfo();
      toast({ title: 'Dokumen dihapus', tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  const exportPdf = async (doc: DocumentSummary) => {
    try {
      const saved = await api.dialog.saveFile({
        title: 'Ekspor PDF',
        defaultPath: `${doc.name}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!saved) return;
      const result = await api.documents.exportPdf(doc.id, {
        quality: 'high',
        imageFormat: 'jpg',
        pageSize: 'Original',
        orientation: 'auto',
        margin: 0,
        addPageNumbers: false,
        outputPath: saved,
      });
      toast({ title: t('toast.exported'), description: result?.path, tone: 'success' });
    } catch (error) {
      toast({ title: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">{t('library.title')}</h1>
          <p className="text-[12px] text-[var(--muted)]">
            {filtered.length} dokumen tersimpan secara lokal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-soft)]"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('library.search')}
              className="h-9 w-[240px] pl-8 pr-8"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-soft)] hover:text-[var(--ink)]"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowDownUp size={13} className="text-[var(--muted-soft)]" />
            <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-9 w-[130px]">
              <option value="date">{t('library.sortDate')}</option>
              <option value="name">{t('library.sortName')}</option>
              <option value="size">{t('library.sortSize')}</option>
            </Select>
          </div>
          <Tabs
            value={category}
            onChange={setCategory}
            tabs={[
              { value: 'all', label: 'Semua' },
              { value: 'scanned', label: 'Scan' },
              { value: 'imported', label: 'Impor' },
              { value: 'converted', label: 'Konversi' },
              { value: 'edited', label: 'Edit' },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Tidak ada dokumen"
            description="Dokumen hasil scan, impor, dan konversi akan muncul di sini."
            action={
              <Button size="sm" variant="primary" onClick={() => navigate('/scanner')}>
                Mulai pindai
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {filtered.map((doc) => (
              <Card key={doc.id} padded={false} className="group relative overflow-hidden">
                <button
                  onClick={() => void openInWorkspace(doc.id)}
                  className="block w-full border-b border-[var(--hairline)] bg-[var(--surface-soft)] p-3 text-left"
                >
                  <div className="flex h-[132px] items-center justify-center overflow-hidden rounded border border-[var(--hairline)] bg-[var(--canvas)]">
                    {doc.thumbnailDataUrl ? (
                      <img src={doc.thumbnailDataUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <FileText size={26} className="text-[var(--muted-soft)]" />
                    )}
                  </div>
                </button>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <p className="line-clamp-2 min-h-[30px] text-[12px] font-medium leading-[1.3] text-[var(--ink)]">
                      {doc.name}
                    </p>
                    <div className="relative">
                      <IconButton
                        icon={MoreHorizontal}
                        label="More"
                        className="h-6 w-6"
                        onClick={() => setMenuFor(menuFor === doc.id ? null : doc.id)}
                      />
                      {menuFor === doc.id ? (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 top-7 z-20 w-[190px] overflow-hidden rounded-md border border-[var(--hairline)] bg-[var(--canvas)] py-1 shadow-raised">
                            {[
                              { label: t('library.open'), icon: FolderOpen, run: () => void openInWorkspace(doc.id) },
                              {
                                label: t('common.rename'),
                                icon: Pencil,
                                run: () => {
                                  setRenameTarget(doc);
                                  setRenameValue(doc.name);
                                },
                              },
                              { label: t('common.duplicate'), icon: Copy, run: () => void duplicate(doc) },
                              { label: t('common.export'), icon: FileText, run: () => void exportPdf(doc) },
                              {
                                label: t('library.openLocation'),
                                icon: FolderOpen,
                                run: () =>
                                  api.documents.exportPdf(doc.id, {
                                    quality: 'high',
                                    imageFormat: 'jpg',
                                    pageSize: 'Original',
                                    orientation: 'auto',
                                    margin: 0,
                                    addPageNumbers: false,
                                  }).then((result) => {
                                    if (result) void api.app.showItemInFolder(result.path);
                                  }),
                              },
                              { label: t('library.properties'), icon: Info, run: () => setDetail(doc) },
                            ].map((item) => (
                              <button
                                key={item.label}
                                onClick={() => {
                                  setMenuFor(null);
                                  item.run();
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--body-text)] hover:bg-[var(--surface-card)]"
                              >
                                <item.icon size={13} /> {item.label}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setMenuFor(null);
                                setDeleteTarget(doc);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--error)] hover:bg-[var(--error)]/8"
                            >
                              <Trash2 size={13} /> {t('common.delete')}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-[var(--muted)]">
                    <span>{doc.pageCount} {t('common.pages')}</span>
                    <span>{formatBytes(doc.sizeBytes)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge tone={doc.category === 'scanned' ? 'info' : 'neutral'}>{doc.category}</Badge>
                    <span className="text-[10px] text-[var(--muted-soft)]">
                      {new Date(doc.updatedAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title={t('common.rename')}
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={rename}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Hapus dokumen"
        description="File asli pada dokumen ini akan dihapus dari penyimpanan lokal."
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={remove}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-[12px] text-[var(--muted)]">{deleteTarget?.name}</p>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={t('library.properties')}
        width="max-w-md"
      >
        {detail ? (
          <dl className="space-y-2 text-[12px]">
            {[
              ['Nama', detail.name],
              ['Kategori', detail.category],
              ['Sumber', detail.sourceType],
              ['Halaman', String(detail.pageCount)],
              ['Ukuran', formatBytes(detail.sizeBytes)],
              ['Dibuat', new Date(detail.createdAt).toLocaleString('id-ID')],
              ['Diubah', new Date(detail.updatedAt).toLocaleString('id-ID')],
              ['ID', detail.id],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-[var(--hairline-soft)] pb-1.5">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-[var(--ink)]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}
