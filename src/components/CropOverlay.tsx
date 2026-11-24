import React from 'react';
import type { Quad } from '@shared/types';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Draggable corner overlay for perspective correction. Corners are stored as
 * normalized coordinates so the same quad works at preview and full resolution.
 */
export function CropOverlay({
  src,
  quad,
  onChange,
}: {
  src: string;
  quad: Quad;
  onChange: (quad: Quad) => void;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef<number | null>(null);

  const move = (event: React.PointerEvent) => {
    if (dragging.current === null || !container.current) return;
    const rect = container.current.getBoundingClientRect();
    const point = {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
    const index = dragging.current;
    onChange(quad.map((corner, i) => (i === index ? point : corner)) as Quad);
  };

  const stop = () => {
    dragging.current = null;
  };

  const polygon = quad.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');

  return (
    <div
      ref={container}
      className="relative inline-block select-none overflow-hidden rounded-md border border-[var(--hairline)] bg-[var(--surface-dark)]"
      onPointerMove={move}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      <img src={src} alt="Crop preview" className="block max-h-[58vh] w-auto" draggable={false} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <polygon points={polygon} fill="rgba(17,17,17,0.12)" stroke="#ffffff" strokeWidth="0.35" />
        <line x1={quad[0].x * 100} y1={quad[0].y * 100} x2={quad[2].x * 100} y2={quad[2].y * 100} stroke="rgba(255,255,255,0.35)" strokeWidth="0.2" />
        <line x1={quad[1].x * 100} y1={quad[1].y * 100} x2={quad[3].x * 100} y2={quad[3].y * 100} stroke="rgba(255,255,255,0.35)" strokeWidth="0.2" />
      </svg>
      {quad.map((point, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Corner ${index + 1}`}
          onPointerDown={(event) => {
            event.preventDefault();
            dragging.current = index;
            (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[var(--ink)] bg-white shadow-soft active:cursor-grabbing"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        />
      ))}
    </div>
  );
}

export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
