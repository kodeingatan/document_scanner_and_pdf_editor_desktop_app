import { execFile, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  DriverKind,
  ScanOptions,
  ScanProfile,
  ScanSessionResult,
  ScannerCapabilities,
  ScannerDevice,
} from '../../src/shared/types';
import { PAPER_SIZES, RESOLUTION_OPTIONS, mmToPixels } from '../../src/shared/constants';
import { paths } from '../lib/paths';
import { logger } from '../lib/logger';
import { db } from './database';
import { settings } from './settings';
import { decodeFile, encodeImage, toDataUrl } from './imageEngine';

const LIST_SCRIPT = `param()
$ErrorActionPreference = 'SilentlyContinue'
$out = @()
try {
  $dm = New-Object -ComObject WIA.DeviceManager
  foreach ($info in $dm.DeviceInfos) {
    $props = @{}
    foreach ($prop in $info.Properties) {
      try { $props[$prop.Name] = [string]$prop.Value } catch { }
    }
    $out += [pscustomobject]@{
      id = [string]$info.DeviceID
      name = if ($props['Name']) { $props['Name'] } else { 'Scanner WIA' }
      description = if ($props['Description']) { $props['Description'] } else { '' }
      manufacturer = if ($props['Manufacturer']) { $props['Manufacturer'] } else { '' }
      port = if ($props['Port']) { $props['Port'] } else { '' }
      type = [string]$info.Type
    }
  }
} catch { }
ConvertTo-Json -InputObject @($out) -Depth 4 -Compress
`;

const SCAN_SCRIPT = `param(
  [string]$DeviceId,
  [string]$OutDir,
  [int]$Dpi = 300,
  [string]$ColorMode = 'color',
  [int]$BitDepth = 24,
  [int]$Brightness = 0,
  [int]$Contrast = 0,
  [string]$PaperSize = 'A4',
  [string]$Source = 'feeder',
  [int]$Duplex = 0,
  [int]$MaxPages = 1,
  [string]$Format = 'png',
  [int]$WidthMm = 210,
  [int]$HeightMm = 297
)
$ErrorActionPreference = 'Stop'
function Emit($obj) { Write-Output ($obj | ConvertTo-Json -Compress) }
function SetProp($props, $id, $name, $value) {
  try { $props.Item($id).Value = $value; return $true } catch { }
  try { $props.Item($name).Value = $value; return $true } catch { }
  return $false
}
try {
  $dm = New-Object -ComObject WIA.DeviceManager
  $target = $null
  foreach ($info in $dm.DeviceInfos) {
    if ([string]$info.DeviceID -eq $DeviceId) { $target = $info; break }
  }
  if ($null -eq $target) {
    foreach ($info in $dm.DeviceInfos) { $target = $info; break }
  }
  if ($null -eq $target) { Emit @{ error = 'Tidak ada scanner yang terhubung.' }; exit 1 }
  $device = $target.Connect()
  $intent = 1
  if ($ColorMode -eq 'grayscale') { $intent = 2 }
  if ($ColorMode -eq 'black-white') { $intent = 4 }
  $select = 2
  if ($Source -eq 'feeder') { $select = 1 }
  if ($Duplex -eq 1) { $select = $select + 4 }
  SetProp $device.Properties 3088 'Document Handling Select' $select | Out-Null
  $paperWidth = [math]::Round(($WidthMm / 25.4) * $Dpi)
  $paperHeight = [math]::Round(($HeightMm / 25.4) * $Dpi)
  $formatId = '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}'
  if ($Format -eq 'jpg') { $formatId = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}' }
  if ($Format -eq 'tiff') { $formatId = '{B96B3CB1-0728-11D3-9D7B-0000F81EF32E}' }
  if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
  $index = 0
  while ($index -lt $MaxPages) {
    $item = $device.Items.Item(1)
    if ($null -eq $item) { break }
    SetProp $item.Properties 6146 'Current Intent' $intent | Out-Null
    SetProp $item.Properties 6147 'Horizontal Resolution' $Dpi | Out-Null
    SetProp $item.Properties 6148 'Vertical Resolution' $Dpi | Out-Null
    SetProp $item.Properties 6149 'Horizontal Start' 0 | Out-Null
    SetProp $item.Properties 6150 'Vertical Start' 0 | Out-Null
    SetProp $item.Properties 6151 'Horizontal Extent' $paperWidth | Out-Null
    SetProp $item.Properties 6152 'Vertical Extent' $paperHeight | Out-Null
    SetProp $item.Properties 6154 'Brightness' $Brightness | Out-Null
    SetProp $item.Properties 6155 'Contrast' $Contrast | Out-Null
    $ext = 'png'
    if ($Format -eq 'jpg') { $ext = 'jpg' }
    if ($Format -eq 'tiff') { $ext = 'tif' }
    $index = $index + 1
    $file = Join-Path $OutDir ('scan-' + $index.ToString('000') + '.' + $ext)
    $image = $item.Transfer($formatId)
    if ($null -eq $image) { throw 'Transfer gambar gagal.' }
    try {
      if ($BitDepth -eq 1) { $image = $image.Copy() ; $image = $image } catch { }
    } catch { }
    $image.SaveFile($file)
    Emit @{ event = 'page'; index = $index; file = $file }
    $status = 0
    try { $status = [int]$device.Properties.Item(3087).Value } catch { }
    $ready = (($status -band 1) -eq 1) -or (($status -band 4) -eq 4)
    if ($Source -ne 'feeder') { break }
    if (-not $ready) { break }
  }
  if ($index -eq 0) { Emit @{ error = 'Scanner tidak menghasilkan halaman.' }; exit 1 }
  Emit @{ event = 'done'; pages = $index }
} catch {
  Emit @{ error = $_.Exception.Message }
  exit 1
}
`;

class ScannerService {
  private activeChild: ChildProcess | null = null;
  private scriptDir: string | null = null;

  private ensureScripts(): { list: string; scan: string } {
    if (!this.scriptDir) {
      this.scriptDir = path.join(paths.temp, 'scanner-scripts');
      fs.mkdirSync(this.scriptDir, { recursive: true });
      fs.writeFileSync(path.join(this.scriptDir, 'wia-list.ps1'), LIST_SCRIPT, 'utf8');
      fs.writeFileSync(path.join(this.scriptDir, 'wia-scan.ps1'), SCAN_SCRIPT, 'utf8');
    }
    return {
      list: path.join(this.scriptDir, 'wia-list.ps1'),
      scan: path.join(this.scriptDir, 'wia-scan.ps1'),
    };
  }

  private powershellPath(): string {
    return process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  }

  async listDevices(): Promise<ScannerDevice[]> {
    const devices: ScannerDevice[] = [];
    if (process.platform === 'win32') {
      try {
        const script = this.ensureScripts();
        const output = await this.runPowershell(script.list, [], 20_000);
        const parsed = output.trim() ? JSON.parse(output.trim()) : [];
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const entry of list) {
          if (!entry || !entry.id) continue;
          devices.push({
            id: String(entry.id),
            name: String(entry.name || 'Scanner WIA'),
            driver: 'wia',
            status: 'ready',
            description: String(entry.description || ''),
            manufacturer: String(entry.manufacturer || ''),
            port: String(entry.port || ''),
            isDefault: settings.get().defaultScannerId === String(entry.id),
          });
        }
      } catch (error) {
        logger.warn('scanner', 'WIA enumeration failed', { error: String(error) });
      }
    }
    const bridge = settings.get().twainBridgePath;
    if (bridge && fs.existsSync(bridge)) {
      devices.push({
        id: 'twain-bridge',
        name: 'TWAIN Scanner (bridge CLI)',
        driver: 'twain',
        status: 'ready',
        description: 'TWAIN melalui bridge eksternal yang dikonfigurasi di Settings',
        manufacturer: 'TWAIN',
        port: path.basename(bridge),
      });
    }
    for (const device of devices) {
      db.run(
        `INSERT INTO scanner_devices (id, name, driver, status, description, manufacturer, port, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status,
         description = excluded.description, manufacturer = excluded.manufacturer,
         port = excluded.port, last_seen = CURRENT_TIMESTAMP`,
        [device.id, device.name, device.driver, device.status, device.description, device.manufacturer, device.port],
      );
    }
    return devices;
  }

  capabilities(deviceId: string, driver: DriverKind): ScannerCapabilities {
    const notes: string[] = [];
    if (driver === 'twain') {
      notes.push('TWAIN menggunakan bridge CLI eksternal; kemampuan detail bergantung pada bridge.');
    } else {
      notes.push('Daftar resolusi dan ukuran kertas mengikuti standar driver WIA. Nilai yang tidak didukung perangkat akan diabaikan driver.');
    }
    return {
      driver,
      minDpi: 75,
      maxDpi: 1200,
      resolutions: RESOLUTION_OPTIONS.filter((value) => value <= 1200),
      colorModes: ['color', 'grayscale', 'black-white'],
      paperSizes: ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Folio', 'Custom'],
      paperSources: driver === 'twain' ? ['feeder', 'flatbed'] : ['feeder', 'flatbed'],
      duplex: true,
      feeder: true,
      flatbed: true,
      bitDepths: ['1', '8', '24'],
      brightnessRange: [-100, 100],
      contrastRange: [-100, 100],
      formats: driver === 'twain' ? ['png', 'jpg', 'tiff'] : ['png', 'jpg', 'tiff'],
      notes,
    };
  }

  private runPowershell(script: string, args: string[], timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.powershellPath(),
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
        { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error && !stdout) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }

  private async scanWithWia(options: ScanOptions): Promise<string[]> {
    const script = this.ensureScripts();
    const outDir = path.join(paths.temp, `scan-${randomUUID()}`);
    fs.mkdirSync(outDir, { recursive: true });
    const paper =
      options.paperSize === 'Custom' && options.customSize
        ? { widthMm: options.customSize.widthMm, heightMm: options.customSize.heightMm }
        : PAPER_SIZES[options.paperSize] ?? PAPER_SIZES.A4;
    const widthMm = paper.widthMm || 210;
    const heightMm = paper.heightMm || 297;
    const maxPages = options.pageCountMode === 'single' ? 1 : Math.max(1, options.maxPages);
    const args = [
      '-DeviceId',
      options.deviceId,
      '-OutDir',
      outDir,
      '-Dpi',
      String(options.resolution),
      '-ColorMode',
      options.colorMode,
      '-BitDepth',
      options.bitDepth,
      '-Brightness',
      String(Math.round(options.brightness)),
      '-Contrast',
      String(Math.round(options.contrast)),
      '-PaperSize',
      options.paperSize,
      '-Source',
      options.paperSource,
      '-Duplex',
      options.duplex ? '1' : '0',
      '-MaxPages',
      String(maxPages),
      '-Format',
      options.format,
      '-WidthMm',
      String(widthMm),
      '-HeightMm',
      String(heightMm),
    ];
    const output = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        this.powershellPath(),
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script.scan, ...args],
        { timeout: 300_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout, stderr) => {
          this.activeChild = null;
          if (error && !stdout) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }
          resolve(stdout);
        },
      );
      this.activeChild = child;
      child.on('error', (error) => reject(new Error(`Tidak dapat menjalankan WIA: ${error.message}`)));
    });

    const files: string[] = [];
    let serverError = '';
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        const event = JSON.parse(trimmed) as { event?: string; file?: string; error?: string };
        if (event.error) serverError = event.error;
        if (event.file && fs.existsSync(event.file)) files.push(event.file);
      } catch {
        continue;
      }
    }
    if (serverError && !files.length) throw new Error(serverError);
    if (!files.length) {
      throw new Error(
        'Scanner tidak mengembalikan gambar. Pastikan dokumen ada di feeder/flatbed dan driver WIA berfungsi.',
      );
    }
    return files;
  }

  private async scanWithBridge(options: ScanOptions): Promise<string[]> {
    const bridge = settings.get().twainBridgePath;
    if (!bridge || !fs.existsSync(bridge)) {
      throw new Error(
        'TWAIN membutuhkan bridge CLI. Atur path bridge di Settings (mis. Naps2.Console.exe) untuk memindai via TWAIN.',
      );
    }
    const outDir = path.join(paths.temp, `scan-twain-${randomUUID()}`);
    fs.mkdirSync(outDir, { recursive: true });
    const args = [
      '--driver',
      'twain',
      '--device',
      options.deviceId,
      '--dpi',
      String(options.resolution),
      '--color',
      options.colorMode,
      '--paper',
      options.paperSize,
      '--source',
      options.paperSource,
      '--duplex',
      options.duplex ? '1' : '0',
      '--format',
      options.format,
      '--output',
      outDir,
    ];
    await new Promise<void>((resolve, reject) => {
      const child = execFile(bridge, args, { timeout: 300_000, windowsHide: true }, (error, _stdout, stderr) => {
        this.activeChild = null;
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve();
      });
      this.activeChild = child;
    });
    const files = fs
      .readdirSync(outDir)
      .filter((name) => /\.(png|jpe?g|tiff?|pdf)$/i.test(name))
      .sort()
      .map((name) => path.join(outDir, name));
    if (!files.length) throw new Error('Bridge TWAIN tidak menghasilkan file gambar.');
    return files;
  }

  async scan(options: ScanOptions): Promise<ScanSessionResult> {
    if (this.activeChild) throw new Error('Pemindaian lain sedang berjalan. Tunggu atau batalkan terlebih dahulu.');
    const sessionId = randomUUID();
    db.run(
      'INSERT INTO scan_sessions (id, device_id, driver, status, options) VALUES (?, ?, ?, ?, ?)',
      [sessionId, options.deviceId, options.driver, 'running', JSON.stringify(options)],
    );
    try {
      const files =
        options.driver === 'twain' ? await this.scanWithBridge(options) : await this.scanWithWia(options);
      const pages: ScanSessionResult['pages'] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (file.toLowerCase().endsWith('.pdf')) {
          const { extractPdfPages } = await import('./pdf');
          const extracted = await extractPdfPages(file, { dpi: options.resolution });
          for (const [innerIndex, page] of extracted.entries()) {
            const pngPath = file.replace(/\.pdf$/i, `-p${innerIndex + 1}.png`);
            fs.writeFileSync(pngPath, page.buffer);
            const image = await decodeFile(pngPath);
            pages.push({
              index: pages.length,
              width: image.width,
              height: image.height,
              dataUrl: toDataUrl(image, 'png'),
              path: pngPath,
            });
          }
          continue;
        }
        const image = await decodeFile(file);
        const pngPath = file.replace(/\.(jpe?g|tiff?)$/i, '.png');
        if (pngPath !== file) fs.writeFileSync(pngPath, encodeImage(image, 'png'));
        pages.push({
          index,
          width: image.width,
          height: image.height,
          dataUrl: toDataUrl(image, 'png'),
          path: pngPath,
        });
      }
      db.run('UPDATE scan_sessions SET status = ?, pages = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'completed',
        pages.length,
        sessionId,
      ]);
      return {
        sessionId,
        pages,
        warning:
          options.driver === 'wia'
            ? undefined
            : 'TWAIN berjalan melalui bridge CLI; periksa hasil pemindaian.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      db.run('UPDATE scan_sessions SET status = ?, error_message = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'failed',
        message,
        sessionId,
      ]);
      logger.error('scanner', 'scan failed', { error: message });
      throw new Error(message);
    }
  }

  cancel(): void {
    if (this.activeChild) {
      try {
        this.activeChild.kill();
      } catch {
        /* ignore */
      }
      this.activeChild = null;
    }
  }

  profiles(): ScanProfile[] {
    db.run(
      `INSERT INTO scan_profiles (id, name, resolution, color_mode, paper_size, paper_source, duplex, is_default)
       SELECT 'default', 'Default', ?, 'color', 'A4', 'feeder', 0, 1
       WHERE NOT EXISTS (SELECT 1 FROM scan_profiles)`,
      [settings.get().defaultResolution],
    );
    return db
      .all<{
        id: string;
        name: string;
        resolution: number;
        color_mode: string;
        paper_size: string;
        paper_source: string;
        duplex: number;
        is_default: number;
        created_at: string;
      }>('SELECT * FROM scan_profiles ORDER BY created_at')
      .map((row) => ({
        id: row.id,
        name: row.name,
        resolution: row.resolution,
        colorMode: row.color_mode as ScanProfile['colorMode'],
        paperSize: row.paper_size as ScanProfile['paperSize'],
        paperSource: row.paper_source as ScanProfile['paperSource'],
        duplex: row.duplex === 1,
        isDefault: row.is_default === 1,
        createdAt: row.created_at,
      }));
  }

  saveProfile(profile: Omit<ScanProfile, 'id' | 'createdAt'> & { id?: string }): ScanProfile[] {
    const id = profile.id ?? randomUUID();
    db.run(
      `INSERT INTO scan_profiles (id, name, resolution, color_mode, paper_size, paper_source, duplex, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, resolution = excluded.resolution,
       color_mode = excluded.color_mode, paper_size = excluded.paper_size,
       paper_source = excluded.paper_source, duplex = excluded.duplex, is_default = excluded.is_default`,
      [
        id,
        profile.name,
        profile.resolution,
        profile.colorMode,
        profile.paperSize,
        profile.paperSource,
        profile.duplex ? 1 : 0,
        profile.isDefault ? 1 : 0,
      ],
    );
    if (profile.isDefault) {
      db.run("UPDATE scan_profiles SET is_default = 0 WHERE id <> ?", [id]);
    }
    db.flush();
    return this.profiles();
  }

  deleteProfile(id: string): ScanProfile[] {
    db.run('DELETE FROM scan_profiles WHERE id = ?', [id]);
    db.flush();
    return this.profiles();
  }

  resolutionPixels(dpi: number, paper: keyof typeof PAPER_SIZES): { width: number; height: number } {
    const def = PAPER_SIZES[paper];
    return { width: mmToPixels(def.widthMm, dpi), height: mmToPixels(def.heightMm, dpi) };
  }
}

export const scanner = new ScannerService();
