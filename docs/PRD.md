Berikut adalah **Product Requirements Document (PRD) lengkap** untuk pengembangan aplikasi desktop *Document Scanner & PDF Editor* menggunakan React.js, Electron.js, dan TypeScript dengan pendekatan **Offline-first**.

PRD ini menggabungkan fungsi aplikasi referensi *Scan Document to PDF* dengan kemampuan pengolahan gambar tingkat lanjut, pemindaian otomatis, berbagai preset filter, serta PDF editor yang memiliki kemampuan konversi dokumen dua arah.

Aplikasi dirancang sebagai produk desktop profesional yang dapat digunakan tanpa koneksi internet, dengan seluruh pemrosesan dokumen, OCR, image processing, dan penyimpanan dilakukan secara lokal.

# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

Product Specification

Version 1.0

# **Document Scanner & PDF Editor**

### Professional Desktop Document Digitization Suite

[QuickScan – PDF & Document Scanner | Scan to PDF - Download e instalação gratuitos no Windows | Microsoft Store](https://images.openai.com/static-rsc-4/mErU6qZscPYxt3Hb0ZfB2f-udhLaBOdhSMgESF2A6aM5ECtOPGBfXUGkQm0avJT1_-EJy47bIMe7LdVrZQGRdTfDeBzlg2tYkDulRy0tZ47kgrCsEW01yCpwrz602zblqIDLOd3uUsId1hnZ6-NVpJkp0EvkagkRT6jI3d8s-GI?purpose=inline)

[apps.microsoft.com](https://apps.microsoft.com/detail/9ngxzg0cdszv?gl=BR\&hl=pt-BR\&utm_source=chatgpt.com)

| Informasi         | Spesifikasi                    |
| ----------------- | ------------------------------ |
| Product Type      | Desktop Application            |
| Target OS         | Windows 10/11                  |
| Frontend          | React.js + TypeScript          |
| Desktop Runtime   | Electron.js                    |
| Build Tool        | Vite                           |
| Architecture      | Modular Desktop Architecture   |
| Operating Model   | Offline-first                  |
| Database          | SQLite                         |
| Image Engine      | OpenCV + Sharp                 |
| OCR Engine        | Tesseract OCR                  |
| PDF Engine        | PDF.js + PDF Processing Engine |
| Office Conversion | LibreOffice Integration        |
| Primary Language  | Indonesian / English           |
| Distribution      | Windows Installer              |

## **1. Executive Summary**

Document Scanner & PDF Editor adalah aplikasi desktop yang menyediakan solusi terpadu untuk digitalisasi dokumen fisik, pemrosesan gambar, pengelolaan halaman, konversi format dokumen, dan pengeditan PDF.

Aplikasi menggabungkan tiga fungsi utama:

1. **Document Scanner:** Memindai dokumen melalui scanner fisik maupun kamera, mendeteksi batas dokumen secara otomatis, melakukan koreksi perspektif, dan meningkatkan kualitas hasil scan.
2. **Image Processing:** Mengolah gambar hasil pemindaian melalui berbagai fitur enhancement, penghapusan noise, koreksi warna, serta preset filter yang dapat diterapkan per halaman atau secara massal.
3. **PDF Editor & Converter:** Mengelola PDF, mengedit susunan halaman, menggabungkan, memisahkan, mengompres, memberikan proteksi, serta mengonversi dokumen ke berbagai format.

### **1.1 Product Vision**

Menjadi aplikasi desktop digitalisasi dokumen yang menyediakan pengalaman pemindaian, pengolahan gambar, dan pengelolaan PDF secara profesional dalam satu lingkungan kerja yang terintegrasi, aman, dan dapat digunakan sepenuhnya secara offline.

### **1.2 Product Objectives**

- Mengurangi kebutuhan menggunakan banyak aplikasi untuk memindai dan mengelola dokumen.
- Menghasilkan dokumen digital dengan kualitas visual yang optimal.
- Mempercepat proses pemindaian dokumen dalam jumlah besar.
- Menyediakan sistem pemrosesan dokumen multi-halaman.
- Mempermudah konversi antarformat dokumen.
- Menyediakan fitur OCR untuk pencarian dan ekstraksi teks.
- Menjamin privasi melalui pemrosesan lokal.
- Menyediakan workflow yang mudah digunakan untuk pekerjaan administrasi dan pengarsipan.

## **2. Target Pengguna**

| Segmen              | Kebutuhan utama                         |
| ------------------- | --------------------------------------- |
| Perkantoran         | Digitalisasi dokumen administrasi       |
| Instansi Pemerintah | Pengarsipan surat dan dokumen           |
| Pendidikan          | Digitalisasi materi dan arsip akademik  |
| Perusahaan          | Pengelolaan dokumen bisnis              |
| Legal Professional  | Pemindaian dan pengelolaan berkas hukum |
| Mahasiswa           | Konversi dan pengelolaan PDF            |
| Personal User       | Pemindaian dokumen pribadi              |

### **2.1 User Personas**

- **Administrative Staff:** Membutuhkan pemindaian cepat, ADF, batch scanning, dan penggabungan dokumen.
- **Document Archivist:** Membutuhkan kualitas scan, filter, OCR, metadata, dan sistem pengarsipan.
- **PDF Editor User:** Membutuhkan pengaturan halaman, konversi, proteksi, dan kompresi PDF.
- **Professional User:** Membutuhkan kontrol penuh terhadap kualitas gambar dan konfigurasi pemindaian.

## **3. Product Scope**

Aplikasi dibangun dengan pendekatan modular. Setiap modul memiliki tanggung jawab tersendiri tetapi menggunakan sistem dokumen dan halaman yang sama.

## **Product Modules**

**Scanner Management**

Hardware & batch scanning

**Smart Detection**

Auto edge & capture

**Image Processing**

Enhancement & correction

**Scan Filters**

10 visual presets

**Page Management**

Multi-page workspace

**PDF Editor**

Page-level operations

**File Converter**

Office & image conversion

**OCR Engine**

Text recognition

**Document Library**

Local document storage

**Application Settings**

Offline configuration

### **3.1 In Scope**

- Scanner hardware integration.
- Camera-based document capture.
- Automatic document detection.
- Automatic edge detection.
- Automatic capture.
- Image processing dan enhancement.
- Sepuluh preset filter.
- Multi-page document management.
- PDF editing.
- PDF conversion.
- Office document conversion.
- OCR.
- Local database.
- Offline processing.
- Import dan export.
- Printing.
- Document history.

### **3.2 Out of Scope untuk versi awal**

- Cloud synchronization.
- Online document storage.
- Collaborative editing.
- Cloud OCR.
- Online account authentication.
- Server-based document processing.
- Mobile application.

# **4. Functional Requirements**

## **4.1 Scanner Management Module**

Priority P0 – Critical

Modul ini bertanggung jawab terhadap seluruh interaksi dengan perangkat pemindai.

### **4.1.1 Device Detection**

Sistem harus mampu:

- Mendeteksi scanner yang terhubung.
- Menampilkan nama dan informasi perangkat.
- Mendeteksi jenis driver.
- Menampilkan status perangkat.
- Memilih perangkat scanner.
- Memperbarui daftar perangkat.
- Menangani scanner yang terputus.
- Menampilkan pesan kesalahan apabila scanner tidak tersedia.

### **4.1.2 Scanner Configuration**

| Parameter      | Pilihan                                  |
| -------------- | ---------------------------------------- |
| Scanner Device | Daftar perangkat                         |
| Driver         | WIA / TWAIN                              |
| Paper Source   | Feeder / Flatbed                         |
| Duplex         | Enabled / Disabled                       |
| Paper Size     | A3, A4, A5, Letter, Legal, Folio, Custom |
| Resolution     | 75–1200 DPI (sesuai perangkat)           |
| Color Mode     | Color, Grayscale, Black & White          |
| Bit Depth      | 1-bit, 8-bit, 24-bit                     |
| Brightness     | -100 sampai +100                         |
| Contrast       | -100 sampai +100                         |
| Scan Format    | PNG, JPG, TIFF                           |
| Page Count     | Single / Multiple / Batch                |

### **4.1.3 Scanning Operations**

- Single-page scanning.
- Multi-page scanning.
- ADF batch scanning.
- Duplex scanning.
- Continuous scanning.
- Cancel scanning.
- Pause/resume jika didukung backend perangkat.
- Preview hasil scanning.
- Scan additional pages.
- Scan to existing document.
- Auto-save hasil pemindaian.

### **4.1.4 Acceptance Criteria**

- Pengguna dapat memilih scanner yang tersedia.
- Pengguna dapat mengubah konfigurasi scanner.
- Pemindaian menghasilkan file gambar yang valid.
- Sistem dapat memproses banyak halaman dalam satu sesi.
- Hasil scan otomatis masuk ke Document Workspace.
- Kesalahan perangkat tidak menyebabkan aplikasi tertutup.

## **4.2 Smart Document Detection & Automatic Capture**

Priority P0 – Critical

Modul ini merupakan salah satu fitur unggulan aplikasi.

[Die besten Scanner-Apps für Android - PC-WELT](https://images.openai.com/static-rsc-4/WakIQAM8aDgZBK59yhmIe8KGtyS7N79niGj_UZ8Oh25gXO8t92LZ4Rz9sOh33vHTbR3a3p09AKl8K68XLrqE3MsmNFqvfJkdQAy0QoTdUHJvIxwVhmGIfUIglNCKmsCgUaOIbk_xKTufucBShThLmAnRane3BHINFNs3HM-z5T4?purpose=inline)

[\[OpenCV\] Perspective Transformation (원근 변환) | 왜곡된 영상을 펴주는 방법 — moovzi’s Doodle](https://images.openai.com/static-rsc-4/zyt2KaWejQVaHRmjHRlHSBw9u70RMU3XyfTjgnj9uPXnrlZRm6E16rnTMqqt4SRuTRBLp_izFGJb0yxQcgiT7F0ZV3st3a7nz8deVNt_DK4e8bT7rcb1r0dvC1xn0OVteXYMzFrZg9mFeSESylS2lpZxlqPgkKOAV35wEYILzSg?purpose=inline)

[IRIScan Desk Scanner v6business: 13MP/21MP Visualizer, Portable, Book Scanner with AI Curve Flattening, Win Mac Compatible - IRIScan](https://images.openai.com/static-rsc-4/v-a9B9WT2t3T_Ln0RY2HbCU3RIi8WujQ5rsT2oY_FCSi89zDxtudl4hkUJ6UM4Ra6uqhr7PddPj7MY2nTHN3L4Os5jhxeEGCcpT7KE1vpDpgYm4IzIXm45WnmAa8KCH-3I0icp5SlebO9Gqvrl2BXlj7DpGQMyp0AhcEDNpcQNA?purpose=inline)

10

Fitur ini ditujukan untuk pemindaian melalui kamera yang menyediakan live preview. Untuk scanner flatbed dan ADF, fitur detection digunakan setelah gambar diperoleh, sedangkan automatic capture berbasis kamera bekerja melalui live video stream.

### **4.2.1 Automatic Document Detection**

Sistem mendeteksi keberadaan objek dokumen di dalam frame kamera.

Persyaratan:

- Mendeteksi dokumen berbentuk persegi panjang.
- Mendeteksi empat sudut dokumen.
- Membedakan dokumen dengan latar belakang.
- Mengidentifikasi area dokumen.
- Menampilkan garis batas dokumen secara real-time.
- Memperbarui posisi batas saat dokumen bergerak.
- Mendukung dokumen dengan orientasi berbeda.

### **4.2.2 Automatic Edge Detection**

Sistem mendeteksi batas fisik dokumen menggunakan kombinasi:

- Image thresholding.
- Edge detection.
- Contour detection.
- Polygon approximation.
- Perspective analysis.

Hasil deteksi berupa empat titik koordinat dokumen.

### **4.2.3 Automatic Capture**

Alur kerja:

1. Kamera menampilkan live preview.
2. Sistem mendeteksi dokumen.
3. Sistem menentukan empat sudut dokumen.
4. Sistem memeriksa kestabilan posisi.
5. Sistem memeriksa tingkat blur.
6. Sistem memastikan pencahayaan mencukupi.
7. Sistem menghitung confidence score.
8. Jika seluruh kondisi terpenuhi, sistem mengambil gambar secara otomatis.
9. Gambar diproses dan dimasukkan ke Document Workspace.

Konfigurasi yang tersedia:

- Enable / Disable Auto Capture.
- Detection Sensitivity.
- Stability Threshold.
- Capture Delay.
- Blur Threshold.
- Minimum Document Size.
- Auto Capture Countdown.

### **4.2.4 Perspective Correction**

Setelah pengambilan gambar, sistem melakukan:

- Four-point perspective transformation.
- Document cropping.
- Perspective correction.
- Deskew.
- Aspect ratio correction.

### **4.2.5 Acceptance Criteria**

- Sistem dapat mendeteksi dokumen dengan empat titik sudut.
- Garis deteksi mengikuti posisi dokumen.
- Automatic capture hanya dilakukan setelah dokumen stabil.
- Sistem tidak mengambil gambar berulang secara terus-menerus untuk objek yang sama.
- Pengguna tetap dapat mengambil gambar secara manual.
- Pengguna dapat memperbaiki sudut crop secara manual.

## **4.3 Image Processing Module**

Priority P0 – Critical

[SE-EDU/LearningResources - Introduction to computer vision (CV)](https://images.openai.com/static-rsc-4/D5yIAFpyiJnjPfqZzpmCdiosogn8HBNl89ynYNBKCbGTAtrty5l_RnMZh1WIozaZRteDWPFKtH7C4yZhXbmRBHWan3SRkC3CqiQL7qP2-rNZsx18RnwMGzHW-o4c4W1WS2dn3togI6XRTTBZJjMj2jLe-yfIIA7fcOelnsGLSFE?purpose=inline)

[Genius Scan 6 – Next-Gen Scanning](https://images.openai.com/static-rsc-4/LtDw9jwuA6UWNK0RCbnfvtnmW4yDRrlcOBD4cztoiirbOxxYOPIfVUNVQFrvMieIiBgB3kyp84eInqCNLx5TeUveMhVZ00BNj_9Wma-FWvsKU1wLo0j1uN3mCAiUDSTrVdx1fEYVRY0t__tADDzMRIX7B-4Fb1geoQLYguPhZ5Q?purpose=inline)

[Czur ET-25 Pro Overhead Book/Document Scanner, 25MP HD Camera, Scan up to A3 Format, Patented Page-Flattening Algorithms, 1.5s/page Print Speed, Efficient OCR, JPG, PDF, TIFF, Gray | ET25 Pro Buy, Best Price. Global Shipping.](https://images.openai.com/static-rsc-4/QZQA8LZD94j3Mbybak6wOQhSXLR8W3Uh1W9eBY3qMhXyoR5A85EKxVZ6Q6-vUSdvfroeT12PVbw31LUyIbm2xc2b0qT3RLCeLfgDsdgndsTUdSA8YLx-DyxTsa25OATUAOdy_U4zqtU_1MZ4npH9S3xCqu0V_8-s0fvoiEqxz3Q?purpose=inline)

13

Modul image processing bertanggung jawab memperbaiki kualitas gambar hasil pemindaian.

### **4.3.1 Automatic Processing**

| Fitur                        | Deskripsi                       | Prioritas |
| ---------------------------- | ------------------------------- | --------- |
| Automatic Document Detection | Mendeteksi objek dokumen        | P0        |
| Automatic Edge Detection     | Mendeteksi tepi dokumen         | P0        |
| Automatic Capture            | Mengambil gambar otomatis       | P0        |
| Color Enhancement            | Meningkatkan kualitas warna     | P0        |
| Noise Reduction              | Mengurangi noise                | P0        |
| Finger Mark Removal          | Mengurangi noda atau bekas jari | P1        |
| Image Rotation               | Memutar gambar                  | P0        |
| Image Resizing               | Mengubah ukuran gambar          | P0        |

### **4.3.2 Color Enhancement**

Fungsi:

- Auto white balance.
- Color correction.
- Brightness adjustment.
- Contrast enhancement.
- Saturation adjustment.
- Background whitening.
- Text clarity improvement.

Sistem harus mempertahankan warna asli dokumen apabila pengguna memilih Original.

### **4.3.3 Noise Reduction**

Mengurangi gangguan visual seperti:

- Grain.
- Sensor noise.
- Background noise.
- Small artifacts.
- Compression artifacts.

Metode yang dapat digunakan:

- Median filtering.
- Gaussian filtering.
- Bilateral filtering.
- Morphological operations.

### **4.3.4 Finger Mark Removal**

Fitur untuk mengurangi noda atau bekas jari yang mengganggu tampilan dokumen.

Kemampuan:

- Mendeteksi area noda.
- Mengidentifikasi area non-teks.
- Mengurangi noda lokal.
- Melakukan background reconstruction.
- Mempertahankan teks dan elemen dokumen.

Fitur ini harus bersifat non-destruktif dan menyediakan perbandingan sebelum/sesudah. Sistem tidak boleh menghapus tanda tangan, cap, sidik jari, anotasi, atau elemen penting dokumen hanya karena bentuknya menyerupai noda.

### **4.3.5 Image Rotation**

- Rotate 90° clockwise.
- Rotate 90° counter-clockwise.
- Rotate 180°.
- Custom rotation.
- Auto orientation detection.
- EXIF orientation correction.

### **4.3.6 Image Resizing**

- Resize berdasarkan pixel.
- Resize berdasarkan persentase.
- Resize berdasarkan ukuran kertas.
- Maintain aspect ratio.
- Custom DPI.
- Fit to A4 / A3 / Letter / Legal / Folio.

### **4.3.7 Non-destructive Editing**

Semua operasi editing harus dapat dikembalikan ke kondisi sebelumnya.

Persyaratan:

- Original image tidak ditimpa.
- Setiap perubahan dicatat sebagai processing operation.
- Undo dan redo tersedia.
- Reset to original tersedia.
- Filter dapat diubah kapan saja.
- Hasil akhir hanya dirender ketika diperlukan.

## **4.4 Scan Filter & Preset Module**

Priority P0 – Critical

Aplikasi harus menyediakan sepuluh preset filter yang dapat dipilih pengguna untuk setiap halaman maupun seluruh halaman dokumen.

[GitHub - singhkp98/openCV-scanner: Simple document scanner in C++ using OpenCV library · GitHub](https://images.openai.com/static-rsc-4/csA3iUPZ2G_XuFXVl277_MC6BfWp_edZ1St_vXAjPKhO4uC9HBn6H7SsQI89iJjGrto-4SN3cYKQLWcg30rMYwSZmK_vUu1rGSYd_VlyzWRzGxAVHg7BexM5B6OwRJe6i-tYXeD4n8k-2hSP-jVkC6IEZ-Fd8am4s_BQngLZHTw?purpose=inline)

[CamScanner para iOS y Android: análisis](https://images.openai.com/static-rsc-4/6ww_4sQjVK-5fbLAWJv2qgQWtrSyKA4--8DkTynrjbEmiteiRQC7vfEA3l5bbnTRGK08IMuXRg_UmHTD7AiYtNFyK-nPAEMC8tJUKF2LlSyepiQjucS1N5K8OT5z94iIzRfgezIDSWfcjXvwHSaOZ1kmltGkf_Y5s1YY_asUYmg?purpose=inline)

[How to Scan in Black and White \[A Full Guide\]](https://images.openai.com/static-rsc-4/oAMNv79NEnzTCja0rq2UOIpw7cQv8waPsSqHPwrMihAAdVLfLUnfIBwyAWsr7C0embVLi_EdNxqlgU5ibvu4vggxaWhz4Uew2MOumYRI3aEIijQztmLFam6fPZer9urBdZQtnlhS850cW9MrbRvmq9EuRS-7MlRAgn8pvZv2J8Q?purpose=inline)

12

### **4.4.1 Filter Presets**

| No. | Preset        | Deskripsi                                       |
| --- | ------------- | ----------------------------------------------- |
| 1   | Original      | Menampilkan gambar tanpa enhancement            |
| 2   | Auto Enhance  | Koreksi otomatis warna, kontras, dan kecerahan  |
| 3   | Magic Color   | Meningkatkan warna dan kejernihan dokumen       |
| 4   | Gray Mode     | Mengubah gambar menjadi grayscale               |
| 5   | Black & White | Konversi menjadi hitam putih berbasis threshold |
| 6   | Lighten       | Mencerahkan dokumen                             |
| 7   | Darken        | Menggelapkan dokumen                            |
| 8   | Sharpen       | Mempertajam teks dan garis                      |
| 9   | Ink Saving    | Mengurangi penggunaan area tinta gelap          |
| 10  | Photo Mode    | Mempertahankan kualitas warna foto              |

### **4.4.2 Filter Configuration**

Setiap filter memiliki parameter yang dapat disesuaikan.

Contoh:

| Filter        | Parameter                            |
| ------------- | ------------------------------------ |
| Auto Enhance  | Brightness, Contrast, Saturation     |
| Magic Color   | Color Boost, White Balance, Contrast |
| Gray Mode     | Grayscale Intensity                  |
| Black & White | Threshold, Adaptive Threshold        |
| Lighten       | Brightness, Exposure                 |
| Darken        | Brightness, Contrast                 |
| Sharpen       | Sharpness, Radius                    |
| Ink Saving    | Threshold, Ink Reduction             |
| Photo Mode    | Saturation, Color Balance, Sharpness |

### **4.4.3 Filter Application Scope**

Pengguna dapat memilih tiga mode penerapan:

**Mode 1 – Current Page**

Filter hanya diterapkan pada halaman yang sedang aktif.

**Mode 2 – Selected Pages**

Filter diterapkan pada beberapa halaman yang dipilih.

**Mode 3 – All Pages**

Filter diterapkan ke seluruh halaman dalam dokumen.

### **4.4.4 Batch Filter Operations**

Fitur:

- Apply filter to all pages.
- Apply filter to selected pages.
- Copy filter settings.
- Paste filter settings.
- Reset filter.
- Preview before applying.
- Compare before and after.
- Undo batch operation.

### **4.4.5 Acceptance Criteria**

- Tersedia sepuluh preset filter.
- Setiap halaman dapat menggunakan filter berbeda.
- Pengguna dapat menerapkan filter ke seluruh halaman.
- Preview berubah tanpa harus membuat dokumen baru.
- Original image tetap tersimpan.
- Pengguna dapat mengembalikan halaman ke Original.

## **4.5 Document Workspace & Page Management**

Priority P0 – Critical

Modul ini menjadi pusat pengelolaan dokumen.

### **4.5.1 Workspace Layout**

Area kerja terdiri dari:

1. Main Toolbar.
2. Scanner Configuration Sidebar.
3. Document Preview.
4. Page Thumbnail Panel.
5. Image Processing Panel.
6. Document Status Bar.

### **4.5.2 Page Operations**

- Add Page.
- Delete Page.
- Duplicate Page.
- Rotate Page.
- Crop Page.
- Reorder Page.
- Move Page Up.
- Move Page Down.
- Drag and Drop.
- Select Multiple Pages.
- Merge Pages.
- Split Document.
- Replace Page.
- Extract Page.
- Apply Filter.
- Apply Image Enhancement.

### **4.5.3 Document Operations**

- New Document.
- Open Document.
- Save Document.
- Save As.
- Rename Document.
- Duplicate Document.
- Delete Document.
- Import Existing Pages.
- Add Pages from Scanner.
- Export Document.

### **4.5.4 Document State**

Setiap dokumen memiliki status:

- New.
- Unsaved.
- Saved.
- Processing.
- Exporting.
- Completed.
- Failed.

Sistem harus memberikan peringatan ketika pengguna menutup dokumen yang memiliki perubahan belum tersimpan.

## **4.6 PDF Management & PDF Editor**

Priority P0 – Critical

Modul PDF Management merupakan salah satu modul terbesar dalam aplikasi. Aplikasi tidak hanya berfungsi sebagai scanner, tetapi juga sebagai PDF editor dan document converter.

Seluruh operasi PDF harus dapat dilakukan tanpa koneksi internet.

### **4.6.1 PDF Tool Center**

Aplikasi menyediakan halaman khusus bernama **PDF Tools** yang mengelompokkan fungsi berdasarkan kategori.

## **PDF Tools**

Proposed tool catalog

**Convert to PDF**

Image to PDF

JPG to PDF

PNG to PDF

Word to PDF

Excel to PDF

PPT to PDF

**Convert from PDF**

PDF to Word

PDF to Excel

PDF to PPT

PDF to JPG

PDF to PNG

**Edit & Organize PDF**

Merge PDF

Split PDF

Compress PDF

Rotate PDF

Delete Pages

Extract Pages

Reorder PDF

Protect PDF

Unlock PDF

Page Number

PDF Metadata

### **4.6.2 PDF Conversion – Image to PDF**

Fitur untuk mengonversi gambar menjadi satu atau beberapa halaman PDF.

Format input:

- JPG / JPEG.
- PNG.
- BMP.
- TIFF.
- WEBP.

Persyaratan:

- Multiple image selection.
- Drag and drop.
- Image ordering.
- Page size selection.
- Page orientation.
- Margin configuration.
- Image scaling.
- Image positioning.
- PDF quality settings.
- Page numbering.
- Output filename configuration.

Opsi ukuran halaman:

- A3.
- A4.
- A5.
- Letter.
- Legal.
- Folio.
- Original Image Size.
- Custom Size.

Pengguna dapat menggabungkan puluhan atau ratusan gambar ke dalam satu PDF.

### **4.6.3 JPG to PDF dan PNG to PDF**

Keduanya memiliki workflow tersendiri tetapi menggunakan satu conversion engine.

Fitur tambahan:

- Preserve image aspect ratio.
- Fit image to page.
- Fill page.
- Center image.
- Maintain original resolution.
- Image compression.
- Multiple image conversion.
- Image preview.

### **4.6.4 Word to PDF**

Format input:

- DOC.
- DOCX.

Fitur:

- Convert single file.
- Batch conversion.
- Preserve page layout.
- Preserve tables.
- Preserve images.
- Preserve headers and footers.
- Preserve page numbering.
- Preserve fonts apabila tersedia.

### **4.6.5 Excel to PDF**

Format input:

- XLS.
- XLSX.

Fitur:

- Convert workbook.
- Select worksheet.
- Convert selected worksheets.
- Export all worksheets.
- Set paper orientation.
- Set paper size.
- Set print area.
- Fit to page width.
- Fit to one page.
- Preserve table formatting.

### **4.6.6 PPT to PDF**

Format input:

- PPT.
- PPTX.

Fitur:

- Convert all slides.
- Convert selected slides.
- Preserve slide dimensions.
- Preserve images.
- Preserve shapes.
- Preserve text formatting.
- Support landscape and portrait slide layouts.

### **4.6.7 PDF to Word**

Mengonversi dokumen PDF menjadi DOCX yang dapat diedit.

Fitur:

- Text extraction.
- Paragraph reconstruction.
- Table reconstruction.
- Image extraction.
- Font mapping.
- Layout preservation.
- Page selection.
- Batch conversion.

Sistem harus menyediakan dua metode:

1. Text-based PDF conversion untuk PDF yang memiliki text layer.
2. OCR-based conversion untuk PDF hasil scanner yang berupa gambar.

Hasil konversi tidak dijamin identik dengan tata letak PDF asli, khususnya dokumen kompleks.

### **4.6.8 PDF to Excel**

Mengonversi tabel dalam PDF menjadi spreadsheet XLSX.

Fitur:

- Table detection.
- Table extraction.
- Column detection.
- Row detection.
- Cell reconstruction.
- Multiple table extraction.
- Worksheet selection.
- Export to XLSX.

Untuk PDF hasil scan, sistem harus melakukan OCR dan table recognition sebelum konversi.

### **4.6.9 PDF to PPT**

Mengonversi halaman PDF menjadi slide PPTX.

Fitur:

- Convert all pages.
- Convert selected pages.
- Preserve page proportions.
- Extract images.
- Reconstruct text elements jika memungkinkan.
- Create editable slides.
- Create image-based slides sebagai alternatif dengan fidelity visual lebih tinggi.

### **4.6.10 PDF to JPG**

Fitur:

- Convert all pages.
- Convert selected pages.
- DPI selection.
- Image quality.
- JPG compression.
- Output folder selection.
- Sequential filename.

### **4.6.11 PDF to PNG**

Fitur:

- Convert all pages.
- Convert selected pages.
- DPI selection.
- Transparent background jika sesuai dengan konten dan renderer.
- Preserve visual quality.
- Export individual page.

### **4.6.12 Merge PDF**

Menggabungkan beberapa file PDF menjadi satu dokumen.

Persyaratan:

- Multiple PDF import.
- Drag and drop ordering.
- Page-level preview.
- Select pages from source PDFs.
- Remove selected pages.
- Rotate pages before merge.
- Output filename.
- Preserve page size.
- Preserve bookmarks jika memungkinkan.

### **4.6.13 Split PDF**

Memisahkan dokumen PDF berdasarkan:

- Every page.
- Page range.
- Selected pages.
- Custom intervals.
- Fixed number of pages per document.

Contoh:

Dokumen 100 halaman dapat dipisahkan menjadi:

- 1–10.
- 11–20.
- 21–30.
- dan seterusnya.

### **4.6.14 Compress PDF**

Fitur untuk mengurangi ukuran PDF.

Preset kompresi:

| Preset              | Kegunaan                            |
| ------------------- | ----------------------------------- |
| Low Compression     | Mempertahankan kualitas             |
| Recommended         | Keseimbangan kualitas dan ukuran    |
| High Compression    | Mengurangi ukuran secara signifikan |
| Extreme Compression | Mengutamakan ukuran kecil           |
| Custom              | Konfigurasi manual                  |

Parameter:

- Image resolution.
- JPEG quality.
- Image downsampling.
- Grayscale conversion.
- Remove unused objects.
- Font optimization.
- Metadata cleanup.
- Object stream compression.

Aplikasi wajib menyediakan:

- Original file size.
- Estimated output size.
- Actual output size.
- Compression percentage.
- Before/after preview.

### **4.6.15 Rotate PDF**

Fitur:

- Rotate selected pages.
- Rotate all pages.
- Rotate clockwise 90°.
- Rotate counter-clockwise 90°.
- Rotate 180°.
- Custom page selection.

Rotasi harus menggunakan perubahan orientasi halaman PDF tanpa melakukan rasterisasi seluruh dokumen jika tidak diperlukan.

### **4.6.16 Delete PDF Pages**

- Select individual pages.
- Multi-page selection.
- Delete page range.
- Delete odd pages.
- Delete even pages.
- Delete blank pages dengan konfirmasi.

### **4.6.17 Extract PDF Pages**

- Extract selected pages.
- Extract page ranges.
- Extract individual pages.
- Extract multiple ranges.
- Save as separate PDF.
- Preserve page orientation.
- Preserve document metadata apabila relevan.

### **4.6.18 Reorder PDF**

- Drag and drop thumbnails.
- Move up.
- Move down.
- Move to beginning.
- Move to end.
- Multi-page selection.
- Preview new page order.

### **4.6.19 Protect PDF**

Fitur untuk memberikan perlindungan password terhadap PDF.

Jenis password:

- Open Password / User Password.
- Owner Password / Permissions Password.

Opsi pembatasan:

- Printing.
- Editing.
- Copying text.
- Page extraction.
- Annotation.
- Form filling.

Persyaratan keamanan:

- Password tidak disimpan dalam bentuk plaintext.
- Pengguna harus memasukkan password saat membuka PDF yang dilindungi.
- Menggunakan enkripsi PDF yang didukung oleh library dan format PDF.
- Memberikan peringatan apabila pembatasan izin tidak didukung secara konsisten oleh aplikasi pembaca PDF tertentu.

### **4.6.20 Unlock PDF**

Fitur untuk membuka PDF yang diproteksi apabila pengguna memiliki otorisasi yang sah.

Persyaratan:

- Password harus dimasukkan jika dibutuhkan.
- Sistem memvalidasi password.
- Sistem menghapus proteksi melalui proses yang sah.
- Pengguna dapat menyimpan hasil sebagai file baru.
- File sumber tidak diubah.
- Tidak menyediakan mekanisme bypass password atau cracking.

### **4.6.21 PDF Page Number**

Fitur untuk menambahkan nomor halaman otomatis.

Pengaturan:

- Position: Top / Bottom.
- Alignment: Left / Center / Right.
- Font family.
- Font size.
- Font color.
- Starting number.
- Prefix.
- Suffix.
- Page numbering format.
- Margin.
- Page range.
- Skip cover page.

Contoh format:

- 1, 2, 3, 4.
- Page 1 of 10.
- Halaman 1.
- I, II, III, IV.

### **4.6.22 PDF Metadata**

Pengguna dapat mengelola informasi dokumen.

| Metadata          | Deskripsi         |
| ----------------- | ----------------- |
| Title             | Judul dokumen     |
| Author            | Penulis           |
| Subject           | Subjek            |
| Keywords          | Kata kunci        |
| Creator           | Aplikasi pembuat  |
| Producer          | PDF generator     |
| Creation Date     | Tanggal pembuatan |
| Modification Date | Tanggal perubahan |

Sistem harus memungkinkan pengguna melihat metadata lama dan menyimpan perubahan metadata.

### **4.6.23 PDF Editor Acceptance Criteria**

- Semua operasi halaman dapat dilakukan melalui preview.
- Operasi tidak merusak file sumber.
- Pengguna dapat memilih halaman tertentu.
- Perubahan urutan halaman sesuai hasil ekspor.
- Hasil konversi tersimpan dalam format yang benar.
- Proses yang gagal tidak menghapus dokumen asli.
- Operasi batch dapat menampilkan progress dan status.
- Dokumen terenkripsi ditangani sesuai otorisasi pengguna.

## **4.7 OCR Module**

Priority P1 – High

OCR digunakan untuk mengekstraksi teks dari hasil pemindaian dan dokumen PDF.

Fitur:

- OCR single page.
- OCR multiple pages.
- OCR entire document.
- Language selection.
- Text extraction.
- Searchable PDF.
- Copy extracted text.
- Export TXT.
- Export DOCX.
- Text search.
- OCR confidence information.

Bahasa OCR:

- Indonesian.
- English.
- Arabic.
- Bahasa tambahan melalui language packs.

Persyaratan:

- OCR berjalan secara offline.
- Pengguna dapat memasang language pack secara lokal.
- Hasil OCR dapat dikoreksi.
- OCR tidak boleh mengubah gambar asli.
- Hasil OCR disimpan secara terpisah dari gambar.

## **4.8 Document Library**

Priority P1 – High

Modul untuk menyimpan dan mengelola hasil pekerjaan.

Fitur:

- Recent Documents.
- All Documents.
- Search Documents.
- Sort by Name.
- Sort by Date.
- Filter by Format.
- Rename.
- Duplicate.
- Delete.
- Open Location.
- Export.
- Document Properties.

Kategori dokumen:

- Scanned Documents.
- Imported Documents.
- Converted Documents.
- Edited Documents.
- Exported Documents.

## **4.9 Print Management**

Priority P1 – High

Fitur:

- Printer detection.
- Printer selection.
- Page range.
- Number of copies.
- Paper size.
- Orientation.
- Color / Grayscale.
- Duplex printing jika didukung.
- Print preview.
- Print current document.

## **4.10 Application Settings**

Pengaturan aplikasi mencakup:

- Application language.
- Theme: Light / Dark / System.
- Default scanner.
- Default scan resolution.
- Default paper size.
- Default image format.
- Default PDF quality.
- Default output directory.
- Auto-save.
- Backup settings.
- OCR language.
- Temporary file management.
- Cache management.
- Hardware acceleration.
- Processing performance.
- Reset application settings.

# **5. User Experience & Application Workflow**

## **5.1 Main Application Navigation**

Aplikasi menyediakan navigasi utama berikut:

| Menu             | Fungsi                   |
| ---------------- | ------------------------ |
| Home             | Dashboard                |
| Scanner          | Pemindaian dokumen       |
| PDF Tools        | PDF editor dan converter |
| Image Editor     | Pengolahan gambar        |
| Document Library | Pengelolaan arsip        |
| OCR              | Ekstraksi teks           |
| Settings         | Pengaturan aplikasi      |

## **5.2 Main Scanner Workflow**

## **Document Scanning Workflow**

1. **Select Scanner**

   Pilih scanner fisik atau kamera.
2. **Configure Scanning**

   Atur DPI, ukuran kertas, warna, dan sumber kertas.
3. **Scan / Auto Capture**

   Lakukan pemindaian manual, batch, atau otomatis.
4. **Document Detection**

   Deteksi tepi, crop, dan koreksi perspektif.
5. **Image Enhancement**

   Tingkatkan warna, kurangi noise, dan koreksi gambar.
6. **Apply Scan Filter**

   Pilih preset untuk setiap halaman atau seluruh dokumen.
7. **Page Management**

   Urutkan, hapus, rotasi, atau tambahkan halaman.
8. **OCR (Optional)**

   Ekstraksi teks dan pembuatan searchable PDF.
9. **Export PDF**

   Simpan dokumen dengan pengaturan kualitas dan metadata.

## **5.3 PDF Editor Workflow**

1. Import PDF atau pilih dokumen dari Document Library.
2. Render halaman dan tampilkan thumbnail.
3. Pilih operasi PDF yang dibutuhkan.
4. Atur parameter operasi.
5. Preview hasil perubahan.
6. Proses dan validasi hasil.
7. Save As atau Export PDF.

# **6. Technical Architecture**

Arsitektur menggunakan pendekatan **Modular Monolith Desktop Application**, yaitu satu aplikasi desktop dengan modul internal yang terpisah berdasarkan tanggung jawab.

Tidak diperlukan backend server untuk menjalankan fungsi inti aplikasi.

## **6.1 Architecture Overview**

## **Application Architecture**

**React Renderer Process**

React · TypeScript · Tailwind CSS · Zustand

Dashboard · Scanner UI · Image Editor · PDF Editor · Library

Secure IPC Bridge

**Electron Main Process**

Window Manager · IPC Handler · Application Lifecycle

File System · Permissions · Process Management

**Scanner Engine**

WIA · TWAIN · Camera

**Image Engine**

OpenCV · Sharp

**PDF Engine**

PDF.js · PDF Libraries

**OCR Engine**

Tesseract

**Office Engine**

LibreOffice

**Storage Engine**

SQLite · Local Files

**Windows OS & Hardware**

Scanner · Camera · Printer · Local Disk · GPU

## **6.2 Recommended Technology Stack**

| Layer             | Teknologi                 | Fungsi                    |
| ----------------- | ------------------------- | ------------------------- |
| Desktop           | Electron                  | Runtime desktop           |
| Frontend          | React                     | UI                        |
| Language          | TypeScript                | Type safety               |
| Build             | Vite                      | Development/build         |
| Styling           | Tailwind CSS              | Styling                   |
| UI                | shadcn/ui                 | Component system          |
| State             | Zustand                   | Application state         |
| Routing           | React Router              | Navigation                |
| Scanner           | WIA / TWAIN               | Scanner integration       |
| Camera            | Media Foundation / WebRTC | Camera capture            |
| Image Processing  | OpenCV                    | Detection & enhancement   |
| Image Processing  | Sharp                     | Resize & image conversion |
| PDF Rendering     | PDF.js                    | Preview                   |
| PDF Manipulation  | pdf-lib / MuPDF           | PDF operations            |
| OCR               | Tesseract                 | Text recognition          |
| Office Conversion | LibreOffice               | Office conversion         |
| Database          | SQLite                    | Local database            |
| ORM               | Drizzle ORM               | Database access           |
| Validation        | Zod                       | Input validation          |
| Logging           | electron-log              | Application logs          |
| Packaging         | electron-builder          | Windows installer         |

## **6.3 Native Scanner Integration**

Scanner integration menjadi bagian teknis yang sangat penting.

Rekomendasi implementasi:

**WIA Integration**

Gunakan Windows Image Acquisition untuk mengakses scanner yang mendukung driver WIA.

**TWAIN Integration**

Sediakan TWAIN bridge untuk kompatibilitas dengan perangkat scanner yang menggunakan driver TWAIN.

**Native Bridge Architecture**

Saya merekomendasikan menggunakan helper service berbasis C#/.NET untuk integrasi WIA dan TWAIN, kemudian Electron berkomunikasi dengan helper tersebut melalui komunikasi lokal yang terkontrol.

Contoh:

```
React Renderer
      |
      v
Electron IPC
      |
      v
Scanner Service
      |
      v
Native Scanner Bridge
      |
      +---- WIA
      |
      +---- TWAIN
      |
      v
Physical Scanner
```

Dengan pemisahan tersebut, proses scanning tidak membebani React Renderer.

## **6.4 Image Processing Architecture**

OpenCV menjadi engine utama untuk pengolahan gambar yang membutuhkan analisis visual.

Pembagian tugas:

| Engine        | Tanggung Jawab                                  |
| ------------- | ----------------------------------------------- |
| OpenCV        | Edge detection, contour, perspective correction |
| OpenCV        | Noise reduction, threshold, color enhancement   |
| OpenCV        | Finger mark removal                             |
| Sharp         | Resize, rotate, image format conversion         |
| Sharp         | Image optimization                              |
| React Canvas  | Preview dan interaksi crop                      |
| Native Worker | Proses image processing intensif                |

Untuk automatic document detection, pipeline yang direkomendasikan:

```
Camera Frame
    |
    v
Image Preprocessing
    |
    v
Grayscale Conversion
    |
    v
Noise Reduction
    |
    v
Edge Detection
    |
    v
Contour Detection
    |
    v
Quadrilateral Detection
    |
    v
Corner Validation
    |
    v
Document Detection Result
    |
    v
Stability Analysis
    |
    v
Automatic Capture
    |
    v
Perspective Correction
    |
    v
Image Enhancement
```

## **6.5 PDF Engine Architecture**

PDF engine harus menggunakan pendekatan modular.

| Engine      | Penggunaan                                  |
| ----------- | ------------------------------------------- |
| PDF.js      | Rendering dan preview PDF                   |
| pdf-lib     | Manipulasi PDF dasar                        |
| MuPDF       | Rendering dan operasi PDF lanjutan          |
| qpdf        | Struktur PDF, enkripsi dan operasi tertentu |
| LibreOffice | Office conversion                           |
| Tesseract   | OCR dan searchable PDF                      |

Tidak semua fungsi harus menggunakan satu library. Setiap operasi diarahkan ke engine yang paling sesuai.

## **6.6 Office Conversion Architecture**

Office conversion membutuhkan perhatian khusus karena aplikasi harus tetap berjalan offline.

Gunakan LibreOffice dalam mode headless sebagai conversion engine.

Contoh:

```
soffice --headless \
  --convert-to pdf \
  --outdir ./output \
  document.docx
```

Alur konversi:

```
Input DOCX / XLSX / PPTX
          |
          v
    File Validation
          |
          v
  LibreOffice Process
          |
          v
   Conversion Engine
          |
          v
    Output PDF
          |
          v
   Result Validation
          |
          v
      Save File
```

Untuk konversi PDF ke Word, Excel, dan PowerPoint, dibutuhkan engine tambahan untuk rekonstruksi layout, tabel, teks, dan elemen visual. LibreOffice saja tidak cukup untuk menjamin konversi PDF ke format Office yang berkualitas.

## **6.7 Application Security Architecture**

Electron harus menerapkan prinsip keamanan berikut:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- Preload script dengan API terbatas.
- Validasi seluruh IPC input.
- Whitelist operasi file.
- Pembatasan akses direktori.
- Tidak mengekspos Node.js API langsung ke React.
- Penggunaan temporary directory yang terisolasi.
- Penghapusan temporary file secara terkontrol.

# **7. Database Design**

Database menggunakan SQLite dengan Drizzle ORM.

Dokumen dan file gambar disimpan di filesystem. Database hanya menyimpan informasi, metadata, relasi, dan lokasi file.

## **7.1 Database Tables**

| Tabel             | Fungsi                   |
| ----------------- | ------------------------ |
| app_settings      | Konfigurasi aplikasi     |
| scanner_devices   | Perangkat scanner        |
| scan_profiles     | Profil scanning          |
| scan_sessions     | Sesi pemindaian          |
| documents         | Data dokumen             |
| document_pages    | Data halaman             |
| page_processing   | Riwayat image processing |
| filter_presets    | Preset filter            |
| ocr_results       | Hasil OCR                |
| pdf_jobs          | Proses PDF               |
| conversion_jobs   | Riwayat konversi         |
| export_history    | Riwayat ekspor           |
| document_tags     | Tag dokumen              |
| document_activity | Aktivitas dokumen        |

## **7.2 Entity Relationship**

```
documents
    |
    +---- document_pages
    |          |
    |          +---- page_processing
    |          |
    |          +---- ocr_results
    |
    +---- document_activity
    |
    +---- export_history

scan_profiles
    |
    +---- scan_sessions
                 |
                 +---- documents

pdf_jobs
    |
    +---- documents

conversion_jobs
    |
    +---- documents
```

## **7.3 Core Database Schema**

Contoh rancangan skema inti:

```
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    document_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    original_path TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    page_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_pages (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    original_image_path TEXT NOT NULL,
    processed_image_path TEXT,
    thumbnail_path TEXT,
    width INTEGER,
    height INTEGER,
    dpi INTEGER,
    rotation INTEGER DEFAULT 0,
    filter_preset TEXT DEFAULT 'original',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE
);

CREATE TABLE page_processing (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    parameters TEXT,
    operation_order INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(page_id)
        REFERENCES document_pages(id)
        ON DELETE CASCADE
);

CREATE TABLE scan_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    resolution INTEGER DEFAULT 300,
    color_mode TEXT DEFAULT 'color',
    paper_size TEXT DEFAULT 'A4',
    paper_source TEXT DEFAULT 'feeder',
    duplex BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ocr_results (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    language TEXT,
    extracted_text TEXT,
    confidence REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(page_id)
        REFERENCES document_pages(id)
        ON DELETE CASCADE
);

CREATE TABLE conversion_jobs (
    id TEXT PRIMARY KEY,
    source_path TEXT NOT NULL,
    output_path TEXT,
    source_format TEXT NOT NULL,
    target_format TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Schema ini merupakan fondasi awal. Implementasi produksi perlu menambahkan tabel konfigurasi, PDF jobs, indexes, migration management, dan mekanisme pemulihan transaksi.

## **7.4 File Storage Structure**

Direktori penyimpanan yang direkomendasikan:

```
DocumentScanner/
│
├── database/
│   └── application.db
│
├── documents/
│   ├── DOC-001/
│   │   ├── original/
│   │   ├── processed/
│   │   ├── thumbnails/
│   │   ├── exports/
│   │   └── metadata.json
│   │
│   └── DOC-002/
│
├── imports/
├── exports/
├── temp/
├── cache/
├── backups/
├── logs/
└── language-packs/
```

Penyimpanan default menggunakan direktori user data aplikasi. Pengguna dapat mengatur direktori dokumen dan ekspor secara terpisah.

# **8. Non-Functional Requirements**

## **8.1 Performance**

| Parameter            | Target                                             |
| -------------------- | -------------------------------------------------- |
| Application startup  | Maksimal 5 detik pada perangkat referensi          |
| UI interaction       | Responsif, target 100 ms untuk interaksi sederhana |
| Thumbnail generation | Background processing                              |
| Image preview        | Progressive rendering                              |
| Batch processing     | Tidak memblokir UI                                 |
| PDF preview          | Lazy loading                                       |
| Database query       | Target di bawah 100 ms untuk operasi sederhana     |
| Memory usage         | Terukur dan dibatasi untuk batch processing        |

Target performa harus diuji pada perangkat referensi, misalnya Windows 11 dengan RAM 8 GB, SSD, dan CPU kelas menengah.

## **8.2 Reliability**

- Aplikasi tidak boleh kehilangan dokumen sumber akibat proses gagal.
- Proses ekspor harus memiliki mekanisme temporary output.
- Hasil akhir hanya menggantikan file tujuan setelah validasi berhasil dan pengguna menyetujui penggantian.
- Database harus menggunakan transaksi.
- Proses scanning yang gagal harus dapat dipulihkan tanpa merusak dokumen sebelumnya.
- Aplikasi harus memiliki mekanisme auto-save dan recovery.

## **8.3 Offline-first**

Mandatory Requirement

Seluruh fungsi inti harus berjalan tanpa koneksi internet.

| Fitur             | Offline                           |
| ----------------- | --------------------------------- |
| Scanner           | Ya                                |
| Camera Capture    | Ya                                |
| Image Processing  | Ya                                |
| Scan Filters      | Ya                                |
| PDF Editing       | Ya                                |
| PDF Conversion    | Ya                                |
| OCR               | Ya                                |
| Document Library  | Ya                                |
| Printing          | Ya, dengan printer lokal          |
| Office Conversion | Ya                                |
| Language Packs    | Ya, setelah tersedia secara lokal |

Tidak boleh ada ketergantungan runtime terhadap cloud API untuk menjalankan fungsi utama.

## **8.4 Security & Privacy**

- File pengguna diproses secara lokal.
- Tidak ada pengiriman dokumen otomatis ke server eksternal.
- Password PDF tidak disimpan plaintext.
- Temporary files dibersihkan setelah pekerjaan selesai.
- Log tidak boleh mencatat isi dokumen atau password.
- Backup dapat dienkripsi.
- Akses file menggunakan mekanisme yang terkontrol.

## **8.5 Compatibility**

Target:

- Windows 10 64-bit.
- Windows 11 64-bit.
- Scanner WIA.
- Scanner TWAIN.
- USB scanner.
- Network scanner apabila terpapar melalui driver Windows.
- Printer lokal.
- Webcam USB dan kamera yang tersedia melalui Windows.

Dukungan perangkat tertentu tetap bergantung pada driver dan kompatibilitas perangkat keras.

# **9. API & IPC Specification**

Karena aplikasi menggunakan Electron, komunikasi frontend dan backend menggunakan IPC.

React tidak boleh mengakses filesystem, scanner, atau native library secara langsung.

## **9.1 Scanner API**

```
interface ScannerAPI {
  getDevices(): Promise<ScannerDevice[]>;

  selectDevice(
    deviceId: string
  ): Promise<void>;

  getCapabilities(
    deviceId: string
  ): Promise<ScannerCapabilities>;

  startScan(
    options: ScanOptions
  ): Promise<ScanSession>;

  cancelScan(
    sessionId: string
  ): Promise<void>;

  onProgress(
    callback: (progress: ScanProgress) => void
  ): () => void;

  onPageReceived(
    callback: (page: ScannedPage) => void
  ): () => void;
}
```

## **9.2 Image Processing API**

```
interface ImageProcessingAPI {
  detectDocument(
    imagePath: string
  ): Promise<DocumentDetectionResult>;

  applyFilter(
    pageId: string,
    filter: FilterPreset,
    options?: FilterOptions
  ): Promise<ProcessedImage>;

  rotate(
    pageId: string,
    degrees: number
  ): Promise<ProcessedImage>;

  resize(
    pageId: string,
    options: ResizeOptions
  ): Promise<ProcessedImage>;

  enhance(
    pageId: string,
    options: EnhancementOptions
  ): Promise<ProcessedImage>;

  undo(
    pageId: string
  ): Promise<void>;

  reset(
    pageId: string
  ): Promise<void>;
}
```

## **9.3 PDF API**

```
interface PDFAPI {
  merge(
    files: string[],
    outputPath: string
  ): Promise<PDFJobResult>;

  split(
    file: string,
    ranges: PageRange[],
    outputDir: string
  ): Promise<PDFJobResult>;

  compress(
    file: string,
    options: CompressOptions
  ): Promise<PDFJobResult>;

  rotate(
    file: string,
    pages: number[],
    degrees: number
  ): Promise<PDFJobResult>;

  extract(
    file: string,
    pages: number[],
    outputPath: string
  ): Promise<PDFJobResult>;

  deletePages(
    file: string,
    pages: number[]
  ): Promise<PDFJobResult>;

  protect(
    file: string,
    options: PDFProtectionOptions
  ): Promise<PDFJobResult>;

  unlock(
    file: string,
    password: string,
    outputPath: string
  ): Promise<PDFJobResult>;

  convert(
    file: string,
    targetFormat: string,
    options?: ConversionOptions
  ): Promise<PDFJobResult>;
}
```

## **9.4 Document API**

```
interface DocumentAPI {
  create(name: string): Promise<Document>;

  open(documentId: string): Promise<Document>;

  save(documentId: string): Promise<void>;

  addPage(
    documentId: string,
    imagePath: string
  ): Promise<DocumentPage>;

  deletePage(pageId: string): Promise<void>;

  reorderPages(
    documentId: string,
    pageIds: string[]
  ): Promise<void>;

  exportPDF(
    documentId: string,
    options: PDFExportOptions
  ): Promise<string>;
}
```

## **9.5 IPC Security Contract**

Semua API tersebut harus diekspos melalui `contextBridge` dengan kontrak yang eksplisit.

Ketentuan:

- Tidak mengekspos `ipcRenderer` secara langsung.
- Tidak menyediakan generic filesystem API kepada Renderer.
- Validasi tipe dan parameter menggunakan Zod.
- Validasi path terhadap direktori yang diizinkan.
- Proses panjang menggunakan job ID.
- Progress dikirim melalui event IPC.
- Event listener wajib memiliki fungsi cleanup.

# **10. Filter Processing Specification**

Bagian ini penting karena sepuluh preset filter harus memiliki karakteristik yang konsisten.

## **10.1 Filter Engine**

Setiap preset menggunakan parameter konfigurasi yang dapat disimpan sebagai JSON.

Contoh:

```
type FilterPreset =
  | "original"
  | "auto-enhance"
  | "magic-color"
  | "gray-mode"
  | "black-white"
  | "lighten"
  | "darken"
  | "sharpen"
  | "ink-saving"
  | "photo-mode";

interface FilterConfig {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
  threshold?: number;
  denoise?: number;
  gamma?: number;
  whiteBalance?: boolean;
  adaptiveThreshold?: boolean;
}
```

## **10.2 Filter Processing Pipeline**

```
Original Image
      |
      v
Image Decode
      |
      v
Filter Preset Selection
      |
      v
Load Filter Configuration
      |
      v
Image Processing Engine
      |
      v
Generate Preview
      |
      v
User Confirmation
      |
      v
Save Processing Recipe
      |
      v
Render Processed Image
```

## **10.3 Batch Application Rules**

Ketika pengguna memilih Apply to All Pages:

1. Sistem mengambil daftar seluruh halaman.
2. Sistem membaca original image masing-masing halaman.
3. Sistem menerapkan konfigurasi filter yang sama.
4. Setiap halaman diproses secara independen.
5. Progress ditampilkan.
6. Pengguna dapat membatalkan batch processing.
7. Hasil yang sudah selesai tidak menggantikan original image.
8. Sistem mencatat hasil dan operasi untuk masing-masing halaman.

Penting: filter yang sama dapat menghasilkan tampilan berbeda pada halaman berbeda karena karakteristik gambar masing-masing.

# **11. PDF Conversion Compatibility & Limitations**

Bagian ini perlu ditetapkan secara eksplisit agar ekspektasi kualitas konversi tidak terlalu tinggi.

Tidak semua format dapat dikonversi dengan tingkat akurasi yang sama.

| Konversi          | Tingkat kompleksitas | Strategi                       |
| ----------------- | -------------------- | ------------------------------ |
| JPG to PDF        | Rendah               | Image embedding                |
| PNG to PDF        | Rendah               | Image embedding                |
| Image to PDF      | Rendah               | Image embedding                |
| Word to PDF       | Sedang               | LibreOffice                    |
| Excel to PDF      | Sedang               | LibreOffice                    |
| PPT to PDF        | Sedang               | LibreOffice                    |
| PDF to JPG        | Rendah               | PDF rendering                  |
| PDF to PNG        | Rendah               | PDF rendering                  |
| Merge PDF         | Rendah               | PDF manipulation               |
| Split PDF         | Rendah               | PDF manipulation               |
| Compress PDF      | Sedang               | Image/object optimization      |
| Rotate PDF        | Rendah               | Page transformation            |
| Delete PDF Pages  | Rendah               | Page manipulation              |
| Extract PDF Pages | Rendah               | Page manipulation              |
| Reorder PDF       | Rendah               | Page manipulation              |
| Protect PDF       | Sedang               | PDF encryption                 |
| Unlock PDF        | Sedang               | Password-authorized decryption |
| PDF Page Number   | Rendah               | PDF overlay                    |
| PDF Metadata      | Rendah               | Metadata manipulation          |
| PDF to Word       | Tinggi               | Layout reconstruction          |
| PDF to Excel      | Tinggi               | Table recognition              |
| PDF to PPT        | Tinggi               | Slide reconstruction           |

**Keputusan produk:**

PDF to Word, Excel, dan PPT harus diperlakukan sebagai advanced conversion engine. Jangan menjanjikan hasil identik dengan dokumen sumber.

Untuk meningkatkan kualitas:

- Gunakan native text extraction untuk PDF yang memiliki text layer.
- Gunakan OCR untuk PDF berbasis gambar.
- Gunakan layout analysis untuk mempertahankan posisi teks.
- Gunakan table recognition untuk Excel.
- Sediakan mode visual conversion sebagai alternatif.
- Tampilkan peringatan jika struktur dokumen tidak dapat direkonstruksi secara sempurna.

# **12. Error Handling & Recovery**

Aplikasi harus memiliki sistem penanganan kesalahan yang konsisten.

| Error                   | Penanganan                              |
| ----------------------- | --------------------------------------- |
| Scanner disconnected    | Tampilkan notifikasi dan opsi reconnect |
| Scanner busy            | Berikan opsi retry                      |
| Unsupported scanner     | Tampilkan informasi kompatibilitas      |
| Invalid image           | Tolak file dan tampilkan pesan          |
| Corrupted PDF           | Tampilkan informasi kerusakan           |
| Wrong PDF password      | Minta input ulang                       |
| Conversion failed       | Pertahankan file sumber                 |
| Disk full               | Hentikan proses dengan aman             |
| OCR failed              | Simpan gambar dan laporkan error        |
| Image processing failed | Kembali ke original                     |
| Application crash       | Pulihkan pekerjaan yang tersimpan       |

### **12.1 Auto Recovery**

Sistem perlu memiliki:

- Automatic project recovery.
- Periodic document state saving.
- Temporary processing recovery.
- Database integrity checking.
- Backup database.
- Export job recovery.
- Temporary file cleanup.

Untuk pekerjaan scanning, hasil halaman yang telah berhasil diterima harus disimpan secara bertahap sehingga kegagalan pada halaman berikutnya tidak menghilangkan halaman sebelumnya.

# **13. Product Acceptance Criteria**

Berikut kriteria utama sebelum aplikasi dinyatakan siap dirilis.

| No. | Kriteria                     | Target                               |
| --- | ---------------------------- | ------------------------------------ |
| 1   | Scanner detection            | Berfungsi                            |
| 2   | WIA integration              | Berfungsi                            |
| 3   | TWAIN integration            | Berfungsi pada perangkat kompatibel  |
| 4   | Batch scanning               | Berfungsi                            |
| 5   | Camera capture               | Berfungsi                            |
| 6   | Automatic document detection | Berfungsi                            |
| 7   | Automatic edge detection     | Berfungsi                            |
| 8   | Automatic capture            | Berfungsi                            |
| 9   | Perspective correction       | Berfungsi                            |
| 10  | Image enhancement            | Berfungsi                            |
| 11  | Finger mark removal          | Berfungsi dengan kontrol pengguna    |
| 12  | 10 filter presets            | Seluruhnya berfungsi                 |
| 13  | Apply filter per page        | Berfungsi                            |
| 14  | Apply filter to all pages    | Berfungsi                            |
| 15  | Multi-page management        | Berfungsi                            |
| 16  | PDF editing                  | Seluruh operasi utama berfungsi      |
| 17  | Office conversion            | Berfungsi offline                    |
| 18  | PDF to Office                | Berfungsi dengan batasan fidelity    |
| 19  | OCR                          | Berfungsi offline                    |
| 20  | Document library             | Berfungsi                            |
| 21  | Print                        | Berfungsi                            |
| 22  | Auto recovery                | Berfungsi                            |
| 23  | Offline operation            | Tidak membutuhkan koneksi internet   |
| 24  | Installer                    | Berhasil dipasang pada Windows 10/11 |

# **14. Development Roadmap**

Pengembangan dibagi menjadi enam fase untuk mengurangi risiko teknis dan memastikan fondasi aplikasi stabil.

## **Development Roadmap**

1. **Phase 1 – Foundation & UI**

   P0

   Estimasi 1–2 minggu
   - Setup React + Electron + TypeScript.
   - Main window.
   - Navigation.
   - Application layout.
   - SQLite.
   - IPC architecture.
   - Document workspace.
2. **Phase 2 – Scanner & Image Processing**

   P0

   Estimasi 2–3 minggu
   - WIA integration.
   - TWAIN integration.
   - Camera integration.
   - Batch scanning.
   - Automatic detection.
   - Automatic capture.
   - Perspective correction.
   - Image enhancement.
3. **Phase 3 – Image Editor & Filters**

   P0

   Estimasi 1–2 minggu
   - Image rotation.
   - Image resizing.
   - Noise reduction.
   - Finger mark removal.
   - 10 filter presets.
   - Batch filter application.
   - Undo/redo.
4. **Phase 4 – PDF Editor & Converter**

   P0

   Estimasi 2–4 minggu
   - PDF rendering.
   - Merge/split.
   - Page manipulation.
   - Compression.
   - Password protection.
   - Metadata.
   - Office to PDF.
   - PDF to Office.
   - Image conversion.
5. **Phase 5 – OCR & Document Library**

   P1

   Estimasi 1–2 minggu
   - Tesseract integration.
   - Searchable PDF.
   - Text extraction.
   - Document library.
   - Document search.
   - Backup and recovery.
6. **Phase 6 – Testing & Release**

   P1

   Estimasi 1–2 minggu
   - Hardware testing.
   - Performance optimization.
   - Security testing.
   - Offline testing.
   - Installer generation.
   - User acceptance testing.
   - Production release.

**Estimasi keseluruhan: 8–15 minggu**

Estimasi untuk satu developer berpengalaman, dengan asumsi integrasi perangkat dan library tidak mengalami kendala besar. PDF to Office berkualitas tinggi dan kompatibilitas berbagai scanner dapat memperpanjang jadwal.

# **15. Testing Strategy**

Pengujian dilakukan dalam beberapa tingkatan.

### **15.1 Unit Testing**

Menggunakan Vitest untuk menguji:

- Filter engine.
- Image processing parameters.
- Document state.
- Page ordering.
- PDF operation parameters.
- Conversion validation.
- Database operations.

### **15.2 Integration Testing**

Menguji:

- React ke Electron IPC.
- Electron ke scanner service.
- Scanner service ke WIA/TWAIN.
- OpenCV dan Sharp.
- PDF engine.
- OCR engine.
- LibreOffice conversion.
- SQLite dan filesystem.

### **15.3 End-to-End Testing**

Menggunakan Playwright dengan Electron untuk menguji:

- Membuat dokumen baru.
- Import gambar.
- Scan dokumen.
- Mengedit gambar.
- Menggunakan filter.
- Mengurutkan halaman.
- Export PDF.
- Merge PDF.
- Convert Office.
- Menyimpan dan membuka kembali dokumen.

### **15.4 Hardware Testing**

Minimal pengujian menggunakan:

- Scanner flatbed.
- Scanner ADF.
- Scanner duplex.
- Scanner WIA.
- Scanner TWAIN.
- Webcam USB.

# **16. Recommended UI Design System**

Desain aplikasi mempertahankan karakteristik desktop scanner klasik pada screenshot referensi, tetapi dengan peningkatan usability dan konsistensi visual.

[QuickScan – PDF & Document Scanner | Scan to PDF - Download e instalação gratuitos no Windows | Microsoft Store](https://images.openai.com/static-rsc-4/mErU6qZscPYxt3Hb0ZfB2f-udhLaBOdhSMgESF2A6aM5ECtOPGBfXUGkQm0avJT1_-EJy47bIMe7LdVrZQGRdTfDeBzlg2tYkDulRy0tZ47kgrCsEW01yCpwrz602zblqIDLOd3uUsId1hnZ6-NVpJkp0EvkagkRT6jI3d8s-GI?purpose=inline)

[GitHub - cyanfish/naps2: Scan documents to PDF and more, as simply as possible. · GitHub](https://images.openai.com/static-rsc-4/P_k3D3XJS-eFyfn_Je1J03Zk0O-uexibd72esSHuAgzlDMIcsy1r5imFuAio5nlFf94OmDmjs4CGHfps0bbWA_KvwzmnCZsXrdykh_zSJFt2BXT96bLaJQ9mreuDNLEjMiHpCGwRMmLrzuOVNMhFg6w51wf5RwTItMBKK3Idhf4?purpose=inline)

[Brief Introduction to PDFelement](https://images.openai.com/static-rsc-4/oPhnKtWQtd3PJ9pRY0BjuuSCj5KLHfYeuZxvbPh-rpa2_BqWnFF44QAufX5WqErAkHHTf3LVSkaXzQelyhhXG48nRr42h2VsJQyNKgYLlkZj1dueZ1knxO4DjP-LOn9LZm34bsOOEFjZpPiYslbY-_8vPA3HOvIB_R6aQrvR7gY?purpose=inline)

12

### **16.1 Design Direction**

- Desktop-first.
- Light theme sebagai default.
- Dark theme sebagai opsi.
- Compact toolbar.
- Resizable sidebar.
- Document preview dengan ruang maksimal.
- Thumbnail navigation.
- Context menu.
- Keyboard shortcuts.
- Drag and drop.
- Modal dialog yang konsisten.

### **16.2 Main Window Layout**

| Area               | Fungsi                            |
| ------------------ | --------------------------------- |
| Title Bar          | Nama aplikasi dan window controls |
| Main Toolbar       | Akses cepat fungsi utama          |
| Navigation Sidebar | Menu aplikasi                     |
| Properties Sidebar | Pengaturan scanner/editor         |
| Workspace          | Preview dokumen                   |
| Thumbnail Panel    | Daftar halaman                    |
| Status Bar         | Informasi dokumen dan proses      |

### **16.3 Keyboard Shortcuts**

| Shortcut         | Fungsi               |
| ---------------- | -------------------- |
| Ctrl + N         | New Document         |
| Ctrl + O         | Open Document        |
| Ctrl + S         | Save                 |
| Ctrl + Shift + S | Save As              |
| Ctrl + I         | Import               |
| Ctrl + P         | Print                |
| Ctrl + Z         | Undo                 |
| Ctrl + Y         | Redo                 |
| Delete           | Delete Selected Page |
| Ctrl + E         | Export PDF           |
| Ctrl + F         | Search               |
| Ctrl + Plus      | Zoom In              |
| Ctrl + Minus     | Zoom Out             |

# **17. Product Prioritization**

Untuk mencegah pengembangan terlalu luas sejak awal, seluruh fitur diklasifikasikan menjadi tiga prioritas.

| Prioritas        | Definisi                                          |
| ---------------- | ------------------------------------------------- |
| P0 – Critical    | Harus tersedia pada versi produksi pertama        |
| P1 – High        | Sangat penting, dapat dirilis setelah fungsi inti |
| P2 – Enhancement | Pengembangan lanjutan                             |

Rekomendasi pembagian:

| Modul                        | Prioritas |
| ---------------------------- | --------- |
| Scanner Management           | P0        |
| Camera Capture               | P0        |
| Automatic Detection          | P0        |
| Image Processing             | P0        |
| 10 Scan Filters              | P0        |
| Page Management              | P0        |
| Image to PDF                 | P0        |
| Merge / Split PDF            | P0        |
| PDF Compression              | P0        |
| PDF Rotation                 | P0        |
| Delete / Extract / Reorder   | P0        |
| Protect / Unlock PDF         | P1        |
| PDF Metadata                 | P1        |
| PDF Page Number              | P1        |
| Word / Excel / PPT to PDF    | P1        |
| PDF to JPG / PNG             | P1        |
| PDF to Word / Excel / PPT    | P2        |
| OCR                          | P1        |
| Document Library             | P1        |
| Advanced Finger Mark Removal | P2        |
| Advanced Auto Capture        | P2        |

# **18. Definition of Done**

Sebuah fitur dinyatakan selesai apabila:

1. UI sudah tersedia dan sesuai desain.
2. Fungsi backend sudah terimplementasi.
3. IPC sudah terhubung dengan aman.
4. Validasi input sudah tersedia.
5. Error handling sudah tersedia.
6. Loading dan progress indicator sudah tersedia.
7. Data dapat disimpan dan dipulihkan.
8. Tidak merusak file asli.
9. Unit dan integration tests lulus.
10. Sudah diuji dalam mode offline.
11. Dokumentasi teknis tersedia.

# **19. Risiko dan Mitigasi**

| Risiko                           | Mitigasi                                 |
| -------------------------------- | ---------------------------------------- |
| Scanner tidak kompatibel         | WIA dan TWAIN adapter                    |
| Driver scanner bermasalah        | Error handling dan driver diagnostics    |
| Auto detection tidak akurat      | Manual crop fallback                     |
| Auto capture terlalu sensitif    | Stability threshold dan confidence score |
| Gambar beresolusi besar          | Worker dan streaming processing          |
| PDF kompleks gagal dikonversi    | Multi-engine conversion                  |
| Office conversion berbeda layout | Font management dan conversion preview   |
| OCR kurang akurat                | Language packs dan image preprocessing   |
| RAM penuh saat batch processing  | Queue dan sequential processing          |
| Database rusak                   | Backup dan integrity checking            |
| Aplikasi kehilangan pekerjaan    | Autosave dan recovery                    |
| File hasil rusak                 | Temporary output dan validation          |

# **20. Final Product Specification**

Product Baseline

# **Document Scanner & PDF Editor**

All-in-one Offline Desktop Document Processing Application

[Scanitto Pro - Scanner software for Windows](https://images.openai.com/static-rsc-4/hQfNZHqSmLFJoK7s8DaNutIH2Y_yETJgAPVBq230_ranB8DETFHc6hsvg8bhanZDXslOdzQY04G_9lAFXskE-J-cdoJ5V9kJyD_k01AjmRFu81AQ5yrrJtjymR2JSb0QZPmvkPb8KLLzHI6t_aa7c6FbN_tNCbbJdLcibMwvXF0?purpose=inline)

[scanitto.com](https://www.scanitto.com/?utm_source=chatgpt.com)

**Fitur utama produk**

Scanner Engine

**WIA + TWAIN**

Smart Capture

**Auto detection**

Image Processing

**OpenCV + Sharp**

Scan Filters

**10 presets**

PDF Editor

**Full page management**

PDF Converter

**Multi-format**

OCR

**Offline Tesseract**

Office Engine

**LibreOffice**

**Product characteristics**

- 100% local-first processing.
- No mandatory cloud dependency.
- Multi-page document workflow.
- Non-destructive image editing.
- Modular architecture.
- Extensible conversion engine.
- Secure local storage.
- Windows desktop distribution.

## **21. Rekomendasi Keputusan Teknis Sebelum Implementasi**

Ada lima keputusan yang sebaiknya ditetapkan sebelum developer mulai membangun aplikasi.

| No. | Keputusan           | Rekomendasi              |
| --- | ------------------- | ------------------------ |
| 1   | Scanner integration | C#/.NET native bridge    |
| 2   | Image processing    | OpenCV + Sharp           |
| 3   | PDF processing      | PDF.js + MuPDF + pdf-lib |
| 4   | Office conversion   | LibreOffice headless     |
| 5   | Database            | SQLite + Drizzle ORM     |

Satu hal yang perlu mendapat perhatian khusus adalah lisensi komponen. MuPDF, qpdf, OpenCV, Tesseract, LibreOffice, dan library lainnya memiliki ketentuan distribusi yang berbeda. Sebelum dimasukkan ke installer komersial, lakukan pemeriksaan lisensi setiap versi dan dependensinya.

**Rekomendasi akhir:** Bangun aplikasi dengan prinsip *local-first, non-destructive editing, modular processing engine,* dan *job-based background processing*. Dengan demikian, aplikasi tidak hanya dapat meniru fungsi aplikasi scanner referensi, tetapi juga dapat berkembang menjadi perangkat lunak pengelolaan dokumen profesional.
