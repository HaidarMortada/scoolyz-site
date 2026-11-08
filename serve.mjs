// A local stand-in for scoolyz.com, for testing the apps against the dev directory:
//
//   node build.mjs --dev && node serve.mjs            # http://127.0.0.1:8090, serving _site-dev/
//   node serve.mjs _site 8091                         # the real build
//
// Behaves like GitHub Pages where the apps care: real 404s (with 404.html), JSON as application/json, folder
// index.html files. Loopback only. No dependencies.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const dir = resolve(ROOT, process.argv[2] ?? '_site-dev');
const port = Number(process.argv[3] ?? 8090);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.exe': 'application/octet-stream',
  '.sig': 'application/octet-stream',
};

function file(path) {
  try {
    const stat = statSync(path);
    if (stat.isDirectory()) return file(join(path, 'index.html'));
    return stat.isFile() ? path : null;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const target = normalize(join(dir, path));
  const found = target.startsWith(dir) ? file(target) : null;
  if (!found) {
    const notFound = join(dir, '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end('Not found');
    console.log(404, path);
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  createReadStream(found).pipe(res);
  console.log(200, path);
}).listen(port, '127.0.0.1', () => console.log(`serving ${dir} on http://127.0.0.1:${port}`));
