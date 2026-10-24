import * as await_weapons from '../shared/weapons.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameMap } from '../shared/map.js';
import { PHYS, newBody, stepBody } from '../shared/physics.js';
import { Game, settle } from '../server/game.mjs';

const mapJson = JSON.parse(fs.readFileSync(new URL('../public/assets/map/catacombs.json', import.meta.url)));
const map = new GameMap(mapJson);

// Controllable clock: the game reads Date.now() for respawns, spawn protection and timers.
let clock = 1_000_000;
Date.now = () => clock;

const fakeWs = () => ({ readyState: 1, sent: [], send(m) { this.sent.push(JSON.parse(m)); } });

function setup(mode = 'ffa') {
  const game = new Game(map, () => {});
  const a = game.addPlayer(fakeWs(), { name: 'Alpha' });
  const b = game.addPlayer(fakeWs(), { name: 'Bravo' });
  game.handle(a, { t: 'config', mode, limit: 5, minutes: 8 });
  game.handle(a, { t: 'start' });
  return { game, a, b };
}

// Middle corridor of Catacombs (the blue flag stands at 481,1184).
function place(p, x, y = 1210) {
  p.body = newBody(x, y);
  settle(map, p.body);
  p.needFreshFire = false; // tests fire straight away; the spawn guard has its own test
  p.shieldUntil = 0;
}

let seq = 0;
const input = (game, p, fields) => { game.handle(p, { t: 'in', s: ++seq, x: 0, b: 0, a: p.aim, ...fields }); };
const run = (game, ticks) => { for (let i = 0; i < ticks; i++) { clock += 1000 / 60; game.update(PHYS.TICK); } };

beforeEach(() => { clock = 1_000_000; });

test('map: spawn points are open, rock is solid', () => {
  for (const o of map.byPrefix('sp_p_')) assert.equal(map.solidAt(o.x, o.y - 20), 0, `${o.name} inside rock`);
  assert.equal(map.solidAt(-5, -5), 1, 'beyond the map edge counts as solid');
  assert.ok(map.raycast(700, 1190, 0, -1, 2000) < 200, 'ceiling above the middle corridor');
});

test('physics: soldier stands, walks, jets up and is stopped by walls', () => {
  const b = newBody(900, 1210);
  for (let i = 0; i < 120; i++) stepBody(b, { mx: 0 }, map);
  assert.ok(b.onGround, 'lands on the corridor floor');
  const y0 = b.y;
  for (let i = 0; i < 30; i++) stepBody(b, { mx: 1 }, map);
  assert.ok(b.x > 900 + 60, `walks right (x=${b.x})`);
  for (let i = 0; i < 20; i++) stepBody(b, { mx: 0, jet: true }, map);
  assert.ok(b.y < y0 - 10, 'jetpack lifts');
  assert.ok(b.fuel < 1, 'jetpack drains fuel');
  for (let i = 0; i < 600; i++) stepBody(b, { mx: 0, jet: true }, map);
  assert.ok(!map.rectSolid(b.x - 11, b.y - 50, b.x + 11, b.y), 'never ends inside rock');
});

test('ffa: hitscan kills, credits the killer, drops a gun and respawns', () => {
  const { game, a, b } = setup('ffa');
  place(a, 900); place(b, 1060);
  a.slots = ['m93ba', 'deagle']; a.slot = 0; a.guns = { m93ba: { mag: 3, reserve: 15 }, deagle: { mag: 15, reserve: 30 } };
  a.aim = Math.atan2((b.body.y - 30) - (a.body.y - 31), b.body.x - a.body.x);
  input(game, a, { b: 4 }); run(game, 1);
  assert.equal(b.hp, 25, 'sniper does 75 [RE]');
  run(game, 60);
  input(game, a, { b: 0 }); input(game, a, { b: 4 }); run(game, 2);
  assert.equal(b.alive, false);
  assert.equal(a.kills, 1);
  assert.equal(b.deaths, 1);
  assert.ok([...game.items.values()].some((it) => !it.spawner && it.type === 'uzi'), 'victim dropped the uzi');
  run(game, 60 * 3 + 5);
  assert.equal(b.alive, true, 'respawned after 3 s');
  assert.equal(b.hp, 100);
});

test('spawn protection blocks damage until it expires or you shoot', () => {
  const { game, a, b } = setup('ffa');
  place(a, 900); place(b, 1060);
  b.shieldUntil = clock + 2000;
  game.damage(b, 50, a, 'ak47');
  assert.equal(b.hp, 100);
  clock += 2500;
  game.damage(b, 50, a, 'ak47');
  assert.equal(b.hp, 50);
});

test('frag grenade explodes on its fuse and hurts by distance', () => {
  const { game, a, b } = setup('ffa');
  place(a, 900); place(b, 980);
  a.aim = Math.PI / 2; // drop it at our feet
  a.nades.fragnade = 1;
  input(game, a, { b: 32 }); run(game, 1);
  assert.equal(a.nades.fragnade, 0);
  const nade = [...game.projectiles.values()].find((p) => p.kind === 'nade');
  assert.ok(nade);
  run(game, 60 * 3);
  assert.equal(game.projectiles.size, 0, 'exploded');
  assert.ok(b.hp < 100 || !b.alive, 'bravo was hurt by the blast');
  assert.ok(a.hp < 100, 'the thrower takes self-damage too');
});

test('pickup swaps the held gun for the one on the floor', () => {
  const { game, a } = setup('ffa');
  place(a, 900);
  game.dropItem('ak47', a.body.x + 10, a.body.y - 20, 0, 0, null);
  input(game, a, { b: 256 }); run(game, 1);
  assert.equal(a.slots[a.slot], 'ak47');
  assert.equal(a.guns.ak47.mag, 35, 'AK mag is 35 [RE]');
  assert.ok([...game.items.values()].some((it) => it.type === 'uzi'), 'old gun dropped');
});

test('team modes: no friendly fire, enemy damage counts', () => {
  const { game, a, b } = setup('tdm');
  b.team = a.team;
  place(a, 900); place(b, 1060);
  game.damage(b, 40, a, 'ak47');
  assert.equal(b.hp, 100, 'teammates are safe');
  b.team = 1 - a.team;
  game.damage(b, 100, a, 'ak47');
  assert.equal(b.alive, false);
  assert.equal(game.teamScore[a.team], 1);
});

test('ctf: take the enemy flag and bring it home to capture', () => {
  const { game, a } = setup('ctf');
  a.team = 0;
  const enemy = game.flags[1];
  place(a, enemy.homeX, enemy.homeY + 20);
  run(game, 1);
  assert.equal(enemy.carrier, a.id, 'picked up the orange flag');
  const home = game.flags[0];
  place(a, home.homeX, home.homeY + 20);
  run(game, 1);
  assert.equal(game.teamScore[0], 1, 'capture scored');
  assert.equal(enemy.atHome, true, 'flag reset');
});

test('match ends at the kill limit and returns to the lobby', () => {
  const { game, a, b } = setup('ffa');
  place(a, 900); place(b, 1060);
  for (let i = 0; i < 5; i++) {
    b.shieldUntil = 0; b.alive = true; b.hp = 100;
    game.damage(b, 200, a, 'ak47');
    run(game, 1);
  }
  assert.equal(game.phase, 'over');
  clock += 13_000;
  run(game, 1);
  assert.equal(game.phase, 'lobby');
});

test('every spawn point settles onto a floor, not into rock', () => {
  for (const o of map.objects.filter((q) => /^(sp_p_|ctf_sp_)/.test(q.name))) {
    for (const dx of [-40, 0, 40]) {
      if (o.name.startsWith('sp_p_') && dx) continue;
      const b = newBody(o.x + dx, o.y);
      settle(map, b);
      assert.ok(!map.rectSolid(b.x - 11, b.y - 50, b.x + 11, b.y), `${o.name}${dx} embedded`);
      assert.ok(map.rectSolid(b.x - 11, b.y - 50, b.x + 11, b.y + 1), `${o.name}${dx} floating`);
      assert.ok(Math.abs(b.y - o.y) < 400, `${o.name}${dx} moved ${b.y - o.y}`);
    }
  }
});

test('collision follows the original tile shapes: soldiers walk the floors without sinking or snagging', () => {
  // gids 70-72 are decoration in MapShapeFactory, so they never block
  const deco = mapJson.layers.tile.findIndex((g) => g >= 70 && g <= 72);
  if (deco >= 0) assert.ok(!map.solidAt((deco % mapJson.width) * 64 + 32, Math.floor(deco / mapJson.width) * 64 + 32));
  for (const o of map.objects.filter((q) => /^(sp_p_|ctf_sp_)/.test(q.name))) {
    let best = 0;
    for (const mx of [-1, 1]) {
      const b = newBody(o.x, o.y);
      settle(map, b);
      const x0 = b.x;
      for (let i = 0; i < 120; i++) {
        stepBody(b, { mx }, map);
        assert.ok(!map.rectSolid(b.x - 11, b.y - 50, b.x + 11, b.y), `${o.name} sank into rock at ${b.x},${b.y}`);
        if (b.onGround) assert.ok(map.rectSolid(b.x - 11, b.y, b.x + 11, b.y + 1), `${o.name} feet off the floor at ${b.x},${b.y}`);
      }
      best = Math.max(best, Math.abs(b.x - x0));
    }
    assert.ok(best > 150, `${o.name} snagged: walked only ${best.toFixed(0)} pt in 2 s`);
  }
});

test('a player joining mid-match does not crash snapshots and spawns shortly after', () => {
  const { game } = setup('ffa');
  const late = game.addPlayer(fakeWs(), { name: 'Late' });
  assert.equal(late.alive, false);
  game.snapshot();
  assert.ok(late.ws.sent.some((m) => m.t === 'snap' && m.me.alive === false), 'late joiner gets snapshots while waiting');
  run(game, 70);
  assert.equal(late.alive, true);
  game.snapshot();
});

// ---------------- host settings ----------------
import { sanitizeConfig, physicsOptions, DEFAULT_CONFIG } from '../shared/config.js';

function configured(patch, mode = 'ffa') {
  const game = new Game(map, () => {});
  const a = game.addPlayer(fakeWs(), { name: 'Host' });
  const b = game.addPlayer(fakeWs(), { name: 'Guest' });
  game.handle(a, { t: 'config', mode, ...patch });
  game.handle(a, { t: 'start' });
  return { game, a, b };
}

test('config: only the host can change it, and junk is rejected', () => {
  const game = new Game(map, () => {});
  const host = game.addPlayer(fakeWs(), { name: 'Host' });
  const guest = game.addPlayer(fakeWs(), { name: 'Guest' });
  game.handle(guest, { t: 'config', gravity: 2 });
  assert.equal(game.config.gravity, 1, 'guest cannot change rules');
  game.handle(host, { t: 'config', gravity: 999, boost: 'lots', drops: 0, specials: ['fastReload', 'nope'], loadout: { primary: 'bazooka', secondary: 'magnum' } });
  assert.equal(game.config.gravity, 1);
  assert.equal(game.config.boost, 100);
  assert.equal(game.config.drops, 0);
  assert.deepEqual(game.config.specials, ['fastReload']);
  assert.equal(game.config.loadout.primary, 'uzi');
  assert.equal(game.config.loadout.secondary, 'magnum');
  assert.deepEqual(sanitizeConfig({}, DEFAULT_CONFIG), DEFAULT_CONFIG);
});

const SHAFT_X = [1190, 1210, 1230, 1250].find((x) => !map.rectSolid(x - 11, 940, x + 11, 1000) && map.raycast(x, 1000, 0, 1, 2000) > 200);
test('gravity: low gravity falls slower, high gravity faster', () => {
  const fall = (g) => {
    const b = newBody(SHAFT_X, 1000); // open vertical shaft
    for (let i = 0; i < 10; i++) stepBody(b, { mx: 0 }, map, PHYS.TICK, physicsOptions({ ...DEFAULT_CONFIG, gravity: g }));
    return b.vy;
  };
  assert.ok(fall(0.5) < fall(1) && fall(1) < fall(2), `${fall(0.5)} < ${fall(1)} < ${fall(2)}`);
});

test('boost: no jetpack, normal tank, and unlimited', () => {
  const fly = (boost) => {
    const b = newBody(900, 1210);
    for (let i = 0; i < 60; i++) stepBody(b, { mx: 0 }, map);
    const y0 = b.y;
    for (let i = 0; i < 180; i++) stepBody(b, { mx: 0, jet: true }, map, PHYS.TICK, physicsOptions({ ...DEFAULT_CONFIG, boost }));
    return { rose: y0 - b.y > 5 || b.jetting, fuel: b.fuel };
  };
  assert.equal(fly(0).rose, false, 'boost 0 = no jetpack');
  assert.ok(fly(100).fuel < 0.1, 'normal tank runs dry in 3 s');
  assert.equal(fly(-1).fuel, 1, 'unlimited never drains');
  assert.ok(fly(200).fuel > fly(100).fuel, 'bigger tank lasts longer');
});

test('map drops off: no weapon spawners; on: they respawn after the set time', () => {
  const off = configured({ drops: 0 });
  assert.equal(off.game.items.size, 0);
  const on = configured({ drops: 10 });
  const count = on.game.items.size;
  assert.ok(count > 0);
  const it = [...on.game.items.values()][0];
  on.game.takeItem(it);
  run(on.game, 60 * 9);
  assert.equal(on.game.items.size, count - 1, 'not back yet at 9 s');
  run(on.game, 60 * 2);
  assert.equal(on.game.items.size, count, 'back after 10 s');
});

test('respawn time and default loadout follow the host', () => {
  const { game, a, b } = configured({ respawn: 8, loadout: { primary: 'm93ba', secondary: 'magnum', fragnade: 0, gasnade: 3, proxynade: 1 } });
  assert.deepEqual(a.slots, ['m93ba', 'magnum']);
  assert.deepEqual(a.nades, { fragnade: 0, gasnade: 3, proxynade: 1 });
  assert.equal(a.nadeSel, 'gasnade');
  place(a, 900); place(b, 1060);
  game.damage(b, 500, a, 'm93ba');
  run(game, 60 * 7);
  assert.equal(b.alive, false, 'still waiting at 7 s');
  run(game, 60 * 2);
  assert.equal(b.alive, true);
});

test('friendly fire on lets teammates hurt each other', () => {
  const { game, a, b } = configured({ friendlyFire: true }, 'tdm');
  b.team = a.team;
  place(a, 900); place(b, 1060);
  game.damage(b, 40, a, 'ak47');
  assert.equal(b.hp, 60);
});

test('global specials change the rules', () => {
  const { game, a } = configured({ specials: ['hiCapMags', 'fastReload', 'grenadier', 'meleePower'], loadout: { primary: 'ak47' } });
  assert.equal(a.guns.ak47.mag, 53, 'hi-cap: 35 -> 53');
  assert.equal(game.reloadTime('ak47'), 1.2, 'fast reload: 2.0 s -> 1.2 s');
  assert.equal(a.nades.fragnade, 4, 'grenadier: +2 frags');
  assert.equal(game.nadeMax(), 5);
  const { game: g2, a: h, b: v } = configured({ specials: ['meleePower'] });
  place(h, 900); place(v, 925);
  h.aim = 0;
  input(g2, h, { b: 128 }); run(g2, 1);
  assert.equal(v.hp, 30, 'melee power: 35 x 2');
  const { game: g3, a: d } = configured({ specials: ['deflector'] });
  place(d, 900);
  g3.explode(d.body.x, d.body.y - 25, 110, 100, null, 'fragnade');
  assert.ok(d.hp >= 50, `deflector halves blast damage (hp ${d.hp})`);
});

test('health regen off: no healing', () => {
  const { game, a } = configured({ healthRegen: false });
  place(a, 900);
  game.damage(a, 50, null, 'fall');
  run(game, 60 * 10);
  assert.equal(a.hp, 50);
});

test('max players is enforced by the host setting', () => {
  const game = new Game(map, () => {});
  const host = game.addPlayer(fakeWs(), { name: 'Host' });
  game.handle(host, { t: 'config', maxPlayers: 2 });
  assert.equal(game.config.maxPlayers, 2);
});

test('an emptied lobby resets to default rules', () => {
  const game = new Game(map, () => {});
  const host = game.addPlayer(fakeWs(), { name: 'Host' });
  game.handle(host, { t: 'config', gravity: 2, drops: 0 });
  game.removePlayer(host);
  assert.equal(game.config.gravity, 1);
  assert.equal(game.config.drops, 18);
});

// ---------------- dual wield (from the APK's dual rules) and the remaining guns ----------------
function armed(loadout = {}) {
  const { game, a, b } = configured({ loadout: { primary: 'uzi', secondary: 'deagle', ...loadout } });
  place(a, 900); place(b, 1060);
  a.aim = 0;
  return { game, a, b };
}
const pickUp = (game, p) => { input(game, p, { b: 256 }); run(game, 1); };

test('dual: a second Uzi makes a pair; shots alternate hands and both mags drain', () => {
  const { game, a } = armed();
  game.dropItem('uzi', a.body.x + 8, a.body.y - 20, 0, 0, null);
  pickUp(game, a);
  assert.equal(a.off[0]?.type, 'uzi', 'now holding Uzi + Uzi');
  const before = [a.guns.uzi.mag, a.off[0].mag];
  for (let i = 0; i < 40; i++) input(game, a, { b: 4, a: 0 });
  run(game, 40);
  assert.ok(a.guns.uzi.mag < before[0] && a.off[0].mag < before[1], 'both guns fired');
  assert.ok(Math.abs((before[0] - a.guns.uzi.mag) - (before[1] - a.off[0].mag)) <= 1, 'alternating hands');
});

test('dual: holding a pair, another dual gun asks "Replace which gun?" and replaces the chosen hand', () => {
  const { game, a } = armed({ primaryDual: true });
  assert.deepEqual([a.slots[0], a.off[0].type], ['uzi', 'uzi'], 'loadout started as a pair');
  const it = game.dropItem('tec9', a.body.x + 8, a.body.y - 20, 0, 0, null);
  pickUp(game, a);
  const choice = a.ws.sent.find((m) => m.t === 'choice');
  assert.deepEqual([choice.type, choice.main, choice.off], ['tec9', 'uzi', 'uzi']);
  assert.equal(a.off[0].type, 'uzi', 'nothing changes until the player chooses');
  game.handle(a, { t: 'replaceGun', item: it.id, hand: 'off' });
  assert.deepEqual([a.slots[0], a.off[0].type], ['uzi', 'tec9']);
  assert.ok([...game.items.values()].some((x) => x.type === 'uzi'), 'replaced Uzi dropped');
});

test('dual: reload refills both guns; death drops both', () => {
  const { game, a, b } = armed({ primaryDual: true });
  a.guns.uzi.mag = 0; a.off[0].mag = 0;
  input(game, a, { b: 8 }); run(game, 1);
  assert.ok(a.reloadT > 0);
  run(game, 60 * 2);
  for (let i = 0; i < 2; i++) input(game, a, { b: 0 });
  run(game, 2);
  assert.equal(a.guns.uzi.mag, 40);
  assert.equal(a.off[0].mag, 40);
  game.damage(a, 500, b, 'ak47');
  const uzis = [...game.items.values()].filter((x) => x.type === 'uzi' && !x.spawner);
  assert.equal(uzis.length, 2, 'both Uzis on the floor');
});

test('dual: only pistols/SMGs from the original pair up; a rifle replaces the whole slot', () => {
  const { game, a } = armed({ primaryDual: true });
  game.dropItem('ak47', a.body.x + 8, a.body.y - 20, 0, 0, null);
  pickUp(game, a);
  assert.equal(a.slots[0], 'ak47');
  assert.equal(a.off[0], null, 'pair dropped for the rifle');
  assert.equal([...game.items.values()].filter((x) => x.type === 'uzi').length, 2);
});

test('dual: a pistol can carry a riot shield in the off hand, and it blocks', () => {
  const { game, a, b } = armed({ primary: 'deagle', secondary: 'uzi' });
  game.dropItem('riot', a.body.x + 8, a.body.y - 20, 0, 0, null);
  pickUp(game, a);
  assert.equal(a.off[0]?.type, 'riot');
  a.aim = 0; // facing right, shield toward bravo
  assert.equal(game.shieldBlocks(a, -1), true);
});

test('minigun spins up before firing; RG-6 throws a grenade; Phasr reaches 1300', () => {
  const { game, a } = armed({ primary: 'minigun' });
  const mag = a.guns.minigun.mag;
  for (let i = 0; i < 20; i++) input(game, a, { b: 4, a: 0 });
  run(game, 20);
  assert.equal(a.guns.minigun.mag, mag, 'still spinning up after 1/3 s');
  for (let i = 0; i < 30; i++) input(game, a, { b: 4, a: 0 });
  run(game, 30);
  assert.ok(a.guns.minigun.mag < mag, 'fires once spun up');
  const r = armed({ primary: 'rg6' });
  input(r.game, r.a, { b: 4, a: -0.3 }); run(r.game, 1);
  assert.ok([...r.game.projectiles.values()].some((x) => x.type === 'rg6'));
  const { GUNS } = await_weapons;
  assert.equal(GUNS.phasr.range, 1300);
});

test('default loadout OFF: each soldier spawns with their own pick', () => {
  const { game, a, b } = configured({ defaultLoadout: false, loadout: { primary: 'ak47' } });
  game.handle(b, { t: 'loadout', loadout: { primary: 'm93ba', secondary: 'magnum' } });
  game.respawn(a); game.respawn(b);
  assert.deepEqual(a.slots, ['ak47', 'deagle'], 'no own pick: host loadout');
  assert.deepEqual(b.slots, ['m93ba', 'magnum']);
  const { game: g2, b: b2 } = configured({ defaultLoadout: true, loadout: { primary: 'ak47' } });
  g2.handle(b2, { t: 'loadout', loadout: { primary: 'm93ba' } });
  g2.respawn(b2);
  assert.equal(b2.slots[0], 'ak47', 'default loadout ON overrides personal picks');
});


test('spawn guard: a trigger held through death does not fire after respawn', () => {
  const { game, a, b } = setup('ffa');
  place(a, 900); place(b, 1060);
  game.respawn(a);
  const mag = a.guns[a.slots[0]].mag;
  for (let i = 0; i < 10; i++) input(game, a, { b: 4, a: 0 });
  run(game, 10);
  assert.equal(a.guns[a.slots[0]].mag, mag, 'held fire from before the respawn is ignored');
  input(game, a, { b: 0 }); input(game, a, { b: 4, a: 0 });
  run(game, 2);
  assert.ok(a.guns[a.slots[0]].mag < mag, 'a fresh press fires');
});

test('zero gravity: float, rise with jet, sink with down, drift to rest', () => {
  const opts = { gravity: 0, tank: 1, regen: 1 };
  const b = newBody(SHAFT_X, 1000);
  const y0 = b.y;
  for (let i = 0; i < 60; i++) stepBody(b, { mx: 0 }, map, PHYS.TICK, opts);
  assert.equal(b.y, y0, 'no falling at gravity 0');
  for (let i = 0; i < 30; i++) stepBody(b, { mx: 0, jet: true }, map, PHYS.TICK, opts);
  const up = b.y;
  assert.ok(up < y0 - 20, 'jet rises');
  assert.equal(b.fuel, 1, 'no fuel used');
  for (let i = 0; i < 120; i++) stepBody(b, { mx: 0 }, map, PHYS.TICK, opts);
  assert.ok(Math.abs(b.vy) < 5, 'drifts to rest');
  const rest = b.y;
  for (let i = 0; i < 30; i++) stepBody(b, { mx: 0, crouch: true }, map, PHYS.TICK, opts);
  assert.ok(b.y > rest + 20, 'down/crouch sinks');
});

test('health regen follows the original: +1 HP per second, x3 with the special', () => {
  const { game, a } = configured({});
  place(a, 900);
  a.hp = 50;
  run(game, 60 * 10);
  assert.ok(a.hp >= 59 && a.hp <= 61, `about +10 in 10 s (got ${a.hp})`);
  const r = configured({ specials: ['healthRegen'] });
  place(r.a, 900);
  r.a.hp = 50;
  run(r.game, 60 * 5);
  assert.ok(r.a.hp >= 62 && r.a.hp <= 66, `about +15 in 5 s with Health Regen (got ${r.a.hp})`);
});

test('melee: lunges along the aim with the original charge (0 at spawn, +45/s to 125, -35 a swing, 0.5 s apart)', () => {
  const { game, a } = configured({});
  place(a, 900);
  a.aim = 0;
  input(game, a, { b: 128 }); run(game, 1);
  assert.ok(Math.abs(a.body.vx) < 1, 'no charge right after spawning, so no lunge');
  run(game, 1); input(game, a, { b: 0 }); // release
  for (let i = 0; i < 200; i++) { input(game, a, {}); run(game, 1); } // ~3.3 s of charging
  assert.ok(a.body.charge >= 125, `charge refilled to ${a.body.charge}`);
  const x0 = a.body.x;
  input(game, a, { b: 128 }); run(game, 1);
  assert.ok(a.body.vx > 100, `lunged forward (vx ${a.body.vx})`);
  assert.ok(Math.abs(a.body.charge - 90) < 1, 'a swing spends 35 charge');
  input(game, a, { b: 128 }); run(game, 1);
  assert.ok(Math.abs(a.body.charge - 90) < 2, 'a second press inside 0.5 s does nothing');
  for (let i = 0; i < 30; i++) { input(game, a, {}); run(game, 1); }
  assert.ok(a.body.x - x0 > 30, `the lunge carried the soldier ${a.body.x - x0} pt`);

  // running + melee is faster than running alone
  const dist = (melee) => {
    const { game: g, a: p } = configured({});
    place(p, 900); p.body.charge = 125; p.aim = 0;
    const s = p.body.x;
    for (let i = 0; i < 40; i++) { input(g, p, { x: 1, b: melee && i % 30 === 5 ? 128 : 0 }); run(g, 1); }
    return p.body.x - s;
  };
  assert.ok(dist(true) > dist(false) + 15, `melee while running goes further (${dist(true)} vs ${dist(false)})`);
});

test('melee hits along the aim, not only straight ahead', () => {
  const { game, a, b } = configured({});
  place(a, 900); place(b, 960);
  a.aim = Math.PI; // facing away
  input(game, a, { b: 128 }); run(game, 1);
  assert.equal(b.hp, 100, 'swinging away misses');
  for (let i = 0; i < 40; i++) { input(game, a, {}); run(game, 1); }
  place(a, 900); a.aim = 0;
  input(game, a, { b: 128 }); run(game, 1);
  assert.equal(b.hp, 65, 'swinging at them hits for 35');
});

test('zero gravity: grenades and dropped guns float instead of falling', () => {
  const { game, a } = configured({ gravity: 0, loadout: { fragnade: 2 } });
  place(a, 900);
  a.aim = 0;
  input(game, a, { b: 32 }); run(game, 1);
  const nade = [...game.projectiles.values()].find((p) => p.kind === 'nade');
  assert.ok(nade, 'threw a grenade');
  const vy0 = nade.vy;
  run(game, 10);
  assert.ok(Math.abs(nade.vy - vy0) < 1, `no gravity on the grenade (vy ${vy0} -> ${nade.vy})`);
  const it = game.dropItem('uzi', 900, 1100, 0, 0, null, null);
  run(game, 30);
  assert.ok(Math.abs(it.y - 1100) < 1, 'a dropped gun stays where it was let go');
});
