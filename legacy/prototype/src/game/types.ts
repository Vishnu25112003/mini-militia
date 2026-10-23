// Plain-data game state. Everything here is JSON-serialisable so the same simulation can run
// on a server (authoritative) and be snapshotted over a socket later.

export type WeaponId =
  | 'magnum' | 'uzi' | 'mp5' | 'ak47' | 'm16' | 'm14' | 'm93ba'
  | 'shotgun' | 'sawgun' | 'smaw' | 'emp' | 'flame' | 'riot';

export type GrenadeKind = 'fragnade' | 'gasnade' | 'proxynade';
export type ItemId = WeaponId | GrenadeKind | 'healthpack' | 'boosttank';
export type GameMode = 'dm' | 'tdm' | 'ctf';

export interface Input {
  left: boolean;
  right: boolean;
  jet: boolean;
  fire: boolean;
  aim: number; // absolute world angle, radians
  reload: boolean;
  swap: boolean;
  grenade: boolean;
  pickup: boolean;
  melee: boolean;
}

export const emptyInput = (): Input => ({
  left: false, right: false, jet: false, fire: false, aim: 0,
  reload: false, swap: false, grenade: false, pickup: false, melee: false,
});

export interface WeaponState {
  id: WeaponId;
  mag: number;
  reserve: number;
}

export interface BotState {
  skill: number; // 0..1
  think: number;
  strafe: number;
  strafeT: number;
  jetT: number;
  stuckT: number;
  lastX: number;
  lastY: number;
  aimErr: number;
  aimErrT: number;
  seekItem: number; // pickup index or -1
  path: { x: number; y: number }[];
  pathIdx: number;
  pathT: number;
  goalX: number;
  goalY: number;
}

export interface Player {
  id: number;
  name: string;
  team: number;
  bot: boolean;
  x: number; // body centre
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  aim: number;
  hp: number;
  fuel: number;
  boostT: number;
  empT: number;
  burnT: number;
  burnBy: number;
  protectT: number;
  alive: boolean;
  respawnT: number;
  onGround: boolean;
  thrusting: boolean;
  runPhase: number;
  slots: [WeaponState, WeaponState | null];
  active: 0 | 1;
  grenades: Record<GrenadeKind, number>;
  gSel: GrenadeKind;
  fireCd: number;
  reloadT: number;
  meleeCd: number;
  kills: number;
  deaths: number;
  carrying: number; // team id of flag being carried, 0 = none
  lastHitBy: number;
  input: Input;
  prev: Input;
  ai?: BotState;
}

export type ProjKind = 'bullet' | 'rocket' | 'flame' | 'emp' | GrenadeKind;

export interface Projectile {
  id: number;
  kind: ProjKind;
  weapon: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  team: number;
  damage: number;
  life: number;
  fuse: number;
  stuck: boolean;
  armT: number;
}

export interface GasCloud { x: number; y: number; r: number; t: number; owner: number }

export interface PickupSpot {
  id: string;
  x: number;
  y: number;
  pool: ItemId[];
  item: ItemId | null;
  respawnT: number;
}

export interface Flag {
  team: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  carrier: number; // player id or -1
  dropT: number;
}

export type GameEvent =
  | { t: 'shot'; x: number; y: number; weapon: string }
  | { t: 'impact'; x: number; y: number; wall: boolean }
  | { t: 'hit'; x: number; y: number; victim: number; dmg: number }
  | { t: 'explosion'; x: number; y: number; r: number; gas?: boolean }
  | { t: 'kill'; killer: number; victim: number; weapon: string; x: number; y: number }
  | { t: 'pickup'; x: number; y: number; item: ItemId; by: number }
  | { t: 'reload'; x: number; y: number }
  | { t: 'spawn'; x: number; y: number }
  | { t: 'flag'; kind: 'taken' | 'dropped' | 'returned' | 'captured'; team: number; by: number }
  | { t: 'melee'; x: number; y: number }
  | { t: 'land'; x: number; y: number; speed: number };

export interface MatchConfig {
  mode: GameMode;
  bots: number;
  scoreLimit: number;
  timeLimit: number; // seconds
  playerName: string;
  seed: number;
}

export interface World {
  config: MatchConfig;
  time: number;
  rng: number;
  nextId: number;
  players: Player[];
  projectiles: Projectile[];
  gas: GasCloud[];
  pickups: PickupSpot[];
  flags: Flag[];
  teamScore: Record<number, number>;
  events: GameEvent[];
  over: boolean;
  winner: string;
}
