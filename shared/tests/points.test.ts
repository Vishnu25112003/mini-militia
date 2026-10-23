import { describe, expect, it } from 'vitest';
import { emptyScore, pointsOnDeath, pointsOnKill, recordDeath, recordKill } from '../logic/points';

describe('points (Game Flow, Section 11)', () => {
  it('+1 per kill; -1 only for a death in a zero-kill life', () => {
    expect(pointsOnKill()).toBe(1);
    expect(pointsOnDeath(true)).toBe(0);
    expect(pointsOnDeath(false)).toBe(-1);
  });

  it("reproduces the flow's worked example exactly", () => {
    let s = emptyScore();

    // Kills 3 players without dying -> +3
    s = recordKill(recordKill(recordKill(s)));
    expect(s.points).toBe(3);

    // Dies (had kills this life) -> still +3, no penalty
    s = recordDeath(s);
    expect(s.points).toBe(3);
    expect(s.deaths).toBe(1);

    // Respawns, dies with no kill -> +2, +1, 0, -1
    const afterEach: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = recordDeath(s);
      afterEach.push(s.points);
    }
    expect(afterEach).toEqual([2, 1, 0, -1]);
    expect(s.kills).toBe(3);
    expect(s.deaths).toBe(5);
  });

  it('a self-kill is a death with no kill credit (-1 if the life had no kills)', () => {
    let s = emptyScore();
    s = recordDeath(s); // own grenade, zero kills this life
    expect(s).toMatchObject({ kills: 0, deaths: 1, points: -1 });

    s = recordKill(s); // next life: one kill...
    s = recordDeath(s); // ...then blows themselves up: no penalty, still no extra kill
    expect(s).toMatchObject({ kills: 1, deaths: 2, points: 0 });
  });

  it('killsThisLife resets on death', () => {
    let s = recordKill(emptyScore());
    expect(s.killsThisLife).toBe(1);
    s = recordDeath(s);
    expect(s.killsThisLife).toBe(0);
  });
});
