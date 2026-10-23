import { describe, expect, it } from 'vitest';
import { EDGE_DAMAGE_FACTOR, GRENADES } from '../config/grenades';
import { GUNS } from '../config/weapons';
import {
  applyDamage,
  damageAfterCrouch,
  explosionDamageAt,
  isFrontHit,
  type DamageSource,
  type DamageTarget,
} from '../logic/damage';

// Target faces right (+1). Damage travelling toward -x came from the right = FRONT hit.
const target = (over: Partial<DamageTarget> = {}): DamageTarget => ({
  health: 100,
  alive: true,
  crouching: false,
  facing: 1,
  ...over,
});
const FRONT = -1;
const BACK = +1;

const bullet = (gun: keyof typeof GUNS, dir: number): DamageSource => ({
  kind: 'bullet',
  crouchAmount: GUNS[gun].crouchDamage,
  directionX: dir,
});

describe('front / back', () => {
  it('a hit is on the front when the damage travels against the way the target faces', () => {
    expect(isFrontHit(1, -5)).toBe(true);
    expect(isFrontHit(1, 5)).toBe(false);
    expect(isFrontHit(-1, 5)).toBe(true);
    expect(isFrontHit(-1, -5)).toBe(false);
    expect(isFrontHit(1, 0)).toBe(false); // no direction -> full damage
  });
});

describe('bullets and the crouch shield (Game Flow, Section 8)', () => {
  it('AK47: 14 standing, 5 crouching on the front, full 14 on the back', () => {
    const ak = GUNS.ak47;
    expect(applyDamage(target(), ak.damage, bullet('ak47', FRONT)).dealt).toBe(14);
    expect(applyDamage(target({ crouching: true }), ak.damage, bullet('ak47', FRONT)).dealt).toBe(5);
    expect(applyDamage(target({ crouching: true }), ak.damage, bullet('ak47', BACK)).dealt).toBe(14);
  });

  it("uses each gun's own crouch value", () => {
    for (const gun of Object.values(GUNS)) {
      const r = applyDamage(target({ crouching: true }), gun.damage, bullet(gun.id, FRONT));
      expect(r.dealt, gun.id).toBe(gun.crouchDamage);
    }
  });

  it('reports shielded / front / died', () => {
    const r = applyDamage(target({ crouching: true, health: 4 }), 14, bullet('ak47', FRONT));
    expect(r).toMatchObject({ dealt: 5, health: 0, died: true, frontHit: true, shielded: true });
  });
});

describe('SMAW (Game Flow, Sections 7-8)', () => {
  const smaw = GUNS.smaw;
  const direct = (dir: number): DamageSource => ({
    kind: 'bullet',
    crouchAmount: smaw.crouchDamage,
    directionX: dir,
  });
  const splash = (dir: number): DamageSource => ({ kind: 'explosion', directionX: dir });

  it('direct hit: 100 (instant kill) standing, 70 crouching on the front, back = full', () => {
    expect(smaw.damage).toBe(100);
    expect(applyDamage(target(), smaw.damage, direct(FRONT))).toMatchObject({ dealt: 100, died: true });
    expect(applyDamage(target({ crouching: true }), smaw.damage, direct(FRONT)).dealt).toBe(70);
    expect(applyDamage(target({ crouching: true }), smaw.damage, direct(BACK)).dealt).toBe(100);
  });

  it('splash: 50 standing, 40 crouching on the front (x0.8), back = full', () => {
    const s = smaw.splash!;
    expect(applyDamage(target(), s.damage, splash(FRONT)).dealt).toBe(50);
    expect(applyDamage(target({ crouching: true }), s.damage, splash(FRONT)).dealt).toBeCloseTo(40, 10);
    expect(applyDamage(target({ crouching: true }), s.damage, splash(BACK)).dealt).toBe(50);
    expect(s.crouchDamage).toBe(40); // config agrees with the x0.8 rule
  });

  it('RG6 splash: 50 / crouch front 40', () => {
    const s = GUNS.rg6.splash!;
    expect(s.damage).toBe(50);
    expect(damageAfterCrouch(s.damage, target({ crouching: true }), splash(FRONT))).toBeCloseTo(
      s.crouchDamage,
      10,
    );
  });
});

describe('explosions, gas, flame (Game Flow, Section 8 table)', () => {
  it('fragnade / proxynade centre: 90 normally, 72 crouching on the front', () => {
    for (const id of ['frag', 'proxy'] as const) {
      const g = GRENADES[id];
      const src: DamageSource = { kind: 'explosion', directionX: FRONT };
      expect(applyDamage(target(), g.damage, src).dealt).toBe(90);
      expect(applyDamage(target({ crouching: true }), g.damage, src).dealt).toBeCloseTo(72, 10);
      expect(g.crouchDamage).toBe(72);
    }
  });

  it('gas: 8 per second normally, 6 per second crouching (explicit table value), full on the back', () => {
    const g = GRENADES.gas;
    const front: DamageSource = { kind: 'gas', crouchAmount: g.crouchDamage, directionX: FRONT };
    const back: DamageSource = { kind: 'gas', crouchAmount: g.crouchDamage, directionX: BACK };
    expect(applyDamage(target({ crouching: true }), g.damage, front).dealt).toBe(6);
    expect(applyDamage(target({ crouching: true }), g.damage, back).dealt).toBe(8);
  });

  it('flame: 4 per tick normally, 3 crouching on the front', () => {
    const f = GUNS.flame;
    const src: DamageSource = { kind: 'flame', crouchAmount: f.crouchDamage, directionX: FRONT };
    expect(applyDamage(target(), f.damage, { ...src }).dealt).toBe(4);
    expect(applyDamage(target({ crouching: true }), f.damage, src).dealt).toBe(3);
  });

  it('without an explicit crouch value, explosion / gas / flame use x0.8', () => {
    for (const kind of ['explosion', 'gas', 'flame'] as const) {
      const r = applyDamage(target({ crouching: true }), 10, { kind, directionX: FRONT });
      expect(r.dealt, kind).toBeCloseTo(8, 10);
    }
  });
});

describe('melee (Game Flow, Section 9)', () => {
  it('a single melee hit always kills, even a crouching full-health player hit from the front', () => {
    const r = applyDamage(target({ crouching: true, health: 100 }), 0, { kind: 'melee', directionX: FRONT });
    expect(r).toMatchObject({ health: 0, died: true, dealt: 100, shielded: false });
  });
});

describe('edge cases', () => {
  it('damage to a dead player does nothing', () => {
    const r = applyDamage(target({ alive: false, health: 0 }), 50, bullet('ak47', FRONT));
    expect(r).toMatchObject({ dealt: 0, died: false, health: 0 });
  });

  it('health never goes below 0 and overkill is capped at remaining health', () => {
    const r = applyDamage(target({ health: 3 }), 14, bullet('ak47', FRONT));
    expect(r.health).toBe(0);
    expect(r.died).toBe(true);
  });

  it('is pure: the target object is not modified', () => {
    const t = target();
    applyDamage(t, 14, bullet('ak47', FRONT));
    expect(t).toEqual(target());
  });
});

describe('explosion falloff', () => {
  it('full damage at the centre, EDGE_DAMAGE_FACTOR at the edge, nothing beyond', () => {
    const g = GRENADES.frag;
    expect(explosionDamageAt(g.damage, 0, g.radiusPx)).toBe(90);
    expect(explosionDamageAt(g.damage, g.radiusPx - 0.0001, g.radiusPx)).toBeCloseTo(
      90 * EDGE_DAMAGE_FACTOR,
      1,
    );
    expect(explosionDamageAt(g.damage, g.radiusPx, g.radiusPx)).toBe(0);
    expect(explosionDamageAt(g.damage, g.radiusPx * 2, g.radiusPx)).toBe(0);
  });

  it('decreases with distance', () => {
    const r = GRENADES.frag.radiusPx;
    expect(explosionDamageAt(90, r * 0.25, r)).toBeGreaterThan(explosionDamageAt(90, r * 0.75, r));
  });
});
