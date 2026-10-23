// Ranking. Source of truth: Game Flow, Section 12 "Ranking order".

export interface Rankable {
  kills: number;
  points: number;
  deaths: number;
}

export type Ranked<T extends Rankable> = T & { rank: number };

/**
 * Order players: kills (more is better) -> points (more) -> deaths (fewer).
 * A full tie shares a rank and the next player gets the NEXT rank (two at 1st -> next is 2nd, then 3rd...).
 * Players who tie keep their original relative order.
 */
export function rankPlayers<T extends Rankable>(players: readonly T[]): Ranked<T>[] {
  const sorted = players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.kills - a.p.kills || b.p.points - a.p.points || a.p.deaths - b.p.deaths || a.i - b.i)
    .map((e) => e.p);

  const ranked: Ranked<T>[] = [];
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    const tied = prev && prev.kills === cur.kills && prev.points === cur.points && prev.deaths === cur.deaths;
    if (!tied) rank += 1;
    ranked.push({ ...cur, rank });
  }
  return ranked;
}
