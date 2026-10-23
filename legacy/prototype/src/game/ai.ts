import { MAP } from './map';
import { findPath } from './nav';
import { PLAYER_H, PLAYER_W, activeWeapon, rand, sameTeam } from './sim';
import { WEAPONS } from './weapons';
import type { BotState, Player, World } from './types';
import { emptyInput } from './types';

export function newBotState(skill: number): BotState {
  return {
    skill, think: 0, strafe: 1, strafeT: 0, jetT: 0, stuckT: 0, lastX: 0, lastY: 0, aimErr: 0, aimErrT: 0, seekItem: -1,
    path: [], pathIdx: 0, pathT: 0, goalX: -1e9, goalY: -1e9,
  };
}

/** Follow an A* path to (tx,ty), repathing when the goal moves or the path goes stale. */
function navigateTo(p: Player, tx: number, ty: number) {
  const ai = p.ai!;
  ai.pathT -= 1 / 60;
  const moved = Math.hypot(tx - ai.goalX, ty - ai.goalY) > 90;
  if (moved || ai.pathT <= 0) {
    const found = findPath(p.x, p.y, tx, ty);
    ai.path = found ?? [];
    ai.pathIdx = Math.min(1, Math.max(0, ai.path.length - 1));
    ai.goalX = tx; ai.goalY = ty;
    // an unreachable goal must not trigger a full-map search every tick
    ai.pathT = (found ? 0.7 : 2) + Math.random() * 0.5;
  }
  // advance past nodes we have reached, then aim a few nodes ahead for smoother motion
  while (ai.pathIdx < ai.path.length - 1 && Math.hypot(ai.path[ai.pathIdx].x - p.x, ai.path[ai.pathIdx].y - p.y) < 22) ai.pathIdx++;
  const look = ai.path[Math.min(ai.path.length - 1, ai.pathIdx + 1)] ?? { x: tx, y: ty };
  const i = p.input;
  const dx = look.x - p.x;
  if (dx > 14) i.right = true; else if (dx < -14) i.left = true;
  if (look.y < p.y - 18 && (p.fuel > 0.05 || !p.onGround)) i.jet = true;
  if (p.onGround && (i.right || i.left) && wallAhead(p, i.right ? 1 : -1) && look.y <= p.y + 10) i.jet = true;
}

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function wallAhead(p: Player, dir: number): boolean {
  return MAP.rectSolid(p.x + dir * (PLAYER_W / 2 + 6), p.y - PLAYER_H / 2 + 4, 6, PLAYER_H - 22);
}

function groundAhead(p: Player, dir: number): boolean {
  return MAP.rectSolid(p.x + dir * 22, p.y + PLAYER_H / 2 + 2, 4, 90);
}

/** Simple steering toward a point: run, hop obstacles and climb with the jetpack. */
function steer(p: Player, tx: number, ty: number, stopDist: number) {
  const i = p.input;
  const dx = tx - p.x;
  const dir = Math.sign(dx);
  if (Math.abs(dx) > stopDist) {
    if (dir > 0) i.right = true; else i.left = true;
    if (p.onGround && wallAhead(p, dir)) i.jet = true;
    if (!p.onGround && p.vy > 80 && !groundAhead(p, dir) && p.fuel > 0.2) i.jet = true;
  }
  if (ty < p.y - 50 && p.fuel > 0.1) i.jet = true;
  if (ty > p.y + 60 && Math.abs(dx) < 60) { /* drop down */ }
}

export function botThink(w: World, p: Player, dt: number) {
  const ai = p.ai;
  if (!ai || !p.alive) return;
  const i = p.input;
  const prevAim = i.aim;
  Object.assign(i, emptyInput(), { aim: prevAim });

  ai.think -= dt; ai.strafeT -= dt; ai.jetT -= dt; ai.aimErrT -= dt;
  if (ai.strafeT <= 0) { ai.strafe = rand(w) < 0.5 ? -1 : 1; ai.strafeT = 0.5 + rand(w) * 1.5; }
  if (ai.aimErrT <= 0) { ai.aimErr = (rand(w) - 0.5) * (1.2 - ai.skill) * 0.55; ai.aimErrT = 0.25 + rand(w) * 0.4; }

  // stuck detection
  ai.stuckT += dt;
  if (ai.stuckT > 0.7) {
    if (Math.hypot(p.x - ai.lastX, p.y - ai.lastY) < 6 && (p.input.left || p.input.right || ai.seekItem >= 0)) ai.jetT = 0.6;
    ai.lastX = p.x; ai.lastY = p.y; ai.stuckT = 0;
  }

  // choose a target
  let target: Player | null = null;
  let best = 1e9;
  for (const o of w.players) {
    if (o === p || !o.alive || sameTeam(w, o, p)) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    const los = !MAP.blocked(p.x, p.y - 6, o.x, o.y - 6);
    const score = d + (los ? 0 : 600);
    // shoot at anything visible; otherwise only chase foes that are reasonably close
    if (score < best && (los ? d < 1200 : d < 700)) { best = score; target = o; }
  }

  // one navigation goal per tick: two different goals would make the path cache thrash and re-run A*
  let navGoal: { x: number; y: number } | null = null;
  const ws = activeWeapon(p);
  const def = WEAPONS[ws.id];

  if (target) {
    const dx = target.x - p.x, dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    const los = !MAP.blocked(p.x, p.y - 6, target.x, target.y - 6);
    const flight = def.speed > 0 ? dist / def.speed : 0;
    const lead = 0.6 * ai.skill;
    const ax = target.x + target.vx * flight * lead - p.x;
    const ay = target.y + target.vy * flight * lead - (p.y - 6);
    const want = Math.atan2(ay, ax) + ai.aimErr;
    i.aim = prevAim + angleDiff(prevAim, want) * Math.min(1, dt * (5 + ai.skill * 9));

    const err = Math.abs(angleDiff(i.aim, Math.atan2(dy, dx)));
    const maxRange = def.kind === 'flame' ? 240 : def.kind === 'shield' ? 40 : def.speed * def.life * 0.8;
    if (los && dist < maxRange && err < 0.18 + (1 - ai.skill) * 0.15) i.fire = true;
    if (def.kind === 'shield' && dist > 50) i.fire = false;

    // grenades at medium range when no clear shot
    if (!los && dist < 450 && dist > 150 && rand(w) < 0.004 && (p.grenades.fragnade || p.grenades.gasnade || p.grenades.proxynade)) {
      i.aim = Math.atan2(dy - 80, dx); i.grenade = true;
    }

    const pref = def.kind === 'flame' ? 120 : ws.id === 'm93ba' ? 520 : ws.id === 'shotgun' ? 160 : 300;
    if (los) {
      if (dist > pref + 60) { if (dist > 420) navGoal = { x: target.x, y: target.y }; else steer(p, target.x, target.y, 20); }
      else if (dist < pref - 60) { if (dx > 0) i.left = true; else i.right = true; }
      else if (ai.strafe > 0) i.right = true; else i.left = true;
      if (dy < -70) i.jet = true;
      if (p.hp < 35 && p.fuel > 0.3 && rand(w) < 0.03) ai.jetT = 0.5;
      if (p.onGround && rand(w) < 0.008) ai.jetT = 0.25;
    } else {
      navGoal = { x: target.x, y: target.y };
    }
  } else {
    // objectives and items
    const want = pickObjective(w, p);
    navGoal = want;
    i.aim = prevAim + angleDiff(prevAim, p.vx >= 0 ? 0 : Math.PI) * Math.min(1, dt * 4);
  }

  // CTF objectives override movement (aim and fire stay with the combat logic above)
  const goal = w.config.mode === 'ctf' ? ctfGoal(w, p) : null;
  if (goal) {
    const close = target && !p.carrying && Math.hypot(target.x - p.x, target.y - p.y) < 170 && !MAP.blocked(p.x, p.y - 6, target.x, target.y - 6);
    if (!close) {
      i.left = false; i.right = false; i.jet = false;
      navGoal = goal;
    }
  }
  if (navGoal) navigateTo(p, navGoal.x, navGoal.y);

  if (ai.jetT > 0) i.jet = true;
  if (ws.mag < def.mag * 0.25 && ws.reserve > 0 && !i.fire) i.reload = true;
}

/** Roles: every third bot defends; the rest attack. Anyone recovers a displaced home flag. */
function ctfGoal(w: World, p: Player): { x: number; y: number } | null {
  const own = w.flags.find((f) => f.team === p.team);
  const enemy = w.flags.find((f) => f.team !== p.team);
  if (!own || !enemy) return null;
  if (p.carrying) return { x: own.homeX, y: own.homeY };
  const ownAway = own.x !== own.homeX || own.y !== own.homeY;
  if (ownAway) return { x: own.x, y: own.y };
  if (p.id % 3 === 0) return { x: own.homeX + (p.id % 2 ? 120 : -120), y: own.homeY };
  return { x: enemy.x, y: enemy.y };
}

function pickObjective(w: World, p: Player): { x: number; y: number } {
  const ai = p.ai!;
  // nearest available item that is useful
  let bestI = -1, bd = 1e9;
  w.pickups.forEach((s, idx) => {
    if (!s.item) return;
    if (s.item === 'healthpack' && p.hp > 80) return;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < bd) { bd = d; bestI = idx; }
  });
  ai.seekItem = bestI;
  const starter = activeWeapon(p).id === 'uzi' || activeWeapon(p).id === 'magnum';
  if (bestI >= 0 && (bd < 600 || (starter && bd < 1800))) return { x: w.pickups[bestI].x, y: w.pickups[bestI].y - 10 };
  const foe = w.players.find((o) => o.alive && o !== p && !sameTeam(w, o, p));
  return foe ? { x: foe.x, y: foe.y } : { x: p.x, y: p.y };
}
