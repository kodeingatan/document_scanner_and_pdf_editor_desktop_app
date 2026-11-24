import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const builderCli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const args = process.argv.slice(2);

// Run electron-builder through Node instead of the .cmd shim, which breaks when
// the project path contains "&".
const child = spawn(process.execPath, [builderCli, ...args], { cwd: root, stdio: 'inherit' });
child.on('close', (code) => process.exit(code ?? 0));
