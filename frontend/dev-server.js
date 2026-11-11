// Запуск фронтенда без Docker: node frontend/dev-server.js
// Раздаёт статические файлы и проксирует /api/* на ewm-service (по умолчанию http://localhost:8080).
// Зависимостей нет — нужен только Node.js 18+.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const API = new URL(process.env.API_URL || 'http://localhost:8080');
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function proxy(req, res) {
  const target = req.url.replace(/^\/api/, '') || '/';
  const upstream = http.request({
    hostname: API.hostname,
    port: API.port,
    path: target,
    method: req.method,
    headers: { ...req.headers, host: API.host },
  }, (up) => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: '' }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT) || urlPath.includes('dev-server')) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) proxy(req, res);
  else serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Фронтенд: http://localhost:${PORT}  (API -> ${API.origin})`);
});
