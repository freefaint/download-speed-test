import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';

const DEFAULT_DOWNLOAD_URL = 'https://watch.net.ru/pub/download-speed-test-10m.bin';
const REQUEST_COUNT = 10;
const TIMEOUT_MS = 120_000;

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const { positionals } = parseArgs({ allowPositionals: true, options: {} });
  if (positionals.length > 1) throw new Error('Usage: npm run cli -- [http(s)://URL]');
  const input = positionals[0] || process.env.DOWNLOAD_URL || DEFAULT_DOWNLOAD_URL;
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  let totalBytes = 0;
  let totalMs = 0;
  for (let i = 0; i < REQUEST_COUNT; i++) {
    const start = performance.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Request ${i + 1}: HTTP ${response.status}`);
    }
    let bytes = 0;
    let sampleStart = performance.now();
    let sampleBytes = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (!process.env.SPEED_TEST_LIVE) continue;
        sampleBytes += chunk.byteLength;
        const now = performance.now();
        const sampleMs = now - sampleStart;
        if (sampleMs >= 300) {
          console.log(`Live speed: ${(sampleBytes * 8 / sampleMs / 1000).toFixed(2)}`);
          sampleStart = now;
          sampleBytes = 0;
        }
      }
    }
    const elapsed = performance.now() - start;
    totalBytes += bytes;
    totalMs += elapsed;
    console.log(`${i + 1}/${REQUEST_COUNT}: ${bytes} bytes, ${elapsed.toFixed(2)} ms`);
  }
  console.log(`\nAverage request time: ${(totalMs / REQUEST_COUNT).toFixed(2)} ms`);
  console.log(`Total downloaded: ${totalBytes} bytes (${(totalBytes / 1024 ** 2).toFixed(2)} MiB)`);
  console.log(`Download speed: ${(totalBytes / (totalMs / 1000) / 1024 ** 2).toFixed(2)} MiB/s`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
