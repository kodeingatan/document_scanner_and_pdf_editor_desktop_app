import { buildElectron, startVite, startElectron } from './electron-build.mjs';

await buildElectron({ watch: true });

const vite = startVite();
let electron = null;
let started = false;

vite.stderr?.on('data', (chunk) => process.stderr.write(String(chunk)));

vite.stdout?.on('data', (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);
  if (!started && text.includes('5273')) {
    started = true;
    setTimeout(boot, 900);
  }
});

setTimeout(() => {
  if (!started) {
    started = true;
    boot();
  }
}, 6000);

function boot() {
  electron = startElectron({ VITE_DEV_SERVER_URL: 'http://localhost:5273' });
  electron.on('close', () => {
    vite.kill();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  electron?.kill();
  vite.kill();
  process.exit(0);
});
