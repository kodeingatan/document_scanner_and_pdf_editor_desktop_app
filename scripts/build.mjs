import { spawn } from 'node:child_process';
import path from 'node:path';
import { buildElectron } from './electron-build.mjs';

// Spawn the Vite CLI with the current Node binary instead of npx so the build
// works no matter what the project path contains (it includes "&" here).
const viteBin = path.resolve(import.meta.dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
const vite = spawn(process.execPath, [viteBin, 'build'], { stdio: 'inherit' });

const viteExit = await new Promise((resolve) => vite.on('close', resolve));
if (viteExit !== 0) {
  process.exit(viteExit ?? 1);
}

await buildElectron();
console.log('Build complete: dist/ and dist-electron/');
