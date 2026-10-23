import type {
  Flag, GameEvent, GasCloud, GameMode, GrenadeKind, Input, MatchConfig, Player, Projectile, World, WeaponState,
} from '../game/types';

export const PROTOCOL_VERSION = 1;
export const TICK_HZ = 60;
export const SNAP_HZ = 20;
export const MAX_PLAYERS = 10;

// ---------- client -> server ----------
export type ClientMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'create'; mode: GameMode; bots: number; minutes: number }
  | { t: 'join'; code: string }
  | { t: 'start' }
  | { t: 'input'; seq: number; i: Input }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'ping'; c: number };

// ---------- server -> client ----------
export interface LobbyPlayer { id: number; name: string; team: number; host: boolean }

export type ServerMsg =
  | { t: 'welcome'; v: number; clientId: number }
  | { t: 'error'; msg: string }
  | { t: 'room'; code: string; state: 'lobby' | 'playing'; mode: GameMode; bots: number; minutes: number; host: number; players: LobbyPlayer[] }
  | { t: 'start'; config: MatchConfig; you: number }
  | { t: 'snap'; s: Snapshot }
  | { t: 'left' }
  | { t: 'pong'; c: number; s: number };

export interface PlayerSnap {
  id: number; n: string; tm: number; b: boolean;
  x: number; y: number; vx: number; vy: number; f: 1 | -1; a: number;
  hp: number; fu: number; bo: number; em: number; bu: number; pr: number;
  al: boolean; rs: number; og: boolean; th: boolean; rp: number;
  sl: (WeaponState | null)[]; ac: 0 | 1; gr: [number, number, number]; gs: GrenadeKind;
  rl: number; k: number; d: number; cr: number;
}

export interface ProjSnap { id: number; k: Projectile['kind']; w: string; x: number; y: number; vx: number; vy: number; fu: number; st: boolean; ar: number; lf: number }

export interface Snapshot {
  time: number; // sim seconds
  tick: number;
  acks: Record<number, number>; // last input seq consumed, per player id
  players: PlayerSnap[];
  projectiles: ProjSnap[];
  gas: GasCloud[];
  pickups: { id: string; x: number; y: number; item: string | null }[];
  flags: Flag[];
  teamScore: Record<number, number>;
  over: boolean;
  winner: string;
  events: GameEvent[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function snapPlayer(p: Player): PlayerSnap {
  return {
    id: p.id, n: p.name, tm: p.team, b: p.bot,
    x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), f: p.facing, a: r2(p.aim),
    hp: r2(p.hp), fu: r2(p.fuel), bo: r2(p.boostT), em: r2(p.empT), bu: r2(p.burnT), pr: r2(p.protectT),
    al: p.alive, rs: r2(p.respawnT), og: p.onGround, th: p.thrusting, rp: r2(p.runPhase),
    sl: p.slots.map((s) => (s ? { ...s } : null)), ac: p.active,
    gr: [p.grenades.fragnade, p.grenades.gasnade, p.grenades.proxynade], gs: p.gSel,
    rl: r2(p.reloadT), k: p.kills, d: p.deaths, cr: p.carrying,
  };
}

export function toSnapshot(w: World, tick: number, acks: Record<number, number>, events: GameEvent[]): Snapshot {
  return {
    time: w.time, tick, acks,
    players: w.players.map(snapPlayer),
    projectiles: w.projectiles.map((p) => ({ id: p.id, k: p.kind, w: p.weapon, x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), fu: r2(p.fuse), st: p.stuck, ar: r2(p.armT), lf: r2(p.life) })),
    gas: w.gas.map((g) => ({ ...g, x: r2(g.x), y: r2(g.y), t: r2(g.t) })),
    pickups: w.pickups.map((s) => ({ id: s.id, x: s.x, y: s.y, item: s.item })),
    flags: w.flags.map((f) => ({ ...f, x: r2(f.x), y: r2(f.y) })),
    teamScore: { ...w.teamScore },
    over: w.over, winner: w.winner, events,
  };
}

/** Defensive parse of an untrusted client input. Returns null when malformed. */
export function sanitizeInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const b = (k: string) => o[k] === true;
  if (typeof o.aim !== 'number' || !Number.isFinite(o.aim)) return null;
  return {
    left: b('left'), right: b('right'), jet: b('jet'), fire: b('fire'), aim: Math.max(-10, Math.min(10, o.aim)),
    reload: b('reload'), swap: b('swap'), grenade: b('grenade'), pickup: b('pickup'), melee: b('melee'),
  };
}
