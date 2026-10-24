import { assets, loadAssets, spriteURL } from './assets.js';
import { GameMap } from '/shared/map.js';
import { PHYS, newBody, stepBody, tryMelee } from '/shared/physics.js';
import { sanitizeConfig, sanitizeLoadout, MODES, physicsOptions } from '/shared/config.js';
import { initSettings, initEditor } from './ui.js';
import { GUNS, itemSprite } from '/shared/weapons.js';
import { Renderer } from './render.js';
import { Input, BIT } from './input.js';
import { gunPose, MAG_DROP_DELAY } from './soldier.js';
import { Screens } from './screens.js';
import { Net } from './net.js';
import * as fx from './effects.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const VOICE_TEXT = { bringit: 'Bring it on!', cmonboy: "C'mon boy!", getsome: 'Get some!', yeah: 'Yeah!', hoorah: 'Hoorah!', coverme: 'Cover me!', moveout: 'Move out!', niceshot: 'Nice shot!', gotme: 'You got me!', goodgame: 'Good game!', thanks: 'Thanks!', readyup: 'Ready up!' };

const canvas = $('game');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
let map = null;

const state = {
  view: 'home', myId: 0, code: '', urls: [], lobby: null, config: sanitizeConfig({}), myLoadout: loadJSON('catacombs.myLoadout'),
  snaps: [], snapBase: null, lastSnap: null, prevSnap: null, lastSnapAt: 0, snapGap: 1000 / 30,
  me: null, pred: { body: newBody(0, 0), pending: [], seq: 0, alive: false, offX: 0, offY: 0 },
  local: new Map(), // per-player client-only animation state
  shake: 0, hurtFlash: 0,
};

function loadJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

const profile = (() => {
  const p = loadJSON('catacombs.profile') || {};
  return { name: p.name || '', avatar: { head: 1, body: 1, leg: 1, arm: 1, ...(p.avatar || {}) } };
})();
const saveProfile = () => saveJSON('catacombs.profile', profile);

const net = new Net({ onMessage, onStatus });
const send = (m) => net.send(m);

const screens = new Screens({
  state, send, net, profile, saveProfile,
  onLeave: leaveRoom,
  openControls: () => menu.open(),
});
screens.onCreate = () => { unlock(); net.create(profile); };
screens.onJoin = (code) => { unlock(); net.join(code, profile); };
screens.onBackToLobby = () => go('lobby');
screens.onNavigate = (v) => go(v);
screens.onPopup = () => syncInput();
screens.saveMyLoadout = (l) => saveJSON('catacombs.myLoadout', l);

// ---------------- boot ----------------
(async function boot() {
  try {
    await loadAssets((f) => { $('loading-text').textContent = `Loading Catacombs… ${Math.round(f * 100)}%`; });
  } catch {
    $('loading-text').textContent = 'Assets are missing. On the host run: npm run extract -- path/to/the.apk';
    return;
  }
  await document.fonts.load('20px Bebas').catch(() => {});
  map = new GameMap(assets.map);
  renderer.buildMinimap(map);
  screens.paintBackdrops(assets.map, renderer.minimap.canvas);
  screens.drawHomeSoldiers();
  $('loading').hidden = true;
  // a refresh mid-session drops you back into your room
  if (net.resume()) screens.system('reconnecting');
  go('home');
  requestAnimationFrame(frame);
})();

function unlock() {
  audio.unlockAudio();
  audio.preload(['jet', 'ak47', 'uzi', 'deagle', 'explode', 'reload', 'snatch', 'death1']);
  // phones: go full screen and hold landscape where the browser allows it
  if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}

function go(view) {
  state.view = view;
  screens.show(view === 'final' ? 'game' : view);
  if (view !== 'game' && view !== 'final') audio.setJet(false);
  if (view === 'home') screens.drawHomeSoldiers();
  syncInput();
}

function syncInput() {
  const blocked = screens.anyOpen() || menu?.isOpen() || editor?.isOpen() || !$('system').hidden;
  input.enabled = state.view === 'game' && !blocked;
  if (!input.enabled) input.reset();
}

function leaveRoom() {
  net.leave();
  state.lobby = null; state.myId = 0; state.code = '';
  screens.closeAll();
  go('home');
}

// ---------------- network ----------------
function onStatus(s) {
  if (s === 'connected') { screens.hideSystem(); syncInput(); }
  else if (s === 'reconnecting') { screens.system('reconnecting'); syncInput(); }
  else if (s === 'disconnected') {
    screens.system('disconnected', () => { if (!net.resume()) go('home'); else screens.system('reconnecting'); });
    syncInput();
  }
}

function onMessage(m) {
  switch (m.t) {
    case 'joined':
      state.myId = m.id;
      state.code = m.code;
      state.urls = m.urls || [];
      screens.hideSystem();
      if (state.myLoadout) send({ t: 'loadout', loadout: state.myLoadout });
      if (!m.resumed && state.view !== 'game') go('lobby');
      break;
    case 'error': {
      const msg = {
        not_found: ['Room not found.', 'Please check the room code and try again.'],
        full: ['Room is full.', `It already has ${m.max || 8} soldiers.`],
        kicked: ['You were removed from this room.', 'The host has to invite you again.'],
        busy: ['Too many rooms on this server.', 'Try again in a moment.'],
        expired: null,
      }[m.reason];
      if (m.reason === 'expired') { screens.system('gone', () => go('home')); break; }
      if (state.view === 'join' && msg) screens.joinError(...msg);
      else if (msg) { screens.hideSystem(); go('home'); }
      break;
    }
    case 'lobby': onLobby(m); break;
    case 'chat': screens.addChat(m); break;
    case 'chatHistory': $('chat-log').innerHTML = ''; for (const c of m.messages) screens.addChat(c, true); break;
    case 'kicked': screens.closeAll(); screens.system('kicked', () => go('home')); state.lobby = null; break;
    case 'cancelled': screens.closeAll(); screens.system('cancelled', () => go('home')); state.lobby = null; break;
    case 'choice': screens.openReplace(m); break;
    case 'myLoadout': state.myLoadout = sanitizeLoadout(m.loadout); saveJSON('catacombs.myLoadout', state.myLoadout); break;
    case 'start':
      state.config = sanitizeConfig(m.config || {});
      state.snaps = []; state.snapBase = null; state.lastSnap = state.prevSnap = null;
      state.pred.pending = []; state.pred.alive = false;
      $('killfeed').innerHTML = '';
      screens.closeAll();
      go('game');
      banner(MODES[state.config.mode].name);
      audio.play('moveout');
      break;
    case 'snap': onSnap(m); break;
    case 'end':
      state.view = 'final';
      input.showScores = false;
      screens.showFinalBoard(m);
      syncInput();
      audio.play(m.players[0]?.id === state.myId || (MODES[m.mode].teams && m.winner === state.lobby?.players.find((p) => p.id === state.myId)?.team) ? 'hoorah' : 'goodgame');
      break;
  }
}

function onLobby(m) {
  const wasHost = state.lobby?.players.find((p) => p.id === state.myId)?.host;
  m.config = sanitizeConfig(m.config || {});
  state.lobby = m;
  state.config = m.config;
  if (m.code) state.code = m.code;
  const isHost = m.players.find((p) => p.id === state.myId)?.host;
  // like GameCustomizeLayer::saveGameSettings / loadSaveGameSettings: the host's rules live on the host's device
  if (isHost && m.phase === 'lobby') {
    if (!wasHost && m.players.length === 1) {
      const saved = loadJSON('catacombs.hostConfig');
      if (saved) send({ t: 'config', ...saved });
    } else saveJSON('catacombs.hostConfig', m.config);
  }
  screens.renderLobby();
  if (m.phase === 'lobby' && (state.view === 'game' || state.view === 'final' || state.view === 'home' || state.view === 'join')) {
    screens.hideBoard();
    go('lobby');
  }
}

// ---------------- snapshots ----------------
function onSnap(s) {
  if (state.view !== 'game' && state.view !== 'final') return;
  const now = performance.now();
  if (state.lastSnap) state.snapGap = state.snapGap * 0.9 + (now - state.lastSnapAt) * 0.1;
  state.prevSnap = state.lastSnap;
  state.lastSnap = s;
  state.lastSnapAt = now;
  state.me = s.me;
  // Remote soldiers are drawn from this buffer by server tick, a little in the past (see remoteAt),
  // so late or bunched packets don't turn into stutter. snapBase is when tick 0 would have arrived
  // with the least delay seen: it follows early packets at once and late ones only slowly.
  const base = now - s.tick * TICK_MS;
  if (state.snapBase === null || base < state.snapBase || base - state.snapBase > 1000) state.snapBase = base;
  else state.snapBase += (base - state.snapBase) * 0.01;
  const byId = new Map(s.players.map((p) => [p.id, p]));
  state.snaps.push({ tick: s.tick, byId });
  if (state.snaps.length > 30) state.snaps.shift();

  for (const p of s.players) {
    let l = state.local.get(p.id);
    if (!l) { l = { phase: 0, recoil: 0, recoil2: 0, meleeT: 0, lastShot: -1e9, flash: 0, flash2: 0, reloadT: 0, rl: 0 }; state.local.set(p.id, l); }
    if (p.rl && !l.rl) { l.reloadT = 0.0001; l.magDropped = false; l.reloadGun = p.w; l.reloadGun2 = p.w2; }
    if (!p.rl || !p.a) { l.reloadT = 0; }
    l.rl = p.a ? p.rl : 0;
  }

  // reconcile own movement: server state + replay of inputs it has not processed yet
  const pr = state.pred, me = s.me;
  if (me.alive) {
    const b = pr.body;
    const beforeX = b.x + pr.offX, beforeY = b.y + pr.offY;
    if (!pr.alive) { pr.pending = []; pr.offX = pr.offY = 0; }
    Object.assign(b, { x: me.x, y: me.y, vx: me.vx, vy: me.vy, onGround: me.onGround, crouch: me.crouch, fuel: me.fuel, regenWait: me.regenWait, boost: me.boost, emp: me.emp, jetting: me.jetting, charge: me.charge ?? 0, meleeCool: me.meleeCool ?? 0, lunge: me.lunge ?? 0 });
    pr.pending = pr.pending.filter((i) => i.s > me.ack);
    const opts = physicsOptions(state.config);
    for (const i of pr.pending) {
      stepBody(b, { mx: i.x, jet: i.b & BIT.jet, crouch: i.b & BIT.crouch }, map, PHYS.TICK, opts);
      if (i.b & BIT.melee) tryMelee(b, i.a);
    }
    if (pr.alive) {
      pr.offX = beforeX - b.x; pr.offY = beforeY - b.y;
      if (Math.hypot(pr.offX, pr.offY) > 60) pr.offX = pr.offY = 0; // teleport (respawn, big knockback)
    }
  }
  // death or respawn: drop whatever was held, so nothing fires by itself after spawning
  if (pr.alive !== me.alive) input.reset();
  pr.alive = me.alive;

  for (const e of s.events) handleEvent(e, s);
}

function playerPos(id) {
  if (id === state.myId && state.pred.alive) return state.pred.body;
  const p = state.lastSnap?.players.find((o) => o.id === id);
  const r = p?.a && remoteAt(id, performance.now());
  return r ? { ...p, ...r } : p; // where the soldier is drawn, so muzzle effects line up
}

function lobbyPlayer(id) { return state.lobby?.players.find((p) => p.id === id); }

// Rounds still flying, keyed by where they stop, so hit effects can wait for them.
const inFlight = new Map();
function onArrival(x, y, fn) {
  const b = inFlight.get(`${x},${y}`);
  if (b && !b.done) b.onEnd.push(fn); else fn();
}
// Relative casing size per gun (WeaponFactory::getShellScale); 0 = no casing ejected on fire.
const SHELL_SCALE = { shotgun: 1.5, aa12: 1.4, m1881: 1.5, m93ba: 1.4, m14: 1.25, deagle: 0.9, gdeagle: 0.9, magnum: 0, uzi: 0.8, tec9: 0.8, mp5: 0.85, phasr: 0, minigun: 1 };

function handleEvent(e, s) {
  const p = e.id ? playerPos(e.id) : null;
  switch (e.k) {
    case 'fire': {
      const g = GUNS[e.w];
      const l = state.local.get(e.id);
      if (l) {
        if (e.h) l.recoil2 = 1; else l.recoil = 1;
        l.lastShot = performance.now();
        if (g?.kind === 'hitscan') {
          if (e.h) l.flash2 = 0.06; else { l.flash = 0.06; l.flashSeed = Math.random(); }
          if (SHELL_SCALE[e.w] !== 0) { l.pendingShells = (l.pendingShells || 0) + 1; l.shellGun = e.w; }
        }
      }
      if (p) audio.play(g?.sound, p.x, p.y, { volume: e.id === state.myId ? 0.8 : 0.9, minGap: 0.02 });
      break;
    }
    case 'shot': {
      // a visible round flies at the original's bullet speed; its impact effect waits for it to arrive
      const b = fx.bullet(e.x0, e.y0, e.x1, e.y1, e.w);
      inFlight.set(`${e.x1},${e.y1}`, b);
      break;
    }
    case 'blood': {
      const hit = () => { fx.blood(e.x, e.y, e.dx); audio.play(['impact', 'impact2', 'impact3'][Math.floor(Math.random() * 3)], e.x, e.y, { volume: 0.5 }); };
      onArrival(e.x, e.y, hit);
      break;
    }
    case 'spark': {
      const b = inFlight.get(`${e.x},${e.y}`);
      const hit = () => { fx.groundHit(e.x, e.y, b?.dx || 0, b?.dy || 0); if (Math.random() < 0.25) audio.play('ricochet', e.x, e.y, { volume: 0.4 }); };
      onArrival(e.x, e.y, hit);
      break;
    }
    case 'boom': {
      fx.explosion(e.x, e.y, e.r);
      audio.play('explode', e.x, e.y);
      const d = Math.hypot(e.x - renderer.cam.x, e.y - renderer.cam.y);
      state.shake = Math.max(state.shake, Math.max(0, 1 - d / 600) * 10);
      break;
    }
    case 'gas': fx.gas(e.x, e.y); audio.play('gas', e.x, e.y); break;
    case 'emp': fx.empBurst(e.x, e.y); audio.play('energy', e.x, e.y); break;
    case 'snd': audio.play(e.s, e.x, e.y, { volume: e.quiet ? 0.5 : 1 }); break;
    case 'melee': { const l = state.local.get(e.id); if (l) l.meleeT = 0.25; break; }
    case 'hurt': if (e.id === state.myId) state.hurtFlash = 1; break;
    case 'spawn': if (e.id === state.myId) { state.pred.pending = []; state.pred.offX = state.pred.offY = 0; } break;
    case 'kill': {
      const victim = lobbyPlayer(e.id);
      fx.gibs(e.x, e.y, victim?.avatar || { head: 1, body: 1, leg: 1, arm: 1 }, Math.random() < 0.5 ? -1 : 1);
      audio.play(e.s, e.x, e.y);
      addFeed(e);
      if (e.by === state.myId && e.id !== state.myId) banner(`You fragged ${victim?.name || 'someone'}`, 1400);
      break;
    }
    case 'voice': {
      const pp = playerPos(e.id);
      audio.play(e.v, pp?.x, pp?.y, { volume: 1 });
      addFeedText(`${lobbyPlayer(e.id)?.name || '?'}: ${VOICE_TEXT[e.v] || e.v}`);
      break;
    }
    case 'flag': {
      const team = e.team === 0 ? 'Blue' : 'Orange';
      const who = e.id ? lobbyPlayer(e.id)?.name : '';
      banner({ take: `${who} took the ${team} flag`, drop: `${team} flag dropped`, return: `${team} flag returned` }[e.what], 1800);
      audio.play(e.what === 'take' ? 'snatch' : 'checkpoint');
      break;
    }
    case 'cap':
      banner(`${lobbyPlayer(e.id)?.name} captured for ${e.team === 0 ? 'Blue' : 'Orange'}!`, 2200);
      audio.play('hoorah');
      break;
  }
}

// ---------------- HUD (DOM parts) ----------------
const COLORS = ['#ff4b3e', '#b05cff', '#ffd23f', '#3fd4ff', '#5ee05a', '#ff9a2e', '#ff6fc3', '#f2f2f2'];
function nameSpan(p) {
  const s = document.createElement('span');
  s.textContent = p?.name || '?';
  s.style.color = MODES[state.config.mode].teams ? ['#7fb2ff', '#ffad5c'][p?.team] : COLORS[p?.color] || '#fff';
  return s;
}
function addFeed(e) {
  const victim = lobbyPlayer(e.id), killer = e.by ? lobbyPlayer(e.by) : null;
  const li = document.createElement('li');
  if (killer && killer.id !== e.id) li.append(nameSpan(killer));
  const icon = itemSprite(e.w) || (e.w === 'machete' ? 'machete' : null);
  if (icon) { const img = document.createElement('img'); img.src = spriteURL(icon); img.alt = GUNS[e.w]?.name || e.w; li.append(img); }
  else { const s = document.createElement('span'); s.textContent = e.w === 'fall' ? 'fell' : 'x'; li.append(s); }
  li.append(nameSpan(victim));
  pushFeed(li);
}
function addFeedText(text) {
  const li = document.createElement('li');
  li.textContent = text;
  pushFeed(li);
}
function pushFeed(li) {
  const feed = $('killfeed');
  feed.append(li);
  while (feed.children.length > 5) feed.firstChild.remove();
  setTimeout(() => li.remove(), 6000);
}

let bannerTimer = 0;
function banner(text, ms = 1600) {
  const b = $('banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
}

$('timer').onclick = () => { input.showScores = !input.showScores; };
$('hud-chat').onclick = () => screens.openChat();
$('zoom-chip').onclick = () => { input.zoomToggle = !input.zoomToggle; };
input.onVoice = (v) => send({ t: 'voice', v });
addEventListener('keydown', (e) => {
  // Enter or T opens chat in a match
  if (state.view === 'game' && input.enabled && (e.code === 'Enter' || e.code === 'KeyT')) { e.preventDefault(); screens.openChat(); }
});

// ---------------- controls & settings ----------------
let tucked = [];
const editor = initEditor({
  input,
  handleAt: (x, y) => {
    const h = renderer.handles;
    if (!h) return null;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (Math.abs(x - (h.cx + sx * (h.r + 6))) < 16 && Math.abs(y - (h.cy + sy * (h.r + 6))) < 16) return h;
    }
    return null;
  },
  onClose: () => {
    for (const el of tucked) el.hidden = false;
    tucked = [];
    renderer.handles = null;
    menu.open();
  },
});
const menu = initSettings({
  input, audio,
  onOpen: () => syncInput(),
  onClose: () => syncInput(),
  openEditor: () => {
    tucked = [...document.querySelectorAll('.screen:not([hidden]), #hud:not([hidden]), #board:not([hidden])')];
    for (const el of tucked) el.hidden = true;
    input.touchMode = true; input.layout(); editor.open();
    syncInput();
  },
});
input.onMenu = () => menu.open();

// ---------------- frame loop ----------------
let lastT = performance.now(), acc = 0, hudAt = 0, boardAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (editor.isOpen() && (state.view !== 'game' || !state.lastSnap)) {
    // placement editor outside a match: draw the controls over the map
    const ctx = renderer.ctx;
    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, renderer.w, renderer.h);
    renderer.drawTouch(input, null, 1, editor.selected());
    return;
  }
  if (state.view !== 'game' && state.view !== 'final') return;
  if (!state.lastSnap) { renderer.ctx.fillStyle = '#120d08'; renderer.ctx.fillRect(0, 0, renderer.canvas.width, renderer.canvas.height); return; }

  // fixed 60 Hz input + prediction
  const physOpts = physicsOptions(state.config);
  acc += dt;
  const pr = state.pred;
  while (acc >= PHYS.TICK) {
    acc -= PHYS.TICK;
    if (state.view !== 'game') continue;
    const i = input.sample();
    if (!pr.alive || !input.enabled) continue;
    i.s = ++pr.seq;
    send({ t: 'in', s: i.s, x: i.x, b: i.b, a: i.a });
    stepBody(pr.body, { mx: i.x, jet: i.b & BIT.jet, crouch: i.b & BIT.crouch }, map, PHYS.TICK, physOpts);
    if (i.b & BIT.melee) tryMelee(pr.body, i.a); // same order as the server: move, then swing
    pr.pending.push(i);
    if (pr.pending.length > 120) pr.pending.shift();
  }
  pr.offX *= Math.pow(0.0005, dt); pr.offY *= Math.pow(0.0005, dt);

  const world = buildWorld(now, dt);
  const me = state.me;
  const self = world.soldiers.find((s) => s.me);

  // camera with aim look-ahead
  let cx = self ? self.x : renderer.cam.x, cy = self ? self.y - 30 : renderer.cam.y;
  if (self?.alive) {
    if (input.touchMode) { cx += Math.cos(input.aim) * 70; cy += Math.sin(input.aim) * 50; }
    else { cx += (input.mouse.x - renderer.w / 2) / renderer.cam.zoom * 0.25; cy += (input.mouse.y - renderer.h / 2) / renderer.cam.zoom * 0.25; }
  }
  const gun = GUNS[me?.slots?.[me.slot]];
  const zoomMul = input.zoomToggle && gun?.zoom ? gun.zoom : 1;
  if (state.shake > 0) { cx += (Math.random() - 0.5) * state.shake; cy += (Math.random() - 0.5) * state.shake; state.shake *= Math.pow(0.02, dt); }
  const halfW = renderer.w / 2 / renderer.cam.zoom, halfH = renderer.h / 2 / renderer.cam.zoom;
  cx = Math.max(halfW, Math.min(map.width - halfW, cx));
  cy = Math.max(halfH, Math.min(map.height - halfH, cy));
  renderer.setCamera(cx, cy, zoomMul);
  audio.listener.x = renderer.cam.x; audio.listener.y = renderer.cam.y;
  audio.setJet(!!(self?.alive && self.j));

  if (self) {
    const sp = renderer.worldToScreen(self.x, self.y - 31);
    input.player.x = sp.x; input.player.y = sp.y;
  }

  fx.setGravity(state.config.gravity);
  fx.updateEffects(dt, map, now / 1000);
  for (const [k, b] of inFlight) if (b.done) inFlight.delete(k);
  renderer.draw(world, now / 1000);
  renderer.hideTouch = editor.isOpen() || state.view === 'final';
  renderer.drawHud(world, me, input, now / 1000);
  if (editor.isOpen()) renderer.drawTouch(input, me, 1, editor.selected());
  if (state.hurtFlash > 0) {
    const ctx = renderer.ctx;
    ctx.fillStyle = `rgba(200, 20, 10, ${0.16 * state.hurtFlash})`;
    ctx.fillRect(0, 0, renderer.w, renderer.h);
    state.hurtFlash = Math.max(0, state.hurtFlash - dt * 3);
  }

  // DOM HUD and leaderboards at ~10 Hz
  if (now - hudAt > 100) {
    hudAt = now;
    screens.updateHud(me, state.lastSnap, input.zoomToggle, gun?.zoom ? Math.round(gun.zoom * 10) / 10 : 0);
  }
  if (state.view === 'game' && now - boardAt > 200) {
    boardAt = now;
    const kind = screens.boardKind();
    if (me && !me.alive) screens.showRespawnBoard(state.lastSnap, me.respawnIn);
    else if (input.showScores) screens.showLiveBoard(state.lastSnap);
    else if (kind === 'respawn' || kind === 'live') screens.hideBoard();
  }
}

const TICK_MS = 1000 / 60;
const INTERP_TICKS = 4; // two 30 Hz snapshots behind the newest

// A remote player's position at render time, interpolated between the buffered snapshots around it.
function remoteAt(id, now) {
  const snaps = state.snaps;
  if (!snaps.length || state.snapBase === null) return null;
  const rt = (now - state.snapBase) / TICK_MS - INTERP_TICKS;
  for (let i = snaps.length - 1; i > 0; i--) {
    const a = snaps[i - 1], b = snaps[i];
    if (a.tick > rt) continue;
    if (rt > b.tick) break;
    const p = a.byId.get(id), q = b.byId.get(id);
    if (!p || !q || !p.a || !q.a || Math.hypot(q.x - p.x, q.y - p.y) > 80) return q && q.a ? q : null;
    const k = (rt - a.tick) / Math.max(1, b.tick - a.tick);
    let da = q.aim - p.aim;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, aim: p.aim + da * k };
  }
  if (rt < snaps[0].tick) { const o = snaps[0].byId.get(id); return o && o.a ? o : null; }
  // newer than anything buffered (a late packet): carry on along the last velocity for up to 100 ms
  const last = snaps[snaps.length - 1], q = last.byId.get(id);
  if (!q || !q.a) return null;
  const ahead = Math.min(0.1, Math.max(0, (rt - last.tick) * TICK_MS / 1000));
  return { x: q.x + q.vx * ahead, y: q.y + q.vy * ahead, aim: q.aim };
}

function buildWorld(now, dt) {
  const s = state.lastSnap;
  const since = Math.min(0.1, (now - state.lastSnapAt) / 1000);
  const teams = MODES[state.config.mode].teams;
  const soldiers = [];
  for (const p of s.players) {
    const lp = lobbyPlayer(p.id);
    const l = state.local.get(p.id) || { phase: 0, recoil: 0, meleeT: 0 };
    let x = p.x, y = p.y, aim = p.aim, vx = p.vx;
    const isMe = p.id === state.myId;
    if (isMe && state.pred.alive) {
      const b = state.pred.body;
      x = b.x + state.pred.offX; y = b.y + state.pred.offY; aim = input.aim; vx = b.vx;
    } else {
      const r = p.a ? remoteAt(p.id, now) : null;
      if (r) ({ x, y, aim } = r);
    }
    l.phase += Math.abs(vx) * dt * 0.075;
    l.recoil = Math.max(0, l.recoil - dt * 10);
    l.recoil2 = Math.max(0, (l.recoil2 || 0) - dt * 10);
    l.meleeT = Math.max(0, l.meleeT - dt);
    l.flash = Math.max(0, (l.flash || 0) - dt);
    l.flash2 = Math.max(0, (l.flash2 || 0) - dt);
    if (l.reloadT > 0) l.reloadT += dt;
    const b = isMe && state.pred.alive ? state.pred.body : null;
    soldiers.push({
      id: p.id, me: isMe, alive: !!p.a, x, y, vx, aim, hp: p.hp, k: p.k, d: p.d, cp: p.cp, col: p.col,
      c: b ? b.crouch : p.c, j: b ? b.jetting : p.j, g: b ? b.onGround : p.g, w: p.w, w2: p.w2, emp: p.emp, burn: p.burn, shield: p.sh, fl: p.fl,
      team: teams ? p.t : -1, avatar: lp?.avatar, name: lp?.name || '?', phase: l.phase, recoil: l.recoil, recoil2: l.recoil2, meleeT: l.meleeT, lastShot: l.lastShot,
      flash: l.flash, flash2: l.flash2, flashSeed: l.flashSeed, rl: l.rl, reloadT: l.reloadT,
    });
    const sol = soldiers[soldiers.length - 1];
    if (sol.alive && (l.pendingShells || (l.reloadT > MAG_DROP_DELAY && !l.magDropped))) {
      const pose = gunPose(sol);
      for (; l.pendingShells > 0; l.pendingShells--) fx.shell(pose.eject.x, pose.eject.y, pose.angle, pose.facing, SHELL_SCALE[l.shellGun || sol.w] ?? 1);
      if (l.reloadT > MAG_DROP_DELAY && !l.magDropped) {
        l.magDropped = true;
        const drop = (type, dy) => {
          const g = GUNS[type];
          if (g) fx.dropMag(`${g.sprite}Mag`, pose.magWell.x, pose.magWell.y + dy, pose.angle + (pose.facing > 0 ? 1.4 : -1.4), pose.facing, vx * 0.5);
        };
        if (sol.w === l.reloadGun) drop(sol.w, 0);
        if (sol.w2 && sol.w2 === l.reloadGun2) drop(sol.w2, 4);
      }
    }
    l.pendingShells = 0;
  }
  // draw self last so it is never hidden behind others
  soldiers.sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
  const projectiles = s.projectiles.map((p) => {
    if (p.s) return p;
    const g = p.k === 'nade' ? PHYS.GRAVITY * (state.config.gravity ?? 1) : 0;
    return { ...p, x: p.x + p.vx * since, y: p.y + p.vy * since + 0.5 * g * since * since };
  });
  return {
    soldiers, projectiles, items: s.items, clouds: s.clouds, flags: s.flags, teams, teamScore: s.ts, time: s.time,
    limit: state.config.limit, playing: state.view === 'game',
  };
}

// read-only handle for automated browser tests
Object.defineProperty(window, '__catacombs', { value: { state, renderer, input, net, screens } });
