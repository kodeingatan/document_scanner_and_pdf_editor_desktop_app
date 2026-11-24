import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

// `electron .` fails on Windows when the project path contains "&" (the cmd
// shell splits the path). Resolve the Electron binary and spawn it without a
// shell instead, exactly like scripts/electron-build.mjs does for dev.
const mainBundle = path.join(root, 'dist-electron', 'main.cjs');
const rendererEntry = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(mainBundle) || !fs.existsSync(rendererEntry)) {
  console.log('Build output not found, running the production build first...');
  const build = spawn(process.execPath, [path.join(root, 'scripts', 'build.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  const buildExit = await new Promise((resolve) => build.on('close', resolve));
  if (buildExit !== 0) {
    process.exit(buildExit ?? 1);
  }
}

const electronPath = require('electron');
const app = spawn(electronPath, ['.'], { cwd: root, stdio: 'inherit' });

app.on('close', (code) => process.exit(code ?? 0));
app.on('error', (error) => {
  console.error('Failed to launch Electron:', error);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    app.kill();
    process.exit(0);
  });
}
