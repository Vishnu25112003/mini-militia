import type { GameMode } from './types';

export const MODES: { id: GameMode; name: string; blurb: string; limit: number }[] = [
  { id: 'dm', name: 'Deathmatch', blurb: 'Free-for-all. First to 20 kills.', limit: 20 },
  { id: 'tdm', name: 'Team Deathmatch', blurb: 'Blue vs Orange. First team to 30 kills.', limit: 30 },
  { id: 'ctf', name: 'Capture the Flag', blurb: 'Steal the enemy flag. First team to 5 captures.', limit: 5 },
];

export const modeName = (m: GameMode) => MODES.find((x) => x.id === m)?.name ?? m;
