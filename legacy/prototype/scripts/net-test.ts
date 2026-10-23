// End-to-end test against a running server: `npm run server`, then
//   npx esbuild scripts/net-test.ts --bundle --platform=node --format=esm --outfile=<tmp>.mjs && node <tmp>.mjs
import WebSocket from 'ws';
import { NetSession } from '../src/net/client';
import { PROTOCOL_VERSION, type ServerMsg } from '../src/net/protocol';
import { emptyInput } from '../src/game/types';

const URL = process.env.URL ?? 'ws://127.0.0.1:8787';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Bot {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  clientId = 0;
  you = -1;
  room: Extract<ServerMsg, { t: 'room' }> | null = null;
  snaps = 0;
  session: NetSession | null = null;
  maxErr = 0;
  errs: number[] = [];
  errors: string[] = [];

  constructor(public name: string) {
    this.ws = new WebSocket(URL);
    this.ws.on('message', (d) => this.on(JSON.parse(d.toString())));
  }

  private on(m: ServerMsg) {
    this.msgs.push(m);
    if (m.t === 'welcome') this.clientId = m.clientId;
    if (m.t === 'room') this.room = m;
    if (m.t === 'error') this.errors.push(m.msg);
    if (m.t === 'start') {
      this.you = m.you;
      this.session = new NetSession(m.config, m.you, (x) => this.send(x));
    }
    if (m.t === 'snap') {
      this.snaps++;
      const smooth = () => (this.session as unknown as { smooth: { x: number; y: number } } | null)?.smooth;
      const before = smooth() ? { ...smooth()! } : { x: 0, y: 0 };
      this.session?.pushSnapshot(m.s);
      const after = smooth();
      // the correction this snapshot introduced = how wrong the prediction was
      if (after && this.snaps > 3) {
        const e = Math.hypot(after.x - before.x, after.y - before.y);
        this.maxErr = Math.max(this.maxErr, e); this.errs.push(e);
      }
    }
  }

  open() { return new Promise<void>((res) => (this.ws.readyState === 1 ? res() : this.ws.once('open', () => res()))); }
  send(m: unknown) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  async hello() { await this.open(); this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name }); await sleep(100); }
  lastSnap() { return [...this.msgs].reverse().find((m) => m.t === 'snap') as Extract<ServerMsg, { t: 'snap' }> | undefined; }
}

const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) process.exitCode = 1; };

const A = new Bot('Alice'), B = new Bot('Bob');
await A.hello(); await B.hello();
check('welcome received', A.clientId > 0 && B.clientId > 0 && A.clientId !== B.clientId);

const BOTS = Number(process.env.BOTS ?? 2);
const NOFIRE = process.env.NOFIRE === '1';
A.send({ t: 'create', mode: 'tdm', bots: BOTS, minutes: 2 });
await sleep(150);
check('room created with 4-letter code', !!A.room && /^[A-Z]{4}$/.test(A.room.code), A.room?.code);

B.send({ t: 'join', code: 'ZZZZ' }); await sleep(100);
check('join unknown code is rejected', B.errors.length === 1);
B.send({ t: 'join', code: A.room!.code.toLowerCase() }); await sleep(150);
check('join by (lowercase) code', B.room?.players.length === 2 && A.room?.players.length === 2);

B.send({ t: 'start' }); await sleep(100);
check('non-host cannot start', B.session === null);
A.send({ t: 'start' }); await sleep(300);
check('both receive start with distinct player ids', !!A.session && !!B.session && A.you !== B.you);

// drive A with the real prediction code, B idles; A also gets junk-injection
let ticks = 0;
const t0 = Date.now();
let last = performance.now(), acc = 0;
// accumulator like the browser game loop: exact 60 Hz on average despite coarse timers
const timer = setInterval(() => {
  const now = performance.now();
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { acc -= 1000 / 60; sendTick(); }
}, 4);
function sendTick() {
  if (!A.session) return;
  const i = emptyInput();
  const phase = Math.floor(ticks / 90) % 4;
  i.right = phase === 0 || phase === 1; i.left = phase === 3; i.jet = phase === 1 || phase === 2; i.aim = phase * 0.7; i.fire = !NOFIRE && ticks % 40 < 10;
  if (ticks % 200 === 50) i.reload = true;
  A.session.stepInput(i);
  ticks++;
}

await sleep(1000);
A.send({ t: 'input', seq: 'x', i: { aim: 'nan' } });
A.send({ t: 'input', seq: -5, i: null });
A.ws.send('{not json');
A.ws.send(JSON.stringify({ t: 'nonsense' }));
await sleep(5000);
clearInterval(timer);

const secs = (Date.now() - t0) / 1000;
const snapRate = A.snaps / secs;
check('snapshots arrive at ~20 Hz', snapRate > 15 && snapRate < 25, `${snapRate.toFixed(1)} Hz`);
const snap = A.lastSnap()!.s;
check(`snapshot has 2 humans + ${BOTS} bots`, snap.players.length === 2 + BOTS && snap.players.filter((p) => p.b).length === BOTS);
check('server acks A inputs', (snap.acks[A.you] ?? 0) > 200, `ack ${snap.acks[A.you]} of ${ticks}`);
const me = snap.players.find((p) => p.id === A.you)!;
check('A moved under authority of the server', Math.abs(me.x) > 0 && (me.vx !== 0 || me.vy !== 0 || me.fu < 1));
const sorted = [...A.errs].sort((x, y) => x - y);
const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0, p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
const big = sorted.filter((e) => e > 6).length;
const stats = `p50 ${p50.toFixed(2)}px p95 ${p95.toFixed(2)}px max ${A.maxErr.toFixed(1)}px, ${big}/${sorted.length} snapshots > 6px`;
if (NOFIRE && BOTS === 0) check('movement prediction is deterministic (no external forces)', p95 < 1, stats);
else check('prediction mostly agrees with server (rest = recoil/knockback/hits)', p95 < 12, stats);
check('server survived junk input', A.ws.readyState === 1);
check('teams assigned (tdm)', snap.players.every((p) => p.tm === 1 || p.tm === 2));

// view construction
const view = A.session!.buildView(performance.now(), 1 / 60);
check('interpolated view built', !!view && A.session!.view.players.length === 2 + BOTS, `local=${view?.name}`);

// join mid-match, displacing a bot only when full
const C = new Bot('Carol');
await C.hello(); C.send({ t: 'join', code: A.room!.code }); await sleep(400);
check('late joiner receives start', !!C.session && C.you > 0);
check('late joiner appears in snapshots', !!C.lastSnap()?.s.players.find((p) => p.id === C.you));

// disconnect handling
B.ws.close(); await sleep(400);
check('room updates when a player leaves', A.room?.players.length === 2);
check('leaver removed from world', !A.lastSnap()!.s.players.some((p) => p.id === B.you));
A.send({ t: 'leave' }); await sleep(200);
C.send({ t: 'leave' }); await sleep(200);
const health = await fetch(URL.replace('ws', 'http').replace(/\/$/, '') + '/health').then((r) => r.json());
check('empty room is destroyed', health.rooms === 0, JSON.stringify(health));

for (const b of [A, B, C]) b.ws.close();
process.exit(process.exitCode ?? 0);
