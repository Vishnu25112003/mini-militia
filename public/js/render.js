import { assets, sprite, tintedSprite } from './assets.js';
import { drawSoldier, TEAM_COLORS } from './soldier.js';
import { drawEffects, trackTrail, drawTrail, flameSmoke as trackSmoke } from './effects.js';
import { settings } from './settings.js';
import { GUNS, NADES, itemSprite, itemName } from '/shared/weapons.js';

const FONT = 'Bebas, sans-serif';
const PLAYER_COLORS = ['#ff4b3e', '#b05cff', '#ffd23f', '#3fd4ff', '#5ee05a', '#ff9a2e', '#ff6fc3', '#f2f2f2'];
const VIEW_W = 820, VIEW_H = 480;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.minimap = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.baseZoom = Math.min(this.w / VIEW_W, this.h / VIEW_H) * (this.w < 700 || this.h < 450 ? 1.15 : 1);
  }

  buildMinimap(map) {
    const c = document.createElement('canvas');
    const k = 4; // collision cells per minimap pixel
    c.width = Math.ceil(map.cols / k); c.height = Math.ceil(map.rows / k);
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const solid = map.solidCell(x * k + 2, y * k + 2);
      const inside = !solid && x * k > 40 && x * k < map.cols - 40;
      const i = (y * c.width + x) * 4;
      if (solid) img.data.set([196, 172, 118, 235], i);
      else img.data.set(inside ? [60, 46, 30, 200] : [60, 46, 30, 200], i);
    }
    g.putImageData(img, 0, 0);
    this.minimap = { canvas: c, scale: 1 / (map.cell * k) };
  }

  setCamera(x, y, zoomMul) {
    const z = this.baseZoom / zoomMul;
    this.cam.zoom += (z - this.cam.zoom) * 0.15;
    this.cam.x = x; this.cam.y = y;
  }

  worldToScreen(x, y) {
    return { x: (x - this.cam.x) * this.cam.zoom + this.w / 2, y: (y - this.cam.y) * this.cam.zoom + this.h / 2 };
  }

  draw(world, t) {
    const { ctx } = this;
    const map = assets.map;
    const z = this.cam.zoom, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#231a12';
    ctx.fillRect(0, 0, this.w, this.h);

    // parallax desert sky
    const bg = assets.img.bgDesert_new;
    if (bg) {
      const sc = Math.max(this.w / bg.width, this.h / bg.height) * 1.15;
      const bw = bg.width * sc, bh = bg.height * sc;
      const px = -((this.cam.x / (map.width * 64)) * (bw - this.w));
      const py = -((this.cam.y / (map.height * 64)) * (bh - this.h));
      ctx.drawImage(bg, px, py, bw, bh);
    }

    ctx.setTransform(d * z, 0, 0, d * z, d * (this.w / 2 - this.cam.x * z), d * (this.h / 2 - this.cam.y * z));
    const vx0 = this.cam.x - this.w / 2 / z, vy0 = this.cam.y - this.h / 2 / z;
    const vx1 = this.cam.x + this.w / 2 / z, vy1 = this.cam.y + this.h / 2 / z;

    this.drawLayer(map.layers.tilebg, vx0, vy0, vx1, vy1);
    this.drawFlagStations(world);
    this.drawItems(world, t);
    this.drawLayer(map.layers.tile, vx0, vy0, vx1, vy1);
    this.drawClouds(world, t);
    this.drawProjectiles(world, t);
    for (const s of world.soldiers) if (s.alive) drawSoldier(ctx, s, t);
    this.drawFlags(world, t);
    drawEffects(ctx);
    for (const s of world.soldiers) if (s.alive) this.drawNameTag(s, world);
    this.drawRadar(world);
  }

  // [RE] Radar / ArrowAlert: a remote soldier who fires posts RadarAlert, and an arrowAlert.png at the
  // screen edge points at them for ~2 s, tinted with their colour at opacity 200. It grows from 0.5
  // to 0.8 as they get closer (sized over 1296 pt; farther shooters keep the smallest arrow so they
  // can still be found) and hides once they are on screen or dead (RadarAlertHide). In CTF, ArrowAlertRuleUpdate keeps the flags pointed at with arrow.png.
  drawRadar(world) {
    const me = world.soldiers.find((s) => s.me);
    if (!me) return;
    const ctx = this.ctx, d = this.dpr, now = performance.now();
    const pad = 26;
    this.radar = []; // what is pointed at this frame (read by the tests)
    const point = (x, y, img, color, k, id) => {
      const p = this.worldToScreen(x, y);
      if (p.x > -8 && p.x < this.w + 8 && p.y > -8 && p.y < this.h + 8) return;
      this.radar.push(id);
      const cx = this.w / 2, cy = this.h / 2;
      const a = Math.atan2(p.y - cy, p.x - cx);
      const t = Math.min((cx - pad) / Math.abs(Math.cos(a) || 1e-6), (cy - pad) / Math.abs(Math.sin(a) || 1e-6));
      const sc = (0.5 + 0.3 * k) * 0.8 * this.baseZoom;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * t, cy + Math.sin(a) * t);
      ctx.rotate(a);
      ctx.globalAlpha = 200 / 255;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4 * d;
      const tinted = tintedSprite(img, color);
      if (tinted) ctx.drawImage(tinted, -tinted.width * sc / 2, -tinted.height * sc / 2, tinted.width * sc, tinted.height * sc);
      ctx.restore();
    };
    ctx.setTransform(d, 0, 0, d, 0, 0);
    for (const s of world.soldiers) {
      if (s.me || !s.alive || now - s.lastShot > 2000) continue;
      const dist = Math.hypot(s.x - me.x, s.y - me.y);
      const color = world.teams ? TEAM_COLORS[s.team] || '#fff' : PLAYER_COLORS[s.col] || '#fff';
      point(s.x, s.y - 25, 'arrowAlert', color, Math.min(1, Math.max(0.3, (1296 - dist) / 1000)), s.id);
    }
    for (const f of world.flags || []) {
      const carrier = f.c && world.soldiers.find((s) => s.id === f.c);
      point(carrier ? carrier.x : f.x, carrier ? carrier.y - 25 : f.y, 'arrow', TEAM_COLORS[f.t], 0.3, `flag${f.t}`);
    }
  }

  drawLayer(gids, x0, y0, x1, y1) {
    const map = assets.map, ts = map.tileset, img = assets.img.tile64Desert_new;
    const T = map.tile;
    const cx0 = Math.max(0, Math.floor(x0 / T)), cy0 = Math.max(0, Math.floor(y0 / T));
    const cx1 = Math.min(map.width - 1, Math.floor(x1 / T)), cy1 = Math.min(map.height - 1, Math.floor(y1 / T));
    const ctx = this.ctx;
    const pad = 0.6 / this.cam.zoom; // hide seams between tiles
    for (let y = cy0; y <= cy1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        const gid = gids[y * map.width + x];
        if (!gid) continue;
        const i = gid - 1;
        const sx = ts.margin + (i % ts.cols) * (ts.size + ts.spacing), sy = ts.margin + Math.floor(i / ts.cols) * (ts.size + ts.spacing);
        ctx.drawImage(img, sx, sy, ts.size, ts.size, x * T, y * T, T + pad, T + pad);
      }
    }
  }

  drawFlagStations(world) {
    if (!world.flags) return;
    for (const o of assets.map.objects) {
      if (!o.name.startsWith('fp_b_')) continue;
      const img = sprite(o.sprite);
      if (img) this.ctx.drawImage(img, o.x - img.width * 0.2, o.y - img.height * 0.4, img.width * 0.4, img.height * 0.4);
    }
  }

  drawItems(world, t) {
    const ctx = this.ctx;
    for (const it of world.items) {
      const img = sprite(itemSprite(it.t));
      if (!img) continue;
      const sc = NADES[it.t] ? 0.26 : (it.t === 'healthpack' || it.t === 'boosttank') ? 0.2 : 0.19;
      const bob = Math.sin(t * 3 + it.id) * 1.5;
      ctx.drawImage(img, it.x - img.width * sc / 2, it.y - img.height * sc + 8 + bob, img.width * sc, img.height * sc);
    }
  }

  drawProjectiles(world, t) {
    const ctx = this.ctx;
    for (const p of world.projectiles) {
      const a = Math.atan2(p.vy, p.vx);
      if (p.k === 'saw' || p.k === 'nade' || p.k === 'rocket') {
        if (!p.s) trackTrail(p.id, p.x, p.y, t);
        drawTrail(ctx, p.id, p.k === 'saw' ? 6 : p.k === 'rocket' ? 6 : 3, t, p.k === 'saw' ? 0.14 : 0.22, p.k === 'rocket' ? '230,230,230' : '255,255,255');
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.k === 'rocket') {
        ctx.rotate(a);
        const img = sprite('rocket');
        ctx.drawImage(img, -img.width * 0.22, -img.height * 0.11, img.width * 0.22, img.height * 0.22);
      } else if (p.k === 'saw') {
        // SAW::init uses wormDroneSaw.png, spinning fast
        ctx.rotate(t * 28);
        const img = sprite('wormDroneSaw');
        const sz = img.width * 0.24;
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      } else if (p.k === 'flame') {
        // [RE] FLAME::reset/updateStep: flame1 or flame2, scale 0.05 -> 0.8 over its life, random spin,
        // opacity 255 fading out; additive so overlapping puffs build a hot core
        const age = Math.max(0, Math.min(1, p.age ?? 0.5));
        ctx.globalCompositeOperation = 'lighter';
        // each flame also draws a puff half a shot behind it, so 0.15 s shots read as one stream
        for (const [back, a0] of [[0.075, age - 0.14], [0, age]]) {
          if (a0 < 0) continue;
          const img = sprite((p.id + (back ? 1 : 0)) % 2 ? 'flame1' : 'flame2');
          const sc = (0.05 + 0.75 * Math.sqrt(a0)) * 0.5; // cocos sd scale -> hd sprite pixels
          ctx.save();
          ctx.translate(-p.vx * back, -p.vy * back);
          ctx.rotate((p.rot || 0) + a0 * 1.5 + back * 20);
          ctx.globalAlpha = Math.max(0, 1 - a0 * a0);
          ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
          ctx.restore();
        }
        if (age > 0.6 && p.id % 3 === 0) trackSmoke?.(p.x, p.y);
      } else if (p.k === 'emp') {
        const img = sprite('empBubble');
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, -10, -10, 20, 20);
        ctx.rotate(t * 10);
        const z = sprite('emp1');
        ctx.drawImage(z, -12, -12, 24, 24);
      } else if (p.k === 'nade') {
        const name = p.t === 'proxynade' ? (p.s && Math.sin(t * 10) > 0 ? 'mine2' : 'mine1') : NADES[p.t]?.sprite;
        const img = sprite(name);
        if (!p.s) ctx.rotate(t * 8);
        if (img) ctx.drawImage(img, -img.width * 0.12, -img.height * 0.12, img.width * 0.24, img.height * 0.24);
      }
      ctx.restore();
    }
  }

  // GasCloud: smoke.png tinted ccc3(100, 255, 0), turning at 180 deg/s, fading at the end of its life.
  drawClouds(world, t) {
    const ctx = this.ctx;
    const img = tintedSprite('smoke', 'rgb(100,255,0)');
    if (!img) return;
    for (const c of world.clouds) {
      const k = Math.min(1, c.left / 1.2);
      ctx.save();
      for (let i = 0; i < 6; i++) {
        const ph = i * 1.05;
        const ox = Math.cos(t * 0.5 + ph) * c.r * 0.35, oy = Math.sin(t * 0.7 + ph * 1.3) * c.r * 0.22;
        const r = c.r * (0.75 + 0.15 * Math.sin(t * 1.3 + ph));
        ctx.globalAlpha = (0.42 + 0.08 * Math.sin(t * 6 + ph)) * k;
        ctx.save();
        ctx.translate(c.x + ox, c.y + oy);
        ctx.rotate((t * Math.PI + ph) * (i % 2 ? 1 : -1));
        ctx.drawImage(img, -r, -r, r * 2, r * 2);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  drawFlags(world, t) {
    if (!world.flags) return;
    const ctx = this.ctx;
    for (const f of world.flags) {
      if (f.c) continue; // carried: drawn on the soldier
      const img = sprite(f.t === 0 ? 'flagBlue' : 'flagOrange');
      if (!img) continue;
      const sc = 0.26;
      ctx.drawImage(img, f.x - img.width * sc * 0.3, f.y - img.height * sc + 26 + Math.sin(t * 2) * 1, img.width * sc, img.height * sc);
    }
  }

  drawNameTag(s, world) {
    const ctx = this.ctx;
    const y = s.y - (s.c ? 42 : 56);
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    // each soldier's lobby colour (team colour in team modes)
    const color = world.teams ? (s.team === 0 ? '#7fb2ff' : '#ffad5c') : PLAYER_COLORS[s.col] || '#fff';
    ctx.fillStyle = color;
    ctx.strokeText(s.name, s.x, y);
    ctx.fillText(s.name, s.x, y);
    if (!s.me) {
      const w = 22, hp = Math.max(0, s.hp) / 100;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(s.x - w / 2, y + 2, w, 2.4);
      ctx.fillStyle = hp > 0.35 ? '#7be35b' : '#ff5a3c';
      ctx.fillRect(s.x - w / 2, y + 2, w * hp, 2.4);
    }
  }

  // ---------------- screen-space HUD ----------------
  drawHud(world, me, input, t) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const k = Math.min(1, Math.max(0.6, Math.min(this.w, this.h) / 520));
    ctx.textBaseline = 'alphabetic';

    // crosshair
    if (!input.touchMode && me?.alive) {
      const m = input.mouse;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff4b3e';
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }

    if (me?.near && !input.touchMode) this.text(`E  pick up ${itemName(me.near)}`, this.w / 2, this.h - 90 * k, 24 * k, '#ffd23f', 'center');

    if (input.touchMode && !this.hideTouch) this.drawTouch(input, me, k);
  }

  // ammoText_new.png: digits 0-9, 28x30 hd pixels each (CCLabelAtlas 14x15, start char '0')
  digits(str, x, y, scale, alpha) {
    const img = assets.img.ammoText_new;
    if (!img) return;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < str.length; i++) {
      const d = str.charCodeAt(i) - 48;
      if (d < 0 || d > 9) continue;
      ctx.drawImage(img, d * 28, 0, 28, 30, x + i * 26 * scale, y, 28 * scale, 30 * scale);
    }
    ctx.globalAlpha = 1;
  }

  drawTouch(input, me, k, edit = null) {
    const ctx = this.ctx;
    const op = settings().touch.opacity;
    const drawPad = (name, x, y, r, alpha) => {
      const img = sprite(name);
      if (!img) return;
      ctx.globalAlpha = Math.min(1, alpha * op * (edit ? 1.4 : 1));
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    };
    const mp = input.movePad, fp = input.firePad;
    const ms = input.sticks.move;
    drawPad('moveStick', ms ? ms.ox : mp.x, ms ? ms.oy : mp.y, mp.r, 0.55);
    if (ms) { const v = input.stickVec(ms, mp.r); drawPad('moveStick', ms.ox + v.x * mp.r * 0.6, ms.oy + v.y * mp.r * 0.6, mp.r * 0.45, 0.85); }
    const as = input.sticks.aim;
    drawPad('firePad', as ? as.ox : fp.x, as ? as.oy : fp.y, fp.r, 0.45);
    if (as) { const v = input.stickVec(as, fp.r); drawPad('fireStick', as.ox + v.x * fp.r * 0.6, as.oy + v.y * fp.r * 0.6, fp.r * 0.42, 0.9); }
    if (edit) {
      // placement editor: ring the selected control
      const sel = edit === 'move' ? mp : edit === 'fire' ? fp : input.buttons.find((b) => b.id === edit);
      if (sel) {
        ctx.strokeStyle = '#3d8dff'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
        ctx.strokeRect(sel.x - sel.r - 6, sel.y - sel.r - 6, sel.r * 2 + 12, sel.r * 2 + 12);
        ctx.setLineDash([]);
        // corner handles: drag one to resize (sheet 12)
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1f6fe6'; ctx.lineWidth = 2;
        for (const [hx, hy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = sel.x + hx * (sel.r + 6), y = sel.y + hy * (sel.r + 6);
          ctx.fillRect(x - 6, y - 6, 12, 12); ctx.strokeRect(x - 6, y - 6, 12, 12);
        }
        this.handles = { id: edit, cx: sel.x, cy: sel.y, r: sel.r };
      }
    }
    const now = performance.now();
    for (const b of input.buttons) {
      if (b.id === 'scores') continue;
      if (b.id === 'pickup') {
        b.visible = !!me?.near && !edit;
        if (!b.visible) continue;
        ctx.fillStyle = 'rgba(255,210,63,0.85)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        const icon = sprite(itemSprite(me.near));
        if (icon) { const s = (b.r * 1.6) / icon.width; ctx.drawImage(icon, b.x - icon.width * s / 2, b.y - icon.height * s / 2, icon.width * s, icon.height * s); }
        continue;
      }
      const pressed = now - (b.pressed || 0) < 120;
      const active = (b.id === 'zoom' && input.zoomToggle) || (b.id === 'crouch' && input.touchCrouch);
      drawPad(b.sprite, b.x, b.y, b.r * (pressed ? 0.9 : 1), active ? 0.95 : 0.6);
      // the grenade button carries the selected grenade and its count (HUD::onGrenadeChange)
      if (b.id === 'throw' && me?.alive) {
        const sel = me.nadeSel, n = me.nades?.[sel] || 0;
        const img = sprite(sel === 'proxynade' ? 'mine1' : NADES[sel]?.sprite);
        if (img) {
          const fit = (b.r * 0.9) / img.height;
          ctx.globalAlpha = n ? 1 : 0.4;
          ctx.drawImage(img, b.x + b.r * 0.35, b.y - b.r * 1.05, img.width * fit, img.height * fit);
          ctx.globalAlpha = 1;
        }
        this.digits(String(n), b.x + b.r * 0.55, b.y + b.r * 0.2, b.r / 60, 1);
      }
    }
  }

  text(str, x, y, size, color, align = 'left') {
    const ctx = this.ctx;
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.textAlign = align;
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { tintedSprite };
