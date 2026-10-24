import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { GameMap } from '../shared/map.js';
import { PHYS } from '../shared/physics.js';
import { RoomManager } from './rooms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const mapFile = path.join(root, 'public/assets/map/catacombs.json');

if (!fs.existsSync(mapFile)) {
  console.error('Assets missing. Extract them from your APK first:\n  npm run extract -- /path/to/com.appsomniacs.mmc.apk');
  process.exit(1);
}

const map = new GameMap(JSON.parse(fs.readFileSync(mapFile, 'utf8')));

const lanAddresses = () => Object.values(os.networkInterfaces()).flat()
  .filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => `http://${a.address}:${PORT}`);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/info.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ urls: lanAddresses(), port: PORT }));
  }
  if (url.pathname === '/qr.svg') {
    const target = lanAddresses()[0] || `http://localhost:${PORT}`;
    const svg = await QRCode.toString(target, { type: 'svg', margin: 1, color: { dark: '#0e1a2b', light: '#ffffff' } });
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
    return res.end(svg);
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const base = rel.startsWith('/shared/') ? root : path.join(root, 'public');
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const cache = rel.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': cache });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const rooms = new RoomManager(map, { info: () => ({ urls: lanAddresses() }) });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    rooms.message(ws, msg);
  });
  ws.on('close', () => rooms.dropped(ws));
});

// Fixed 60 Hz simulation, 30 Hz snapshots, for every room.
let last = performance.now(), acc = 0, ticks = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= PHYS.TICK) {
    acc -= PHYS.TICK;
    try {
      rooms.update(PHYS.TICK);
      if (++ticks % 2 === 0) rooms.snapshot();
    } catch (err) {
      // keep the LAN session alive; one bad tick should not end everyone's match
      console.error('tick failed:', err);
    }
  }
}, 4);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Catacombs LAN server on port ${PORT}`);
  console.log(`  this machine: http://localhost:${PORT}`);
  for (const u of lanAddresses()) console.log(`  on your LAN:  ${u}`);
});
