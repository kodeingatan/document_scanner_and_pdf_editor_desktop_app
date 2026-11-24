import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'resources', 'tessdata');
fs.mkdirSync(outDir, { recursive: true });

const LANGS = ['eng', 'ind', 'osd'];
const BASE = 'https://tessdata.projectnaptha.com/4.0.0';

for (const lang of LANGS) {
  const target = path.join(outDir, `${lang}.traineddata.gz`);
  if (fs.existsSync(target) && fs.statSync(target).size > 1000) {
    console.log(`skip ${lang} (already present)`);
    continue;
  }
  const url = `${BASE}/${lang}.traineddata.gz`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
    console.log(`downloaded ${lang}.traineddata.gz (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (error) {
    console.warn(`failed ${lang}: ${error.message}`);
  }
}
