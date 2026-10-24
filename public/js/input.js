// Keyboard + mouse and touch dual-stick input, sampled once per 60 Hz simulation tick.
// Bits match server/game.mjs applyInput: 1 jet, 2 crouch, 4 fire, 8 reload, 16 swap, 32 throw, 64 nade cycle, 128 melee, 256 pickup.
import { settings, onChange, SIZE_MIN, SIZE_MAX } from './settings.js';

export const BIT = { jet: 1, crouch: 2, fire: 4, reload: 8, swap: 16, throw: 32, nade: 64, melee: 128, pickup: 256 };
const HELD = new Set(['left', 'right', 'jet', 'crouch', 'fire']);
export const VOICE_KEYS = { Digit1: 'bringit', Digit2: 'cmonboy', Digit3: 'getsome', Digit4: 'yeah', Digit5: 'coverme', Digit6: 'niceshot', Digit7: 'gotme', Digit8: 'goodgame' };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set(); // actions currently held
    this.edges = 0;
    this.mouse = { x: 0, y: 0 };
    this.clicked = false;
    this.aim = 0;
    this.player = { x: 0, y: 0 };
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.sticks = { move: null, aim: null };
    this.buttons = [];
    this.zoomToggle = false;
    this.showScores = false;
    this.onVoice = null;
    this.onMenu = null;
    this.onGear = null;
    this.enabled = false;
    this.capture = null; // key-binding capture callback
    this.layout();
    onChange(() => this.layout());
    this.bind();
  }

  actionsFor(code) {
    if (!code) return []; // some phone keyboards and pads send an empty code; it must not match empty slots
    const keys = settings().keys;
    return Object.keys(keys).filter((a) => keys[a].includes(code));
  }

  press(code) {
    for (const a of this.actionsFor(code)) {
      if (a === 'scores') this.showScores = true;
      else if (a === 'zoom') this.zoomToggle = !this.zoomToggle;
      else if (HELD.has(a)) { this.held.add(a); if (a === 'fire') this.clicked = true; }
      else this.edges |= BIT[a];
    }
  }

  release(code) {
    for (const a of this.actionsFor(code)) {
      if (a === 'scores') this.showScores = false;
      else this.held.delete(a);
    }
  }

  bind() {
    addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); this.capture(e.code); return; }
      if (e.code === 'Escape' && this.enabled) { this.onMenu?.(); return; }
      if (!this.enabled || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Tab' || ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.press(e.code);
      if (VOICE_KEYS[e.code]) this.onVoice?.(VOICE_KEYS[e.code]);
    });
    addEventListener('keyup', (e) => this.release(e.code));
    addEventListener('blur', () => { this.held.clear(); this.showScores = false; });

    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { if (this.enabled) this.edges |= BIT.swap; e.preventDefault(); }, { passive: false });
    c.addEventListener('pointerdown', (e) => {
      // keep receiving this pointer even if an overlay (respawn board, popup) opens on top of the canvas
      try { c.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      if (e.pointerType === 'touch') { this.touchMode = true; this.touchStart(e); return; }
      this.touchMode = false;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (e.button === 1) e.preventDefault();
      if (this.onGear?.(e.clientX, e.clientY)) return;
      if (this.enabled) this.press(`Mouse${e.button}`);
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') { this.touchMove(e); return; }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    const up = (e) => {
      if (e.pointerType === 'touch') { this.touchEnd(e); return; }
      this.release(`Mouse${e.button}`);
    };
    // releases are heard anywhere, so a finger or button lifted over an overlay never stays "held"
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    // while rebinding, a mouse button on the capture button binds that button
    addEventListener('mousedown', (e) => {
      if (this.capture && e.target.closest?.('[data-capture]')) { e.preventDefault(); e.stopPropagation(); this.capture(`Mouse${e.button}`); }
    }, true);
    addEventListener('resize', () => this.layout());
  }

  // Forget everything held: on death, on respawn and whenever an overlay takes the screen.
  reset() {
    this.held.clear();
    this.clicked = false;
    this.edges = 0;
    this.sticks.move = this.sticks.aim = null;
    this.touchCrouch = false;
  }

  // ---------- touch ----------
  // Default positions (the original's arc around the fire pad); the player's saved placement goes on top.
  // Default positions follow sheet 8: move stick bottom-left with the grenade button beside it,
  // melee + swap in a row left of the aim pad, pickup above the aim pad on the right edge.
  defaultLayout() {
    const w = innerWidth, h = innerHeight;
    const s = Math.min(1, Math.max(0.62, Math.min(w, h) / 420));
    const fireR = 82 * s, moveR = 72 * s, r = 30 * s;
    const fx = w - fireR - 22 * s, fy = h - fireR - 18 * s;
    const move = { x: moveR + 26 * s, y: h - moveR - 20 * s, r: moveR };
    return {
      s, move, fire: { x: fx, y: fy, r: fireR },
      buttons: [
        { id: 'throw', sprite: 'grenadeBtn', x: move.x + moveR + 52 * s, y: h - r - 22 * s, r },
        { id: 'nade', sprite: 'nadeSwitchBtn', x: move.x + moveR + 52 * s, y: h - r * 3 - 34 * s, r: r * 0.75 },
        { id: 'crouch', sprite: 'crouchShield', x: move.x + moveR + 112 * s, y: h - r - 22 * s, r: r * 0.8 },
        { id: 'melee', sprite: 'meleeBtn', x: fx - fireR - 120 * s, y: fy + 26 * s, r },
        { id: 'swap', sprite: 'wepSwitchBtn', x: fx - fireR - 50 * s, y: fy + 26 * s, r },
        { id: 'reload', sprite: 'ammoBtn', x: fx - fireR - 50 * s, y: fy - 44 * s, r: r * 0.8 },
      ],
    };
  }

  layout() {
    const w = innerWidth, h = innerHeight;
    const t = settings().touch;
    const d = this.defaultLayout();
    this.scale = d.s;
    const place = (id, ctl) => {
      let { x, y } = ctl;
      if (t.swap) x = w - x; // sticks and buttons trade sides
      const p = t.pos[id];
      if (p) { x = p[0] * w; y = p[1] * h; }
      const k = Math.max(SIZE_MIN, Math.min(SIZE_MAX, t.size[id] ?? 1));
      return { ...ctl, id, x, y, r: ctl.r * k, baseR: ctl.r };
    };
    this.movePad = place('move', d.move);
    this.firePad = place('fire', d.fire);
    this.buttons = [
      ...d.buttons.map((b) => place(b.id, b)),
      { id: 'pickup', sprite: null, x: this.firePad.x + (t.swap ? 30 : -6) * d.s, y: this.firePad.y - this.firePad.r - 52 * d.s, r: 34 * d.s, dynamic: true },
      { id: 'scores', sprite: null, x: w / 2, y: 26, r: 40 },
    ];
  }

  hitButton(x, y) {
    return this.buttons.find((b) => (!b.dynamic || b.visible) && Math.hypot(x - b.x, y - b.y) < b.r * 1.25);
  }

  touchStart(e) {
    if (this.onGear?.(e.clientX, e.clientY)) return;
    if (!this.enabled) return;
    const x = e.clientX, y = e.clientY;
    const b = this.hitButton(x, y);
    if (b) {
      if (b.id === 'zoom') this.zoomToggle = !this.zoomToggle;
      else if (b.id === 'scores') this.showScores = !this.showScores;
      else if (b.id === 'crouch') { this.touchCrouch = !this.touchCrouch; }
      else this.edges |= BIT[b.id];
      b.pressed = performance.now();
      return;
    }
    // each stick owns the half of the screen it sits on
    const moveLeft = this.movePad.x < this.firePad.x;
    const onMoveSide = moveLeft ? x < innerWidth * 0.45 : x > innerWidth * 0.55;
    if (onMoveSide && !this.sticks.move) {
      this.sticks.move = { id: e.pointerId, ox: x, oy: y, x, y };
    } else if (!onMoveSide && !this.sticks.aim) {
      const p = this.firePad;
      const onPad = Math.hypot(x - p.x, y - p.y) < p.r * 1.4;
      this.sticks.aim = { id: e.pointerId, ox: onPad ? p.x : x, oy: onPad ? p.y : y, x, y };
    }
  }

  touchMove(e) {
    for (const k of ['move', 'aim']) {
      const s = this.sticks[k];
      if (s && s.id === e.pointerId) { s.x = e.clientX; s.y = e.clientY; }
    }
  }

  touchEnd(e) {
    for (const k of ['move', 'aim']) if (this.sticks[k]?.id === e.pointerId) this.sticks[k] = null;
  }

  stickVec(s, r) {
    if (!s) return { x: 0, y: 0, m: 0 };
    let dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    const m = Math.min(1, d / r);
    if (d > 0) { dx /= d; dy /= d; }
    return { x: dx * m, y: dy * m, m };
  }

  // ---------- sampling ----------
  sample() {
    let x = 0, bits = 0;
    if (this.touchMode) {
      const t = settings().touch;
      const mv = this.stickVec(this.sticks.move, this.movePad.r);
      if (t.moveInvert) { mv.x = -mv.x; mv.y = -mv.y; }
      x = Math.abs(mv.x) > 0.12 ? mv.x : 0;
      if (mv.y < -0.42) bits |= BIT.jet;
      if (mv.y > 0.6 || this.touchCrouch) bits |= BIT.crouch;
      const av = this.stickVec(this.sticks.aim, this.firePad.r);
      if (t.aimInvert) { av.x = -av.x; av.y = -av.y; }
      if (av.m > 0.1) this.aim = Math.atan2(av.y, av.x);
      if (av.m > (t.fireAt ?? 0.35)) bits |= BIT.fire; // how far the aim stick is pushed before it shoots
    } else {
      const h = this.held;
      if (h.has('left')) x -= 1;
      if (h.has('right')) x += 1;
      if (h.has('jet')) bits |= BIT.jet;
      if (h.has('crouch')) bits |= BIT.crouch;
      // a click shorter than one input tick still fires once
      if (h.has('fire') || this.clicked) bits |= BIT.fire;
      this.clicked = false;
      this.aim = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
    }
    bits |= this.edges;
    this.edges = 0;
    return { x, b: bits, a: Math.round(this.aim * 1000) / 1000 };
  }
}
