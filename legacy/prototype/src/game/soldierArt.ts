// Original soldier character, drawn with canvas paths. Authored 68px tall around the body centre
// (head top at y=-34, boots at y=+34); callers scale it to the hitbox.
import { OUT, drawGun } from './art';
import { WEAPONS } from './weapons';
import type { WeaponId } from './types';

export type Headgear = 'helmet' | 'cap' | 'bandana' | 'mohawk' | 'hair';

export interface SoldierLook {
  shirt: string;
  shirtDark: string;
  skin: string;
  hair: string;
  headgear: Headgear;
}

export interface SoldierPose {
  facing: 1 | -1;
  aim: number;
  thrusting: boolean;
  onGround: boolean;
  runPhase: number;
  vx: number;
  weapon: WeaponId;
  firing?: boolean;
  empT?: number;
  carrying?: string | null; // colour of a carried flag
  t: number; // seconds, for small idle motion
}

const SKINS = ['#f2c9a0', '#dfab7b', '#b9804f', '#8a5a36'];
const HAIR = ['#2b1d12', '#5a3a1c', '#c99a3a', '#1a1a1e', '#8c3a22'];
const GEAR: Headgear[] = ['helmet', 'cap', 'bandana', 'mohawk', 'hair'];

/** Stable per-player appearance so everyone is recognisable. */
export function lookFor(id: number, shirt: string, shirtDark: string): SoldierLook {
  return { shirt, shirtDark, skin: SKINS[id % SKINS.length], hair: HAIR[(id * 3 + 1) % HAIR.length], headgear: GEAR[(id * 2 + (id >> 2)) % GEAR.length] };
}

const outlined = (g: CanvasRenderingContext2D, fill: string | CanvasGradient, w = 2.4) => {
  g.fillStyle = fill; g.fill();
  g.lineWidth = w; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
};

function limb(g: CanvasRenderingContext2D, pts: [number, number][], thickness: number, fill: string, hi?: string) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, c] of [[thickness + 4.5, OUT], [thickness, fill]] as [number, string][]) {
    g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
  if (hi) {
    g.strokeStyle = hi; g.lineWidth = Math.max(1.5, thickness * 0.25); g.beginPath(); g.moveTo(pts[0][0] - 1, pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] - 1.4, pts[i][1]);
    g.stroke();
  }
}

export function drawSoldierArt(g: CanvasRenderingContext2D, look: SoldierLook, pose: SoldierPose) {
  const f = pose.facing;
  const bob = pose.onGround && Math.abs(pose.vx) < 20 ? Math.sin(pose.t * 2.4) * 0.8 : 0;
  g.save();
  g.translate(0, bob);

  // ---- jetpack: two tanks and a nozzle, with flame
  const jx = -f * 17;
  g.beginPath(); g.roundRect(jx - 8.5, -16, 9, 31, 4.5); outlined(g, '#8a909a');
  g.beginPath(); g.roundRect(jx - 1, -14, 9, 29, 4.5); outlined(g, '#757b86');
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(jx - 6.5, -13, 2.2, 22); g.fillRect(jx + 1, -11, 2.2, 20);
  g.beginPath(); g.roundRect(jx - 5, 14, 10, 6, 2); outlined(g, '#3b4048', 2);
  if (pose.thrusting) {
    const fl = 24 + Math.random() * 18;
    g.beginPath(); g.moveTo(jx - 6, 19); g.quadraticCurveTo(jx, 19 + fl * 1.25, jx + 6, 19); g.closePath(); outlined(g, '#ffb13b', 2);
    g.fillStyle = '#fff3c4'; g.beginPath(); g.moveTo(jx - 3.2, 19); g.quadraticCurveTo(jx, 19 + fl * 0.72, jx + 3.2, 19); g.fill();
  }

  // ---- legs with knees and boots
  const run = pose.onGround ? Math.sin(pose.runPhase * 3) * Math.min(1, Math.abs(pose.vx) / 150) : 0;
  const air = pose.onGround ? 0 : 1;
  for (const side of [-1, 1]) {
    const phase = run * side;
    const hx = side * 5, hy = 10;
    const fx = hx + phase * 12 + side * air * 3;
    const lift = air ? 3 * side : Math.max(0, phase) * 5;
    const fy = 31 - lift;
    const kx = (hx + fx) / 2 + f * (4 + Math.max(0, phase) * 3), ky = (hy + fy) / 2 - Math.max(0, phase) * 2;
    limb(g, [[hx, hy], [kx, ky], [fx, fy]], 8, '#667052', 'rgba(255,255,255,0.18)');
    g.beginPath(); g.roundRect(fx - 5 + f * 2.5, fy - 1.5, 13, 7.5, 3); outlined(g, '#3a352a', 2.2);
    g.fillStyle = '#1d1a14'; g.fillRect(fx - 4.5 + f * 2.5, fy + 4, 12, 2);
  }

  // ---- offhand arm behind the weapon (two-handed grip on long guns)
  const def = WEAPONS[pose.weapon];
  const twoHand = def.kind !== 'shield' && pose.weapon !== 'magnum';
  const kick = pose.firing ? -2.5 : 0;
  g.save();
  g.translate(0, -4); g.rotate(pose.aim); if (f < 0) g.scale(1, -1);
  if (twoHand) {
    const reach = 14 + Math.min(def.length * 0.42, 34) + kick;
    limb(g, [[0, 2], [reach * 0.55, 5], [reach, 3.5]], 6.2, look.shirtDark);
    g.beginPath(); g.arc(reach, 3.5, 4.6, 0, Math.PI * 2); outlined(g, '#3a352a', 2);
  }
  g.restore();

  // ---- torso, vest, belt
  const grad = g.createLinearGradient(-15, -12, 12, 14);
  grad.addColorStop(0, look.shirt); grad.addColorStop(1, look.shirtDark);
  g.beginPath(); g.roundRect(-15, -11, 30, 26, 10); outlined(g, grad);
  g.beginPath(); g.roundRect(-13, -9, 11, 14, 4); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fill();
  g.beginPath(); g.roundRect(f > 0 ? 1 : -12, -7, 11, 9, 2.5); outlined(g, look.shirtDark, 1.8);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(f > 0 ? 3 : -10, -6, 7, 1.6);
  g.beginPath(); g.roundRect(-15, 1, 30, 7, 2); outlined(g, '#4a3a22', 2);
  g.beginPath(); g.roundRect(-3.5, 0.5, 7, 8, 1.5); outlined(g, '#e0bf55', 1.8);

  // ---- head
  const hg = g.createRadialGradient(-4, -27, 2, 0, -22, 17);
  hg.addColorStop(0, look.skin); hg.addColorStop(1, shade(look.skin, 0.82));
  g.beginPath(); g.arc(0, -22, 14.5, 0, Math.PI * 2); outlined(g, hg);
  g.beginPath(); g.ellipse(-f * 13.5, -21, 2.8, 4, 0, 0, Math.PI * 2); outlined(g, shade(look.skin, 0.9), 1.8);
  headgear(g, look, f, pose.t);

  // eye follows the aim; brow tilts with firing
  const ex = f * 7, ey = -21;
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 5.4, 6.2, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = OUT; g.beginPath(); g.arc(ex + Math.cos(pose.aim) * 2.4, ey + Math.sin(pose.aim) * 2.2, 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + Math.cos(pose.aim) * 2.4 - 0.8, ey + Math.sin(pose.aim) * 2.2 - 1, 0.9, 0, Math.PI * 2); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(ex - 5, ey - 8 + (pose.firing ? 1.5 : 0)); g.lineTo(ex + 5, ey - 8 - (pose.firing ? 0.5 : 1.5)); g.stroke();
  g.lineWidth = 1.9;
  g.beginPath();
  if (pose.firing) { g.ellipse(f * 5, -11, 3, 2.2, 0, 0, Math.PI); g.stroke(); } else { g.moveTo(f * 2, -11.5); g.quadraticCurveTo(f * 6, -9.5, f * 10, -11.5); g.stroke(); }

  // ---- front arm, weapon, glove
  g.save();
  g.translate(0, -4); g.rotate(pose.aim); if (f < 0) g.scale(1, -1);
  g.translate(14 + kick, 0);
  drawGun(g, pose.weapon, def.length, def.color);
  g.translate(-14 - kick, 0);
  limb(g, [[0, 0], [8, 1.5], [15 + kick, 2]], 7.2, look.shirt, 'rgba(255,255,255,0.2)');
  g.beginPath(); g.arc(17 + kick, 2, 5.2, 0, Math.PI * 2); outlined(g, '#3a352a', 2);
  g.restore();

  if (pose.carrying) {
    g.beginPath(); g.roundRect(-f * 6 - 1.5, -64, 3, 36, 1); outlined(g, '#e8e0cc', 2);
    g.beginPath(); g.moveTo(-f * 6 + 1.5, -64); g.quadraticCurveTo(-f * 6 + 14, -66 + Math.sin(pose.t * 7) * 2, -f * 6 + 26, -58); g.lineTo(-f * 6 + 26, -48); g.quadraticCurveTo(-f * 6 + 14, -52, -f * 6 + 1.5, -49); g.closePath(); outlined(g, pose.carrying, 2);
  }
  if (pose.empT && pose.empT > 0) {
    g.strokeStyle = `rgba(120,200,255,${0.4 + Math.random() * 0.5})`; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, -4, 38 + Math.random() * 4, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

function headgear(g: CanvasRenderingContext2D, look: SoldierLook, f: number, t: number) {
  const dark = look.shirtDark;
  switch (look.headgear) {
    case 'helmet':
      g.beginPath(); g.arc(0, -24, 15.5, Math.PI * 1.03, Math.PI * 1.97); g.lineTo(f * 16, -25); g.lineTo(-f * 16, -25); g.closePath(); outlined(g, dark);
      g.beginPath(); g.roundRect(f > 0 ? -3 : -19, -29.5, 22, 5.5, 2.5); outlined(g, shade(dark, 1.25), 2);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-f * 4, -35, 6, 2, -0.2 * f, 0, Math.PI * 2); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-f * 12, -22); g.lineTo(-f * 12, -14); g.stroke();
      break;
    case 'cap':
      g.beginPath(); g.arc(0, -24, 15, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); outlined(g, dark);
      g.beginPath(); g.moveTo(f * 3, -26); g.quadraticCurveTo(f * 20, -27, f * 22, -22); g.lineTo(f * 4, -22.5); g.closePath(); outlined(g, shade(dark, 0.8), 2);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(-f * 3, -34.5, 5, 1.8, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'bandana':
      g.fillStyle = look.hair; g.beginPath(); g.arc(0, -24, 14.8, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.roundRect(-15, -29, 30, 7, 3); outlined(g, '#c0392b', 2);
      g.beginPath(); g.moveTo(-f * 14, -26); g.quadraticCurveTo(-f * 22, -24 + Math.sin(t * 6) * 3, -f * 28, -20 + Math.sin(t * 6 + 1) * 4); g.lineTo(-f * 22, -27); g.closePath(); outlined(g, '#c0392b', 1.8);
      break;
    case 'mohawk':
      g.fillStyle = look.hair;
      g.beginPath(); g.moveTo(-9, -33); for (let i = 0; i < 5; i++) { g.lineTo(-9 + i * 4.5 + 2.2, -45 + (i % 2) * 3); g.lineTo(-9 + (i + 1) * 4.5, -34); } g.closePath();
      g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
      break;
    default:
      g.beginPath(); g.arc(0, -24.5, 15, Math.PI * 1.0, Math.PI * 2); g.quadraticCurveTo(f * 14, -26, f * 4, -29); g.quadraticCurveTo(-f * 6, -30, -f * 15, -24); g.closePath(); outlined(g, look.hair);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(-f * 3, -35, 6, 1.8, 0, 0, Math.PI * 2); g.fill();
  }
}
