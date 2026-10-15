import { describe, expect, it } from 'vitest';
import { pointsOnDeath, pointsOnKill, rankPlayers } from './scoring.js';

describe('points system', () => {
  it('matches the worked example from the flow', () => {
    let total = 0;

    // Kills 3 players without dying.
    total += 3 * pointsOnKill();
    expect(total).toBe(3);

    // Dies, but had kills this life: no penalty.
    total += pointsOnDeath(true);
    expect(total).toBe(3);

    // Four respawns, each dying with zero kills that life.
    total += pointsOnDeath(false);
    expect(total).toBe(2);
    total += pointsOnDeath(false);
    expect(total).toBe(1);
    total += pointsOnDeath(false);
    expect(total).toBe(0);
    total += pointsOnDeath(false);
    expect(total).toBe(-1);
  });

  it('self-kills are just a death: no penalty when that life already had a kill', () => {
    expect(pointsOnDeath(true)).toBe(0);
    expect(pointsOnDeath(false)).toBe(-1);
  });
});

describe('rankPlayers', () => {
  it('ranks by kills, then points, then deaths', () => {
    const players = [
      { id: 'a', kills: 5, points: 5, deaths: 2 },
      { id: 'b', kills: 5, points: 4, deaths: 1 },
      { id: 'c', kills: 3, points: 10, deaths: 0 },
    ];

    const ranked = rankPlayers(players);
    expect(ranked.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it('breaks a kills+points tie by fewer deaths', () => {
    const players = [
      { id: 'e', kills: 2, points: 2, deaths: 3 },
      { id: 'f', kills: 2, points: 2, deaths: 1 },
    ];

    const ranked = rankPlayers(players);
    expect(ranked.map((p) => p.id)).toEqual(['f', 'e']);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2]);
  });

  it('gives a full tie the same rank, and the next distinct player the next rank (dense ranking)', () => {
    const players = [
      { id: 'a', kills: 5, points: 5, deaths: 2 },
      { id: 'b', kills: 5, points: 5, deaths: 2 },
      { id: 'c', kills: 5, points: 4, deaths: 1 },
      { id: 'd', kills: 3, points: 10, deaths: 0 },
    ];

    const ranked = rankPlayers(players);
    const byId = Object.fromEntries(ranked.map((p) => [p.id, p.rank]));
    expect(byId).toEqual({ a: 1, b: 1, c: 2, d: 3 });
  });
});
