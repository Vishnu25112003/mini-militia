// Authoritative multiplayer server: rooms, lobby, 60 Hz simulation, 20 Hz snapshots.
// Run with `npm run server`. After `npm run build` it also serves the client from ./dist.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { botThink, newBotState } from '../src/game/ai';
import { DT, addPlayer, createWorld, removePlayer, stepWorld } from '../src/game/sim';
import type { GameEvent, GameMode, Input, MatchConfig, Player, World } from '../src/game/types';
import { emptyInput } from '../src/game/types';
import {
  MAX_PLAYERS, PROTOCOL_VERSION, SNAP_HZ, TICK_HZ, sanitizeInput, toSnapshot,
  type ClientMsg, type LobbyPlayer, type ServerMsg,
} from '../src/net/protocol';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const SCORE_LIMIT: Record<GameMode, number> = { dm: 20, tdm: 30, ctf: 5 };
const MODES = new Set<GameMode>(['dm', 'tdm', 'ctf']);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
const BOT_NAMES = ['Rook', 'Vex', 'Mako', 'Juno', 'Tank', 'Pixel', 'Ghost', 'Blitz', 'Nova', 'Fang', 'Echo', 'Zed'];

interface Client {
  id: number;
  ws: WebSocket;
  name: string;
  hello: boolean;
  room: Room | null;
  alive: boolean;
  tokens: number;
  tokenAt: number;
}

// `starved` is the jitter-buffer state: after the queue runs dry we wait for a one-input cushion
// before consuming again, so a late packet doesn't make the server simulate ticks the client never sent.
interface InputQueue { q: { seq: number; input: Input }[]; last: Input; ack: number; starved: boolean }

class Room {
  state: 'lobby' | 'playing' = 'lobby';
  clients = new Map<number, Client>();
  hostId: number;
  world: World | null = null;
  tick = 0;
  acc = 0;
  lastAt = performance.now();
  playerOf = new Map<number, number>(); // clientId -> playerId
  inputs = new Map<number, InputQueue>(); // playerId -> queue
  pending: GameEvent[] = [];

  constructor(public code: string, host: Client, public mode: GameMode, public bots: number, public minutes: number) {
    this.hostId = host.id;
    this.add(host);
  }

  add(c: Client) { this.clients.set(c.id, c); c.room = this; }

  humans(): number { return this.clients.size; }

  lobbyPlayers(): LobbyPlayer[] {
    return [...this.clients.values()].map((c) => {
      const pid = this.playerOf.get(c.id);
      const p = pid !== undefined ? this.world?.players.find((q) => q.id === pid) : undefined;
      return { id: c.id, name: c.name, team: p?.team ?? 0, host: c.id === this.hostId };
    });
  }

  broadcastRoom() {
    this.send({ t: 'room', code: this.code, state: this.state, mode: this.mode, bots: this.bots, minutes: this.minutes, host: this.hostId, players: this.lobbyPlayers() });
  }

  send(msg: ServerMsg) {
    const data = JSON.stringify(msg);
    for (const c of this.clients.values()) if (c.ws.readyState === c.ws.OPEN) c.ws.send(data);
  }

  private pickTeam(w: World): number {
    const blue = w.players.filter((p) => p.team === 1).length;
    const orange = w.players.filter((p) => p.team === 2).length;
    return blue <= orange ? 1 : 2;
  }

  private spawnHuman(c: Client): Player {
    const w = this.world!;
    const p = addPlayer(w, c.name, this.pickTeam(w), false);
    this.playerOf.set(c.id, p.id);
    this.inputs.set(p.id, { q: [], last: emptyInput(), ack: 0, starved: true });
    return p;
  }

  private config(): MatchConfig {
    return { mode: this.mode, bots: this.bots, scoreLimit: SCORE_LIMIT[this.mode], timeLimit: this.minutes * 60, playerName: '', seed: (Math.random() * 2 ** 30) | 0 };
  }

  start() {
    this.world = createWorld(this.config());
    this.playerOf.clear(); this.inputs.clear(); this.pending = []; this.tick = 0; this.acc = 0;
    this.lastAt = performance.now();
    for (const c of this.clients.values()) this.spawnHuman(c);
    const nBots = Math.max(0, Math.min(this.bots, MAX_PLAYERS - this.clients.size));
    for (let i = 0; i < nBots; i++) {
      const bot = addPlayer(this.world, BOT_NAMES[i % BOT_NAMES.length], this.pickTeam(this.world), true);
      bot.ai = newBotState(0.4 + Math.random() * 0.45);
    }
    this.state = 'playing';
    for (const c of this.clients.values()) this.sendStart(c);
    this.broadcastRoom();
  }

  sendStart(c: Client) {
    const pid = this.playerOf.get(c.id);
    if (pid === undefined || !this.world || c.ws.readyState !== c.ws.OPEN) return;
    c.ws.send(JSON.stringify({ t: 'start', config: this.world.config, you: pid } satisfies ServerMsg));
  }

  /** Join a match in progress; a bot gives up its seat when the room is full. */
  joinLive(c: Client) {
    const w = this.world!;
    if (w.players.length >= MAX_PLAYERS) {
      const bot = [...w.players].reverse().find((p) => p.bot);
      if (bot) removePlayer(w, bot.id);
    }
    this.spawnHuman(c);
    this.sendStart(c);
  }

  remove(c: Client) {
    this.clients.delete(c.id);
    c.room = null;
    const pid = this.playerOf.get(c.id);
    if (pid !== undefined && this.world) removePlayer(this.world, pid);
    this.playerOf.delete(c.id);
    if (pid !== undefined) this.inputs.delete(pid);
    if (this.hostId === c.id) { const next = this.clients.keys().next(); if (!next.done) this.hostId = next.value; }
  }

  step() {
    const w = this.world!;
    const acks: Record<number, number> = {};
    for (const p of w.players) {
      if (p.bot) { botThink(w, p, DT); continue; }
      const iq = this.inputs.get(p.id);
      if (!iq) continue;
      // keep the queue short so latency spikes don't turn into input lag
      while (iq.q.length > 6) iq.ack = iq.q.shift()!.seq;
      if (iq.starved && iq.q.length >= 2) iq.starved = false;
      const next = iq.starved ? undefined : iq.q.shift();
      if (next) { iq.last = next.input; iq.ack = next.seq; p.input = next.input; }
      else {
        iq.starved = true;
        p.input = { ...iq.last, reload: false, swap: false, grenade: false, pickup: false, melee: false };
      }
    }
    stepWorld(w, DT);
    for (const iq of this.inputs.entries()) acks[iq[0]] = iq[1].ack;
    this.pending.push(...w.events);
    w.events.length = 0;
    this.tick++;
    if (this.tick % (TICK_HZ / SNAP_HZ) === 0) {
      this.send({ t: 'snap', s: toSnapshot(w, this.tick, acks, this.pending) });
      this.pending = [];
    }
  }

  update(now: number) {
    if (this.state !== 'playing' || !this.world) return;
    this.acc = Math.min(0.25, this.acc + (now - this.lastAt) / 1000);
    this.lastAt = now;
    while (this.acc >= DT) { this.step(); this.acc -= DT; }
  }
}

// ---------- server state ----------
const rooms = new Map<string, Room>();
const allClients = new Set<Client>();
let nextClientId = 1;

function newCode(): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

const clean = (s: unknown) => String(s ?? '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14);
const toClient = (c: Client, msg: ServerMsg) => { if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg)); };

function leave(c: Client) {
  const room = c.room;
  if (!room) return;
  room.remove(c);
  if (room.humans() === 0) { rooms.delete(room.code); console.log(`room ${room.code} closed`); }
  else room.broadcastRoom();
}

function handle(c: Client, m: ClientMsg) {
  if (m.t === 'ping') { toClient(c, { t: 'pong', c: Number(m.c) || 0, s: Date.now() }); return; }
  if (m.t === 'hello') {
    if (m.v !== PROTOCOL_VERSION) { toClient(c, { t: 'error', msg: 'Client and server versions differ. Refresh the page.' }); return; }
    c.name = clean(m.name) || `Player${c.id}`;
    c.hello = true;
    toClient(c, { t: 'welcome', v: PROTOCOL_VERSION, clientId: c.id });
    return;
  }
  if (!c.hello) return;

  switch (m.t) {
    case 'create': {
      if (c.room) leave(c);
      const mode = MODES.has(m.mode) ? m.mode : 'dm';
      const room = new Room(newCode(), c, mode, Math.max(0, Math.min(MAX_PLAYERS - 1, Math.floor(Number(m.bots) || 0))), Math.max(2, Math.min(15, Math.floor(Number(m.minutes) || 5))));
      rooms.set(room.code, room);
      console.log(`room ${room.code} created by ${c.name}`);
      room.broadcastRoom();
      break;
    }
    case 'join': {
      const room = rooms.get(String(m.code ?? '').toUpperCase().trim());
      if (!room) { toClient(c, { t: 'error', msg: 'No room with that code.' }); return; }
      if (room.humans() >= MAX_PLAYERS) { toClient(c, { t: 'error', msg: 'Room is full.' }); return; }
      if (c.room === room) return;
      if (c.room) leave(c);
      room.add(c);
      if (room.state === 'playing' && room.world && !room.world.over) room.joinLive(c);
      room.broadcastRoom();
      break;
    }
    case 'start': {
      const room = c.room;
      if (room && room.hostId === c.id && room.state === 'lobby') room.start();
      break;
    }
    case 'rematch': {
      const room = c.room;
      if (room && room.state === 'playing' && room.world?.over) room.start();
      break;
    }
    case 'input': {
      const room = c.room;
      if (!room?.world) return;
      const pid = room.playerOf.get(c.id);
      const iq = pid !== undefined ? room.inputs.get(pid) : undefined;
      const input = sanitizeInput(m.i);
      const seq = Number(m.seq);
      if (!iq || !input || !Number.isInteger(seq) || seq <= iq.ack) return;
      iq.q.push({ seq, input });
      if (iq.q.length > 30) iq.q.splice(0, iq.q.length - 30);
      break;
    }
    case 'leave':
      leave(c);
      toClient(c, { t: 'left' });
      break;
  }
}

// ---------- http (static client) + websocket ----------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Catacombs Militia game server is running. Run `npm run build` to serve the client from here, or use `npm run dev` for the client.');
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(DIST, '.' + rel);
  if (!file.startsWith(DIST + path.sep) && file !== DIST) { res.writeHead(403); res.end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(target)] ?? 'application/octet-stream', 'cache-control': target.includes('assets') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(target).pipe(res);
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', (ws) => {
  const c: Client = { id: nextClientId++, ws, name: '', hello: false, room: null, alive: true, tokens: 300, tokenAt: Date.now() };
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    c.tokens = Math.min(300, c.tokens + ((now - c.tokenAt) / 1000) * 200);
    c.tokenAt = now;
    if (--c.tokens < 0) { ws.close(1008, 'rate limit'); return; }
    let msg: ClientMsg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    try { handle(c, msg); } catch (e) { console.error('handler error', e); }
  });
  allClients.add(c);
  const gone = () => { allClients.delete(c); leave(c); };
  ws.on('close', gone);
  ws.on('error', gone);
});

setInterval(() => {
  const now = performance.now();
  for (const room of rooms.values()) room.update(now);
}, 8);

// drop connections that stopped answering pings
setInterval(() => {
  for (const c of allClients) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    c.ws.ping();
  }
}, 20_000).unref();

server.listen(PORT, HOST, () => {
  console.log(`Catacombs Militia server on http://${HOST}:${PORT}  (client ${fs.existsSync(DIST) ? 'served from dist/' : 'not built'})`);
});
