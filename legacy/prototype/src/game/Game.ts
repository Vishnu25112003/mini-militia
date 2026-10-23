import { newBotState, botThink } from './ai';
import { AudioEngine } from './audio';
import { Renderer, colorFor } from './renderer';
import { DT, activeWeapon, addPlayer, createWorld, makePlayer, nearestPickup, stepWorld } from './sim';
import { ITEM_NAMES, WEAPONS } from './weapons';
import { emptyInput } from './types';
import type { GrenadeKind, Input, MatchConfig, Player, World } from './types';
import type { NetSession } from '../net/client';

const BOT_NAMES = ['Rook', 'Vex', 'Mako', 'Juno', 'Tank', 'Pixel', 'Ghost', 'Blitz', 'Nova', 'Fang', 'Echo', 'Zed'];

export interface FeedItem { id: number; text: string; color: string; at: number }

export interface BoardRow { id: number; name: string; kills: number; deaths: number; color: string; me: boolean; team: number }

export interface HudState {
  alive: boolean;
  hp: number;
  fuel: number;
  boost: boolean;
  emp: boolean;
  weapon: string;
  mag: number;
  reserve: number;
  reloading: boolean;
  alt: string | null;
  grenades: Record<GrenadeKind, number>;
  gSel: GrenadeKind;
  time: number;
  mode: MatchConfig['mode'];
  teamScore: Record<number, number>;
  scoreLimit: number;
  kills: number;
  deaths: number;
  respawnT: number;
  prompt: string | null;
  over: boolean;
  winner: string;
  feed: FeedItem[];
  board: BoardRow[];
  carrying: boolean;
  paused: boolean;
}

/** Touch input fed from the on-screen sticks. */
export interface TouchState {
  moveX: number; // -1..1
  jet: boolean;
  aimX: number;
  aimY: number;
  fire: boolean;
}

export class Game {
  world: World;
  readonly renderer: Renderer;
  readonly audio: AudioEngine;
  local: Player;
  onHud: (h: HudState) => void = () => {};
  touch: TouchState | null = null;
  paused = false;

  private keys = new Set<string>();
  private pulse = { reload: false, swap: false, grenade: false, pickup: false, melee: false };
  private mouse = { x: 0, y: 0, down: false };
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudT = 0;
  private feed: FeedItem[] = [];
  private feedId = 0;
  private cleanups: (() => void)[] = [];

  private netInput: Input = emptyInput();

  constructor(private canvas: HTMLCanvasElement, config: MatchConfig, audio: AudioEngine, private net: NetSession | null = null) {
    this.audio = audio;
    this.renderer = new Renderer(canvas);

    if (net) {
      // online: the world is a view rebuilt every frame from server snapshots
      this.world = net.view;
      this.local = makePlayer(this.world, 'You', 1, false);
      this.bind();
      return;
    }
    this.world = createWorld(config);
    this.local = addPlayer(this.world, config.playerName || 'You', 1, false);
    const used = new Set<string>();
    for (let i = 0; i < config.bots; i++) {
      let name = BOT_NAMES[i % BOT_NAMES.length];
      while (used.has(name)) name += i;
      used.add(name);
      const blue = this.world.players.filter((p) => p.team === 1).length;
      const orange = this.world.players.filter((p) => p.team === 2).length;
      const team = blue <= orange ? 1 : 2;
      const bot = addPlayer(this.world, name, team, true);
      bot.ai = newBotState(0.4 + Math.random() * 0.45);
    }
    this.bind();
  }

  // ---------- lifecycle ----------
  start() {
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.audio.setJet(0);
  }

  resize() { this.renderer.resize(); }

  togglePause() { this.paused = !this.paused; this.audio.setJet(0); this.emitHud(); }

  // ---------- input ----------
  private bind() {
    const on = (t: Window | HTMLElement, type: string, fn: (e: never) => void) => {
      t.addEventListener(type, fn as EventListener);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener));
    };
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.audio.unlock();
      const k = e.code;
      this.keys.add(k);
      if (k === 'KeyR') this.pulse.reload = true;
      if (k === 'KeyQ' || k === 'Tab') this.pulse.swap = true;
      if (k === 'KeyG') this.pulse.grenade = true;
      if (k === 'KeyE') this.pulse.pickup = true;
      if (k === 'KeyF') this.pulse.melee = true;
      if (k === 'Digit1') this.local.gSel = 'fragnade';
      if (k === 'Digit2') this.local.gSel = 'gasnade';
      if (k === 'Digit3') this.local.gSel = 'proxynade';
      if (k === 'Escape') this.togglePause();
      if (k === 'Tab' || k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.mouse.down = false; });
    on(this.canvas, 'mousemove', (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    on(this.canvas, 'mousedown', (e: MouseEvent) => { this.audio.unlock(); if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.pulse.swap = true; });
    on(window, 'mouseup', (e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; });
    on(this.canvas, 'contextmenu', (e: Event) => e.preventDefault());
    on(this.canvas, 'wheel', (e: WheelEvent) => { if (Math.abs(e.deltaY) > 4) this.pulse.swap = true; });
    this.mouse.x = this.canvas.clientWidth * 0.75;
    this.mouse.y = this.canvas.clientHeight * 0.5;
  }

  pressAction(a: 'reload' | 'swap' | 'grenade' | 'pickup' | 'melee') { this.pulse[a] = true; }

  private applyLocalInput() {
    const p = this.local;
    const i = this.net ? this.netInput : p.input;
    const k = this.keys;
    const t = this.touch;
    const pos = this.net?.localPos ?? { x: p.x, y: p.y };
    i.left = k.has('KeyA') || k.has('ArrowLeft') || (t ? t.moveX < -0.25 : false);
    i.right = k.has('KeyD') || k.has('ArrowRight') || (t ? t.moveX > 0.25 : false);
    i.jet = k.has('KeyW') || k.has('ArrowUp') || k.has('Space') || (t?.jet ?? false);
    i.fire = this.mouse.down || k.has('KeyJ') || (t?.fire ?? false);
    if (t && (t.fire || Math.hypot(t.aimX, t.aimY) > 0.2)) i.aim = Math.atan2(t.aimY, t.aimX);
    else {
      const w = this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
      i.aim = Math.atan2(w.y - (pos.y - 6), w.x - pos.x);
    }
    i.reload = this.pulse.reload; i.swap = this.pulse.swap; i.grenade = this.pulse.grenade;
    i.pickup = this.pulse.pickup; i.melee = this.pulse.melee;
    if (this.net && this.paused) { i.left = i.right = i.jet = i.fire = false; }
  }

  // ---------- frame ----------
  private tickOnline(dt: number, net: NetSession) {
    // the server keeps simulating while the menu is open, so keep sending (neutral) input
    this.acc += dt;
    let guard = 0;
    while (this.acc >= DT && guard++ < 6) {
      this.applyLocalInput();
      net.stepInput(this.netInput);
      this.pulse = { reload: false, swap: false, grenade: false, pickup: false, melee: false };
      this.acc -= DT;
    }
    if (guard >= 6) this.acc = 0;
    const me = net.buildView(performance.now(), dt);
    if (me) this.local = me;
    this.collectFeed();
    this.renderer.handleEvents(this.world, this.local, this.audio);
    this.renderer.draw(this.world, net.ready ? this.local : undefined, dt);
    this.audio.setJet(this.local.alive && this.local.thrusting ? 1 : 0);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.emitHud(); }
  }

  private tick(dt: number) {
    if (this.net) { this.tickOnline(dt, this.net); return; }
    if (!this.paused) {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= DT && guard++ < 6) {
        this.applyLocalInput();
        for (const p of this.world.players) if (p.bot) botThink(this.world, p, DT);
        stepWorld(this.world, DT);
        this.pulse = { reload: false, swap: false, grenade: false, pickup: false, melee: false };
        this.acc -= DT;
      }
      if (guard >= 6) this.acc = 0;
      this.collectFeed();
    }
    this.renderer.handleEvents(this.world, this.local, this.audio);
    this.renderer.draw(this.world, this.local, this.paused ? 0 : dt);
    this.audio.setJet(this.local.alive && this.local.thrusting && !this.paused ? 1 : 0);

    this.hudT -= dt;
    if (this.hudT <= 0 || this.paused) { this.hudT = 0.1; this.emitHud(); }
  }

  private nameOf(id: number) { return this.world.players.find((p) => p.id === id); }

  private pushFeed(text: string, color: string) {
    this.feed.push({ id: this.feedId++, text, color, at: this.world.time });
    if (this.feed.length > 6) this.feed.shift();
  }

  private collectFeed() {
    for (const e of this.world.events) {
      if (e.t === 'kill') {
        const v = this.nameOf(e.victim);
        const k = this.nameOf(e.killer);
        if (!v) continue;
        const wname = e.weapon in WEAPONS ? WEAPONS[e.weapon as keyof typeof WEAPONS].name : e.weapon === 'fall' ? 'fall' : e.weapon;
        this.pushFeed(k && k !== v ? `${k.name} › ${v.name}  (${wname})` : `${v.name} died`, k ? colorFor(this.world, k) : '#ddd');
      } else if (e.t === 'flag') {
        const by = this.nameOf(e.by);
        const team = e.team === 1 ? 'Blue' : 'Orange';
        const msg = e.kind === 'taken' ? `${by?.name} took the ${team} flag` : e.kind === 'dropped' ? `${team} flag dropped` : e.kind === 'returned' ? `${team} flag returned` : `${by?.name} captured the ${team} flag!`;
        this.pushFeed(msg, e.team === 1 ? '#60a5fa' : '#fb923c');
      }
    }
  }

  private emitHud() {
    const w = this.world, p = this.local;
    const ws = activeWeapon(p);
    const d = WEAPONS[ws.id];
    const alt = p.slots[1] ? WEAPONS[p.slots[p.active === 0 ? 1 : 0]!.id].name : null;
    const pi = p.alive ? nearestPickup(w, p) : -1;
    const board: BoardRow[] = [...w.players]
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((q) => ({ id: q.id, name: q.name, kills: q.kills, deaths: q.deaths, color: colorFor(w, q), me: q === p, team: q.team }));
    this.onHud({
      alive: p.alive, hp: Math.max(0, p.hp), fuel: p.fuel, boost: p.boostT > 0, emp: p.empT > 0,
      weapon: d.name, mag: ws.mag, reserve: ws.reserve, reloading: p.reloadT > 0, alt,
      grenades: { ...p.grenades }, gSel: p.gSel,
      time: Math.max(0, w.config.timeLimit - w.time), mode: w.config.mode, teamScore: { ...w.teamScore }, scoreLimit: w.config.scoreLimit,
      kills: p.kills, deaths: p.deaths, respawnT: Math.max(0, p.respawnT),
      prompt: pi >= 0 ? `Press E — ${ITEM_NAMES[w.pickups[pi].item!]}` : null,
      over: w.over, winner: w.winner,
      feed: this.feed.filter((f) => w.time - f.at < 6), board, carrying: p.carrying > 0, paused: this.paused,
    });
  }
}
