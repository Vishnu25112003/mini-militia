// One room: its lobby (ready, chat, countdown, host rules) and its authoritative Catacombs match.
// server/rooms.mjs runs many of these side by side, each with its own join code.
import { PHYS, newBody, stepBody, bodyHeight, rayHitsBody, tryMelee } from '../shared/physics.js';
import { GUNS, NADES, MELEE, SPAWN_LOADOUT, isGun, isNade, isDual } from '../shared/weapons.js';
import { MODES, DEFAULT_CONFIG, sanitizeConfig, sanitizeLoadout, physicsOptions, has } from '../shared/config.js';
import { randomUUID } from 'node:crypto';

const DEG = Math.PI / 180;
const TEAM_NAMES = ['blue', 'orange'];
export { MODES };
const SPAWN_SHIELD = 2;
const DROP_TTL = 25;
const FLAG_RETURN = 20;
const RECONNECT_GRACE = 30_000; // a dropped player's seat is held this long
const COUNTDOWN = 120; // lobby auto-start, seconds, once two soldiers are in
const COUNTDOWN_READY = 10; // ...cut to this when everyone is ready
const CHAT_MAX = 100;
export const COLORS = ['#ff4b3e', '#b05cff', '#ffd23f', '#3fd4ff', '#5ee05a', '#ff9a2e', '#ff6fc3', '#f2f2f2'];
export const points = (p) => p.kills * 100 + p.caps * 300;
const VOICE = ['bringit', 'cmonboy', 'getsome', 'yeah', 'hoorah', 'coverme', 'moveout', 'niceshot', 'gotme', 'goodgame', 'thanks', 'readyup'];

let nextId = 1;
const uid = () => nextId++;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  constructor(map, broadcast = null, { code = '' } = {}) {
    this.map = map;
    this.code = code;
    // every message goes to this room's connected players; `broadcast` is an optional observer
    this.broadcast = (msg) => {
      broadcast?.(msg);
      const data = JSON.stringify(msg);
      for (const q of this.players.values()) if (q.connected && q.ws?.readyState === 1) q.ws.send(data);
    };
    this.players = new Map();
    this.kicked = new Set(); // tokens the host removed
    this.chatLog = [];
    this.countdownAt = 0;
    this.closed = false;
    this.phase = 'lobby'; // lobby | playing | over
    // the shared spawn loadout stays the default so tooling can still swap it out
    this.config = sanitizeConfig({ loadout: { ...SPAWN_LOADOUT, ...SPAWN_LOADOUT.nades } }, DEFAULT_CONFIG);
    this.phys = physicsOptions(this.config);
    this.reset();
    this.tick = 0;
  }

  reset() {
    this.items = new Map();
    this.projectiles = new Map();
    this.clouds = [];
    this.events = [];
    this.teamScore = [0, 0];
    this.flags = null;
    this.endsAt = 0;
    this.overUntil = 0;
  }

  // ---------------- lobby ----------------
  addPlayer(ws, hello) {
    const id = uid();
    const used = new Set([...this.players.values()].map((q) => q.color));
    const host = this.players.size === 0;
    const p = {
      id, ws, name: cleanName(hello.name), avatar: sanitizeAvatar(hello.avatar),
      token: typeof hello.token === 'string' && /^[\w-]{8,64}$/.test(hello.token) ? hello.token : randomUUID(),
      color: [...COLORS.keys()].find((i) => !used.has(i)) ?? 0, ready: host, connected: true, dropAt: 0, chatAt: 0, chatBurst: 0,
      team: this.smallerTeam(), host, kills: 0, deaths: 0, caps: 0,
      inputs: [], ack: 0, alive: false, body: newBody(0, 0), hp: PHYS.MAX_HP, aim: 0,
      slots: [], slot: 0, guns: {}, nades: {}, nadeSel: 'fragnade', carrying: -1, reloadT: 0, shieldUntil: 0,
    };
    this.players.set(id, p);
    if (this.phase !== 'lobby') this.spawnLate(p);
    this.updateCountdown();
    this.sendLobby();
    if (this.chatLog.length) send(ws, { t: 'chatHistory', messages: this.chatLog });
    return p;
  }

  removePlayer(p) {
    if (!this.players.has(p.id)) return;
    if (p.alive) this.dropFlag(p);
    this.players.delete(p.id);
    if (this.players.size === 0) {
      // an empty room starts fresh; hosts restore their own saved rules from their device
      this.phase = 'lobby'; this.reset();
      this.config = sanitizeConfig({ loadout: { ...SPAWN_LOADOUT, ...SPAWN_LOADOUT.nades } }, DEFAULT_CONFIG);
      this.closed = true;
      return;
    }
    if (p.host) return this.cancel(); // "Room cancelled by host"
    this.updateCountdown();
    this.sendLobby();
  }

  // The host left for good: everyone else is told and the room closes.
  cancel() {
    this.broadcast({ t: 'cancelled' });
    for (const q of this.players.values()) q.cancelled = true;
    this.players.clear();
    this.closed = true;
  }

  // A socket dropped: keep the seat (and the soldier) for a while so the player can resume.
  disconnect(p) {
    if (!this.players.has(p.id)) return;
    p.connected = false;
    p.ws = null;
    p.inputs.length = 0;
    p.dropAt = Date.now() + RECONNECT_GRACE;
    this.updateCountdown();
    this.sendLobby();
  }

  resume(token, ws) {
    const p = [...this.players.values()].find((q) => q.token === token);
    if (!p) return null;
    p.ws = ws;
    p.connected = true;
    p.dropAt = 0;
    this.updateCountdown();
    this.sendLobby();
    return p;
  }

  kick(host, id) {
    const q = this.players.get(id);
    if (!host.host || !q || q === host) return;
    this.kicked.add(q.token);
    send(q.ws, { t: 'kicked' });
    q.kickedOut = true;
    this.removePlayer(q);
    q.ws?.close?.();
  }

  say(p, text) {
    const now = Date.now();
    // short bursts are fine, floods are not
    p.chatBurst = Math.max(0, p.chatBurst - (now - p.chatAt) / 1500);
    if (p.chatBurst > 4) return;
    p.chatAt = now;
    p.chatBurst++;
    const clean = String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
    if (!clean) return;
    const msg = { t: 'chat', id: p.id, name: p.name, color: p.color, team: p.team, text: clean, at: now };
    this.chatLog.push(msg);
    if (this.chatLog.length > 40) this.chatLog.shift();
    this.broadcast(msg);
  }

  connectedCount() { return [...this.players.values()].filter((q) => q.connected).length; }

  smallerTeam() {
    const n = [0, 0];
    for (const q of this.players.values()) n[q.team]++;
    return n[0] <= n[1] ? 0 : 1;
  }

  lobbyState() {
    return {
      t: 'lobby', code: this.code, phase: this.phase, config: this.config,
      startsIn: this.countdownAt ? Math.max(0, Math.ceil((this.countdownAt - Date.now()) / 1000)) : null,
      players: [...this.players.values()].map((q) => ({
        id: q.id, name: q.name, team: q.team, avatar: q.avatar, host: q.host, ready: q.ready, color: q.color, connected: q.connected,
      })),
    };
  }

  sendLobby() { this.broadcast(this.lobbyState()); }

  handle(p, msg) {
    switch (msg.t) {
      case 'in': {
        if (p.inputs.length < 30) p.inputs.push(msg);
        break;
      }
      case 'team':
        if (msg.team === 0 || msg.team === 1) { p.team = msg.team; this.sendLobby(); }
        break;
      case 'profile':
        p.name = cleanName(msg.name, p.name);
        p.avatar = sanitizeAvatar(msg.avatar);
        this.sendLobby();
        break;
      case 'config':
        if (!p.host || this.phase !== 'lobby') break;
        this.config = sanitizeConfig(msg, this.config);
        this.sendLobby();
        break;
      case 'start':
        if (p.host && this.phase === 'lobby') this.start();
        break;
      case 'ready':
        if (this.phase !== 'playing') { p.ready = !!msg.v; this.updateCountdown(); this.sendLobby(); }
        break;
      case 'kick':
        if (this.phase === 'lobby' || this.phase === 'over' || this.phase === 'playing') this.kick(p, msg.id);
        break;
      case 'chat':
        this.say(p, msg.text);
        break;
      case 'playAgain':
        // host restarts with the same rules; a guest just marks themselves ready
        if (p.host && this.phase !== 'playing') this.start();
        else if (!p.host) { p.ready = true; this.updateCountdown(); this.sendLobby(); }
        break;
      case 'loadout':
        // the soldier's own pick, used when the host's DEFAULT LOADOUT is off
        p.loadout = sanitizeLoadout(msg.loadout, this.config.loadout);
        send(p.ws, { t: 'myLoadout', loadout: p.loadout });
        break;
      case 'replaceGun':
        if (this.phase === 'playing') this.replaceGun(p, msg.item, msg.hand === 'off' ? 'off' : 'main');
        break;
      case 'toLobby':
        if (p.host && this.phase === 'over') this.toLobby();
        break;
      case 'voice':
        if (VOICE.includes(msg.v)) this.ev({ k: 'voice', id: p.id, v: msg.v });
        break;
    }
  }

  // ---------------- match lifecycle ----------------
  toLobby() {
    this.phase = 'lobby';
    this.reset();
    for (const q of this.players.values()) q.ready = q.host;
    this.updateCountdown();
    this.sendLobby();
  }

  // Lobby auto-start: two minutes once two soldiers are in, ten seconds when everyone is ready.
  updateCountdown() {
    if (this.phase !== 'lobby') { this.countdownAt = 0; return; }
    const ps = [...this.players.values()].filter((q) => q.connected);
    if (ps.length < 2) { this.countdownAt = 0; return; }
    const now = Date.now();
    if (!this.countdownAt) this.countdownAt = now + COUNTDOWN * 1000;
    if (ps.every((q) => q.ready)) this.countdownAt = Math.min(this.countdownAt, now + COUNTDOWN_READY * 1000);
  }

  start() {
    this.reset();
    this.countdownAt = 0;
    this.phase = 'playing';
    this.endsAt = Date.now() + this.config.minutes * 60_000;
    this.phys = physicsOptions(this.config);
    const mode = this.config.mode;
    const spawnerPrefix = mode === 'ctf' ? /^(wp_p_|ctf_wp_)/ : /^wp_p_/;
    // MAP DROPS off: no weapon spawners at all
    this.spawners = this.config.drops === 0 ? [] : this.map.objects.filter((o) => spawnerPrefix.test(o.name) && o.weapon)
      .map((o) => ({ x: o.x, y: o.y, list: o.weapon.split(','), item: null, respawnAt: 0 }));
    for (const s of this.spawners) this.fillSpawner(s);
    if (mode === 'ctf') {
      this.flags = [1, 2].map((n, team) => {
        const o = this.map.objects.find((q) => q.name === `fp_${n}`);
        return { team, homeX: o.x, homeY: o.y, x: o.x, y: o.y, carrier: 0, atHome: true, returnAt: 0 };
      });
    }
    for (const p of this.players.values()) {
      p.kills = p.deaths = p.caps = 0;
      if (!MODES[mode].teams) p.team = 0;
      this.respawn(p);
    }
    if (MODES[mode].teams) this.balanceTeams();
    this.broadcast({ t: 'start', config: this.config });
    this.sendLobby();
  }

  balanceTeams() {
    const n = [0, 0];
    for (const p of this.players.values()) n[p.team]++;
    for (const p of this.players.values()) {
      if (Math.abs(n[0] - n[1]) <= 1) break;
      const big = n[0] > n[1] ? 0 : 1;
      if (p.team === big) { p.team = 1 - big; n[big]--; n[1 - big]++; }
    }
  }

  spawnLate(p) {
    if (MODES[this.config.mode].teams) p.team = this.smallerTeam();
    p.respawnAt = Date.now() + 1000;
    p.alive = false;
  }

  finish(reason) {
    this.phase = 'over';
    const mode = this.config.mode;
    const players = [...this.players.values()].map((q) => ({ id: q.id, name: q.name, team: q.team, kills: q.kills, deaths: q.deaths, caps: q.caps, points: points(q), color: q.color, avatar: q.avatar }))
      .sort((a, b) => (b.points - a.points) || (a.deaths - b.deaths));
    let winner;
    if (MODES[mode].teams) winner = this.teamScore[0] === this.teamScore[1] ? -1 : (this.teamScore[0] > this.teamScore[1] ? 0 : 1);
    else winner = players[0]?.id ?? 0;
    this.broadcast({ t: 'end', reason, mode, winner, teamScore: this.teamScore, players });
    this.overUntil = Date.now() + 12_000;
  }

  // ---------------- per-player state ----------------
  respawn(p) {
    const spot = this.chooseSpawn(p);
    p.body = newBody(spot.x, spot.y);
    settle(this.map, p.body);
    p.alive = true;
    p.hp = PHYS.MAX_HP;
    p.shieldUntil = Date.now() + SPAWN_SHIELD * 1000;
    p.lastHurt = 0;
    p.burn = 0;
    const L = this.config.defaultLoadout || !p.loadout ? this.config.loadout : { ...this.config.loadout, ...p.loadout };
    p.guns = {};
    for (const t of [L.primary, L.secondary]) p.guns[t] = this.newAmmo(t);
    p.slots = [L.primary, L.secondary];
    // off-hand guns per slot (dual wield); the loadout can start a slot as a pair
    p.off = [L.primaryDual ? { type: L.primary, ...this.newAmmo(L.primary) } : null, L.secondaryDual ? { type: L.secondary, ...this.newAmmo(L.secondary) } : null];
    p.hand = 0;
    p.spin = 0;
    p.slot = 0;
    p.holsterT = 0;
    p.nades = { fragnade: L.fragnade, gasnade: L.gasnade, proxynade: L.proxynade };
    if (has(this.config, 'grenadier')) p.nades.fragnade += 2;
    if (has(this.config, 'ace')) { p.nades.proxynade += 1; p.nades.gasnade += 1; }
    for (const n in p.nades) p.nades[n] = Math.min(this.nadeMax(), p.nades[n]);
    p.nadeSel = ['fragnade', 'gasnade', 'proxynade'].find((n) => p.nades[n] > 0) || 'fragnade';
    p.cool = 0; p.reloadT = 0; p.burst = 0; p.burstT = 0; p.swingT = 0; p.fireHeld = false;
    p.carrying = -1;
    p.needFreshFire = true; // a trigger held through death does not fire on spawn
    this.ev({ k: 'spawn', id: p.id, x: p.body.x, y: p.body.y });
  }

  chooseSpawn(p) {
    const mode = this.config.mode;
    let spots = mode === 'ctf' ? this.map.objects.filter((o) => o.name === `ctf_sp_${p.team + 1}`) : this.map.byPrefix('sp_p_');
    if (!spots.length) spots = this.map.byPrefix('sp_p_');
    if (mode === 'ctf') return { x: spots[0].x + rand(-40, 40), y: spots[0].y };
    const enemies = [...this.players.values()].filter((q) => q !== p && q.alive && (!MODES[mode].teams || q.team !== p.team));
    let best = spots[0], bestD = -1;
    for (const s of spots) {
      const d = enemies.length ? Math.min(...enemies.map((q) => Math.hypot(q.body.x - s.x, q.body.y - s.y))) : Math.random() * 1000;
      const score = d + rand(0, 250);
      if (score > bestD) { bestD = score; best = s; }
    }
    return best;
  }

  activeGun(p) { return p.slots?.[p.slot]; }
  offOf(p) { return p.off?.[p.slot] || null; }
  // the off-hand gun that can fire (an off-hand riot shield only blocks)
  offGun(p) { const o = this.offOf(p); return o && GUNS[o.type]?.kind !== 'shield' ? o : null; }
  newAmmo(t) { return { mag: this.magCap(t), reserve: GUNS[t].kind === 'shield' ? 0 : this.magCap(t) * 2 }; }

  // ---------------- host settings ----------------
  magCap(type) {
    const g = GUNS[type];
    if (!g) return 0;
    return has(this.config, 'hiCapMags') && g.mag > 1 ? Math.round(g.mag * 1.5) : g.mag;
  }
  reloadTime(type) { return (GUNS[type]?.reload || 0) * (has(this.config, 'fastReload') ? 0.6 : 1); }
  nadeMax() { return has(this.config, 'grenadier') ? 5 : 3; }

  // ---------------- simulation ----------------
  update(dt) {
    this.tick++;
    const now = Date.now();
    // seats held for dropped players run out
    for (const q of [...this.players.values()]) if (!q.connected && q.dropAt && now > q.dropAt) this.removePlayer(q);
    if (this.closed) return;
    if (this.phase === 'lobby') {
      if (this.countdownAt && now >= this.countdownAt) this.start();
      else if (this.tick % 60 === 0 && this.countdownAt) this.sendLobby(); // keep everyone's clock in step
      return;
    }
    if (this.phase === 'over') {
      if (now > this.overUntil) this.toLobby();
      return;
    }
    if (this.phase !== 'playing') return;

    for (const p of this.players.values()) {
      if (!p.alive) {
        p.inputs.length = 0;
        if (p.respawnAt && now >= p.respawnAt) this.respawn(p);
        continue;
      }
      // Consume queued inputs (cap to avoid catch-up bursts); each one is a fixed 1/60 s step, like the client.
      let n = 0;
      while (p.inputs.length && n < 4 && p.alive) {
        this.applyInput(p, p.inputs.shift(), PHYS.TICK);
        n++;
      }
      if (n === 0) this.idle(p, dt);
    }

    this.updateProjectiles(dt);
    this.updateItems(dt);
    this.updateClouds(dt);
    if (this.flags) this.updateFlags();

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      // [RE] SoldierLocalController::updateStep: once a second, hp += 60 * dt * regenMultiplier (= +1 HP/s),
      // capped at 100; the HEALTH REGEN special sets the multiplier to 3 (ItemLibrary::applyItem).
      if ((p.regenT = (p.regenT || 0) + dt) >= 1) {
        p.regenT = 0;
        if (this.config.healthRegen && p.hp < PHYS.MAX_HP) p.hp = Math.min(PHYS.MAX_HP, p.hp + (has(this.config, 'healthRegen') ? 3 : 1));
      }
      if (p.body.y > this.map.height + 200) this.kill(p, null, 'fall');
    }

    this.checkEnd(now);
  }

  idle(p, dt) {
    // No input arrived this tick: keep timers moving so cooldowns do not freeze.
    p.cool = Math.max(0, p.cool - dt);
    if (p.reloadT > 0 && (p.reloadT -= dt) <= 0) this.finishReload(p);
  }

  applyInput(p, inp, dt) {
    p.ack = inp.s;
    const bits = inp.b | 0;
    const jet = !!(bits & 1), crouch = !!(bits & 2);
    let fire = !!(bits & 4);
    if (p.needFreshFire) { if (!fire) p.needFreshFire = false; fire = false; }
    if (Number.isFinite(inp.a)) p.aim = inp.a;
    const mx = Number.isFinite(inp.x) ? Math.max(-1, Math.min(1, inp.x)) : 0;
    stepBody(p.body, { mx, jet, crouch }, this.map, dt, this.phys);

    p.cool = Math.max(0, p.cool - dt);
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) this.finishReload(p);
    }
    if (bits & 16) this.swap(p);
    if (has(this.config, 'autoReloader')) {
      const other = p.slots[1 - p.slot], a = other && p.guns[other];
      if (a && a.mag < this.magCap(other) && a.reserve > 0 && (p.holsterT += dt) >= this.reloadTime(other)) {
        const take = Math.min(this.magCap(other) - a.mag, a.reserve);
        a.mag += take; a.reserve -= take; p.holsterT = 0;
      }
    }
    if (bits & 64) this.cycleNade(p);
    if (bits & 8) this.startReload(p);
    if (bits & 256) this.tryPickup(p);
    if (bits & 32) this.throwNade(p);
    if (bits & 128) this.melee(p);
    else if (p.swingT > 0) this.checkSwing(p);
    if (p.swingT > 0) p.swingT -= dt;

    // M16 burst continuation
    if (p.burst > 0) {
      p.burstT -= dt;
      if (p.burstT <= 0) this.fireGun(p, true);
    }
    if (fire) this.tryFire(p, !p.fireHeld, dt);
    else p.spin = 0;
    p.fireHeld = fire;
    if (p.alive) this.autoPickups(p);
  }

  tryFire(p, edge, dt = PHYS.TICK) {
    const type = this.activeGun(p);
    const g = GUNS[type];
    if (!g || g.kind === 'shield') return;
    if (p.body.emp > 0 || p.reloadT > 0 || p.cool > 0 || p.burst > 0) return;
    // the minigun has to spin up first (m61Pre)
    if (g.spinUp) {
      if (!p.spin) this.ev({ k: 'snd', s: 'm61Pre', x: p.body.x, y: p.body.y });
      p.spin += dt;
      if (p.spin < g.spinUp) return;
    }
    if (!g.auto && !edge) return;
    const off = this.offGun(p);
    const ammoOf = (h) => (h ? off : p.guns[type]);
    let hand = off ? p.hand : 0;
    if (off && ammoOf(hand).mag <= 0 && ammoOf(1 - hand).mag > 0) hand = 1 - hand;
    if (ammoOf(hand).mag <= 0) {
      if (edge) {
        if (p.guns[type].reserve > 0 || off?.reserve > 0) this.startReload(p);
        else this.ev({ k: 'snd', s: 'dryfire', x: p.body.x, y: p.body.y });
      }
      return;
    }
    p.burst = hand ? 1 : g.burst || 1;
    this.fireGun(p, false, hand);
    if (off) p.hand = 1 - hand;
  }

  fireGun(p, continuing, hand = 0) {
    const off = this.offGun(p);
    const type = hand && off ? off.type : this.activeGun(p);
    const g = GUNS[type];
    const ammo = hand && off ? off : p.guns[type];
    if (!g || !ammo || ammo.mag <= 0 || p.body.emp > 0) { p.burst = 0; return; }
    ammo.mag--;
    p.burst--;
    p.burstT = g.burstGap || 0;
    // a pair alternates hands, so each gun keeps its own rate and the pair fires twice as often
    if (p.burst <= 0) p.cool = g.interval * (off ? 0.5 : 1);
    p.shieldUntil = 0; // shooting ends spawn protection
    const b = p.body;
    const h = bodyHeight(b);
    const ox = b.x, oy = b.y - h * 0.62;
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    const mx = ox + dx * 26, my = oy + dy * 26;
    this.ev({ k: 'fire', id: p.id, w: type, h: hand });

    if (g.kind === 'hitscan') {
      const spread = g.spread * (has(this.config, 'shotStabilizer') ? 0.5 : 1);
      const range = g.range * (has(this.config, 'hiVelocity') ? 1.3 : 1);
      for (let i = 0; i < g.pellets; i++) {
        const a = p.aim + rand(-spread / 2, spread / 2) * DEG;
        this.hitscan(p, ox, oy, Math.cos(a), Math.sin(a), range, g.damage, type);
      }
    } else if (g.kind === 'launcher') {
      // RG-6: a bouncing grenade that goes off on a short fuse
      this.spawnProjectile({ kind: 'nade', type: 'rg6', owner: p.id, team: p.team, x: mx, y: my, vx: dx * g.speed + b.vx * 0.3, vy: dy * g.speed + b.vy * 0.3, life: NADES.rg6.fuse, armed: 0, stuck: false });
    } else if (g.kind === 'rocket' || g.kind === 'emp') {
      this.spawnProjectile({ kind: g.kind, type, owner: p.id, team: p.team, x: mx, y: my, vx: dx * g.speed, vy: dy * g.speed, life: 4 });
    } else if (g.kind === 'saw') {
      this.spawnProjectile({ kind: 'saw', type, owner: p.id, team: p.team, x: mx, y: my, vx: dx * g.speed, vy: dy * g.speed, life: g.life, bounces: g.bounces, hit: [] });
    } else if (g.kind === 'flame') {
      const a = p.aim + rand(-g.spread / 2, g.spread / 2) * DEG;
      const sp = 340;
      this.spawnProjectile({ kind: 'flame', type, owner: p.id, team: p.team, x: mx, y: my, vx: Math.cos(a) * sp + b.vx * 0.5, vy: Math.sin(a) * sp + b.vy * 0.5, life: g.range / sp + 0.1, maxLife: g.range / sp + 0.1, rot: Math.random() * 6.28, hit: [] });
    }
    const other = hand ? p.guns[this.activeGun(p)] : off;
    if (ammo.mag <= 0 && (!other || other.mag <= 0) && (ammo.reserve > 0 || other?.reserve > 0) && !continuing) {
      // auto reload once the last round leaves (both guns of a pair)
      p.burst = 0;
      p.cool = Math.max(p.cool, g.interval);
      this.startReload(p);
    }
  }

  hitscan(p, x, y, dx, dy, range, dmg, type) {
    const wall = this.map.raycast(x, y, dx, dy, range);
    let best = wall, target = null;
    for (const q of this.players.values()) {
      if (q === p || !q.alive || this.friendly(p, q)) continue;
      const t = rayHitsBody(q.body, x, y, dx, dy, best);
      if (t >= 0 && t < best) { best = t; target = q; }
    }
    const hx = x + dx * best, hy = y + dy * best;
    this.ev({ k: 'shot', x0: Math.round(x + dx * 24), y0: Math.round(y + dy * 24), x1: Math.round(hx), y1: Math.round(hy), w: type });
    if (target) {
      if (this.shieldBlocks(target, dx)) {
        this.ev({ k: 'snd', s: pick(['ricochet', 'clank']), x: hx, y: hy });
        return;
      }
      this.ev({ k: 'blood', x: Math.round(hx), y: Math.round(hy), dx: Math.sign(dx) });
      this.damage(target, dmg, p, type);
    } else if (best < range) {
      this.ev({ k: 'spark', x: Math.round(hx), y: Math.round(hy) });
    }
  }

  // Riot shield faces the aim side and stops anything travelling toward its face.
  shieldBlocks(q, dx) {
    if (this.activeGun(q) !== 'riot' && this.offOf(q)?.type !== 'riot') return false;
    const facing = Math.cos(q.aim) >= 0 ? 1 : -1;
    return Math.sign(dx) === -facing;
  }

  friendly(a, b) { return MODES[this.config.mode].teams && a.team === b.team && !this.config.friendlyFire; }

  damage(q, amount, attacker, type, silent) {
    if (!q.alive || amount <= 0) return;
    if (q.shieldUntil > Date.now()) return;
    if (attacker && attacker !== q && this.friendly(attacker, q)) return;
    q.hp -= amount;
    q.lastHurt = Date.now();
    if (attacker && attacker !== q) q.lastAttacker = attacker.id;
    if (!silent) this.ev({ k: 'hurt', id: q.id });
    if (q.hp <= 0) this.kill(q, attacker, type);
  }

  kill(q, attacker, type) {
    if (!q.alive) return;
    q.alive = false;
    q.hp = 0;
    q.deaths++;
    q.respawnAt = Date.now() + this.config.respawn * 1000;
    const killer = attacker && attacker !== q ? attacker : (q.lastAttacker && Date.now() - q.lastHurt < 4000 ? this.players.get(q.lastAttacker) : null);
    if (killer && killer.id !== q.id) {
      killer.kills++;
      if (this.config.mode === 'tdm' && killer.team !== q.team) this.teamScore[killer.team]++;
    }
    this.dropFlag(q);
    // drop the active gun (not the starter sidearm) with what is left in it
    const drop = q.slots.find((t) => t && t !== this.config.loadout.secondary && GUNS[t]);
    if (drop) this.dropItem(drop, q.body.x, q.body.y - 20, rand(-80, 80), -160, q.guns[drop]);
    const off = this.offOf(q);
    if (off) this.dropItem(off.type, q.body.x, q.body.y - 24, rand(-80, 80), -180, off);
    this.ev({ k: 'kill', id: q.id, by: killer?.id ?? 0, w: type, x: Math.round(q.body.x), y: Math.round(q.body.y - 25), s: `death${1 + Math.floor(Math.random() * 9)}` });
  }

  // A reload refills the main gun and, for a pair, the off-hand gun too.
  startReload(p) {
    const type = this.activeGun(p);
    const g = GUNS[type];
    if (!g || g.kind === 'shield' || p.reloadT > 0) return;
    const needs = (t, a) => a && GUNS[t]?.kind !== 'shield' && a.mag < this.magCap(t) && a.reserve > 0;
    const off = this.offGun(p);
    const main = needs(type, p.guns[type]), second = off && needs(off.type, off);
    if (!main && !second) return;
    p.reloadT = Math.max(main ? this.reloadTime(type) : 0, second ? this.reloadTime(off.type) : 0);
    p.burst = 0;
    this.ev({ k: 'snd', s: 'reload', x: p.body.x, y: p.body.y });
  }

  finishReload(p) {
    p.reloadT = 0;
    const fill = (t, a) => {
      if (!a || !GUNS[t]) return;
      const take = Math.min(this.magCap(t) - a.mag, a.reserve);
      if (take > 0) { a.mag += take; a.reserve -= take; }
    };
    const type = this.activeGun(p);
    fill(type, p.guns[type]);
    const off = this.offGun(p);
    if (off) fill(off.type, off);
  }

  swap(p) {
    if (!p.slots[1 - p.slot]) return;
    p.slot = 1 - p.slot;
    p.reloadT = 0;
    p.holsterT = 0;
    p.burst = 0;
    p.cool = Math.max(p.cool, 0.2);
    this.ev({ k: 'snd', s: 'switch', x: p.body.x, y: p.body.y, quiet: 1 });
  }

  cycleNade(p) {
    const order = ['fragnade', 'gasnade', 'proxynade'];
    const i = order.indexOf(p.nadeSel);
    for (let k = 1; k <= 3; k++) {
      const t = order[(i + k) % 3];
      if (p.nades[t] > 0) { p.nadeSel = t; return; }
    }
  }

  throwNade(p) {
    let t = p.nadeSel;
    if (!(p.nades[t] > 0)) { this.cycleNade(p); t = p.nadeSel; }
    if (!(p.nades[t] > 0) || p.body.emp > 0) return;
    p.nades[t]--;
    if (p.nades[t] <= 0) this.cycleNade(p);
    p.shieldUntil = 0;
    const b = p.body;
    const sp = 540;
    const x = b.x + Math.cos(p.aim) * 14, y = b.y - bodyHeight(b) * 0.7;
    this.spawnProjectile({ kind: 'nade', type: t, owner: p.id, team: p.team, x, y, vx: Math.cos(p.aim) * sp + b.vx * 0.5, vy: Math.sin(p.aim) * sp + b.vy * 0.5 - 60, life: NADES[t].fuse, armed: 0, stuck: false });
    this.ev({ k: 'snd', s: 'throw', x, y });
  }

  melee(p) {
    if (!tryMelee(p.body, p.aim)) return;
    p.swingT = MELEE.swing; p.swingHit = false;
    this.ev({ k: 'melee', id: p.id });
    if (!this.checkSwing(p)) this.ev({ k: 'snd', s: MELEE.sound, x: p.body.x, y: p.body.y });
  }

  // [RE] SoldierLocalController::checkMeleeCollision runs through the swing: a segment from the body
  // centre toward the fist (along the aim), first soldier it crosses is hit, once per swing.
  checkSwing(p) {
    if (p.swingHit || !(p.swingT > 0)) return false;
    const b = p.body, dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    const cx = b.x, cy = b.y - bodyHeight(b) * 0.55, reach = PHYS.WIDTH / 2 + MELEE.range;
    let hit = null, best = Infinity;
    for (const q of this.players.values()) {
      if (q === p || !q.alive || this.friendly(p, q)) continue;
      const d = rayHitsBody(q.body, cx, cy, dx, dy, reach);
      if (d >= 0 && d < best) { best = d; hit = q; }
    }
    if (!hit) return false;
    p.swingHit = true;
    const facing = dx >= 0 ? 1 : -1;
    this.ev({ k: 'snd', s: 'impale', x: hit.body.x, y: hit.body.y });
    this.ev({ k: 'blood', x: Math.round(hit.body.x), y: Math.round(hit.body.y - 30), dx: facing });
    this.damage(hit, MELEE.damage * (has(this.config, 'meleePower') ? 2 : 1), p, 'machete');
    return true;
  }

  // ---------------- items ----------------
  fillSpawner(s) {
    const type = pick(s.list);
    const it = this.dropItem(type, s.x, s.y - 12, 0, 0, null, s);
    s.item = it.id;
  }

  dropItem(type, x, y, vx, vy, ammo, spawner) {
    const id = uid();
    let a = null;
    if (GUNS[type]) {
      const g = GUNS[type];
      a = ammo ? { mag: ammo.mag, reserve: ammo.reserve } : { mag: this.magCap(type), reserve: g.kind === 'shield' ? 0 : Math.min(g.maxAmmo, g.mag * 3) };
    }
    const it = { id, type, x, y, vx, vy, ammo: a, spawner: spawner || null, ttl: spawner ? Infinity : DROP_TTL, rest: false };
    this.items.set(id, it);
    return it;
  }

  takeItem(it) {
    this.items.delete(it.id);
    if (it.spawner) { it.spawner.item = null; it.spawner.respawnAt = Date.now() + this.config.drops * 1000; }
  }

  updateItems(dt) {
    const now = Date.now();
    for (const it of this.items.values()) {
      if (!it.rest) {
        it.vy += PHYS.GRAVITY * this.phys.gravity * dt;
        if (!this.phys.gravity) { // zero-g: drops drift to a stop
          const k = Math.exp(-1.5 * dt);
          it.vx *= k; it.vy *= k;
          if (Math.hypot(it.vx, it.vy) < 4) { it.vx = it.vy = 0; it.rest = true; }
        }
        const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
        if (this.map.solidAt(nx, it.y)) it.vx = -it.vx * 0.3; else it.x = nx;
        if (this.map.solidAt(it.x, ny + 8)) {
          if (it.vy > 0) { it.vx *= 0.6; if (Math.abs(it.vy) < 60) { it.vy = 0; it.rest = true; } else it.vy = -it.vy * 0.25; }
          else it.vy = 0;
        } else it.y = ny;
      }
      it.ttl -= dt;
      if (it.ttl <= 0) this.items.delete(it.id);
    }
    for (const s of this.spawners || []) if (!s.item && now >= s.respawnAt) this.fillSpawner(s);
  }

  nearItems(p, r = 44) {
    const b = p.body;
    const cy = b.y - bodyHeight(b) / 2;
    return [...this.items.values()].filter((it) => Math.abs(it.x - b.x) < r && Math.abs(it.y - cy) < r + 10);
  }

  autoPickups(p) {
    for (const it of this.nearItems(p, 34)) {
      if (isNade(it.type)) {
        if ((p.nades[it.type] || 0) >= this.nadeMax()) continue;
        p.nades[it.type] = Math.min(this.nadeMax(), (p.nades[it.type] || 0) + 2);
        if (!(p.nades[p.nadeSel] > 0)) p.nadeSel = it.type;
        this.takeItem(it);
        this.ev({ k: 'snd', s: 'snatch', x: it.x, y: it.y, to: p.id });
      } else if (it.type === 'healthpack') {
        if (p.hp >= PHYS.MAX_HP) continue;
        p.hp = PHYS.MAX_HP;
        p.burn = 0;
        this.takeItem(it);
        this.ev({ k: 'snd', s: 'snatch', x: it.x, y: it.y, to: p.id });
      } else if (it.type === 'boosttank') {
        p.body.boost = 10;
        p.body.fuel = 1;
        this.takeItem(it);
        this.ev({ k: 'snd', s: 'snatch', x: it.x, y: it.y, to: p.id });
      } else if (GUNS[it.type] && it.ammo && (p.slots.includes(it.type) || p.off?.some((o) => o?.type === it.type)) && !(isDual(it.type) && this.pickupAction(p, it))) {
        // same gun lying around: take its rounds (a gun that could become a pair is left for a manual pickup)
        const g = GUNS[it.type], a = p.slots.includes(it.type) ? p.guns[it.type] : p.off.find((o) => o?.type === it.type);
        const room = g.maxAmmo - a.reserve;
        const take = Math.min(room, it.ammo.mag + it.ammo.reserve);
        if (take <= 0) continue;
        a.reserve += take;
        this.takeItem(it);
        this.ev({ k: 'snd', s: 'snatch', x: it.x, y: it.y, to: p.id });
      }
    }
  }

  // What picking up this gun would do: 'pair' (becomes the off-hand gun), 'shield' (off-hand riot shield),
  // 'choose' (holding a pair: ask which hand to replace), 'replace' (swap the whole slot), or null.
  pickupAction(p, it) {
    const main = this.activeGun(p), off = this.offOf(p), t = it.type;
    if (!GUNS[t]) return null;
    const other = p.slots[1 - p.slot];
    if (isDual(t) && isDual(main) && !off) return 'pair';
    if (t === 'riot' && GUNS[main]?.hand && !off) return 'shield';
    if (isDual(t) && isDual(main) && off) return t === other ? null : 'choose';
    if (!p.slots.includes(t)) return 'replace';
    return null;
  }

  pickupCandidate(p) {
    for (const it of this.nearItems(p)) {
      const action = this.pickupAction(p, it);
      if (action) return { it, action };
    }
    return null;
  }

  tryPickup(p) {
    const c = this.pickupCandidate(p);
    if (!c) return;
    const { it, action } = c;
    if (action === 'choose') {
      // sheet 9: "Replace which gun?"
      send(p.ws, { t: 'choice', item: it.id, type: it.type, main: this.activeGun(p), off: this.offOf(p).type });
      return;
    }
    if (action === 'pair' || action === 'shield') {
      p.off[p.slot] = { type: it.type, mag: it.ammo.mag, reserve: it.ammo.reserve };
      p.hand = 1;
    } else {
      const replaced = p.slots[p.slot];
      const facing = Math.cos(p.aim) >= 0 ? -60 : 60;
      if (replaced) {
        this.dropItem(replaced, p.body.x, p.body.y - 30, facing, -120, p.guns[replaced]);
        delete p.guns[replaced];
      }
      const off = this.offOf(p);
      if (off) this.dropItem(off.type, p.body.x, p.body.y - 34, facing * 1.4, -140, off);
      p.off[p.slot] = null;
      p.slots[p.slot] = it.type;
      p.guns[it.type] = { ...it.ammo };
    }
    p.reloadT = 0; p.burst = 0; p.cool = 0.2;
    this.takeItem(it);
    this.ev({ k: 'snd', s: 'snatch', x: it.x, y: it.y, to: p.id });
  }

  // Answer to "Replace which gun?": swap the main or the off-hand gun of the pair for the one on the floor.
  replaceGun(p, itemId, hand) {
    const it = this.items.get(itemId);
    if (!p.alive || !it || !this.nearItems(p).includes(it) || this.pickupAction(p, it) !== 'choose') return;
    const off = this.offOf(p);
    const facing = Math.cos(p.aim) >= 0 ? -60 : 60;
    if (hand === 'off') {
      this.dropItem(off.type, p.body.x, p.body.y - 34, facing, -140, off);
      p.off[p.slot] = { type: it.type, mag: it.ammo.mag, reserve: it.ammo.reserve };
    } else {
      const main = this.activeGun(p);
      if (it.type !== main && p.slots.includes(it.type)) return;
      this.dropItem(main, p.body.x, p.body.y - 30, facing, -120, p.guns[main]);
      delete p.guns[main];
      p.slots[p.slot] = it.type;
      p.guns[it.type] = { ...it.ammo };
    }
    p.reloadT = 0; p.burst = 0; p.cool = 0.2;
    this.takeItem(it);
    this.ev({ k: 'snd', s: 'snatch', x: it.x, y: it.y, to: p.id });
  }

  // ---------------- projectiles ----------------
  spawnProjectile(pr) {
    pr.id = uid();
    this.projectiles.set(pr.id, pr);
    return pr;
  }

  updateProjectiles(dt) {
    for (const pr of this.projectiles.values()) {
      pr.life -= dt;
      const owner = this.players.get(pr.owner);
      if (pr.kind === 'nade') { this.updateNade(pr, owner, dt); continue; }
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      const hitWallX = this.map.solidAt(nx, pr.y), hitWallY = this.map.solidAt(pr.x, ny);
      const victim = this.touching(pr, nx, ny, pr.kind === 'flame' ? 12 : 9);

      if (pr.kind === 'rocket') {
        if (victim || hitWallX || hitWallY || pr.life <= 0) { this.explode(pr.x, pr.y, GUNS.smaw.radius, GUNS.smaw.damage, owner, 'smaw'); this.projectiles.delete(pr.id); continue; }
      } else if (pr.kind === 'emp') {
        if (victim) {
          victim.body.emp = GUNS.emp.stun;
          this.damage(victim, GUNS.emp.damage, owner, 'emp');
        }
        if (victim || hitWallX || hitWallY || pr.life <= 0) {
          this.ev({ k: 'emp', x: Math.round(pr.x), y: Math.round(pr.y) });
          for (const q of this.players.values()) if (q.alive && q !== owner && !(owner && this.friendly(owner, q)) && Math.hypot(q.body.x - pr.x, q.body.y - 25 - pr.y) < 50) q.body.emp = Math.max(q.body.emp, GUNS.emp.stun * 0.6);
          this.projectiles.delete(pr.id);
          continue;
        }
      } else if (pr.kind === 'saw') {
        if (victim && !pr.hit.includes(victim.id)) {
          pr.hit.push(victim.id);
          this.ev({ k: 'blood', x: Math.round(pr.x), y: Math.round(pr.y), dx: Math.sign(pr.vx) });
          this.ev({ k: 'snd', s: 'impale', x: pr.x, y: pr.y });
          this.damage(victim, GUNS.sawgun.damage, owner, 'sawgun');
        }
        if (hitWallX || hitWallY) {
          if (pr.bounces-- <= 0) { this.ev({ k: 'spark', x: Math.round(pr.x), y: Math.round(pr.y) }); this.projectiles.delete(pr.id); continue; }
          if (hitWallX) pr.vx = -pr.vx;
          if (hitWallY) pr.vy = -pr.vy;
          pr.hit.length = 0;
          this.ev({ k: 'snd', s: 'ricochet', x: pr.x, y: pr.y, quiet: 1 });
          continue;
        }
        if (pr.life <= 0) { this.projectiles.delete(pr.id); continue; }
      } else if (pr.kind === 'flame') {
        if (victim && !pr.hit.includes(victim.id)) {
          pr.hit.push(victim.id);
          // [RE] FLAME::calcDamage: max(10, 30 * k), k = how fresh the flame still is; no afterburn
          const k = Math.max(0, Math.min(1, pr.life / pr.maxLife));
          this.damage(victim, Math.max(10, 30 * k), owner, 'flame');
        }
        if (hitWallX || hitWallY || pr.life <= 0) { this.projectiles.delete(pr.id); continue; }
      }
      pr.x = nx;
      pr.y = ny;
    }
  }

  touching(pr, x, y, r) {
    for (const q of this.players.values()) {
      if (!q.alive || q.id === pr.owner) continue;
      if (MODES[this.config.mode].teams && q.team === pr.team && !this.config.friendlyFire) continue;
      const b = q.body, h = bodyHeight(b);
      if (x > b.x - PHYS.WIDTH / 2 - r && x < b.x + PHYS.WIDTH / 2 + r && y > b.y - h - r && y < b.y + r) {
        if (pr.kind !== 'flame' && this.shieldBlocks(q, pr.vx)) {
          pr.vx = -pr.vx * 0.6;
          this.ev({ k: 'snd', s: 'clank', x, y });
          return null;
        }
        return q;
      }
    }
    return null;
  }

  updateNade(pr, owner, dt) {
    const N = NADES[pr.type];
    if (!pr.stuck) {
      pr.vy += PHYS.GRAVITY * this.phys.gravity * dt;
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      let bounced = false;
      if (this.map.solidAt(nx, pr.y)) { pr.vx = -pr.vx * 0.45; bounced = true; } else pr.x = nx;
      if (this.map.solidAt(pr.x, ny)) { pr.vy = -pr.vy * 0.4; pr.vx *= 0.75; bounced = true; } else pr.y = ny;
      if (bounced) {
        if (N.sticky) { pr.stuck = true; pr.vx = pr.vy = 0; this.ev({ k: 'snd', s: 'proxy', x: pr.x, y: pr.y, quiet: 1 }); }
        else if (Math.abs(pr.vx) + Math.abs(pr.vy) > 120) this.ev({ k: 'snd', s: 'grenade2', x: pr.x, y: pr.y, quiet: 1 });
      }
    }
    if (N.sticky) {
      pr.armed += dt;
      if (pr.armed > N.arm) {
        for (const q of this.players.values()) {
          if (!q.alive || (owner && this.friendly(owner, q) && q !== owner) || q.id === pr.owner) continue;
          if (Math.hypot(q.body.x - pr.x, q.body.y - bodyHeight(q.body) / 2 - pr.y) < N.trigger) { pr.life = 0; break; }
        }
      }
    }
    if (pr.life > 0) return;
    this.projectiles.delete(pr.id);
    if (pr.type === 'gasnade') {
      this.clouds.push({ id: uid(), x: pr.x, y: pr.y, r: N.radius, until: Date.now() + N.cloud * 1000, owner: pr.owner, team: pr.team });
      this.ev({ k: 'gas', x: Math.round(pr.x), y: Math.round(pr.y) });
    } else {
      this.explode(pr.x, pr.y, N.radius, N.damage, owner, pr.type);
    }
  }

  explode(x, y, radius, dmg, owner, type) {
    this.ev({ k: 'boom', x: Math.round(x), y: Math.round(y), r: radius });
    for (const q of this.players.values()) {
      if (!q.alive) continue;
      const cx = q.body.x, cy = q.body.y - bodyHeight(q.body) / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d > radius + 12) continue;
      if (!this.map.lineOfSight(x, y, cx, cy) && !this.map.lineOfSight(x, y - 6, cx, q.body.y - bodyHeight(q.body) + 4)) continue;
      const f = Math.max(0, 1 - Math.max(0, d - 12) / radius);
      const push = 420 * f;
      q.body.vx += ((cx - x) / (d || 1)) * push;
      q.body.vy += ((cy - y) / (d || 1)) * push - 80 * f;
      const self = owner && q.id === owner.id;
      this.damage(q, dmg * Math.pow(f, 0.8) * (self ? 0.5 : 1) * (has(this.config, 'deflector') ? 0.5 : 1), owner, type);
    }
    // chain other explosives
    for (const pr of this.projectiles.values()) {
      if (pr.kind === 'nade' && pr.type !== 'gasnade' && Math.hypot(pr.x - x, pr.y - y) < radius * 0.6) pr.life = Math.min(pr.life, 0.05);
    }
    for (const it of this.items.values()) {
      const d = Math.hypot(it.x - x, it.y - y);
      if (d < radius) { it.rest = false; it.vx += (it.x - x) / (d || 1) * 200; it.vy -= 220; }
    }
  }

  updateClouds(dt) {
    const now = Date.now();
    this.clouds = this.clouds.filter((c) => c.until > now);
    for (const c of this.clouds) {
      const owner = this.players.get(c.owner);
      for (const q of this.players.values()) {
        if (!q.alive || q.id === c.owner) continue;
        if (MODES[this.config.mode].teams && q.team === c.team && !this.config.friendlyFire) continue;
        if (Math.hypot(q.body.x - c.x, q.body.y - 25 - c.y) < c.r) this.damage(q, NADES.gasnade.damage * dt, owner, 'gasnade', true);
      }
    }
  }

  // ---------------- capture the flag ----------------
  updateFlags() {
    const now = Date.now();
    for (const f of this.flags) {
      if (f.carrier) {
        const c = this.players.get(f.carrier);
        if (!c || !c.alive) { f.carrier = 0; continue; }
        f.x = c.body.x; f.y = c.body.y - 40;
        const home = this.flags[c.team];
        if (home.atHome && Math.hypot(c.body.x - home.homeX, c.body.y - home.homeY) < 50) {
          c.caps++;
          this.teamScore[c.team]++;
          c.carrying = -1;
          this.resetFlag(f);
          this.ev({ k: 'cap', id: c.id, team: c.team });
        }
        continue;
      }
      if (!f.atHome && now >= f.returnAt) { this.resetFlag(f); this.ev({ k: 'flag', team: f.team, what: 'return' }); continue; }
      for (const p of this.players.values()) {
        if (!p.alive || Math.hypot(p.body.x - f.x, p.body.y - 25 - f.y) > 40) continue;
        if (p.team === f.team) {
          if (!f.atHome) { this.resetFlag(f); this.ev({ k: 'flag', team: f.team, what: 'return', id: p.id }); }
        } else if (p.carrying < 0) {
          f.carrier = p.id; f.atHome = false; p.carrying = f.team;
          this.ev({ k: 'flag', team: f.team, what: 'take', id: p.id });
        }
        break;
      }
    }
  }

  resetFlag(f) { f.carrier = 0; f.atHome = true; f.x = f.homeX; f.y = f.homeY; }

  dropFlag(p) {
    if (!this.flags || p.carrying < 0) return;
    const f = this.flags[p.carrying];
    p.carrying = -1;
    if (f.carrier !== p.id) return;
    f.carrier = 0;
    const b = newBody(p.body.x, p.body.y);
    settle(this.map, b);
    f.x = b.x; f.y = b.y - 20;
    f.returnAt = Date.now() + FLAG_RETURN * 1000;
    this.ev({ k: 'flag', team: f.team, what: 'drop' });
  }

  checkEnd(now) {
    const mode = this.config.mode, limit = this.config.limit;
    if (now >= this.endsAt) return this.finish('time');
    if (mode === 'ffa') { for (const p of this.players.values()) if (p.kills >= limit) return this.finish('limit'); }
    else if (this.teamScore[0] >= limit || this.teamScore[1] >= limit) return this.finish('limit');
  }

  // ---------------- networking ----------------
  ev(e) { this.events.push(e); }

  snapshot() {
    const events = this.events;
    this.events = [];
    if (this.phase !== 'playing') return;
    const now = Date.now();
    const players = [];
    for (const p of this.players.values()) {
      const b = p.body;
      players.push({
        id: p.id, a: p.alive ? 1 : 0, x: r1(b.x), y: r1(b.y), vx: r1(b.vx), vy: r1(b.vy), aim: r2(p.aim),
        c: b.crouch ? 1 : 0, j: b.jetting ? 1 : 0, g: b.onGround ? 1 : 0, hp: Math.ceil(p.hp), w: p.alive ? this.activeGun(p) : '', w2: p.alive ? this.offOf(p)?.type || '' : '',
        rl: p.reloadT > 0 ? 1 : 0, emp: b.emp > 0 ? 1 : 0, bo: b.boost > 0 ? 1 : 0, sh: p.shieldUntil > now ? 1 : 0, fl: p.carrying ?? -1,
        k: p.kills, d: p.deaths, cp: p.caps, pts: points(p), t: p.team, col: p.color, on: p.connected ? 1 : 0, burn: p.burn > 0 ? 1 : 0,
      });
    }
    const projectiles = [...this.projectiles.values()].map((pr) => ({ id: pr.id, k: pr.kind, t: pr.type, x: r1(pr.x), y: r1(pr.y), vx: r1(pr.vx), vy: r1(pr.vy), s: pr.stuck ? 1 : 0, ...(pr.kind === 'flame' ? { age: r2(1 - pr.life / pr.maxLife), rot: r2(pr.rot) } : {}) }));
    const items = [...this.items.values()].map((it) => ({ id: it.id, t: it.type, x: r1(it.x), y: r1(it.y) }));
    const clouds = this.clouds.map((c) => ({ id: c.id, x: c.x, y: c.y, r: c.r, left: (c.until - now) / 1000 }));
    const flags = this.flags?.map((f) => ({ t: f.team, x: r1(f.x), y: r1(f.y), c: f.carrier, h: f.atHome ? 1 : 0 }));
    const base = { t: 'snap', tick: this.tick, time: Math.max(0, Math.round((this.endsAt - now) / 1000)), ts: this.teamScore, players, projectiles, items, clouds, flags, events };
    for (const p of this.players.values()) {
      const b = p.body;
      const me = {
        id: p.id, ack: p.ack, alive: p.alive, x: b.x, y: b.y, vx: b.vx, vy: b.vy, onGround: b.onGround, crouch: b.crouch,
        fuel: b.fuel, regenWait: b.regenWait, boost: b.boost, emp: b.emp, jetting: b.jetting, charge: b.charge, meleeCool: b.meleeCool, lunge: b.lunge,
        hp: Math.ceil(p.hp), slots: p.slots, slot: p.slot, guns: p.guns, nades: p.nades, nadeSel: p.nadeSel,
        reload: p.reloadT, reloadMax: this.reloadTime(this.activeGun(p)), respawnIn: p.alive ? 0 : Math.max(0, (p.respawnAt - now) / 1000),
        off: p.off, near: p.alive ? this.pickupCandidate(p)?.it.type || null : null,
      };
      send(p.ws, { ...base, me });
    }
  }
}

function send(ws, msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
}

export function settle(map, b) {
  const blocked = (y) => map.rectSolid(b.x - PHYS.WIDTH / 2, y - PHYS.HEIGHT, b.x + PHYS.WIDTH / 2, y);
  // nearest free spot (prefer below: map points sit near the floor), then drop onto the floor
  if (blocked(b.y)) {
    for (let d = 1; d <= 160; d++) {
      if (!blocked(b.y + d)) { b.y += d; break; }
      if (!blocked(b.y - d)) { b.y -= d; break; }
    }
  }
  for (let i = 0; i < 400 && !blocked(b.y + 1); i++) b.y += 1;
  b.onGround = true;
}

export function cleanName(v, fallback = 'Soldier') {
  const n = String(v ?? '').replace(/[^\w .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return n.length >= 2 ? n : fallback;
}

function sanitizeAvatar(a = {}) {
  const n = (v, max) => clampInt(v, 1, max, 1);
  return { head: n(a.head, 17), body: n(a.body, 18), leg: n(a.leg, 17), arm: n(a.arm, 18) };
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

export { TEAM_NAMES, VOICE, isGun };
