import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const origin = `http://${host}:${port}`;
const pageUrl = new URL('./index.html', import.meta.url);
let running = false;

createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(pageUrl));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/run') {
    res.writeHead(404).end();
    return;
  }
  if (req.headers.origin !== origin) {
    res.writeHead(403).end();
    return;
  }
  if (running) {
    res.writeHead(409).end('Замер уже идёт.');
    return;
  }

  running = true;
  const child = spawn(process.execPath, ['speed-test.js'], {
    env: { ...process.env, SPEED_TEST_LIVE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.flushHeaders();
  child.stdout.pipe(res, { end: false });
  child.stderr.pipe(res, { end: false });
  child.on('error', () => res.end('Не удалось запустить Node.js.\n'));
  child.on('close', () => {
    running = false;
    res.end();
  });
  res.on('close', () => {
    if (!res.writableFinished) child.kill();
  });
}).listen(port, host, () => console.log(`Замер скорости: ${origin}`));
