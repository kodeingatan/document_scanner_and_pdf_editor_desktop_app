import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

const root = path.resolve(import.meta.dirname, '..');
const DESIGN = 1024;
const ICO_SIZES = [256, 128, 64, 48, 32, 16];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function docPath(ctx, x, y, w, h, r, fold) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.arcTo(x + r, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function renderIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / DESIGN;
  const b = (v) => v * s;
  const docX = 282;
  const docY = 232;
  const docW = 460;
  const docH = 560;
  const fold = 96;

  ctx.save();
  ctx.scale(s, s);

  const bg = ctx.createLinearGradient(80, 0, 944, 1024);
  bg.addColorStop(0, '#3b82f6');
  bg.addColorStop(1, '#1d4ed8');
  roundRect(ctx, 0, 0, DESIGN, DESIGN, 220);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, DESIGN, DESIGN, 220);
  ctx.clip();
  const sheen = ctx.createRadialGradient(300, 160, 40, 300, 160, 640);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, DESIGN, DESIGN);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.35)';
  ctx.shadowBlur = b(40);
  ctx.shadowOffsetY = b(18);
  docPath(ctx, docX, docY, docW, docH, 30, fold);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  docPath(ctx, docX, docY, docW, docH, 30, fold);
  ctx.clip();

  const tag = roundRect(ctx, docX + 70, docY + 96, 150, 36, 18);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();

  const bars = [320, 260, 300, 210];
  bars.forEach((w, i) => {
    roundRect(ctx, docX + 70, docY + 176 + i * 52, w, 30, 15);
    ctx.fillStyle = i % 2 === 0 ? '#d7dde7' : '#e3e8ef';
    ctx.fill();
  });

  const scanY = 604;
  const band = ctx.createLinearGradient(0, scanY - 92, 0, scanY);
  band.addColorStop(0, 'rgba(56,189,248,0)');
  band.addColorStop(1, 'rgba(56,189,248,0.38)');
  ctx.fillStyle = band;
  ctx.fillRect(docX, scanY - 92, docW, 92);
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = b(28);
  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(docX + 18, scanY);
  ctx.lineTo(docX + docW - 18, scanY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(docX + docW - fold, docY);
  ctx.lineTo(docX + docW - fold, docY + fold);
  ctx.lineTo(docX + docW, docY + fold);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(15,23,42,0.28)';
  ctx.shadowBlur = b(10);
  const i0 = 112;
  const i1 = DESIGN - 112;
  const arm = 130;
  const paths = [
    [i0, i0 + arm, i0, i0, i0 + arm, i0],
    [i1 - arm, i0, i1, i0, i1, i0 + arm],
    [i0, i1 - arm, i0, i1, i0 + arm, i1],
    [i1 - arm, i1, i1, i1, i1, i1 - arm],
  ];
  for (const [ax, ay, bx, by, cx, cy] of paths) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
  return canvas;
}

function writeIco(filePath, entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + 16 * entries.length;
  const dirEntries = [];
  const blobs = [];
  for (const { size, buf } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirEntries.push(entry);
    blobs.push(buf);
  }
  fs.writeFileSync(filePath, Buffer.concat([header, ...dirEntries, ...blobs]));
}

const resourcesDir = path.join(root, 'resources');
const publicDir = path.join(root, 'public');
fs.mkdirSync(resourcesDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const master = renderIcon(DESIGN);
const pngPath = path.join(resourcesDir, 'icon.png');
fs.writeFileSync(pngPath, master.toBuffer('image/png'));

const faviconPath = path.join(publicDir, 'icon.png');
fs.writeFileSync(faviconPath, renderIcon(512).toBuffer('image/png'));

const icoEntries = ICO_SIZES.map((size) => ({
  size,
  buf: renderIcon(size).toBuffer('image/png'),
}));
const icoPath = path.join(resourcesDir, 'icon.ico');
writeIco(icoPath, icoEntries);

for (const file of [pngPath, faviconPath, icoPath]) {
  const { size } = fs.statSync(file);
  console.log(`${path.relative(root, file)}  ${(size / 1024).toFixed(1)} KB`);
}
