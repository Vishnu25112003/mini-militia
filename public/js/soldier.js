// Draws a doodle soldier from the original body-part sprites (menuTexture: head/body/leg/arm N).
import { sprite, tintedSprite } from './assets.js';
import { jetPuff, trackTrail, drawTrail } from './effects.js';
import { GUNS, DUAL_SCALE } from '/shared/weapons.js';

const S = 0.19; // hd sprite pixels -> world points
export const TEAM_COLORS = ['#2f7df6', '#ff8a1e'];
export const FFA_COLOR = '#f2f2f2';
const boostAt = new Map(); // last exhaust puff per jetpack nozzle

// Jetpack geometry in soldier-local points (x toward the back is negative, y from the hip line).
const PACK = { x: -17, y: -23, w: 11, h: 22 };
const NOZZLES = [[-13.3, -1.8], [-9.7, -1.8]]; // bottom centre of each nozzle
let packCanvas = null;
function jetpackImage() {
  if (packCanvas) return packCanvas;
  const k = 8; // canvas pixels per point
  const c = document.createElement('canvas');
  c.width = PACK.w * k; c.height = PACK.h * k;
  const g = c.getContext('2d');
  g.scale(k, k);
  g.lineJoin = 'round';
  g.lineWidth = 1.1;
  g.strokeStyle = '#151515';
  const tank = (x, fill, shade) => {
    // nozzle
    g.fillStyle = '#3b3b3b';
    g.beginPath(); g.moveTo(x + 1.2, 18); g.lineTo(x + 4.8, 18); g.lineTo(x + 5.6, 21.2); g.lineTo(x + 0.4, 21.2); g.closePath(); g.fill(); g.stroke();
    // cylinder with a domed top
    g.fillStyle = fill;
    g.beginPath(); g.moveTo(x, 18.4); g.lineTo(x, 4.5); g.arc(x + 3, 4.5, 3, Math.PI, 0); g.lineTo(x + 6, 18.4); g.closePath(); g.fill();
    g.fillStyle = shade; g.fillRect(x + 3.9, 3, 1.6, 15.2); // shadow side
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x + 1, 4.2, 1.1, 12.5); // highlight
    g.beginPath(); g.moveTo(x, 18.4); g.lineTo(x, 4.5); g.arc(x + 3, 4.5, 3, Math.PI, 0); g.lineTo(x + 6, 18.4); g.closePath(); g.stroke();
    // valve cap
    g.fillStyle = '#4a4a4a'; g.fillRect(x + 2, 0.6, 2, 1.4); g.strokeRect(x + 2, 0.6, 2, 1.4);
  };
  tank(0.7, '#5a6439', '#465030'); // far tank
  tank(4.3, '#76814c', '#5c6739'); // near tank
  // strap across both tanks
  g.fillStyle = '#2f3322'; g.fillRect(0.4, 10.2, 10.4, 2); g.strokeRect(0.4, 10.2, 10.4, 2);
  packCanvas = c;
  return c;
}

// The original swaps a gun to its empty "<sprite>E" frame and drops "<sprite>Mag" a moment after a reload starts
// (AK47::startReloadWeapon schedules AK47::dropMag).
export const MAG_DROP_DELAY = 0.12;

function part(ctx, img, ax, ay, x, y, rot = 0, sc = S) {
  if (!img) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -img.width * ax * sc, -img.height * ay * sc, img.width * sc, img.height * sc);
  ctx.restore();
}

// Grip point inside each gun sprite, as a fraction of its (untrimmed) width/height.
const GRIP = { desertEagle: [0.22, 0.6], magnum: [0.2, 0.62], uzi: [0.4, 0.55], tec9: [0.35, 0.5], mp5: [0.32, 0.5], ak47: [0.34, 0.45], m16: [0.38, 0.5], hunting: [0.4, 0.5], sniper: [0.36, 0.55], shotgun: [0.3, 0.5], smaw: [0.42, 0.5], sawgun: [0.3, 0.6], flamethrower: [0.28, 0.6], emp: [0.32, 0.58], shield: [0.3, 0.5] };
// Height of the barrel at the muzzle, as a fraction of sprite height.
const MUZZLE_Y = { desertEagle: 0.25, magnum: 0.22, uzi: 0.3, tec9: 0.3, smaw: 0.28, sawgun: 0.45, flamethrower: 0.45, emp: 0.5 };
// Where the magazine sits (fraction of sprite), for the dropped clip.
const MAG_AT = { desertEagle: [0.22, 0.8], magnum: [0.35, 0.5], uzi: [0.4, 0.85], tec9: [0.45, 0.8], mp5: [0.47, 0.75], ak47: [0.47, 0.75], m16: [0.45, 0.7], hunting: [0.45, 0.62], sniper: [0.42, 0.62], aa12: [0.45, 0.75], tavor: [0.25, 0.7], xm8: [0.45, 0.72], emp: [0.45, 0.75], flamethrower: [0.5, 0.75] };

// World-space geometry of a soldier's gun: hand, muzzle, ejection port and magazine well.
export function gunPose(s) {
  const facing = Math.cos(s.aim) >= 0 ? 1 : -1;
  let la = facing > 0 ? s.aim : Math.PI - s.aim;
  la = Math.atan2(Math.sin(la), Math.cos(la));
  la = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, la));
  const hipY = s.c ? -10 : -15;
  const shoulderX = -1, shoulderY = hipY - 13;
  const cos = Math.cos(la), sin = Math.sin(la);
  const handX = shoulderX + cos * 13, handY = shoulderY + sin * 13;
  const g = GUNS[s.w];
  const name = g?.sprite;
  const img = name ? sprite(name) : null;
  const [gx, gy] = GRIP[name] || [0.3, 0.55];
  const toWorld = (lx, ly) => ({ x: s.x + facing * lx, y: s.y + ly });
  const at = (u, v) => {
    if (!img) return toWorld(handX, handY);
    const ox = (u - gx) * img.width * S, oy = (v - gy) * img.height * S;
    return toWorld(handX + ox * cos - oy * sin, handY + ox * sin + oy * cos);
  };
  const mag = MAG_AT[name] || [gx + 0.08, gy + 0.25];
  return {
    facing, la, hipY, shoulderX, shoulderY, handX, handY, img, gx, gy,
    angle: facing > 0 ? la : Math.PI - la, // world-space barrel direction
    muzzle: at(1.0, MUZZLE_Y[name] ?? 0.36),
    eject: at(Math.min(0.62, gx + 0.18), 0.35),
    magWell: at(mag[0], mag[1]),
  };
}

export function drawSoldier(ctx, s, t) {
  const pose = gunPose(s);
  const { facing, la, hipY, shoulderX, shoulderY, handX, handY } = pose;
  const av = s.avatar || { head: 1, body: 1, leg: 1, arm: 1 };

  const crouch = s.c;
  const moving = Math.abs(s.vx) > 20 && s.g;
  const swing = moving ? Math.sin(s.phase) * 0.65 : 0;
  const leg = sprite(`leg${av.leg}`);

  const backLeg = crouch ? 0.9 : (s.g ? -swing : 0.35);
  const frontLeg = crouch ? -0.9 : (s.g ? swing : -0.2);

  // Jetpack on the back. The original has no pack sprite (its Boostie exhaust hangs off the soldier),
  // so the pack is drawn here in the doodle style; the exhaust (Boostie: flickering `flame`, Smoke.plist
  // glow from ora_new.png, a CCMotionStreak trail) comes out of its two nozzles.
  const packY = hipY;
  NOZZLES.forEach(([nx, ny], i) => {
    const key = `${s.id}:${i}`;
    if (s.j) {
      const wx = s.x + facing * nx, wy = s.y + packY + ny;
      trackTrail(key, wx, wy, t);
      const last = boostAt.get(key) ?? 0;
      if (t - last > 1 / 30 || t < last) { jetPuff(wx, wy + 12); boostAt.set(key, t); }
    }
    drawTrail(ctx, key, 3, t, 0.75, '255,214,150');
  });

  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.shield) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 18);
  ctx.scale(facing, 1);

  const pack = jetpackImage();
  ctx.drawImage(pack, PACK.x, packY + PACK.y, PACK.w, PACK.h);

  // carried flag on the back
  if (s.fl >= 0) part(ctx, sprite(s.fl === 0 ? 'flagBlue' : 'flagOrange'), 0.5, 0.95, -10, hipY - 10, -0.25, 0.22);

  // back leg, back arm
  part(ctx, leg, 0.45, 0.08, -3, hipY, backLeg);
  if (s.j) {
    // exhaust over the back leg, so the whole flame shows below the nozzles
    const flame = sprite('flame');
    for (const [nx, ny] of NOZZLES) part(ctx, flame, 0.5, 0, nx, packY + ny - 0.6, 0, 0.15 + Math.random() * 0.075);
  }
  const arm = sprite(`arm${av.arm}`);
  const off = GUNS[s.w2];
  const reloadDip = s.reloadT > MAG_DROP_DELAY ? 0.55 : 0;
  if (off && off.kind !== 'shield') {
    // dual wield: the back arm holds the second gun at DUAL_SCL, aimed with the main one
    const backX = shoulderX - 4, backY = shoulderY + 1;
    const dir = [Math.cos(la), Math.sin(la)];
    const kick = s.recoil2 > 0 ? -s.recoil2 * 4 : 0;
    const hx = backX + dir[0] * (13 + kick), hy = backY + dir[1] * (13 + kick) + reloadDip * 6;
    const empty = s.reloadT > MAG_DROP_DELAY && sprite(`${off.sprite}E`);
    const img = empty || sprite(off.sprite);
    const [gx, gy] = GRIP[off.sprite] || [0.3, 0.55];
    part(ctx, img, gx, gy, hx, hy, la + reloadDip * 0.4, S * DUAL_SCALE);
    if (s.flash2 > 0 && off.kind === 'hitscan') {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(la);
      ctx.globalCompositeOperation = 'lighter';
      const fl = sprite('flare');
      const sc = S * DUAL_SCALE;
      const mx = (1 - gx) * img.width * sc, my = ((MUZZLE_Y[off.sprite] ?? 0.36) - gy) * img.height * sc;
      ctx.drawImage(fl, mx - 2, my - fl.height * 0.08, fl.width * 0.16, fl.height * 0.16);
      ctx.restore();
    }
    part(ctx, arm, 0.08, 0.5, backX, backY, la + reloadDip * 0.4);
  } else {
    // while reloading the support hand drops to the magazine well
    part(ctx, arm, 0.08, 0.5, shoulderX - 4, shoulderY + 1, la + 0.18 + reloadDip);
  }

  // body + front leg
  part(ctx, sprite(`body${av.body}`), 0.5, 0.5, 0, hipY - 8);
  if (s.team !== undefined && s.team >= 0) part(ctx, tintedSprite('teamWaistBand', TEAM_COLORS[s.team]), 0.5, 0.5, 0, hipY - 1, 0, 0.1);
  part(ctx, leg, 0.45, 0.08, 3, hipY, frontLeg);

  // head looks a little toward the aim
  part(ctx, sprite(`head${av.head}`), 0.5, 0.55, 1, hipY - 27, la * 0.35);

  // gun, then the front arm over it
  const g = GUNS[s.w];
  if (g) {
    const dir = [Math.cos(la), Math.sin(la)];
    const kick = s.recoil > 0 ? -s.recoil * 4 : 0;
    const hx = handX + dir[0] * kick, hy = handY + dir[1] * kick;
    if (g.kind === 'shield') {
      part(ctx, sprite(g.sprite), 0.5, 0.5, 11, hipY - 12, 0, 0.2);
    } else {
      const reloading = s.reloadT > MAG_DROP_DELAY;
      const empty = reloading && sprite(`${g.sprite}E`);
      const img = empty || pose.img;
      // a loaded saw blade sits in the Saw Gun's housing (SAWGUN::init uses wormDroneSaw.png)
      if (g.kind === 'saw' && !s.rl) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(la);
        const bx = (0.8 - pose.gx) * img.width * S, by = (0.45 - pose.gy) * img.height * S;
        part(ctx, sprite('wormDroneSaw'), 0.5, 0.5, bx, by, t * 4, 0.19);
        ctx.restore();
      }
      part(ctx, img, pose.gx, pose.gy, hx, hy, la);
      // muzzle flash: each gun's own flare.png, fixed to the barrel
      if (s.flash > 0 && g.kind === 'hitscan') {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(la);
        const mx = (1 - pose.gx) * img.width * S, my = ((MUZZLE_Y[g.sprite] ?? 0.36) - pose.gy) * img.height * S;
        ctx.globalCompositeOperation = 'lighter';
        const fl = sprite('flare');
        const fs = 0.2 + (s.flashSeed || 0) * 0.08;
        ctx.drawImage(fl, mx - 2, my - fl.height * fs / 2, fl.width * fs, fl.height * fs);
        ctx.restore();
      }
    }
  }
  // an off-hand riot shield is carried in front, next to a pistol
  if (off && off.kind === 'shield') part(ctx, sprite(off.sprite), 0.5, 0.5, 12, hipY - 12, 0, 0.2);
  if (s.meleeT > 0) {
    const swingA = la - 1.2 + (1 - s.meleeT / 0.25) * 2.2;
    part(ctx, sprite('machete'), 0.1, 0.5, shoulderX, shoulderY, swingA, 0.17);
  }
  part(ctx, arm, 0.08, 0.5, shoulderX, shoulderY, la);
  if (s.team !== undefined && s.team >= 0) {
    const dir = [Math.cos(la), Math.sin(la)];
    part(ctx, tintedSprite('teamArmBand', TEAM_COLORS[s.team]), 0.5, 0.5, shoulderX + dir[0] * 3, shoulderY + dir[1] * 3, la, 0.12);
  }

  if (s.emp) part(ctx, sprite('emp1'), 0.5, 0.5, 0, hipY - 12, t * 6, 0.16);
  ctx.restore();
}

// Soldier with the given avatar for the lobby preview.
export function drawAvatar(canvas, avatar, team) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  const k = canvas.height / 64;
  ctx.translate(canvas.width / 2 - 4 * k, canvas.height - 6 * k);
  ctx.scale(k, k);
  drawSoldier(ctx, { x: 0, y: 0, vx: 0, aim: -0.15, c: 0, g: 1, j: 0, w: 'ak47', avatar, team, fl: -1, phase: 0 }, 0);
  ctx.restore();
}
