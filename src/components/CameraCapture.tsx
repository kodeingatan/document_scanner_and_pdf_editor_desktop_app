import React from 'react';
import { Camera, Check, RefreshCw, ScanEye, VideoOff } from 'lucide-react';
import type { AutoCaptureSettings, DetectionResult, Quad } from '@shared/types';
import { api, errorMessage } from '../lib/api';
import { Alert, Badge, Button, Field, Select, Switch } from './ui';
import { CropOverlay, FULL_QUAD } from './CropOverlay';

type Pending = { dataUrl: string; quad: Quad; detection: DetectionResult | null };

const EMPTY_DETECTION: DetectionResult = {
  found: false,
  confidence: 0,
  corners: FULL_QUAD,
  areaRatio: 0,
  brightness: 0,
  blur: 0,
};

export function CameraCapture({
  autoCapture,
  onCapture,
}: {
  autoCapture: AutoCaptureSettings;
  onCapture: (dataUrl: string) => Promise<void>;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);

  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState('');
  const [error, setError] = React.useState('');
  const [ready, setReady] = React.useState(false);
  const [auto, setAuto] = React.useState(autoCapture.enabled);
  const [detection, setDetection] = React.useState<DetectionResult | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [countdown, setCountdown] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [shots, setShots] = React.useState(0);

  const stopStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = React.useCallback(
    async (targetId?: string) => {
      stopStream();
      setError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: targetId
            ? { deviceId: { exact: targetId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [stopStream],
  );

  React.useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) => {
        if (cancelled) return;
        const cameras = list.filter((device) => device.kind === 'videoinput');
        setDevices(cameras);
        const preferred = deviceId || cameras[0]?.deviceId || '';
        setDeviceId(preferred);
        if (preferred) void start(preferred);
      })
      .catch((caught) => setError(errorMessage(caught)));
    return () => {
      cancelled = true;
      stopStream();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grabFrame = React.useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  const takeShot = React.useCallback(async () => {
    const dataUrl = grabFrame();
    if (!dataUrl) return;
    try {
      const result = await api.images.detect(dataUrl, autoCapture.sensitivity);
      setPending({ dataUrl, quad: result.found ? result.corners : FULL_QUAD, detection: result });
      setCountdown(0);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [autoCapture.sensitivity, grabFrame]);

  // Continuous detection loop for the auto capture mode.
  React.useEffect(() => {
    if (!auto || !ready || pending) return undefined;
    let cancelled = false;
    let missed = 0;
    const tick = async () => {
      const dataUrl = grabFrame();
      if (!dataUrl || cancelled) return;
      try {
        const result = await api.images.detect(dataUrl, autoCapture.sensitivity);
        if (cancelled) return;
        setDetection(result);
        const stable =
          result.found &&
          result.confidence >= autoCapture.sensitivity / 100 &&
          result.areaRatio * 100 >= autoCapture.minDocumentSize &&
          result.blur >= autoCapture.blurThreshold;
        missed = stable ? 0 : missed + 1;
        if (stable && missed === 0) {
          setCountdown(Math.max(1, Math.round(autoCapture.countdownMs / 1000)));
          window.setTimeout(() => {
            if (!cancelled) void takeShot();
          }, autoCapture.countdownMs);
        }
      } catch {
        /* keep the loop alive; a single bad frame should not stop capture */
      }
    };
    timerRef.current = window.setInterval(tick, Math.max(500, autoCapture.captureDelayMs));
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      setCountdown(0);
    };
  }, [auto, ready, pending, autoCapture, grabFrame, takeShot]);

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const warped = await api.images.warp(pending.dataUrl, pending.quad);
      await onCapture(warped.dataUrl);
      setShots((count) => count + 1);
      setPending(null);
      setDetection(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {error ? <Alert tone="error" title="Kamera tidak dapat digunakan">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Perangkat kamera" className="min-w-[220px] flex-1">
          <Select
            value={deviceId}
            onChange={(event) => {
              setDeviceId(event.target.value);
              void start(event.target.value);
            }}
          >
            {devices.length === 0 ? <option value="">Tidak ada kamera</option> : null}
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Kamera ${index + 1}`}
              </option>
            ))}
          </Select>
        </Field>
        <Switch checked={auto} onChange={setAuto} label="Auto capture" />
        <Button size="sm" icon={RefreshCw} onClick={() => void start(deviceId)}>
          Restart
        </Button>
      </div>

      <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface-dark)]">
        <video ref={videoRef} muted playsInline className="max-h-[52vh] w-full object-contain" />
        <canvas ref={canvasRef} className="hidden" />
        {!ready && !error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--on-dark-soft)]">
            <VideoOff size={22} />
            <p className="text-[12px]">Menunggu kamera…</p>
          </div>
        ) : null}
        {detection ? (
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Badge tone={detection.found ? 'success' : 'neutral'}>
              <ScanEye size={11} /> {detection.found ? 'Dokumen terdeteksi' : 'Mencari dokumen'}
            </Badge>
            <span className="rounded-pill bg-black/55 px-2 py-0.5 text-[10px] text-white">
              {Math.round(detection.confidence * 100)}% · blur {Math.round(detection.blur)}
            </span>
          </div>
        ) : null}
        {countdown > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-[24px] font-semibold text-white">
              {countdown}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-[var(--muted)]">
          {shots > 0 ? `${shots} halaman diambil. ` : ''}
          Posisikan dokumen memenuhi bingkai dengan pencahayaan merata.
        </p>
        <Button variant="primary" icon={Camera} onClick={() => void takeShot()} disabled={!ready || !!pending}>
          Ambil gambar
        </Button>
      </div>

      {pending ? (
        <div className="rounded-lg border border-[var(--hairline)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-[var(--ink)]">Sesuaikan sudut dokumen</p>
            <span className="text-[11px] text-[var(--muted)]">
              {pending.detection?.found ? 'Sudut terdeteksi otomatis' : 'Atur manual'}
            </span>
          </div>
          <div className="flex justify-center">
            <CropOverlay
              src={pending.dataUrl}
              quad={pending.quad}
              onChange={(quad) => setPending((current) => (current ? { ...current, quad } : current))}
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" onClick={() => setPending(null)}>
              Batalkan
            </Button>
            <Button size="sm" variant="primary" icon={Check} loading={saving} onClick={() => void confirm()}>
              Simpan halaman
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
