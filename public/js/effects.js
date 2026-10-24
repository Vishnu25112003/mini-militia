// Short-lived visual effects driven by server events. All in world points.
// Particle numbers come from the original's cocos particle plists (assets/files/*.plist) and
// EffectsManager / Tracer / Magazine / GasCloud in libcocos2dcpp.so.
import { assets, sprite, tintedSprite } from './assets.js';
import { settings } from './settings.js';

const parts = [];
const bullets = [];
const mags = [];
const trails = new Map(); // projectile id -> recent positions (CCMotionStreak look)
const MAX = 900;
const BULLET_SPEED = 1300; // Weapon::init stores 1300

let gravityScale = 1; // the host's GRAVITY setting: shells, gibs and magazines float at 0
export function setGravity(g) { gravityScale = g ?? 1; }

const rand = (a, b) => a + Math.random() * (b - a);
const vary = (v, d) => v + rand(-d, d);

function add(p) {
  if (parts.length > MAX) parts.shift();
  parts.push({ age: 0, rot: 0, vr: 0, g: 0, drag: 0, alpha: 1, fade: true, grow: 0, ...p });
}

// A visible round travelling from the muzzle to where the server says it stopped; onEnd fires on arrival.
export function bullet(x0, y0, x1, y1, weapon) {
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy) || 1;
  const b = { x0, y0, dx: dx / dist, dy: dy / dist, dist, d: 0, weapon, onEnd: [], done: false, fadeT: 0 };
  bullets.push(b);
  return b;
}

// Shell.plist: speed 150, gravity 500, life 0.75 s, size 6, fades out; EffectsManager::weaponFired
// throws it 90 degrees off the barrel (up and back over the shoulder).
export function shell(x, y, barrelAngle, facing, scale = 1) {
  const a = barrelAngle - facing * Math.PI / 2 + rand(-0.5, 0.5) - facing * 0.4;
  const sp = vary(150, 30);
  add({ img: assets.img.shell_new, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, life: 0.75, size: 6 * scale, vr: rand(-18, 18), rot: barrelAngle, bounce: true });
}

// Rock.plist (5 chips, speed 100+-25, gravity 350, life 0.5) + spark_new flash where a round hits rock.
export function groundHit(x, y, dx = 0, dy = 0) {
  const back = Math.atan2(-dy, -dx);
  for (let i = 0; i < 5; i++) {
    const a = back + rand(-0.6, 0.6);
    const sp = vary(100, 25);
    add({ img: assets.img.rock_new, x: vary(x, 3), y: vary(y, 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 350, life: vary(0.5, 0.1), size: vary(6, 2), vr: rand(-10, 10) });
  }
  add({ img: assets.img.spark_new, x, y, vx: 0, vy: 0, life: 0.09, size: 16, grow: 8, rot: rand(0, 6), blend: 'lighter' });
}

// Blood.plist: 15 drops, any direction, speed 200+-100, gravity 100, life 0.2, size 5+-3 -> 1.
export function blood(x, y, dir = 0, n = 15) {
  if (!settings().blood) return;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = vary(200, 100);
    add({ img: assets.img.blood_new, x: vary(x, 3), y: vary(y, 3), vx: Math.cos(a) * sp + dir * 60, vy: Math.sin(a) * sp, g: 100, life: vary(0.2, 0.1), size: vary(5, 3), shrink: true, fade: false });
  }
}

export function spark(x, y) { groundHit(x, y); }

// Magazine: a light physics body that falls out of the gun, bounces, lies there and fades.
export function dropMag(name, x, y, angle, facing, vx = 0) {
  const img = sprite(name);
  if (!img) return;
  mags.push({ img, x, y, vx: vx + facing * rand(10, 40), vy: rand(-20, 30), rot: angle, vr: facing * rand(2, 6), flip: facing < 0, age: 0, life: 3.2, rest: false });
  if (mags.length > 40) mags.shift();
}

export function explosion(x, y, r) {
  const k = r / 105;
  add({ img: sprite('explosion'), x, y, vx: 0, vy: 0, life: 0.32, size: 120 * k, grow: 60 * k, rot: rand(0, 6), blend: 'lighter' });
  add({ img: sprite('flame2'), x, y, vx: 0, vy: 0, life: 0.45, size: 90 * k, grow: 40 * k, rot: rand(0, 6) });
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(60, 260) * k;
    add({ img: assets.img.smoke_new, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, drag: 2.5, life: rand(0.6, 1.3), size: rand(20, 36) * k, grow: 30 * k, alpha: 0.75 });
  }
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(200, 420);
    add({ img: assets.img.shrap_new, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, life: rand(0.3, 0.6), size: rand(3, 6), vr: rand(-20, 20) });
  }
}

// GasCloud pops with a green-tinted flash of explosion.png before the cloud itself (drawn from snapshots).
export function gas(x, y) {
  add({ img: tintedSprite('explosion', 'rgb(100,255,0)'), x, y, vx: 0, vy: 0, life: 0.35, size: 70, grow: 40, rot: rand(0, 6), alpha: 0.8 });
}

// a wisp of smoke where a flame burns out (rate-limited per spot)
let lastSmoke = 0;
export function flameSmoke(x, y) {
  const now = performance.now();
  if (now - lastSmoke < 60) return;
  lastSmoke = now;
  add({ img: sprite('smoke'), x, y, vx: rand(-10, 10), vy: rand(-40, -20), life: 0.7, size: 14, grow: 26, alpha: 0.35, rot: rand(0, 6), vr: rand(-1, 1) });
}

// Smoke.plist below a jetpack nozzle: additive glow, size 25 -> 10 over 0.2 s (+-0.1), no drift.
// Drawn at 60% size and warm-tinted so it lights the flame tip instead of hiding the pack.
export function jetPuff(x, y) {
  add({ img: jetGlow(), x, y, vx: 0, vy: 0, life: vary(0.2, 0.1), size: 15, grow: -9, blend: 'lighter', alpha: 0.6 });
}
let glow = null;
function jetGlow() {
  if (glow) return glow;
  const src = assets.img.ora_new;
  glow = document.createElement('canvas');
  glow.width = src.width; glow.height = src.height;
  const g = glow.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgb(255,170,70)';
  g.fillRect(0, 0, glow.width, glow.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(src, 0, 0);
  return glow;
}

export function empBurst(x, y) {
  add({ img: sprite('empBubble'), x, y, vx: 0, vy: 0, life: 0.45, size: 40, grow: 140, alpha: 0.8, blend: 'lighter' });
  add({ img: sprite('emp1'), x, y, vx: 0, vy: 0, life: 0.35, size: 60, grow: 40, rot: rand(0, 6), blend: 'lighter' });
}

export function gibs(x, y, avatar, dir) {
  const pieces = [`head${avatar.head}`, `body${avatar.body}`, `leg${avatar.leg}`, `leg${avatar.leg}`, `arm${avatar.arm}`];
  for (const name of pieces) {
    const img = sprite(name);
    add({ img, x: x + rand(-6, 6), y: y + rand(-12, 6), vx: dir * rand(20, 140) + rand(-80, 80), vy: rand(-320, -140), g: 900, life: 2.2, size: img ? img.width * 0.19 : 10, vr: rand(-10, 10), bounce: true, rot: rand(-1, 1) });
  }
  blood(x, y, dir, 30);
}

// Motion-streak trail for saws, grenades and rockets (SAW/FRAGNADE/GASNADE/ROCKET::updateEffects use streak_new.png).
export function trackTrail(id, x, y, now) {
  let tr = trails.get(id);
  if (!tr) { tr = []; trails.set(id, tr); }
  const last = tr[tr.length - 1];
  if (!last || Math.hypot(last.x - x, last.y - y) > 2) tr.push({ x, y, t: now });
  tr.seen = now;
}

export function drawTrail(ctx, id, width, now, life = 0.22, color = '255,255,255') {
  const tr = trails.get(id);
  if (!tr) return;
  while (tr.length && now - tr[0].t > life) tr.shift();
  if (tr.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    const k = 1 - (now - tr[i].t) / life;
    ctx.strokeStyle = `rgba(${color},${0.55 * k})`;
    ctx.lineWidth = width * (0.35 + 0.65 * k);
    ctx.beginPath();
    ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
    ctx.lineTo(tr[i].x, tr[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

export function updateEffects(dt, map, now) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    p.vy += p.g * gravityScale * dt;
    if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (p.bounce && map) {
      if (map.solidAt(nx, p.y)) p.vx *= -0.4; else p.x = nx;
      if (map.solidAt(p.x, ny)) { p.vy *= -0.35; p.vx *= 0.7; p.vr *= 0.6; } else p.y = ny;
    } else { p.x = nx; p.y = ny; }
    p.rot += p.vr * dt;
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b.done) {
      b.d += BULLET_SPEED * dt;
      if (b.d >= b.dist) {
        b.d = b.dist;
        b.done = true;
        for (const f of b.onEnd) f();
      }
    } else if ((b.fadeT += dt) > 0.06) bullets.splice(i, 1);
  }
  for (let i = mags.length - 1; i >= 0; i--) {
    const m = mags[i];
    m.age += dt;
    if (m.age > m.life) { mags.splice(i, 1); continue; }
    if (m.rest) continue;
    m.vy += 700 * gravityScale * dt;
    if (!gravityScale) { const k = Math.exp(-1.5 * dt); m.vx *= k; m.vy *= k; }
    const nx = m.x + m.vx * dt, ny = m.y + m.vy * dt;
    if (map.solidAt(nx, m.y)) m.vx *= -0.3; else m.x = nx;
    if (map.solidAt(m.x, ny + 3)) {
      if (Math.abs(m.vy) < 60) { m.vy = 0; m.vx = 0; m.rest = true; m.rot = Math.round(m.rot / (Math.PI / 2)) * (Math.PI / 2) + (m.flip ? -0.1 : 0.1); }
      else { m.vy *= -0.3; m.vx *= 0.6; m.vr *= 0.5; }
    } else m.y = ny;
    m.rot += m.vr * dt;
  }
  if (now !== undefined) for (const [id, tr] of trails) if (now - tr.seen > 1) trails.delete(id);
}

export function drawEffects(ctx) {
  ctx.save();
  // magazines on the floor
  for (const m of mags) {
    const fade = Math.min(1, (m.life - m.age) / 0.8);
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    if (m.flip) ctx.scale(-1, 1);
    const sc = 0.19;
    ctx.drawImage(m.img, -m.img.width * sc / 2, -m.img.height * sc / 2, m.img.width * sc, m.img.height * sc);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // rounds in flight: bullet_new.png head + a short streak (Tracer uses streak_new.png)
  const bimg = assets.img.bullet_new;
  for (const b of bullets) {
    const hx = b.x0 + b.dx * b.d, hy = b.y0 + b.dy * b.d;
    const len = Math.min(b.d, b.weapon === 'm93ba' || b.weapon === 'm14' ? 90 : 46);
    const k = b.done ? 1 - b.fadeT / 0.06 : 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * k})`;
    ctx.lineWidth = b.weapon === 'm93ba' ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - b.dx * len, hy - b.dy * len);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    if (!b.done && bimg) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.atan2(b.dy, b.dx));
      ctx.drawImage(bimg, -5, -1.5, 6, 3);
      ctx.restore();
    }
  }
  for (const p of parts) {
    if (!p.img) continue;
    const k = p.age / p.life;
    const size = p.shrink ? p.size + (1 - p.size) * k : p.size + p.grow * k;
    const w = size, h = size * (p.img.height / p.img.width);
    ctx.globalAlpha = p.alpha * (p.fade ? 1 - k : 1);
    ctx.globalCompositeOperation = p.blend || 'source-over';
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot);
    ctx.drawImage(p.img, -w * (p.anchorX ?? 0.5), -h / 2, w, h);
    ctx.restore();
  }
  ctx.restore();
}
