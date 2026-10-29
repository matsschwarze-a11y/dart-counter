// Minimaler statischer Dev-Server.  Aufruf: node tools/serve.js [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(ROOT, path);
    if (!file.startsWith(ROOT)) throw new Error('forbidden');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
});

// Ist der Port belegt (z. B. läuft der Server schon), den nächsten freien nehmen.
let port = PORT;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < PORT + 10) {
    console.log(`Port ${port} ist belegt – versuche ${port + 1} …`);
    server.listen(++port);
  } else {
    console.error(e.message);
    process.exit(1);
  }
});
server.on('listening', () => console.log(`Dart Counter läuft auf http://localhost:${port}/`));
server.listen(port);
