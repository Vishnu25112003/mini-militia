import { describe, expect, it } from 'vitest';
import { rankPlayers } from '../logic/ranking';

const p = (id: string, kills: number, points: number, deaths: number) => ({ id, kills, points, deaths });
const ranks = (list: ReturnType<typeof p>[]) => rankPlayers(list).map((r) => `${r.id}:${r.rank}`);

describe('ranking (Game Flow, Section 12)', () => {
  it('more kills ranks higher', () => {
    expect(ranks([p('a', 2, 9, 0), p('b', 5, 0, 9), p('c', 3, 3, 3)])).toEqual(['b:1', 'c:2', 'a:3']);
  });

  it('equal kills: more points ranks higher', () => {
    expect(ranks([p('a', 4, 1, 0), p('b', 4, 3, 5)])).toEqual(['b:1', 'a:2']);
  });

  it('equal kills and points: fewer deaths ranks higher', () => {
    expect(ranks([p('a', 4, 2, 5), p('b', 4, 2, 1)])).toEqual(['b:1', 'a:2']);
  });

  it('a full tie shares the rank and the next player gets the NEXT rank (1st, 1st, 2nd, 3rd)', () => {
    expect(ranks([p('a', 5, 5, 1), p('b', 5, 5, 1), p('c', 4, 4, 1), p('d', 1, 1, 1)])).toEqual([
      'a:1',
      'b:1',
      'c:2',
      'd:3',
    ]);
  });

  it('works for three-way ties and keeps tied players in their original order', () => {
    expect(ranks([p('x', 1, 1, 1), p('y', 1, 1, 1), p('z', 1, 1, 1)])).toEqual(['x:1', 'y:1', 'z:1']);
    expect(rankPlayers([p('a', 0, 0, 0)])[0].rank).toBe(1);
    expect(rankPlayers([])).toEqual([]);
  });

  it('does not change the input array', () => {
    const input = [p('a', 1, 0, 0), p('b', 2, 0, 0)];
    rankPlayers(input);
    expect(input.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
