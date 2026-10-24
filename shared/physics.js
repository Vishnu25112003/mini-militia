// Soldier movement, shared by the server (authoritative) and the client (prediction).
//
// Values marked [RE] were read from SoldierLocalController in libcocos2dcpp.so:
//   init(): hp 100, walk speed 190 (+0x284), thrust 320 (+0x288)
//   updateStep(): vertical velocity clamp around 300, body damping 0.99
// The space gravity is (0,0) in PhysicsManager::init(): the original applies gravity per body,
// so GRAVITY and JET_ACCEL are tuned to reproduce the feel rather than read from a table.

export const PHYS = {
  TICK: 1 / 60,
  WIDTH: 22,
  HEIGHT: 50,
  CROUCH_HEIGHT: 36,
  RUN: 190, // [RE]
  CROUCH_RUN: 80,
  GROUND_ACCEL: 1800,
  AIR_ACCEL: 1000,
  GRAVITY: 900,
  JET_ACCEL: 1950,
  MAX_RISE: 320, // [RE] thrust
  MAX_FALL: 620,
  FUEL_DRAIN: 0.48, // full tank lasts ~2 s
  FUEL_REGEN: 0.38,
  FUEL_REGEN_DELAY: 0.35,
  STEP_UP: 9,
  SNAP_DOWN: 8,
  MAX_HP: 100, // [RE]
  // [RE] SoldierLocalController::meleeAttack / updateStep: a melee charge (+0x2b8) starts at 0, refills
  // 45/s while under 125 and each swing spends 35. The swing adds an impulse of charge x mass along
  // the aim (= +charge pt/s), skipped when already moving faster than 320 that way. HUD::onPunch
  // allows a swing every 0.5 s.
  MELEE_CHARGE_MAX: 125,
  MELEE_CHARGE_RATE: 45,
  MELEE_CHARGE_COST: 35,
  MELEE_MAX_SPEED: 320,
  MELEE_INTERVAL: 0.5,
  // The original walks with a force-limited Chipmunk joint, so a lunge outlasts the run speed for a
  // moment; LUNGE_DECEL (tuned) is how fast the extra speed bleeds off, for LUNGE_TIME after a swing.
  LUNGE_DECEL: 180,
  LUNGE_TIME: 0.8,
};

export function newBody(x, y) {
  return { x, y, vx: 0, vy: 0, onGround: false, crouch: false, fuel: 1, regenWait: 0, jetting: false, boost: 0, emp: 0, charge: 0, meleeCool: 0, lunge: 0 };
}

const box = (map, x, y, h) => map.rectSolid(x - PHYS.WIDTH / 2, y - h, x + PHYS.WIDTH / 2, y);

// input: { mx: -1..1, jet: bool, crouch: bool }
// opts (host settings): gravity multiplier, tank (1 = normal jetpack, 0 = none, Infinity = unlimited), regen multiplier
export const DEFAULT_OPTS = { gravity: 1, tank: 1, regen: 1 };
export function stepBody(b, input, map, dt = PHYS.TICK, opts = DEFAULT_OPTS) {
  const P = PHYS;
  // crouch only on the ground; stand up only if there is headroom
  let crouch = !!input.crouch && b.onGround;
  if (!crouch && b.crouch && box(map, b.x, b.y, P.HEIGHT)) crouch = true;
  b.crouch = crouch;
  const h = crouch ? P.CROUCH_HEIGHT : P.HEIGHT;

  const mx = Math.max(-1, Math.min(1, input.mx || 0));
  const target = mx * (crouch ? P.CROUCH_RUN : P.RUN);
  let accel = (b.onGround ? P.GROUND_ACCEL : P.AIR_ACCEL) * dt;
  // after a melee lunge, speed beyond the run target (or against no input) fades slowly
  if (b.lunge > 0 && Math.abs(b.vx) > Math.abs(target) && Math.sign(b.vx) !== -Math.sign(target)) accel = P.LUNGE_DECEL * dt;
  if (b.vx < target) b.vx = Math.min(target, b.vx + accel);
  else if (b.vx > target) b.vx = Math.max(target, b.vx - accel);
  meleeTimers(b, dt);

  if (b.boost > 0) b.boost = Math.max(0, b.boost - dt);
  if (b.emp > 0) b.emp = Math.max(0, b.emp - dt);

  const tank = opts.tank ?? 1;
  const zeroG = (opts.gravity ?? 1) === 0;
  if (zeroG) return floatStep(b, input, map, dt, crouch, h);
  const unlimited = tank === Infinity || b.boost > 0;
  const canJet = input.jet && !crouch && b.emp <= 0 && tank > 0 && (b.fuel > 0 || unlimited);
  b.jetting = !!canJet;
  if (canJet) {
    b.vy -= P.JET_ACCEL * (b.boost > 0 ? 1.2 : 1) * dt;
    if (!unlimited) b.fuel = Math.max(0, b.fuel - (P.FUEL_DRAIN / tank) * dt);
    b.regenWait = P.FUEL_REGEN_DELAY;
  } else if (b.regenWait > 0) {
    b.regenWait -= dt;
  } else {
    b.fuel = Math.min(1, b.fuel + (P.FUEL_REGEN * (opts.regen ?? 1) / Math.max(tank, 0.25)) * dt);
  }
  if (tank === Infinity) b.fuel = 1;

  b.vy += P.GRAVITY * (opts.gravity ?? 1) * dt;
  b.vy = Math.max(-P.MAX_RISE * (b.boost > 0 ? 1.15 : 1), Math.min(P.MAX_FALL, b.vy));

  // horizontal, in small steps, climbing pebbles and slopes
  let dx = b.vx * dt;
  const sx = Math.sign(dx);
  while (dx !== 0) {
    const step = Math.abs(dx) > 1 ? sx : dx;
    const nx = b.x + step;
    if (!box(map, nx, b.y, h)) {
      b.x = nx;
    } else {
      let climbed = false;
      const maxUp = b.onGround ? P.STEP_UP : 3;
      for (let up = 1; up <= maxUp; up++) {
        if (!box(map, nx, b.y - up, h)) { b.x = nx; b.y -= up; climbed = true; break; }
      }
      if (!climbed) { b.vx = 0; break; }
    }
    dx -= step;
  }

  // vertical
  let dy = b.vy * dt;
  const sy = Math.sign(dy);
  let landed = false;
  while (dy !== 0) {
    const step = Math.abs(dy) > 1 ? sy : dy;
    if (!box(map, b.x, b.y + step, h)) {
      b.y += step;
    } else {
      if (step > 0) landed = true;
      b.vy = 0;
      break;
    }
    dy -= step;
  }

  // keep feet on downhill slopes when walking
  if (!landed && b.onGround && !b.jetting && b.vy >= 0) {
    for (let d = 1; d <= P.SNAP_DOWN; d++) {
      if (box(map, b.x, b.y + d, h)) { b.y += d - 1; landed = true; b.vy = 0; break; }
    }
  }
  b.onGround = landed || box(map, b.x, b.y + 1, h);
  if (b.onGround && b.vy > 0) b.vy = 0;
  return b;
}

// Zero gravity (host setting GRAVITY 0): drift and settle; the jetpack pushes up, down/crouch pushes down.
// No weight to lift, so no fuel is used.
const ZERO_G_THRUST = 900, ZERO_G_DRAG = 2.5;
function floatStep(b, input, map, dt, crouch, h) {
  const P = PHYS;
  const up = input.jet && b.emp <= 0, down = input.crouch && !b.onGround;
  b.jetting = !!up;
  if (up) b.vy -= ZERO_G_THRUST * dt;
  if (down) b.vy += ZERO_G_THRUST * dt;
  const drag = Math.exp(-ZERO_G_DRAG * dt);
  if (!up && !down) b.vy *= drag;
  if (!input.mx) b.vx *= drag;
  b.vy = Math.max(-P.MAX_RISE, Math.min(P.MAX_RISE, b.vy));
  b.fuel = Math.min(1, b.fuel + P.FUEL_REGEN * dt);
  // same stepping collision as normal movement
  let dx = b.vx * dt;
  const sx = Math.sign(dx);
  while (dx !== 0) {
    const step = Math.abs(dx) > 1 ? sx : dx;
    if (!box(map, b.x + step, b.y, h)) b.x += step; else { b.vx = 0; break; }
    dx -= step;
  }
  let dy = b.vy * dt;
  const sy = Math.sign(dy);
  let landed = false;
  while (dy !== 0) {
    const step = Math.abs(dy) > 1 ? sy : dy;
    if (!box(map, b.x, b.y + step, h)) b.y += step;
    else { if (step > 0) landed = true; b.vy = 0; break; }
    dy -= step;
  }
  b.onGround = landed || box(map, b.x, b.y + 1, h);
  return b;
}

function meleeTimers(b, dt) {
  const P = PHYS;
  if ((b.charge ?? 0) < P.MELEE_CHARGE_MAX) b.charge = (b.charge ?? 0) + P.MELEE_CHARGE_RATE * dt;
  if (b.meleeCool > 0) b.meleeCool = Math.max(0, b.meleeCool - dt);
  if (b.lunge > 0) b.lunge = Math.max(0, b.lunge - dt);
}

// Start a melee swing if the button allows one; lunges along the aim. Shared by the server and the
// client's prediction so your own lunge shows at once. Returns true when a swing starts.
export function tryMelee(b, aim) {
  const P = PHYS;
  if (b.meleeCool > 0) return false;
  b.meleeCool = P.MELEE_INTERVAL;
  const dx = Math.cos(aim), dy = Math.sin(aim);
  const speed = Math.hypot(b.vx, b.vy);
  const along = speed > 0 ? (b.vx * dx + b.vy * dy) / speed : 0;
  if (!(speed >= P.MELEE_MAX_SPEED && along > 0) && b.charge > 0) {
    b.vx += dx * b.charge;
    b.vy += dy * b.charge;
    b.lunge = P.LUNGE_TIME;
  }
  b.charge = Math.max(0, b.charge - P.MELEE_CHARGE_COST);
  return true;
}

export const bodyHeight = (b) => (b.crouch ? PHYS.CROUCH_HEIGHT : PHYS.HEIGHT);

// Ray vs a soldier's box; returns hit distance or -1.
export function rayHitsBody(b, x, y, dx, dy, maxDist) {
  const h = bodyHeight(b);
  const l = b.x - PHYS.WIDTH / 2, r = b.x + PHYS.WIDTH / 2, t = b.y - h, bt = b.y;
  let tmin = 0, tmax = maxDist;
  for (const [o, d, lo, hi] of [[x, dx, l, r], [y, dy, t, bt]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}
