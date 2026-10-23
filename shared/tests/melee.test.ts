import { describe, expect, it } from 'vitest';
import { resolveMeleeClash, type ClashParticipant } from '../logic/points';

const fighter = (health: number, over: Partial<ClashParticipant> = {}): ClashParticipant => ({
  health,
  alive: true,
  kills: 0,
  deaths: 0,
  points: 0,
  killsThisLife: 0,
  ...over,
});

describe('melee clash (Game Flow, Section 9)', () => {
  it('A (100 hp) hits B (30 hp) first: A gets the kill and drops to 50 hp, B dies', () => {
    const r = resolveMeleeClash(fighter(100), fighter(30));
    expect(r.firstDied).toBe(false);
    expect(r.first).toMatchObject({ health: 50, alive: true, kills: 1, deaths: 0, points: 1 });
    expect(r.second).toMatchObject({ health: 0, alive: false, kills: 0, deaths: 1, points: -1 });
  });

  it('B (30 hp) hits A (100 hp) first: B gets the kill AND also dies', () => {
    const r = resolveMeleeClash(fighter(30), fighter(100));
    expect(r.firstDied).toBe(true);
    expect(r.first).toMatchObject({ health: 0, alive: false, kills: 1, deaths: 1 });
    expect(r.second).toMatchObject({ alive: false, kills: 0, deaths: 1 });
  });

  it('scoring when both die: first hitter +1 kill +1 death, other +1 death', () => {
    const r = resolveMeleeClash(fighter(30), fighter(100));
    // first hitter: +1 kill, and their death costs nothing because the life had a kill
    expect(r.first.points).toBe(1);
    expect(r.first.kills).toBe(1);
    expect(r.first.deaths).toBe(1);
    // other player had no kills this life -> -1
    expect(r.second.points).toBe(-1);
    expect(r.second.deaths).toBe(1);
  });

  it('the other player loses a point only if they had zero kills this life', () => {
    const withKill = resolveMeleeClash(fighter(100), fighter(100, { kills: 2, points: 2, killsThisLife: 2 }));
    expect(withKill.second.points).toBe(2); // death in a life that had kills: no penalty
    const withoutKill = resolveMeleeClash(fighter(100), fighter(100, { points: 2 }));
    expect(withoutKill.second.points).toBe(1);
  });

  it('exactly 50 health counts as "50 or less": the first hitter dies too', () => {
    expect(resolveMeleeClash(fighter(50), fighter(100)).firstDied).toBe(true);
    expect(resolveMeleeClash(fighter(51), fighter(100)).firstDied).toBe(false);
    expect(resolveMeleeClash(fighter(51), fighter(100)).first.health).toBe(1);
  });

  it('does not change its inputs', () => {
    const a = fighter(100);
    const b = fighter(30);
    resolveMeleeClash(a, b);
    expect(a).toEqual(fighter(100));
    expect(b).toEqual(fighter(30));
  });
});
