import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const esbuild = require('esbuild');

const MAIN_ENTRY = path.join(root, 'electron', 'main.ts');
const PRELOAD_ENTRY = path.join(root, 'electron', 'preload.ts');
const OUT_DIR = path.join(root, 'dist-electron');

/** Bundle the main process and preload script with all node_modules left external. */
export async function buildElectron({ watch = false } = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: true,
    packages: 'external',
    external: ['electron'],
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    },
  };
  const contexts = await Promise.all([
    esbuild.context({ ...common, entryPoints: [MAIN_ENTRY], outfile: path.join(OUT_DIR, 'main.cjs') }),
    esbuild.context({ ...common, entryPoints: [PRELOAD_ENTRY], outfile: path.join(OUT_DIR, 'preload.cjs') }),
  ]);
  if (watch) {
    await Promise.all(contexts.map((c) => c.watch()));
    return contexts;
  }
  await Promise.all(contexts.map((c) => c.rebuild()));
  await Promise.all(contexts.map((c) => c.dispose()));
  return [];
}

export function startVite() {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  return spawn(process.execPath, [viteBin, '--port', '5273', '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function startElectron(env) {
  const electronPath = require('electron');
  return spawn(electronPath, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

export const paths = { root, OUT_DIR };
