import { MATCH_RULES } from '../config/matchRules';

// Points. Source of truth: Game Flow, Sections 9 (Melee clash) and 11 (Points System).

export const POINTS_PER_KILL = 1;
export const POINTS_PER_PENALIZED_DEATH = -1;

export interface Scoreboard {
  kills: number;
  deaths: number;
  points: number;
  /** Kills in the current life. */
  killsThisLife: number;
}

export const emptyScore = (): Scoreboard => ({ kills: 0, deaths: 0, points: 0, killsThisLife: 0 });

/** +1 for each kill. */
export function pointsOnKill(): number {
  return POINTS_PER_KILL;
}

/** -1 for a death in a life with zero kills; no penalty if the life had at least one kill. */
export function pointsOnDeath(lifeHadKill: boolean): number {
  return lifeHadKill ? 0 : POINTS_PER_PENALIZED_DEATH;
}

/** Record a kill for the killer. */
export function recordKill<T extends Scoreboard>(s: T): T {
  return { ...s, kills: s.kills + 1, points: s.points + pointsOnKill(), killsThisLife: s.killsThisLife + 1 };
}

/**
 * Record a death. A self-kill (own explosive) is just a death: -1 if the life had no kills, and nobody
 * gets kill credit. The kills-this-life counter resets because the next life starts.
 */
export function recordDeath<T extends Scoreboard>(s: T): T {
  return {
    ...s,
    deaths: s.deaths + 1,
    points: s.points + pointsOnDeath(s.killsThisLife > 0),
    killsThisLife: 0,
  };
}

export interface ClashParticipant extends Scoreboard {
  health: number;
  alive: boolean;
}

export interface ClashResult<T extends ClashParticipant> {
  first: T;
  second: T;
  /** The first hitter also died (they had 50 health or less). */
  firstDied: boolean;
}

/**
 * Melee clash: both players melee each other. The player who hits first gets the kill and loses a fixed
 * 50 health; if they have 50 health or less they also die. The other player always dies.
 *
 * Scoring (Option A): first hitter +1 kill (+1 death if they died too); other player +1 death.
 * Death penalties follow the normal rule — the first hitter just got a kill this life, so their death
 * costs no point; the other player loses a point only if they had no kills this life.
 */
export function resolveMeleeClash<T extends ClashParticipant>(first: T, second: T): ClashResult<T> {
  // the kill is credited first, so the first hitter's own death (below) is in a life that had a kill
  let a = recordKill(first);
  const firstDied = first.health <= MATCH_RULES.meleeClashFirstHitterLoss;
  a = { ...a, health: Math.max(0, first.health - MATCH_RULES.meleeClashFirstHitterLoss) };
  if (firstDied) a = { ...recordDeath(a), alive: false, health: 0 };

  const b = { ...recordDeath(second), alive: false, health: 0 };
  return { first: a, second: b, firstDied };
}
