import { describe, expect, it } from 'vitest';
import { GRENADES } from '../config/grenades';
import { clampSetting, defaultHostSettings, HOST_SETTING_SPECS } from '../config/hostSettings';
import { MATCH_RULES, TICK_DT } from '../config/matchRules';
import { GUNS, GUN_LIST } from '../config/weapons';
import { GUN_IDS } from '../types';
import { createPlayer } from '../logic/player';

// These tables are copied from the Game Flow on purpose: if someone edits a config number by accident,
// the test fails and points at the flow. Change the FLOW first (Dev4 approves), then the config.
//           id              dmg crouch rate  mag  reserve reload zoom
const FLOW_GUN_TABLE: [string, number, number, number, number, number, number, number][] = [
  ['ak47', 14, 5, 8, 30, 90, 2.0, 1.4],
  ['m16', 12, 4, 9, 30, 90, 1.8, 1.4],
  ['tavor', 11, 4, 10, 30, 90, 1.8, 1.2],
  ['xm8', 13, 4, 8, 30, 90, 1.8, 1.6],
  ['m14', 30, 10, 3, 15, 45, 2.2, 2],
  ['m93ba', 95, 30, 0.8, 5, 15, 3.0, 3],
  ['uzi', 7, 2, 14, 30, 90, 1.5, 1],
  ['mp5', 8, 3, 12, 30, 90, 1.6, 1.2],
  ['tec9', 7, 2, 12, 20, 80, 1.4, 1],
  ['desert_eagle', 28, 9, 3, 7, 28, 1.6, 1.2],
  ['shotgun', 10, 3, 1, 6, 18, 2.5, 1],
  ['smaw', 100, 70, 0.5, 1, 4, 2.5, 1.4],
  ['rg6', 50, 40, 1.5, 6, 12, 3.0, 1.2],
  ['flame', 4, 3, 20, 100, 0, 0, 1],
  ['phasr', 20, 7, 4, 12, 36, 2.0, 1.6],
];

describe('weapons config matches the Game Flow table (Section 7)', () => {
  it('has exactly the 15 guns and no others', () => {
    expect(GUN_IDS).toHaveLength(15);
    expect(GUN_LIST).toHaveLength(15);
    expect(Object.keys(GUNS).sort()).toEqual([...GUN_IDS].sort());
  });

  it.each(FLOW_GUN_TABLE)(
    '%s: damage %i, crouch %i, rate %d, mag %i, reserve %i, reload %d, zoom %d',
    (id, damage, crouch, rate, mag, reserve, reload, zoom) => {
      const g = GUNS[id as keyof typeof GUNS];
      expect(g.damage).toBe(damage);
      expect(g.crouchDamage).toBe(crouch);
      expect(g.fireRate).toBe(rate);
      expect(g.magazine).toBe(mag);
      expect(g.reserve).toBe(reserve);
      expect(g.reloadSec).toBe(reload);
      expect(g.zoom).toBe(zoom);
    },
  );

  it('special values: SMAW direct 100 / 70, splash 50 / 40; RG6 splash 50 / 40; shotgun 8 pellets; M16 3-shot burst', () => {
    expect(GUNS.smaw.damage).toBe(100);
    expect(GUNS.smaw.crouchDamage).toBe(70);
    expect(GUNS.smaw.splash).toMatchObject({ damage: 50, crouchDamage: 40 });
    expect(GUNS.rg6.splash).toMatchObject({ damage: 50, crouchDamage: 40 });
    expect(GUNS.shotgun.pellets).toBe(8);
    expect(GUNS.m16.burstSize).toBe(3);
  });

  it('ranges follow the flow words', () => {
    const range = Object.fromEntries(GUN_LIST.map((g) => [g.id, g.range]));
    expect(range).toMatchObject({
      ak47: 'medium',
      m16: 'medium',
      tavor: 'medium',
      xm8: 'medium_long',
      m14: 'long',
      m93ba: 'very_long',
      uzi: 'short',
      mp5: 'short_medium',
      tec9: 'short',
      desert_eagle: 'medium',
      shotgun: 'short',
      smaw: 'long',
      rg6: 'medium',
      flame: 'very_short',
      phasr: 'long',
    });
  });

  it('behaviour types match Phase 08', () => {
    const b = (ids: string[]) => ids.map((id) => GUNS[id as keyof typeof GUNS].behaviour);
    expect(b(['ak47', 'tavor', 'xm8', 'uzi', 'mp5', 'tec9']).every((x) => x === 'hitscan_auto')).toBe(true);
    expect(b(['m16'])).toEqual(['hitscan_burst']);
    expect(b(['m14', 'm93ba', 'desert_eagle', 'phasr']).every((x) => x === 'hitscan_precision')).toBe(true);
    expect(b(['shotgun', 'smaw', 'rg6', 'flame'])).toEqual([
      'pellet',
      'rocket',
      'grenade_launcher',
      'stream',
    ]);
  });
});

describe('grenades config (Section 7)', () => {
  it('frag 90 / 72 with a 3 s fuse; gas 8 / 6 per second for 5 s on landing; proxy 90 / 72, arms after 1 s', () => {
    expect(GRENADES.frag).toMatchObject({ damage: 90, crouchDamage: 72, fuseSec: 3, trigger: 'fuse' });
    expect(GRENADES.gas).toMatchObject({ damage: 8, crouchDamage: 6, durationSec: 5, trigger: 'on_landing' });
    expect(GRENADES.proxy).toMatchObject({ damage: 90, crouchDamage: 72, armSec: 1, trigger: 'proximity' });
    expect(GRENADES.proxy.radiusPx).toBeLessThan(GRENADES.frag.radiusPx); // proxy radius is "small"
  });
});

describe('match rules (Sections 2, 3, 6, 7, 9, 15)', () => {
  it('has the numbers from the flow', () => {
    expect(MATCH_RULES).toMatchObject({
      maxHealth: 100,
      respawnWaitSec: 5,
      spawnShieldSec: 3,
      grenadeCarryLimit: 5,
      pickupVisibleSec: 60,
      pickupGapSec: 5,
      meleeClashFirstHitterLoss: 50,
      explosionCrouchMultiplier: 0.8,
      lobbyAutoStartSec: 120,
      tickRate: 30,
      snapshotRate: 20,
    });
    expect(MATCH_RULES.spawnGrenades).toEqual({ frag: 2, gas: 2, proxy: 0 });
    expect(MATCH_RULES.medkitHealsToFull).toBe(true);
    expect(MATCH_RULES.boostTankRefillsToFull).toBe(true);
  });

  it('the physics timestep is 1/30 s', () => {
    expect(TICK_DT).toBeCloseTo(1 / 30, 12);
  });

  it('a new player spawns with full health and fuel, 2 frag + 2 gas, and a 3 s shield', () => {
    const p = createPlayer({
      id: 'x',
      name: 'Test',
      color: 0,
      x: 0,
      y: 0,
      slots: [
        { kind: 'single', gun: 'ak47', ammo: { magazine: 30, reserve: 90 } },
        { kind: 'single', gun: 'm14', ammo: { magazine: 15, reserve: 45 } },
      ],
    });
    expect(p).toMatchObject({
      health: 100,
      alive: true,
      shieldTimer: 3,
      grenades: { frag: 2, gas: 2, proxy: 0 },
      kills: 0,
      deaths: 0,
      points: 0,
    });
  });
});

describe('host settings (Section 2)', () => {
  it('ranges, steps and defaults match the table', () => {
    expect(HOST_SETTING_SPECS).toEqual({
      playerCount: { min: 2, max: 8, step: 1, default: 8 },
      gameTimeSec: { min: 60, max: 900, step: 30, default: 300 },
      mapDropsSec: { min: 5, max: 60, step: 5, default: 15 },
      gravity: { min: 0, max: 100, step: 10, default: 100 },
      boost: { min: 0, max: 100, step: 10, default: 100 },
    });
    expect(defaultHostSettings()).toEqual({
      playerCount: 8,
      gameTimeSec: 300,
      mapDropsSec: 15,
      gravity: 100,
      boost: 100,
      defaultLoadout: false,
      loadout: null,
    });
  });

  it('clamps to the range and snaps to the step', () => {
    expect(clampSetting('playerCount', 9)).toBe(8);
    expect(clampSetting('playerCount', 1)).toBe(2);
    expect(clampSetting('playerCount', 4.6)).toBe(5);
    expect(clampSetting('gameTimeSec', 10)).toBe(60);
    expect(clampSetting('gameTimeSec', 65)).toBe(60);
    expect(clampSetting('gameTimeSec', 76)).toBe(90);
    expect(clampSetting('gameTimeSec', 99999)).toBe(900);
    expect(clampSetting('mapDropsSec', 12)).toBe(10);
    expect(clampSetting('mapDropsSec', 13)).toBe(15);
    expect(clampSetting('gravity', 44)).toBe(40);
    expect(clampSetting('gravity', -5)).toBe(0);
    expect(clampSetting('boost', 100)).toBe(100);
  });

  it('non-numbers fall back to the default instead of poisoning the match', () => {
    expect(clampSetting('gravity', 'high')).toBe(100);
    expect(clampSetting('gameTimeSec', NaN)).toBe(300);
    expect(clampSetting('boost', undefined)).toBe(100);
    expect(clampSetting('playerCount', Infinity)).toBe(8);
  });
});
