# Document Scanner & PDF Editor

Aplikasi desktop **offline-first** untuk digitalisasi dokumen: memindai (scanner WIA/TWAIN dan kamera), membersihkan hasil pindai dengan 10 preset filter, menyunting halaman, mengelola dokumen, OCR tanpa internet, serta mengonversi dan mengedit PDF.

Dibangun dengan **Electron 35 + React 18 + TypeScript + Vite**, database **SQLite** lokal (sql.js), pemrosesan gambar **@napi-rs/canvas**, PDF **@cantoo/pdf-lib** + **pdfjs-dist**, dan OCR **Tesseract.js** dengan language pack lokal.

> Semua dokumen, hasil OCR, dan konversi diproses di komputer pengguna. Tidak ada data yang dikirim ke server.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Persyaratan Sistem](#persyaratan-sistem)
- [Cara Penggunaan (Pengguna)](#cara-penggunaan-pengguna)
- [Pintasan Keyboard](#pintasan-keyboard)
- [Lokasi Data, Backup, dan Pemulihan](#lokasi-data-backup-dan-pemulihan)
- [Pemecahan Masalah](#pemecahan-masalah)
- [Panduan Developer](#panduan-developer)
- [Status Implementasi](#status-implementasi)

---

## Fitur Utama

### 1. Scanner (`/scanner`)
- Deteksi perangkat **WIA** (Windows Image Acquisition) melalui PowerShell COM, termasuk nama, produsen, dan port perangkat.
- Dukungan **TWAIN** melalui bridge CLI eksternal (mis. Naps2) yang diatur di Settings.
- Konfigurasi lengkap: paper source (feeder/flatbed), duplex, ukuran kertas (A3/A4/A5/Letter/Legal/Folio/Custom), resolusi 75–1200 DPI, color mode (color/grayscale/black & white), bit depth (1/8/24), brightness, contrast, format output (PNG/JPG/TIFF), mode jumlah halaman (single/multiple/batch).
- Profil pemindaian yang dapat disimpan, dijadikan default, dan dihapus.
- Pemindaian dapat dibatalkan; progres dan hasil per halaman ditampilkan sebelum ditambahkan ke dokumen.
- **Mode kamera**: ambil gambar dari webcam, deteksi tepi dokumen otomatis, auto-capture (sensitivitas, ambang stabilitas, delay, ambang blur, ukuran dokumen minimum, countdown), lalu koreksi perspektif.

### 2. Workspace (`/workspace`)
- Thumbnail rail semua halaman, kanvas pratinjau dengan zoom (`Ctrl` + scroll atau tombol `+`/`−`) dan pan dengan klik & geser mouse.
- **10 preset filter**: Original, Auto Enhance, Magic Color, Gray Mode, Black & White, Lighten, Darken, Sharpen, Ink Saving, Photo Mode — masing-masing dengan parameter yang bisa disetel.
- Penyesuaian manual: brightness, contrast, saturation, exposure, sharpness, threshold, white balance, whitening, color boost, ink reduction, radius.
- Cakupan filter: halaman aktif, halaman terpilih, atau semua halaman.
- Crop manual dengan drag 4 sudut (koreksi perspektif), rotasi 90°, operasi halaman (hapus, duplikat, urutkan ulang drag & drop, pindah ke awal/akhir).
- **Undo/redo non-destruktif** per halaman: gambar asli tidak pernah ditimpa, riwayat disimpan di database.
- Perbandingan sebelum/sesudah (compare).
- Ekspor PDF dengan pengaturan kualitas, ukuran kertas, orientasi, margin, dan rentang halaman; ekspor gambar; cetak; metadata dokumen.

### 3. PDF Tools (`/pdf`) — 20+ alat
- **Ke PDF**: gambar (JPG/PNG/BMP/TIFF/WebP) → PDF, Word/Excel/PowerPoint → PDF (butuh LibreOffice).
- **Dari PDF**: PDF → Word, PDF → Excel, PDF → PowerPoint, PDF → JPG/PNG.
- **Edit & atur**: merge, split (per halaman/rentang/ukuran), compress, rotate, hapus halaman, ekstrak halaman, urutkan ulang halaman, page numbering, edit metadata, deteksi halaman kosong.
- **Keamanan**: protect (password + permission) dan unlock PDF berpassword.
- Info PDF (jumlah halaman, ukuran, metadata) dan render halaman untuk pratinjau.

### 4. OCR (`/ocr`)
- Tesseract.js berjalan lokal dengan language pack di `resources/tessdata` (tersedia: `eng`, `ind`, `osd`).
- OCR per halaman atau seluruh dokumen, menampilkan teks, confidence, dan progres per halaman.
- Membuat **searchable PDF** (lapisan teks invisible di atas gambar asli).
- Ekspor hasil ke **TXT** dan **DOCX**.

### 5. Image Editor (`/editor`)
- Noise reduction (median filter), penghapusan finger mark, rotasi, resize.
- Perbandingan original vs hasil edit; semua edit non-destruktif.

### 6. Document Library (`/library`)
- Daftar dokumen dengan pencarian, urutan (nama/tanggal/ukuran), filter kategori.
- Buka di workspace, buka lokasi file, properti dokumen, duplikat, rename, hapus.

### 7. Settings (`/settings`)
- Bahasa (Indonesia/English), tema (light/dark/system), direktori dokumen dan output.
- Default resolusi/kertas/format/quality, auto-save + interval, backup otomatis, pembersihan temp, batas cache, concurrency, hardware acceleration.
- Path LibreOffice dan TWAIN bridge, pemilihan kamera default, parameter auto-capture.
- Utilitas: cek integritas database, backup manual, bersihkan file temp, reset pengaturan.

---

## Persyaratan Sistem

| Kebutuhan | Keterangan |
|---|---|
| OS | Windows 10/11 64-bit (aplikasi desktop Electron) |
| RAM | Minimal 4 GB (8 GB disarankan untuk DPI tinggi/batch scan) |
| Disk | ±400 MB untuk aplikasi + language pack; ruang tambahan untuk dokumen |
| Scanner | Driver WIA terpasang (standar Windows). TWAIN memerlukan bridge CLI opsional |
| LibreOffice | Opsional — hanya untuk Word/Excel/PowerPoint → PDF |
| Node.js | Hanya untuk pengembangan: Node.js 20+ dan npm 10+ |

---

## Cara Penggunaan (Pengguna)

### 1. Menjalankan aplikasi

**Build produksi (installer):**

```bash
npm install
npm run build      # menghasilkan dist/ (renderer) dan dist-electron/ (main + preload)
npm run dist       # paket installer Windows via electron-builder
```

Setelah terpasang, buka **Document Scanner & PDF Editor** dari Start Menu. Aplikasi hanya bisa dijalankan satu instance; membuka lagi akan memfokuskan jendela yang sudah ada.

**Mode pengembangan:**

```bash
npm install
npm run dev
```

### 2. Alur kerja singkat

1. **Pindai** dokumen di menu *Scanner* (atau impor file yang sudah ada dari Home / `Ctrl+I`).
2. Rapikan hasil di **Workspace**: pilih filter, atur crop/perspektif, rotasi, urutkan halaman.
3. **Jalankan OCR** jika dokumen perlu bisa dicari atau teksnya perlu diekstrak.
4. **Ekspor** ke PDF, cetak, atau simpan ke *Document Library*.

### 3. Memindai dokumen

1. Buka **Scanner** (`Ctrl+2`).
2. Klik **Perbarui daftar perangkat** lalu pilih scanner. Jika tidak ada perangkat, pastikan driver WIA terpasang dan scanner menyala.
3. Atur konfigurasi: sumber kertas, duplex, ukuran kertas, resolusi, mode warna, bit depth, kecerahan/kontras, format, dan jumlah halaman.
4. Klik **Scan**. Untuk feeder multi-halaman, pilih mode *multiple/batch* agar semua lembar diproses.
5. Periksa pratinjau hasil; halaman bisa dihapus sebelum ditambahkan.
6. Klik **Tambahkan ke dokumen** — dokumen baru dibuat otomatis bila belum ada.
7. Untuk memindai dari kamera, buka tab **Kamera**, pilih perangkat, aktifkan **Auto Capture** (opsional), lalu ambil gambar. Koreksi sudut dapat dilakukan sebelum halaman disimpan.

### 4. Workspace

- **Pilih halaman** pada rail kiri; gunakan `Ctrl`/`Shift` + klik untuk multi-pilih.
- **Terapkan filter**: klik salah satu preset untuk langsung menerapkan efeknya ke cakupan yang dipilih (*halaman aktif / terpilih / semua*). Slider parameter bisa disesuaikan lalu **Terapkan filter** untuk menerapkan ulang.
- **Zoom & pan**: `Ctrl` + scroll untuk zoom di sekitar kursor, atau tombol `+`/`−`/fit di toolbar. Saat halaman lebih besar dari kanvas, klik & geser (drag) halaman untuk menggeser tampilan dan memeriksa detail.
- **Crop manual**: aktifkan mode crop, geser keempat sudut mengikuti tepi dokumen, lalu konfirmasi. Sudut dinormalisasi (0–1) sehingga tetap akurat pada resolusi berapa pun.
- **Operasi halaman**: hapus (`Delete`), duplikat, pindahkan urutan dengan drag & drop atau tombol naik/turun/awal/akhir.
- **Undo/redo** (`Ctrl+Z` / `Ctrl+Y`) bekerja per halaman tanpa merusak file asli.
- **Bandingkan** untuk melihat hasil sebelum vs sesudah edit.
- **Ekspor PDF** (`Ctrl+E`): isi **Nama file** dan tentukan **Lokasi penyimpanan** (tombol **Pilih…** membuka folder picker; default folder output `%APPDATA%\document-scanner-pdf-editor\exports`), lalu atur kualitas, ukuran kertas, orientasi, margin, dan nomor halaman.
- **Cetak** (`Ctrl+P`) memilih printer, jumlah salinan, rentang halaman, orientasi, dan duplex.

### 5. PDF Tools

1. Buka **PDF Tools** (`Ctrl+3`) dan pilih alat yang diinginkan.
2. Pilih file sumber (PDF/gambar/Office). Untuk PDF terproteksi, masukkan password saat diminta.
3. Atur opsi alat (rentang halaman, derajat rotasi, kualitas kompresi, password, posisi nomor halaman, metadata, dan lainnya).
4. Jalankan; hasil disimpan ke direktori output dan dicatat di riwayat ekspor.

> Konversi Word/Excel/PowerPoint → PDF memerlukan LibreOffice. Status deteksi terlihat di footer aplikasi dan di Settings. Tanpa LibreOffice, alat tersebut dinonaktifkan dan aplikasi menampilkan pesan yang jelas.

### 6. OCR

1. Buka **OCR** (`Ctrl+6`).
2. Pilih bahasa (`ind`, `eng`, atau gabungan seperti `ind+eng`).
3. Jalankan OCR untuk halaman aktif, halaman terpilih, atau seluruh dokumen.
4. Lihat teks dan confidence per halaman.
5. Pilih **Buat Searchable PDF**, **Ekspor TXT**, atau **Ekspor DOCX**.

### 7. Image Editor

Buka **Image Editor** (`Ctrl+4`) untuk halaman aktif: kurangi noise, hilangkan finger mark, rotasi, dan resize. Gunakan tombol bandingkan untuk melihat original vs hasil. Perubahan disimpan sebagai resep pemrosesan, bukan menimpa gambar asli.

### 8. Document Library

Buka **Document Library** (`Ctrl+5`) untuk mencari dokumen, mengurutkan, membuka di workspace, membuka lokasi file di Explorer, melihat properti, menduplikat, mengganti nama, atau menghapus.

---

## Pintasan Keyboard

| Pintasan | Aksi |
|---|---|
| `Ctrl+N` | Dokumen baru |
| `Ctrl+O` | Buka dokumen |
| `Ctrl+I` | Impor file |
| `Ctrl+S` | Simpan |
| `Ctrl+Shift+S` | Simpan sebagai |
| `Ctrl+E` | Ekspor PDF |
| `Ctrl+P` | Cetak |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Delete` | Hapus halaman terpilih |
| `Ctrl+F` | Cari (Library) |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `Ctrl+1` … `Ctrl+6` | Home, Scanner, PDF Tools, Image Editor, Library, OCR |
| `Ctrl+,` | Settings |
| `Esc` | Tutup dialog / keluar dari mode bandingkan |

---

## Lokasi Data, Backup, dan Pemulihan

Semua data berada di direktori userData Electron:

```
%APPDATA%\document-scanner-pdf-editor\
├─ database\application.db     # SQLite: dokumen, halaman, riwayat, OCR, job, settings
├─ documents\                  # gambar halaman dokumen (dapat dipindah via Settings)
├─ imports\                    # file yang diimpor
├─ exports\                    # hasil ekspor PDF/gambar
├─ temp\                       # file sementara (dibersihkan otomatis saat start)
├─ cache\                      # cache render
├─ backups\                    # backup database otomatis
└─ logs\application.log        # log operasi (tanpa isi dokumen/password)
```

- **Auto-save** menulis database sesuai interval di Settings (default 60 detik); penulisan file database bersifat atomik (tulis ke file sementara lalu rename).
- **Backup** dibuat saat aplikasi ditutup dan berkala (bila diaktifkan). Backup manual tersedia di Settings.
- **Pemulihan**: jika aplikasi tertutup mendadak, database tetap konsisten. Bila database rusak, gunakan *Cek integritas database* di Settings; bila perlu, ganti `application.db` dengan salinan terbaru dari `backups\`.
- Menutup aplikasi saat masih ada perubahan memunculkan dialog konfirmasi (simpan atau keluar tanpa menyimpan). Gambar asli tidak pernah dihapus.

---

## Pemecahan Masalah

| Gejala | Penyebab & solusi |
|---|---|
| Scanner tidak terdeteksi | Pastikan driver WIA terpasang (Device Manager), scanner menyala, dan tidak sedang dipakai aplikasi lain. Klik *Perbarui daftar perangkat*. |
| Pemindaian gagal / kosong | Periksa dokumen pada feeder/flatbed, pilih sumber kertas yang benar, dan turunkan resolusi bila memori kurang. |
| TWAIN tidak tersedia | TWAIN memerlukan bridge CLI eksternal (mis. Naps2). Atur path bridge di **Settings → Pemindaian**. |
| Word/Excel/PPT → PDF gagal | LibreOffice tidak terdeteksi. Pasang LibreOffice dan/atau atur path `soffice.exe` di Settings. |
| OCR gagal / bahasa tidak tersedia | Language pack tidak ditemukan. Jalankan `npm run prepare:assets` (dev) atau pastikan folder `tessdata` ikut terpaket. |
| Kamera tidak muncul | Berikan izin kamera pada Windows (Settings → Privacy → Camera) dan pastikan tidak dipakai aplikasi lain. |
| Ekspor ditolak | Tujuan harus berada di direktori yang diizinkan (profil pengguna, Documents, Desktop, Downloads, Pictures, folder aplikasi) atau folder yang dipilih lewat dialog **Pilih…**/*Save As*. Pilih folder lain yang valid. |
| Aplikasi lambat saat scan DPI tinggi | Turunkan DPI (300 cukup untuk dokumen teks), kurangi concurrency, atau proses per batch. |

---

## Panduan Developer

### Prasyarat

- Node.js 20+ (diuji pada Node 22) dan npm 10+
- Windows 10/11 (jalur WIA memakai PowerShell COM; bagian lain tetap lintas platform)
- Git

### Instalasi

```bash
git clone <repo>
cd "Document Scanner & PDF Editor"
npm install
npm run prepare:assets   # unduh language pack Tesseract ke resources/tessdata
```

`resources/tessdata` berisi `eng.traineddata.gz`, `ind.traineddata.gz`, dan `osd.traineddata.gz`. Jalankan `npm run prepare:assets` bila folder kosong (butuh internet, sekali saja).

### Skrip npm

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Build main/preload dengan esbuild (watch) + Vite dev server di port 5273 + Electron |
| `npm run build` | Build renderer ke `dist/` dan main/preload ke `dist-electron/` |
| `npm start` | Jalankan Electron dari hasil build (`dist-electron/main.cjs`); build produksi otomatis dijalankan bila `dist/` belum ada |
| `npm run typecheck` | Typecheck renderer (`tsconfig.json`) dan main (`tsconfig.electron.json`) |
| `npm test` | Vitest (`tests/`) |
| `npm run prepare:assets` | Unduh language pack OCR |
| `npm run dist` | Build + installer Windows (electron-builder) |
| `npm run pack` | Build + paket tanpa installer (electron-builder `--dir`) |

### Struktur Proyek

```
electron/                 Proses main (Node) — dibundel esbuild ke dist-electron/main.cjs
├─ main.ts                Lifecycle, jendela, menu, close guard, auto-save
├─ preload.ts             contextBridge → window.api (tanpa nodeIntegration)
├─ ipc.ts                 Semua handler IPC + validasi Zod + progres job
├─ lib/
│  ├─ paths.ts            Layout direktori + guard path (assertInside/assertAllowedRead/Write)
│  ├─ logger.ts           Structured log tanpa isi dokumen
│  ├─ validate.ts         Skema Zod untuk payload IPC
│  ├─ jobs.ts             Manajemen job & pembatalan
│  └─ filenames.ts        Sanitasi nama file
└─ services/
   ├─ database.ts         sql.js, skema 14 tabel, migrasi, integrity check
   ├─ settings.ts         Default + persistensi pengaturan
   ├─ imageEngine.ts      Decode/encode, render halaman, thumbnail, data URL
   ├─ documents.ts        CRUD dokumen/halaman, filter, history, ekspor
   ├─ pdf.ts              Operasi PDF (merge/split/compress/protect/…)
   ├─ office.ts           Deteksi LibreOffice + konversi Office ↔ PDF
   ├─ convert.ts          PDF → Word/Excel/PowerPoint
   ├─ ocr.ts              Tesseract worker, searchable PDF, ekspor teks
   ├─ scanner.ts          WIA (PowerShell COM) + bridge TWAIN + profil
   └─ print.ts            Daftar printer, cetak dokumen/PDF, pratinjau
src/                      Renderer (React)
├─ App.tsx                Routing, aksi menu, close guard, dialog about
├─ components/            AppShell, komponen UI, Toasts
├─ pages/                 Home, Scanner, Workspace, ImageEditor, PdfTools, Ocr, Library, Settings
├─ store/                 Zustand: app, documents, jobs, toast
├─ lib/api.ts             Wrapper typed untuk window.api
├─ i18n/                  Kamus ID/EN
├─ shared/                Kode dipakai renderer + main
│  ├─ types.ts            Tipe domain + kontrak AppApi
│  ├─ constants.ts        Ukuran kertas, preset, util format/rentang halaman
│  ├─ filters.ts          Engine filter/adjustment (10 preset) + renderRecipe
│  └─ detection.ts        Deteksi tepi dokumen, corner extraction, confidence
scripts/                  dev/build/fetch-tessdata
resources/tessdata/       Language pack OCR
docs/                     PRD.md dan DESIGN.md
dist/ dist-electron/      Output build
```

### Arsitektur Proses & IPC

- Renderer **tidak memiliki akses Node**. Semua I/O lewat `window.api` yang didefinisikan di `electron/preload.ts`.
- Setiap modul punya prefix channel: `app:*`, `settings:*`, `documents:*`, `scanner:*`, `pdf:*`, `office:*`, `ocr:*`, `print:*`, `jobs:*`, `dialog:*`, `images:*`.
- Handler IPC di `electron/ipc.ts` memvalidasi input dengan Zod (`electron/lib/validate.ts`) sebelum memanggil service. Tambahkan skema baru di sana saat menambah channel.
- Operasi berat (OCR, konversi, batch render) mengirim progres lewat event `jobs:progress`; renderer berlangganan di `src/store/jobs.ts` dan menampilkan progres di header.
- Menu native mengirim `app:menu-action` ke renderer; `src/App.tsx` memetakan aksi ke navigasi/store.

**Menambah channel IPC:**

1. Tambahkan tipe method pada `AppApi` di `src/shared/types.ts`.
2. Daftarkan `handle('<modul>:<aksi>', ...)` di `electron/ipc.ts` (pakai skema Zod untuk input dari renderer).
3. Ekspos pemanggilan di `electron/preload.ts`.
4. Panggil dari renderer melalui `api.<modul>.<aksi>()` di `src/lib/api.ts`.

### Engine Gambar & Filter

- `src/shared/filters.ts` dijalankan di **kedua sisi**: pratinjau di renderer dan render final di main, sehingga hasil pratinjau identik dengan hasil ekspor.
- `renderRecipe` menerapkan urutan: quad (perspektif) → rotation → filter preset → adjustments → operations (noise, finger mark, resize).
- Setiap halaman menyimpan `original_path` (tidak pernah ditimpa) + resep pemrosesan; undo/redo memakai tabel `page_history`.

**Menambah preset filter:**

1. Tambahkan entri di `FILTER_PRESETS` (`src/shared/constants.ts`) dengan `config` dan daftar `params`.
2. Pastikan setiap key config ditangani di `applyFilter`/`adjustImage` pada `src/shared/filters.ts`.
3. Tipe `FilterPreset` di `src/shared/types.ts` ikut diperbarui bila menambah id baru.

### Database

- SQLite via **sql.js** (WASM, tanpa native build), file `database/application.db`.
- Skema didefinisikan di `electron/services/database.ts` (14 tabel: `documents`, `document_pages`, `page_processing`, `page_history`, `ocr_results`, `pdf_jobs`, `conversion_jobs`, `export_history`, `scan_sessions`, `scan_profiles`, `scanner_devices`, `app_settings`, `document_tags`, `document_activity`).
- Perubahan skema memakai `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` yang idempoten saat `db.init()`.
- `db.run/all` untuk query; panggil `db.flush()` setelah rangkaian perubahan agar file tersimpan.
- Parameter SQL selalu di-bind (`?`) — jangan menyusun query dengan interpolasi.

### Keamanan

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`; preload hanya mengekspos API tertutup.
- Navigasi eksternal diblokir; URL `https` dibuka di browser default.
- Semua tulis/baca file melewati guard di `electron/lib/paths.ts` (root yang diizinkan: userData, documents, exports, Documents, Desktop, Downloads, Pictures).
- Log tidak pernah mencatat isi dokumen, hasil OCR, atau password PDF.

### Build & Packaging

```bash
npm run typecheck   # renderer + main
npm test
npm run build
npm run dist        # installer Windows → release/
```

`electron-builder` membaca konfigurasi dari `package.json` (`build`) atau `electron-builder.yml`. Repo ini memakai **`electron-builder.yml`** (appId `com.docscanner.app`, target NSIS, output `release/`, ikon `resources/icon.ico`):

```yaml
appId: com.docscanner.app
productName: Document Scanner & PDF Editor
directories:
  output: release
files:
  - dist/**
  - dist-electron/**
  - package.json
  - resources/icon.png
extraResources:
  - from: resources/tessdata
    to: tessdata
win:
  target: nsis
  icon: resources/icon.ico
  artifactName: ${productName}-${version}-setup.${ext}
```

`extraResources` wajib agar language pack OCR ikut terpasang. Tanpa itu, OCR hanya tersedia di mode pengembangan.

**Ikon aplikasi** dihasilkan ulang oleh skrip (memakai `@napi-rs/canvas`, sudah ada di devDependencies):

```bash
node scripts/make-icon.mjs   # -> resources/icon.png, resources/icon.ico, public/icon.png
```

### Konvensi Kode

- TypeScript strict di kedua konfigurasi; tipe domain bersama hanya di `src/shared`.
- Nama channel IPC `modul:aksi`; nama tipe/interface PascalCase; util di `src/shared/constants.ts`.
- Komponen UI memakai token desain di `src/styles.css` (`--canvas`, `--ink`, `--surface-card`, `--hairline`, radius 8/12px) sesuai `docs/DESIGN.md` — jangan menulis warna hex langsung di komponen.
- Bahasa UI Indonesia sebagai default, dengan kamus Inggris di `src/i18n/index.ts`.

### Pengujian

- Unit test memakai Vitest (`npm test`), tempatkan di `tests/`.
- Prioritas pengujian: `src/shared/filters.ts`, `src/shared/detection.ts`, `src/shared/constants.ts` (`parsePageRange`, `formatBytes`), dan service main yang murni logika.
- Uji manual yang disarankan: scan WIA, auto capture kamera, konversi Office (dengan LibreOffice), OCR `ind+eng`, ekspor PDF dengan password, dan pemulihan setelah menutup paksa aplikasi.

---

## Status Implementasi

| Modul | Status |
|---|---|
| Proses main: database, settings, image engine, dokumen, PDF, Office, OCR, scanner, print | Selesai, typecheck lulus |
| Engine bersama: filter, deteksi dokumen, konstanta | Selesai |
| Halaman Home, Library, Settings | Selesai |
| Halaman Scanner, Workspace, Image Editor, PDF Tools, OCR | Selesai |
| `npm run typecheck`, `npm run build`, `npm run dev` | Lulus — Vite membalas HTTP 200 di port 5273 dan Electron berhasil memuat aplikasi |
| Konfigurasi electron-builder | Selesai — `electron-builder.yml`, ikon `resources/icon.ico`, installer NSIS di `release/` |
| Test Vitest | Belum ada |

Keterbatasan lingkungan: LibreOffice tidak terpasang di mesin pengembangan saat ini, sehingga jalur Office → PDF hanya tervalidasi secara kode. Scanner fisik dan kamera juga perlu pengujian pada perangkat nyata; jalur WIA, bridge TWAIN, dan `getUserMedia` belum diuji dengan perangkat.
