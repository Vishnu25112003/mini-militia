import { DT, applyMovement, createWorld } from '../game/sim';
import type { GameEvent, GameMode, Input, MatchConfig, Player, Projectile, World } from '../game/types';
import { emptyInput } from '../game/types';
import {
  PROTOCOL_VERSION, type ClientMsg, type LobbyPlayer, type PlayerSnap, type ServerMsg, type Snapshot,
} from './protocol';

const INTERP_DELAY = 0.1; // seconds remote entities are rendered behind the newest snapshot

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export interface RoomInfo {
  code: string;
  state: 'lobby' | 'playing';
  mode: GameMode;
  bots: number;
  minutes: number;
  host: number;
  players: LobbyPlayer[];
}

export function serverUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL;
  if (env) return env;
  const { protocol, hostname, host, port } = window.location;
  const secure = protocol === 'https:';
  // `npm run dev` serves the client on 5173 and the game server runs separately on 8787
  if (port === '5173' || port === '4173') return `${secure ? 'wss' : 'ws'}://${hostname}:8787`;
  return `${secure ? 'wss' : 'ws'}://${host}`;
}

function blankPlayer(id: number): Player {
  return {
    id, name: '', team: 0, bot: false, x: 0, y: 0, vx: 0, vy: 0, facing: 1, aim: 0, hp: 100, fuel: 1, boostT: 0, empT: 0,
    burnT: 0, burnBy: -1, protectT: 0, alive: false, respawnT: 0, onGround: false, thrusting: false, runPhase: 0,
    slots: [{ id: 'uzi', mag: 0, reserve: 0 }, null], active: 0, grenades: { fragnade: 0, gasnade: 0, proxynade: 0 }, gSel: 'fragnade',
    fireCd: 0, reloadT: 0, meleeCd: 0, kills: 0, deaths: 0, carrying: 0, lastHitBy: -1, input: emptyInput(), prev: emptyInput(),
  };
}

function fromSnap(p: Player, s: PlayerSnap) {
  p.name = s.n; p.team = s.tm; p.bot = s.b;
  p.x = s.x; p.y = s.y; p.vx = s.vx; p.vy = s.vy; p.facing = s.f; p.aim = s.a;
  p.hp = s.hp; p.fuel = s.fu; p.boostT = s.bo; p.empT = s.em; p.burnT = s.bu; p.protectT = s.pr;
  p.alive = s.al; p.respawnT = s.rs; p.onGround = s.og; p.thrusting = s.th; p.runPhase = s.rp;
  p.slots = [s.sl[0] ? { ...s.sl[0] } : p.slots[0], s.sl[1] ? { ...s.sl[1] } : null] as Player['slots'];
  p.active = s.ac;
  p.grenades = { fragnade: s.gr[0], gasnade: s.gr[1], proxynade: s.gr[2] };
  p.gSel = s.gs; p.reloadT = s.rl; p.kills = s.k; p.deaths = s.d; p.carrying = s.cr;
}

/** One online match: input sequencing, prediction of the local soldier, interpolation of everything else. */
let sessionCounter = 0;

export class NetSession {
  readonly uid = ++sessionCounter;
  readonly view: World;
  readonly config: MatchConfig;
  private scratch: World;
  private seq = 0;
  private pending: { seq: number; input: Input }[] = [];
  private snaps: { s: Snapshot; at: number }[] = [];
  private offset: number | null = null; // client ms - server ms
  private events: { time: number; e: GameEvent }[] = [];
  private predicted: Player | null = null;
  private smooth = { x: 0, y: 0 };
  private byId = new Map<number, Player>();

  constructor(config: MatchConfig, readonly you: number, private send: (m: ClientMsg) => void) {
    this.config = config;
    this.view = createWorld(config);
    this.view.pickups = []; this.view.flags = []; this.view.players = [];
    this.scratch = createWorld(config);
  }

  get ready() { return this.snaps.length > 0; }

  pushSnapshot(s: Snapshot) {
    const now = performance.now();
    const sample = now - s.time * 1000;
    this.offset = this.offset === null ? sample : this.offset + (sample - this.offset) * 0.1;
    this.snaps.push({ s, at: now });
    if (this.snaps.length > 40) this.snaps.shift();
    for (const e of s.events) this.events.push({ time: s.time, e });

    const me = s.players.find((p) => p.id === this.you);
    if (!me) return;
    const ack = s.acks[this.you] ?? 0;
    this.pending = this.pending.filter((p) => p.seq > ack);

    const before = this.predicted ? { x: this.predicted.x, y: this.predicted.y } : null;
    const pred = blankPlayer(this.you);
    fromSnap(pred, me);
    if (pred.alive) {
      // re-apply inputs the server has not processed yet on top of its authoritative state
      for (const p of this.pending) applyMovement(this.scratch, pred, p.input, DT);
      pred.alive = true; pred.hp = me.hp;
      this.scratch.events.length = 0;
    }
    this.predicted = pred;
    if (before && pred.alive) {
      const dx = before.x - pred.x, dy = before.y - pred.y;
      if (Math.hypot(dx, dy) < 80) { this.smooth.x += dx; this.smooth.y += dy; } else this.smooth = { x: 0, y: 0 };
    } else this.smooth = { x: 0, y: 0 };
  }

  /** Called once per fixed client tick: sends the input and predicts its movement locally. */
  stepInput(input: Input) {
    const seq = ++this.seq;
    const copy = { ...input };
    this.pending.push({ seq, input: copy });
    if (this.pending.length > 120) this.pending.shift();
    if (this.predicted?.alive) {
      applyMovement(this.scratch, this.predicted, copy, DT);
      this.scratch.events.length = 0;
    }
    this.send({ t: 'input', seq, i: copy });
  }

  /** Predicted local soldier (position used for aiming). */
  get localPos(): { x: number; y: number } | null {
    return this.predicted ? { x: this.predicted.x + this.smooth.x, y: this.predicted.y + this.smooth.y } : null;
  }

  buildView(nowMs: number, dt: number): Player | undefined {
    const v = this.view;
    if (!this.snaps.length || this.offset === null) return undefined;
    const renderT = (nowMs - this.offset) / 1000 - INTERP_DELAY;

    let ia = 0;
    for (let i = 0; i < this.snaps.length; i++) if (this.snaps[i].s.time <= renderT) ia = i;
    const a = this.snaps[ia].s;
    const b = this.snaps[Math.min(ia + 1, this.snaps.length - 1)].s;
    const t = b.time > a.time ? Math.max(0, Math.min(1, (renderT - a.time) / (b.time - a.time))) : 1;
    const latest = this.snaps[this.snaps.length - 1].s;

    // players (objects are reused so the renderer sees stable identities)
    const seen = new Set<number>();
    for (const sb of b.players) {
      seen.add(sb.id);
      let p = this.byId.get(sb.id);
      if (!p) { p = blankPlayer(sb.id); this.byId.set(sb.id, p); }
      const sa = a.players.find((q) => q.id === sb.id);
      fromSnap(p, sb);
      if (sa && sa.al && sb.al && Math.hypot(sb.x - sa.x, sb.y - sa.y) < 250) {
        p.x = lerp(sa.x, sb.x, t); p.y = lerp(sa.y, sb.y, t);
        p.aim = lerpAngle(sa.a, sb.a, t);
        p.runPhase = lerp(sa.rp, sb.rp, t);
      }
      // HUD-facing state comes from the newest snapshot, not the delayed one
      const sl = latest.players.find((q) => q.id === sb.id);
      if (sl && sb.id === this.you) {
        p.hp = sl.hp; p.alive = sl.al; p.respawnT = sl.rs; p.kills = sl.k; p.deaths = sl.d;
        p.slots = [sl.sl[0] ? { ...sl.sl[0] } : p.slots[0], sl.sl[1] ? { ...sl.sl[1] } : null] as Player['slots'];
        p.active = sl.ac; p.reloadT = sl.rl; p.grenades = { fragnade: sl.gr[0], gasnade: sl.gr[1], proxynade: sl.gr[2] };
        p.gSel = sl.gs; p.boostT = sl.bo; p.empT = sl.em; p.protectT = sl.pr; p.carrying = sl.cr; p.burnT = sl.bu;
      }
      if (sb.id === this.you && this.predicted && this.predicted.alive && p.alive) {
        const k = Math.exp(-dt * 12);
        this.smooth.x *= k; this.smooth.y *= k;
        const q = this.predicted;
        p.x = q.x + this.smooth.x; p.y = q.y + this.smooth.y; p.vx = q.vx; p.vy = q.vy;
        p.facing = q.facing; p.aim = q.aim; p.fuel = q.fuel; p.onGround = q.onGround; p.thrusting = q.thrusting; p.runPhase = q.runPhase;
      }
    }
    for (const id of [...this.byId.keys()]) if (!seen.has(id)) this.byId.delete(id);
    v.players = b.players.map((s) => this.byId.get(s.id)!);

    // projectiles
    const pa = new Map(a.projectiles.map((p) => [p.id, p]));
    v.projectiles = b.projectiles.map((p) => {
      const o = pa.get(p.id);
      return {
        id: p.id, kind: p.k, weapon: p.w, x: o ? lerp(o.x, p.x, t) : p.x, y: o ? lerp(o.y, p.y, t) : p.y, vx: p.vx, vy: p.vy,
        owner: 0, team: 0, damage: 0, life: p.lf, fuse: p.fu, stuck: p.st, armT: p.ar,
      } satisfies Projectile;
    });

    v.gas = b.gas;
    v.flags = b.flags;
    v.pickups = b.pickups.map((s) => ({ id: s.id, x: s.x, y: s.y, pool: [], item: s.item as World['pickups'][number]['item'], respawnT: 0 }));
    v.teamScore = latest.teamScore;
    v.time = latest.time;
    v.over = latest.over; v.winner = latest.winner;

    // release events once the (delayed) render clock reaches them
    while (this.events.length && this.events[0].time <= renderT + 0.02) v.events.push(this.events.shift()!.e);
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);

    return this.byId.get(this.you);
  }
}

export class NetClient {
  status: 'idle' | 'connecting' | 'open' | 'closed' = 'idle';
  error: string | null = null;
  clientId = 0;
  rtt = 0;
  room: RoomInfo | null = null;
  session: NetSession | null = null;
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private pingTimer = 0;
  private version = 0;

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.version++; this.listeners.forEach((l) => l()); }
  get stamp() { return this.version; }

  connect(name: string): Promise<void> {
    this.close();
    this.status = 'connecting'; this.error = null; this.emit();
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try { ws = new WebSocket(serverUrl()); } catch (e) { this.fail('Could not reach the game server.'); reject(e); return; }
      this.ws = ws;
      ws.onopen = () => {
        this.send({ t: 'hello', v: PROTOCOL_VERSION, name });
        this.pingTimer = window.setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
      };
      ws.onmessage = (ev) => {
        let m: ServerMsg;
        try { m = JSON.parse(ev.data as string); } catch { return; }
        if (m.t === 'welcome') { this.clientId = m.clientId; this.status = 'open'; this.emit(); resolve(); }
        else this.onMessage(m);
      };
      ws.onerror = () => { if (this.status === 'connecting') { this.fail(`Could not connect to ${serverUrl()}. Is the server running?`); reject(new Error('connect')); } };
      ws.onclose = () => {
        window.clearInterval(this.pingTimer);
        if (this.status === 'connecting') return;
        this.status = 'closed'; this.session = null; this.room = null;
        this.error ??= 'Disconnected from server.';
        this.emit();
      };
    });
  }

  private fail(msg: string) { this.status = 'closed'; this.error = msg; this.emit(); }

  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'room': this.room = m; this.emit(); break;
      case 'start': this.session = new NetSession(m.config, m.you, (x) => this.send(x)); this.emit(); break;
      case 'snap': this.session?.pushSnapshot(m.s); break;
      case 'error': this.error = m.msg; this.emit(); break;
      case 'left': this.room = null; this.session = null; this.emit(); break;
      case 'pong': this.rtt = Math.round(performance.now() - m.c); break;
    }
  }

  send(m: ClientMsg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  clearError() { this.error = null; this.emit(); }
  create(mode: GameMode, bots: number, minutes: number) { this.error = null; this.send({ t: 'create', mode, bots, minutes }); }
  join(code: string) { this.error = null; this.send({ t: 'join', code: code.trim().toUpperCase() }); }
  start() { this.send({ t: 'start' }); }
  rematch() { this.send({ t: 'rematch' }); }
  leave() { this.session = null; this.send({ t: 'leave' }); this.emit(); }

  close() {
    window.clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); }
    this.session = null; this.room = null; this.status = 'idle';
  }
}
