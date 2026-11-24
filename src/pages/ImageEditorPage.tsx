import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crop, Eraser, Eye, RotateCcw, RotateCw, Scaling, Sparkles, Trash2 } from 'lucide-react';
import type { PageAdjustments } from '@shared/types';
import { DEFAULT_ADJUSTMENTS } from '@shared/types';
import { api, errorMessage } from '../lib/api';
import { useDocumentStore } from '../store/documents';
import { useToastStore } from '../store/toast';
import { useT } from '../i18n';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  SectionTitle,
  Segmented,
  Slider,
  Spinner,
  Switch,
} from '../components/ui';

export default function ImageEditorPage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToastStore((state) => state.push);

  const current = useDocumentStore((state) => state.current);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const previews = useDocumentStore((state) => state.previews);
  const compare = useDocumentStore((state) => state.compare);
  const busy = useDocumentStore((state) => state.busy);
  const store = useDocumentStore.getState;
  const activePage = current?.pages.find((page) => page.id === activePageId) ?? null;

  const [adjustments, setAdjustments] = React.useState<PageAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [resizeMode, setResizeMode] = React.useState<'percent' | 'pixel'>('percent');
  const [percent, setPercent] = React.useState(100);
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [maintainAspect, setMaintainAspect] = React.useState(true);

  React.useEffect(() => {
    if (!activePage) return;
    setAdjustments({ ...DEFAULT_ADJUSTMENTS, ...activePage.adjustments });
    setWidth(activePage.width);
    setHeight(activePage.height);
    setPercent(100);
  }, [activePage?.id]);

  if (!current || !activePage) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={Sparkles}
          title="Tidak ada halaman aktif"
          description="Pilih dokumen dan halaman di Workspace untuk mulai mengedit gambar."
          action={
            <Button size="sm" variant="primary" onClick={() => navigate('/workspace')}>
              Buka Workspace
            </Button>
          }
        />
      </div>
    );
  }

  const image = previews[activePage.id] ?? null;

  const applyResize = () => {
    const params: Record<string, string | number | boolean> =
      resizeMode === 'percent'
        ? { mode: 'percent', percent, maintainAspect }
        : { mode: 'pixel', width, height, maintainAspect };
    void store().operation('resize', params);
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[330px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--hairline)] p-4">
        <SectionTitle title={t('editor.title')} description={t('editor.nonDestructive')} />

        <Card className="space-y-2.5 bg-[var(--surface-soft)]">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
            <Eraser size={12} /> {t('editor.noise')}
          </p>
          <Slider
            label="Noise reduction"
            value={adjustments.denoise}
            min={0}
            max={100}
            onChange={(value) => setAdjustments((state) => ({ ...state, denoise: value }))}
            onReset={() => setAdjustments((state) => ({ ...state, denoise: 0 }))}
          />
          <Button size="sm" block onClick={() => void store().operation('noise-reduction', { strength: 45 })}>
            Terapkan noise reduction
          </Button>
        </Card>

        <Card className="space-y-2.5 bg-[var(--surface-soft)]">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
            <Sparkles size={12} /> {t('editor.finger')}
          </p>
          <Slider
            label="Kekuatan"
            value={adjustments.fingerMarks}
            min={0}
            max={100}
            onChange={(value) => setAdjustments((state) => ({ ...state, fingerMarks: value }))}
            onReset={() => setAdjustments((state) => ({ ...state, fingerMarks: 0 }))}
          />
          <Button size="sm" block onClick={() => void store().operation('finger-marks', { strength: adjustments.fingerMarks || 50 })}>
            Hapus finger mark
          </Button>
        </Card>

        <Card className="space-y-2.5 bg-[var(--surface-soft)]">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
            <RotateCw size={12} /> {t('editor.rotate')}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" icon={RotateCcw} onClick={() => void store().rotate(-90)}>Kiri 90°</Button>
            <Button size="sm" icon={RotateCw} onClick={() => void store().rotate(90)}>Kanan 90°</Button>
          </div>
          <Button size="sm" block variant="ghost" icon={Crop} onClick={() => navigate('/workspace')}>
            Koreksi perspektif di Workspace
          </Button>
        </Card>

        <Card className="space-y-2.5 bg-[var(--surface-soft)]">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">
            <Scaling size={12} /> {t('editor.resize')}
          </p>
          <Segmented
            value={resizeMode}
            onChange={setResizeMode}
            options={[
              { value: 'percent', label: 'Persen' },
              { value: 'pixel', label: 'Piksel' },
            ]}
          />
          {resizeMode === 'percent' ? (
            <Slider label="Skala" value={percent} min={10} max={300} suffix="%" onChange={setPercent} onReset={() => setPercent(100)} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Lebar">
                <Input type="number" min={50} value={width} onChange={(event) => setWidth(Number(event.target.value) || 0)} />
              </Field>
              <Field label="Tinggi">
                <Input type="number" min={50} value={height} onChange={(event) => setHeight(Number(event.target.value) || 0)} />
              </Field>
            </div>
          )}
          <Switch checked={maintainAspect} onChange={setMaintainAspect} label="Jaga rasio aspek" />
          <Button size="sm" block onClick={applyResize}>Terapkan resize</Button>
        </Card>

        <Card className="space-y-2.5 bg-[var(--surface-soft)]">
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted-soft)]">Penyesuaian</p>
          <Slider label="Brightness" value={adjustments.brightness} min={-100} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, brightness: value }))} />
          <Slider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, contrast: value }))} />
          <Slider label="Whiteness" value={adjustments.whitening} min={0} max={100} onChange={(value) => setAdjustments((state) => ({ ...state, whitening: value }))} />
          <Button size="sm" block variant="primary" onClick={() => void store().adjust(adjustments)}>
            {t('common.apply')}
          </Button>
        </Card>

        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void store().resetPage()}>
          Reset halaman ke original
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface-soft)]">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--hairline)] bg-[var(--canvas)] px-5">
          <div>
            <p className="text-[12.5px] font-medium text-[var(--ink)]">
              {current.name} · Halaman {activePage.pageNumber}
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              {activePage.width}×{activePage.height}px · {activePage.dpi} DPI
            </p>
          </div>
          <div className="flex items-center gap-2">
            {busy ? <Spinner size={12} /> : null}
            <Button size="sm" icon={Eye} onClick={() => (compare ? store().clearCompare() : void store().loadCompare(null))}>
              {compare ? 'Tutup perbandingan' : t('workspace.compare')}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {compare ? (
            <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-3">
              {[
                { label: t('editor.before'), src: compare.before },
                { label: t('editor.after'), src: compare.after },
              ].map((item) => (
                <div key={item.label}>
                  <p className="mb-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {item.label}
                  </p>
                  <div className="flex justify-center rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] p-2">
                    <img src={item.src} alt={item.label} className="max-h-[65vh] w-auto object-contain" />
                  </div>
                </div>
              ))}
            </div>
          ) : image ? (
            <div className="flex justify-center">
              <img
                src={image}
                alt="Halaman aktif"
                className="max-h-[68vh] w-auto rounded-md border border-[var(--hairline)] bg-white shadow-soft"
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Spinner size={18} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
