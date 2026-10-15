export const POINTS_PER_KILL = 1;

/** +1 for a kill. */
export function pointsOnKill(): number {
  return POINTS_PER_KILL;
}

/** -1 for a death in a life with zero kills; no penalty otherwise (including self-kills). */
export function pointsOnDeath(lifeHadKill: boolean): number {
  return lifeHadKill ? 0 : -1;
}

export interface Rankable {
  kills: number;
  points: number;
  deaths: number;
}

function compareForRank(a: Rankable, b: Rankable): number {
  if (a.kills !== b.kills) return b.kills - a.kills;
  if (a.points !== b.points) return b.points - a.points;
  return a.deaths - b.deaths;
}

function isTiedForRank(a: Rankable, b: Rankable): boolean {
  return a.kills === b.kills && a.points === b.points && a.deaths === b.deaths;
}

/**
 * Kills ↓, then points ↓, then deaths ↑. A full tie shares a rank, and the
 * next distinct player gets the very next rank — dense ranking, per the
 * flow's own example: two players tied for 1st, the next player is 2nd, not
 * 3rd.
 */
export function rankPlayers<T extends Rankable>(players: readonly T[]): (T & { rank: number })[] {
  const sorted = [...players].sort(compareForRank);
  const ranked: (T & { rank: number })[] = [];

  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i]!;
    const previous = sorted[i - 1];
    if (i === 0 || !isTiedForRank(previous!, player)) {
      rank += 1;
    }
    ranked.push({ ...player, rank });
  }

  return ranked;
}
