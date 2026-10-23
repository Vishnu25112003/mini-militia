import { MAP } from './map';
import { GRENADES, WEAPONS } from './weapons';
import type {
  GrenadeKind, ItemId, MatchConfig, Input, Player, Projectile, WeaponId, World,
} from './types';
import { emptyInput } from './types';

export const DT = 1 / 60;

// Hitbox is sized by the Catacombs passages: connectivity analysis showed the narrowest tunnels are
// exactly 56px, and anything taller than that cannot reach 4 of the 10 spawns. A body of exactly 56px
// also wedges in them (float error puts the head 1px into the ceiling), so keep 4px of slack.
// Art is drawn at 68px and scaled by ART_SCALE to fit.
export const PLAYER_W = 22;
export const PLAYER_H = 52;
export const ART_SCALE = PLAYER_H / 68;
const GRAVITY = 1500;
const MAX_FALL = 950;
const RUN_SPEED = 300;
const GROUND_ACC = 2600;
const AIR_ACC = 1100;
const JET_ACC = 2900;
const JET_MAX_UP = 430;
const FUEL_DRAIN = 0.34;
const FUEL_REGEN_GROUND = 0.65;
const FUEL_REGEN_AIR = 0.08;
const STEP_H = 18;
const FALL_DMG_SPEED = 720;
const RESPAWN_TIME = 3;
const PROTECT_TIME = 2;
const PICKUP_RANGE = 44;
const MAX_HP = 100;

export const TEAM_BLUE = 1;
export const TEAM_ORANGE = 2;

// ---------- helpers ----------
export function rand(w: World): number {
  // mulberry32 so a seed reproduces a match (needed for lock-step / server replay)
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rng ^ (w.rng >>> 15), 1 | w.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const range = (w: World, a: number, b: number) => a + (b - a) * rand(w);
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

export function sameTeam(w: World, a: { team: number }, b: { team: number }): boolean {
  return w.config.mode !== 'dm' && a.team === b.team;
}

const collides = (x: number, y: number) => MAP.rectSolid(x - PLAYER_W / 2, y - PLAYER_H / 2, PLAYER_W, PLAYER_H);

// ---------- creation ----------
export function makePlayer(w: World, name: string, team: number, bot: boolean): Player {
  const p: Player = {
    id: w.nextId++, name, team, bot, x: 0, y: 0, vx: 0, vy: 0, facing: 1, aim: 0,
    hp: MAX_HP, fuel: 1, boostT: 0, empT: 0, burnT: 0, burnBy: -1, protectT: 0,
    alive: false, respawnT: 0, onGround: false, thrusting: false, runPhase: 0,
    slots: [loadout('uzi'), loadout('magnum')], active: 0,
    grenades: { fragnade: 2, gasnade: 0, proxynade: 0 }, gSel: 'fragnade',
    fireCd: 0, reloadT: 0, meleeCd: 0, kills: 0, deaths: 0, carrying: 0, lastHitBy: -1,
    input: emptyInput(), prev: emptyInput(),
  };
  return p;
}

function loadout(id: WeaponId, mags = WEAPONS[id].mags) {
  const d = WEAPONS[id];
  return { id, mag: d.mag, reserve: d.mag * Math.max(0, mags - 1) };
}

export function createWorld(config: MatchConfig): World {
  const w: World = {
    config, time: 0, rng: config.seed | 0, nextId: 1, players: [], projectiles: [], gas: [],
    pickups: MAP.pickups.map((p) => ({ id: p.id, x: p.x, y: p.y, pool: p.pool, item: null, respawnT: 0 })),
    flags: [], teamScore: { 1: 0, 2: 0 }, events: [], over: false, winner: '',
  };
  for (const p of w.pickups) p.item = p.pool[Math.floor(rand(w) * p.pool.length)];
  if (config.mode === 'ctf') {
    for (const f of MAP.flags) w.flags.push({ team: f.team, homeX: f.x, homeY: f.y, x: f.x, y: f.y, carrier: -1, dropT: 0 });
  }
  return w;
}

export function addPlayer(w: World, name: string, team: number, bot: boolean): Player {
  const p = makePlayer(w, name, w.config.mode === 'dm' ? 100 + w.nextId : team, bot);
  w.players.push(p);
  respawn(w, p);
  p.protectT = PROTECT_TIME;
  return p;
}

function pickSpawn(w: World, p: Player): { x: number; y: number } {
  if (w.config.mode === 'ctf') {
    const s = MAP.ctfSpawns.find((c) => c.team === p.team) ?? MAP.ctfSpawns[0];
    return { x: s.x + range(w, -40, 40), y: s.y };
  }
  const foes = w.players.filter((o) => o !== p && o.alive && !sameTeam(w, o, p));
  const scored = MAP.spawns.map((s) => {
    let d = 1e9;
    for (const f of foes) d = Math.min(d, Math.hypot(f.x - s.x, f.y - s.y));
    return { s, d };
  }).sort((a, b) => b.d - a.d);
  return scored[Math.floor(rand(w) * Math.min(3, scored.length))].s;
}

/** First position near (x,y) where the body fits: prefers straight down from the spawn marker, then sideways. */
function freeSpot(x: number, y: number): { x: number; y: number } {
  for (const dx of [0, -10, 10, -20, 20, -32, 32]) {
    for (let dy = -PLAYER_H / 2; dy <= 140; dy += 4) {
      if (!collides(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
  }
  return { x, y: y - PLAYER_H / 2 };
}

export function respawn(w: World, p: Player) {
  const s = pickSpawn(w, p);
  const spot = freeSpot(s.x, s.y);
  p.x = spot.x; p.y = spot.y; p.vx = 0; p.vy = 0;
  p.hp = MAX_HP; p.fuel = 1; p.boostT = 0; p.empT = 0; p.burnT = 0; p.alive = true; p.protectT = PROTECT_TIME;
  p.slots = [loadout('uzi'), loadout('magnum')]; p.active = 0;
  p.grenades = { fragnade: 2, gasnade: 0, proxynade: 0 }; p.gSel = 'fragnade';
  p.reloadT = 0; p.fireCd = 0; p.carrying = 0;
  w.events.push({ t: 'spawn', x: p.x, y: p.y });
}

export const activeWeapon = (p: Player) => p.slots[p.active] ?? p.slots[0];

// ---------- damage ----------
function hurt(w: World, victim: Player, amount: number, attacker: number, weapon: string) {
  if (!victim.alive || victim.protectT > 0 || w.over) return;
  const atk = w.players.find((q) => q.id === attacker);
  if (atk && atk !== victim && sameTeam(w, atk, victim)) return;
  victim.hp -= amount;
  victim.lastHitBy = attacker;
  w.events.push({ t: 'hit', x: victim.x, y: victim.y, victim: victim.id, dmg: amount });
  if (victim.hp <= 0) kill(w, victim, attacker, weapon);
}

function kill(w: World, victim: Player, attacker: number, weapon: string) {
  victim.alive = false;
  victim.respawnT = RESPAWN_TIME;
  victim.deaths++;
  victim.thrusting = false;
  const atk = w.players.find((q) => q.id === attacker);
  if (atk && atk !== victim) {
    atk.kills++;
    if (w.config.mode !== 'ctf') w.teamScore[atk.team] = (w.teamScore[atk.team] ?? 0) + 1;
  }
  if (victim.carrying) dropFlag(w, victim);
  w.events.push({ t: 'kill', killer: attacker, victim: victim.id, weapon, x: victim.x, y: victim.y });
}

function explode(w: World, x: number, y: number, radius: number, damage: number, owner: number, weapon: string) {
  w.events.push({ t: 'explosion', x, y, r: radius });
  for (const p of w.players) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > radius + PLAYER_W) continue;
    const f = Math.max(0.15, 1 - d / (radius + PLAYER_W));
    const nx = d > 1 ? (p.x - x) / d : 0, ny = d > 1 ? (p.y - y) / d : -1;
    p.vx += nx * 750 * f;
    p.vy += ny * 750 * f - 120 * f;
    p.onGround = false;
    if (damage > 0) hurt(w, p, damage * f * (p.id === owner ? 0.6 : 1), owner, weapon);
  }
}

// ---------- weapons ----------
function startReload(w: World, p: Player) {
  const ws = activeWeapon(p);
  const d = WEAPONS[ws.id];
  if (p.reloadT > 0 || ws.mag >= d.mag || ws.reserve <= 0 || d.kind === 'shield') return;
  p.reloadT = d.reload;
  w.events.push({ t: 'reload', x: p.x, y: p.y });
}

function finishReload(p: Player) {
  const ws = activeWeapon(p);
  const d = WEAPONS[ws.id];
  const take = Math.min(d.mag - ws.mag, ws.reserve);
  ws.mag += take;
  ws.reserve -= take;
}

// shoulder sits a little above the body centre; renderer draws the arm from the same point
export const SHOULDER_Y = -4 * ART_SCALE;

function muzzle(p: Player, len: number) {
  return { x: p.x + Math.cos(p.aim) * len * ART_SCALE, y: p.y + SHOULDER_Y + Math.sin(p.aim) * len * ART_SCALE };
}

function spawnProj(w: World, p: Player, kind: Projectile['kind'], weapon: string, angle: number, speed: number, damage: number, life: number, fuse = 0): Projectile {
  const m = muzzle(p, 34);
  const pr: Projectile = {
    id: w.nextId++, kind, weapon, x: m.x, y: m.y, vx: Math.cos(angle) * speed + (kind === 'bullet' ? 0 : p.vx * 0.4),
    vy: Math.sin(angle) * speed + (kind === 'bullet' ? 0 : p.vy * 0.4), owner: p.id, team: p.team, damage, life, fuse, stuck: false, armT: 0,
  };
  // never start a shot inside terrain (e.g. standing against a wall)
  if (MAP.isSolid(pr.x, pr.y)) { pr.x = p.x; pr.y = p.y + SHOULDER_Y; }
  w.projectiles.push(pr);
  return pr;
}

function fireWeapon(w: World, p: Player) {
  const ws = activeWeapon(p);
  const d = WEAPONS[ws.id];
  if (d.kind === 'shield') { melee(w, p, d.damage); p.fireCd = 1 / d.rate; return; }
  if (ws.mag <= 0) { startReload(w, p); return; }
  ws.mag--;
  p.fireCd = 1 / d.rate;
  const spreadRad = (d.spread * Math.PI) / 180;
  for (let i = 0; i < d.pellets; i++) {
    const a = p.aim + range(w, -spreadRad, spreadRad);
    const sp = d.speed * (d.kind === 'flame' ? range(w, 0.8, 1.1) : 1);
    if (d.kind === 'bullet') spawnProj(w, p, 'bullet', d.id, a, sp, d.damage, d.life);
    else if (d.kind === 'rocket') spawnProj(w, p, 'rocket', d.id, a, sp, d.damage, d.life);
    else if (d.kind === 'emp') spawnProj(w, p, 'emp', d.id, a, sp, d.damage, d.life);
    else if (d.kind === 'flame') spawnProj(w, p, 'flame', d.id, a, sp, d.damage, d.life);
  }
  p.vx -= Math.cos(p.aim) * d.recoil;
  p.vy -= Math.sin(p.aim) * d.recoil * 0.6;
  const m = muzzle(p, d.length + 14);
  w.events.push({ t: 'shot', x: m.x, y: m.y, weapon: d.id });
  if (ws.mag <= 0) startReload(w, p);
}

function melee(w: World, p: Player, dmg: number) {
  if (p.meleeCd > 0) return;
  p.meleeCd = 0.5;
  const reach = 42;
  const cx = p.x + p.facing * reach * 0.6;
  w.events.push({ t: 'melee', x: cx, y: p.y });
  for (const o of w.players) {
    if (o === p || !o.alive || sameTeam(w, o, p)) continue;
    if (Math.abs(o.x - cx) < reach && Math.abs(o.y - p.y) < PLAYER_H) {
      hurt(w, o, dmg, p.id, 'melee');
      o.vx += p.facing * 360;
    }
  }
}

function throwGrenade(w: World, p: Player) {
  const k = p.gSel;
  if (p.grenades[k] <= 0) {
    const other = (Object.keys(p.grenades) as GrenadeKind[]).find((g) => p.grenades[g] > 0);
    if (!other) return;
    p.gSel = other;
    return;
  }
  p.grenades[k]--;
  const g = GRENADES[k];
  spawnProj(w, p, k, k, p.aim, 640, g.damage, 0, g.fuse);
  const last = w.projectiles[w.projectiles.length - 1];
  last.vy -= 120;
  if (p.grenades[k] <= 0) {
    const other = (Object.keys(p.grenades) as GrenadeKind[]).find((q) => p.grenades[q] > 0);
    if (other) p.gSel = other;
  }
}

// ---------- pickups ----------
function tryPickup(w: World, p: Player, spotIdx: number): boolean {
  const spot = w.pickups[spotIdx];
  const item = spot.item;
  if (!item) return false;
  if (item === 'healthpack') {
    if (p.hp >= MAX_HP) return false;
    p.hp = Math.min(MAX_HP, p.hp + 60);
  } else if (item === 'boosttank') {
    p.fuel = 1; p.boostT = 10;
  } else if (item === 'fragnade' || item === 'gasnade' || item === 'proxynade') {
    p.grenades[item] = Math.min(6, p.grenades[item] + 2);
    p.gSel = item;
  } else {
    const have = p.slots.findIndex((s) => s?.id === item);
    if (have >= 0) {
      const s = p.slots[have]!;
      s.reserve += WEAPONS[item].mag * 2;
    } else if (!p.slots[1]) {
      p.slots[1] = loadout(item); p.active = 1;
    } else {
      p.slots[p.active] = loadout(item);
    }
    p.reloadT = 0;
  }
  spot.item = null;
  spot.respawnT = 14 + rand(w) * 10;
  w.events.push({ t: 'pickup', x: spot.x, y: spot.y, item: item as ItemId, by: p.id });
  return true;
}

export function nearestPickup(w: World, p: Player): number {
  let best = -1, bd = PICKUP_RANGE;
  w.pickups.forEach((s, i) => {
    if (!s.item) return;
    const d = Math.hypot(s.x - p.x, s.y - 14 - p.y);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// ---------- CTF ----------
function dropFlag(w: World, p: Player) {
  const f = w.flags.find((q) => q.carrier === p.id);
  p.carrying = 0;
  if (!f) return;
  f.carrier = -1; f.x = p.x; f.y = p.y; f.dropT = 20;
  w.events.push({ t: 'flag', kind: 'dropped', team: f.team, by: p.id });
}

function updateFlags(w: World, dt: number) {
  for (const f of w.flags) {
    const carrier = w.players.find((p) => p.id === f.carrier);
    if (carrier) { f.x = carrier.x; f.y = carrier.y - 8; continue; }
    const atHome = f.x === f.homeX && f.y === f.homeY;
    if (!atHome) {
      f.dropT -= dt;
      if (f.dropT <= 0) { f.x = f.homeX; f.y = f.homeY; w.events.push({ t: 'flag', kind: 'returned', team: f.team, by: -1 }); continue; }
    }
    for (const p of w.players) {
      if (!p.alive || Math.hypot(p.x - f.x, p.y - f.y) > 36) continue;
      if (p.team === f.team) {
        if (!atHome) { f.x = f.homeX; f.y = f.homeY; w.events.push({ t: 'flag', kind: 'returned', team: f.team, by: p.id }); }
        else if (p.carrying) {
          const enemy = w.flags.find((q) => q.team === p.carrying)!;
          enemy.carrier = -1; enemy.x = enemy.homeX; enemy.y = enemy.homeY;
          p.carrying = 0;
          w.teamScore[p.team] = (w.teamScore[p.team] ?? 0) + 1;
          w.events.push({ t: 'flag', kind: 'captured', team: enemy.team, by: p.id });
        }
      } else if (!p.carrying) {
        f.carrier = p.id; p.carrying = f.team;
        w.events.push({ t: 'flag', kind: 'taken', team: f.team, by: p.id });
        break;
      }
    }
  }
}

// ---------- player update ----------
function updatePlayer(w: World, p: Player, dt: number) {
  const inp: Input = p.input;
  const edge = (k: 'reload' | 'swap' | 'grenade' | 'pickup' | 'melee') => inp[k] && !p.prev[k];

  if (!p.alive) {
    p.respawnT -= dt;
    if (p.respawnT <= 0 && !w.over) respawn(w, p);
    p.prev = { ...inp };
    return;
  }

  p.protectT = Math.max(0, p.protectT - dt);
  p.empT = Math.max(0, p.empT - dt);
  p.boostT = Math.max(0, p.boostT - dt);
  p.meleeCd = Math.max(0, p.meleeCd - dt);
  if (p.burnT > 0) { p.burnT -= dt; hurt(w, p, 9 * dt, p.burnBy, 'flame'); }

  applyMovement(w, p, inp, dt);

  // weapons
  if (edge('swap') && p.slots[1]) { p.active = p.active === 0 ? 1 : 0; p.reloadT = 0; p.fireCd = 0.25; }
  if (edge('reload')) startReload(w, p);
  if (edge('grenade')) throwGrenade(w, p);
  if (edge('melee')) melee(w, p, 28);
  if (edge('pickup')) { const i = nearestPickup(w, p); if (i >= 0) tryPickup(w, p, i); }

  p.fireCd = Math.max(0, p.fireCd - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) { p.reloadT = 0; finishReload(p); }
  }
  const ws = activeWeapon(p);
  const def = WEAPONS[ws.id];
  const wantsFire = inp.fire && (def.auto || !p.prev.fire);
  if (wantsFire && p.fireCd <= 0 && p.reloadT <= 0 && p.empT <= 0) fireWeapon(w, p);

  // bots auto-collect nearby items
  if (p.bot) { const i = nearestPickup(w, p); if (i >= 0) tryPickup(w, p, i); }

  p.prev = { ...inp };
}

/**
 * Aim, run, jetpack, gravity and collision for one alive player. Exported so a client can
 * predict its own movement with exactly the code the server runs (client-side prediction).
 */
export function applyMovement(w: World, p: Player, inp: Input, dt: number) {
  p.aim = inp.aim;
  p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;

  // horizontal
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const shielded = activeWeapon(p).id === 'riot';
  p.vx = approach(p.vx, dir * RUN_SPEED * (shielded ? 0.8 : 1), (p.onGround ? GROUND_ACC : AIR_ACC) * dt);
  if (p.onGround && dir) p.runPhase += Math.abs(p.vx) * dt * 0.06;

  // jetpack
  p.thrusting = false;
  if (inp.jet && p.fuel > 0 && p.empT <= 0) {
    p.vy -= JET_ACC * (p.boostT > 0 ? 1.25 : 1) * dt;
    p.vy = Math.max(p.vy, -JET_MAX_UP * (p.boostT > 0 ? 1.2 : 1));
    p.fuel = Math.max(0, p.fuel - FUEL_DRAIN * dt);
    p.thrusting = true;
    p.onGround = false;
  } else {
    p.fuel = Math.min(1, p.fuel + (p.onGround ? FUEL_REGEN_GROUND : FUEL_REGEN_AIR) * dt);
  }
  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

  moveBody(w, p, dt);
}

/** Remove a disconnected player, dropping any flag they carry. */
export function removePlayer(w: World, id: number) {
  const p = w.players.find((q) => q.id === id);
  if (!p) return;
  if (p.carrying) dropFlag(w, p);
  w.players = w.players.filter((q) => q.id !== id);
  w.projectiles = w.projectiles.filter((pr) => pr.owner !== id || pr.kind === 'proxynade');
}

function moveBody(w: World, p: Player, dt: number) {
  const wasGround = p.onGround;

  // X
  const dx = p.vx * dt;
  if (dx !== 0) {
    if (!collides(p.x + dx, p.y)) p.x += dx;
    else {
      let stepped = false;
      if (wasGround) {
        for (let s = 1; s <= STEP_H; s++) {
          if (!collides(p.x + dx, p.y - s)) { p.x += dx; p.y -= s; stepped = true; break; }
        }
      }
      if (!stepped) p.vx = 0;
    }
    // stick to downward slopes
    if (wasGround && p.vy >= 0 && !collides(p.x, p.y + 1)) {
      for (let s = 1; s <= STEP_H; s++) {
        if (collides(p.x, p.y + s + 1) && !collides(p.x, p.y + s)) { p.y += s; break; }
      }
    }
  }

  // Y
  const dy = p.vy * dt;
  p.onGround = false;
  if (!collides(p.x, p.y + dy)) {
    p.y += dy;
  } else {
    const sgn = Math.sign(dy) || 1;
    const impact = p.vy;
    for (let i = 0; i < Math.ceil(Math.abs(dy)) + 1 && !collides(p.x, p.y + sgn); i++) p.y += sgn;
    // close the last sub-pixel gap so the body rests exactly on the surface
    for (let i = 0; i < 10 && !collides(p.x, p.y + sgn * 0.1); i++) p.y += sgn * 0.1;
    if (sgn > 0) {
      p.onGround = true;
      if (impact > FALL_DMG_SPEED) {
        hurt(w, p, (impact - FALL_DMG_SPEED) * 0.12, -1, 'fall');
        w.events.push({ t: 'land', x: p.x, y: p.y + PLAYER_H / 2, speed: impact });
      }
    }
    p.vy = 0;
  }
  if (p.onGround && p.vy === 0 && !collides(p.x, p.y + 1)) p.onGround = false;
  if (!p.onGround && collides(p.x, p.y + 1)) p.onGround = true;

  // pushed through terrain by a blast: nudge out
  if (collides(p.x, p.y)) {
    for (let s = 1; s < 40; s++) if (!collides(p.x, p.y - s)) { p.y -= s; break; }
  }
}

// ---------- projectiles ----------
function hitPlayer(w: World, pr: Projectile): Player | null {
  for (const p of w.players) {
    if (!p.alive || p.id === pr.owner) continue;
    const owner = w.players.find((q) => q.id === pr.owner);
    if (owner && sameTeam(w, owner, p)) continue;
    if (Math.abs(pr.x - p.x) <= PLAYER_W / 2 + 2 && Math.abs(pr.y - p.y) <= PLAYER_H / 2 + 2) return p;
  }
  return null;
}

function updateProjectiles(w: World, dt: number) {
  const next: Projectile[] = [];
  for (const pr of w.projectiles) {
    let dead = false;
    const isGrenade = pr.kind === 'fragnade' || pr.kind === 'gasnade' || pr.kind === 'proxynade';

    if (isGrenade) {
      dead = stepGrenade(w, pr, dt);
    } else {
      if (pr.kind === 'rocket') { pr.vx *= 1 + 0.35 * dt; pr.vy *= 1 + 0.35 * dt; }
      if (pr.kind === 'flame') { pr.vy -= 160 * dt; pr.vx *= 1 - 1.4 * dt; }
      const steps = Math.max(1, Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 6));
      for (let i = 0; i < steps && !dead; i++) {
        pr.x += (pr.vx * dt) / steps;
        pr.y += (pr.vy * dt) / steps;
        if (MAP.isSolid(pr.x, pr.y)) { dead = true; onWall(w, pr); break; }
        const victim = hitPlayer(w, pr);
        if (victim) { dead = true; onHitPlayer(w, pr, victim); }
      }
      pr.life -= dt;
      if (!dead && pr.life <= 0) { dead = true; if (pr.kind === 'rocket' || pr.kind === 'emp') onWall(w, pr); }
    }
    if (!dead) next.push(pr);
  }
  w.projectiles = next;
}

function onWall(w: World, pr: Projectile) {
  const owner = pr.owner;
  if (pr.kind === 'rocket') explode(w, pr.x - pr.vx * 0.01, pr.y - pr.vy * 0.01, WEAPONS.smaw.radius, pr.damage, owner, pr.weapon);
  else if (pr.kind === 'emp') empBlast(w, pr);
  else if (pr.kind === 'bullet') w.events.push({ t: 'impact', x: pr.x, y: pr.y, wall: true });
}

function empBlast(w: World, pr: Projectile) {
  w.events.push({ t: 'explosion', x: pr.x, y: pr.y, r: WEAPONS.emp.radius });
  const owner = w.players.find((q) => q.id === pr.owner);
  for (const p of w.players) {
    if (!p.alive || (owner && p !== owner && sameTeam(w, owner, p))) continue;
    if (Math.hypot(p.x - pr.x, p.y - pr.y) < WEAPONS.emp.radius) {
      p.empT = 4.5;
      hurt(w, p, pr.damage, pr.owner, 'emp');
    }
  }
}

function onHitPlayer(w: World, pr: Projectile, victim: Player) {
  if (pr.kind === 'rocket') { explode(w, pr.x, pr.y, WEAPONS.smaw.radius, pr.damage, pr.owner, pr.weapon); return; }
  if (pr.kind === 'emp') { empBlast(w, pr); return; }
  if (pr.kind === 'flame') {
    victim.burnT = 2.5; victim.burnBy = pr.owner;
    hurt(w, victim, pr.damage, pr.owner, 'flame');
    return;
  }
  let dmg = pr.damage;
  if (pr.y < victim.y - PLAYER_H * 0.2) dmg *= 1.6; // headshot
  const shield = victim.slots[victim.active]?.id === 'riot';
  if (shield && Math.sign(pr.vx) === -victim.facing) { dmg *= 0.08; w.events.push({ t: 'impact', x: pr.x, y: pr.y, wall: true }); }
  victim.vx += Math.sign(pr.vx) * 30;
  w.events.push({ t: 'impact', x: pr.x, y: pr.y, wall: false });
  hurt(w, victim, dmg, pr.owner, pr.weapon);
}

function stepGrenade(w: World, pr: Projectile, dt: number): boolean {
  if (!pr.stuck) {
    pr.vy = Math.min(pr.vy + GRAVITY * 0.85 * dt, 900);
    const nx = pr.x + pr.vx * dt;
    if (MAP.isSolid(nx, pr.y)) { pr.vx *= -0.5; } else pr.x = nx;
    const ny = pr.y + pr.vy * dt;
    if (MAP.isSolid(pr.x, ny)) {
      if (pr.kind === 'proxynade') { pr.stuck = true; pr.vx = 0; pr.vy = 0; pr.armT = 0.8; }
      else { pr.vy *= -0.45; pr.vx *= 0.8; if (Math.abs(pr.vy) < 40) pr.vy = 0; }
    } else pr.y = ny;
  } else {
    pr.armT -= dt;
  }
  pr.fuse -= dt;
  const def = GRENADES[pr.kind as GrenadeKind];

  if (pr.kind === 'proxynade') {
    if (pr.stuck && pr.armT <= 0) {
      const owner = w.players.find((q) => q.id === pr.owner);
      for (const p of w.players) {
        if (!p.alive || (owner && sameTeam(w, owner, p) && p !== owner)) continue;
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < 70) { explode(w, pr.x, pr.y, def.radius, def.damage, pr.owner, 'proxynade'); return true; }
      }
    }
    if (pr.fuse <= 0) { explode(w, pr.x, pr.y, def.radius, def.damage, pr.owner, 'proxynade'); return true; }
    return false;
  }
  if (pr.fuse <= 0) {
    if (pr.kind === 'gasnade') {
      w.gas.push({ x: pr.x, y: pr.y - 10, r: def.radius, t: 7, owner: pr.owner });
      w.events.push({ t: 'explosion', x: pr.x, y: pr.y, r: 40, gas: true });
    } else explode(w, pr.x, pr.y, def.radius, def.damage, pr.owner, 'fragnade');
    return true;
  }
  return false;
}

function updateGas(w: World, dt: number) {
  for (const g of w.gas) {
    g.t -= dt;
    const owner = w.players.find((q) => q.id === g.owner);
    for (const p of w.players) {
      if (!p.alive || (owner && p !== owner && sameTeam(w, owner, p))) continue;
      if (Math.hypot(p.x - g.x, p.y - g.y) < g.r) hurt(w, p, 13 * dt, g.owner, 'gasnade');
    }
  }
  w.gas = w.gas.filter((g) => g.t > 0);
}

function updatePickups(w: World, dt: number) {
  for (const s of w.pickups) {
    if (s.item) continue;
    s.respawnT -= dt;
    if (s.respawnT <= 0) s.item = s.pool[Math.floor(rand(w) * s.pool.length)];
  }
}

// ---------- match flow ----------
function checkEnd(w: World) {
  if (w.over) return;
  const { mode, scoreLimit, timeLimit } = w.config;
  const byTeam = mode !== 'dm';
  let winner = '';
  if (byTeam) {
    const b = w.teamScore[1] ?? 0, o = w.teamScore[2] ?? 0;
    if (b >= scoreLimit) winner = 'Blue team';
    else if (o >= scoreLimit) winner = 'Orange team';
    else if (w.time >= timeLimit) winner = b === o ? 'Draw' : b > o ? 'Blue team' : 'Orange team';
  } else {
    const top = [...w.players].sort((a, b) => b.kills - a.kills)[0];
    if (top && top.kills >= scoreLimit) winner = top.name;
    else if (w.time >= timeLimit && top) winner = top.name;
  }
  if (winner) { w.over = true; w.winner = winner; }
}

export function stepWorld(w: World, dt: number = DT) {
  if (!w.over) w.time += dt;
  for (const p of w.players) updatePlayer(w, p, dt);
  updateProjectiles(w, dt);
  updateGas(w, dt);
  updatePickups(w, dt);
  if (w.config.mode === 'ctf') updateFlags(w, dt);
  checkEnd(w);
}
