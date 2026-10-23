import type { GrenadeKind, WeaponId } from './types';

export type FireKind = 'bullet' | 'rocket' | 'flame' | 'emp' | 'shield';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: FireKind;
  damage: number; // per bullet / pellet / explosion centre
  rate: number; // shots per second
  mag: number;
  mags: number; // magazines carried when picked up / spawned with
  reload: number; // seconds
  spread: number; // degrees, +/- random
  pellets: number;
  speed: number; // px/s
  life: number; // seconds of projectile flight
  recoil: number; // px/s push-back on the shooter
  auto: boolean;
  radius: number; // explosion radius for rocket / emp
  length: number; // drawn barrel length (px)
  color: string;
}

// Gameplay numbers are tuned by feel. The class/weapon roster itself (Weapon subclasses UZI, MP5,
// AK47, M16, M14, M93BA, SHOTGUN, SAWGUN, SMAW, EMP, FLAMETHROWER, RIOTSHIELD, MAGNUM ...) was
// observed in the shipped libcocos2dcpp.so symbol table; exact constants could not be decompiled.
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  magnum:  { id: 'magnum',  name: 'Magnum',        kind: 'bullet', damage: 26, rate: 3.6, mag: 8,   mags: 4, reload: 1.2, spread: 1,   pellets: 1, speed: 1500, life: 0.9, recoil: 40,  auto: false, radius: 0,   length: 50, color: '#c9ccd2' },
  uzi:     { id: 'uzi',     name: 'Uzi',           kind: 'bullet', damage: 9,  rate: 13,  mag: 30,  mags: 4, reload: 1.4, spread: 4.5, pellets: 1, speed: 1300, life: 0.7, recoil: 22,  auto: true,  radius: 0,   length: 55, color: '#9aa0aa' },
  mp5:     { id: 'mp5',     name: 'MP5',           kind: 'bullet', damage: 11, rate: 11,  mag: 30,  mags: 3, reload: 1.5, spread: 3,   pellets: 1, speed: 1400, life: 0.8, recoil: 24,  auto: true,  radius: 0,   length: 60, color: '#7d848f' },
  ak47:    { id: 'ak47',    name: 'AK-47',         kind: 'bullet', damage: 17, rate: 8.5, mag: 30,  mags: 3, reload: 1.8, spread: 3.5, pellets: 1, speed: 1500, life: 0.9, recoil: 34,  auto: true,  radius: 0,   length: 71, color: '#8a6a3f' },
  m16:     { id: 'm16',     name: 'M16',           kind: 'bullet', damage: 15, rate: 9.5, mag: 30,  mags: 3, reload: 1.7, spread: 2.2, pellets: 1, speed: 1600, life: 0.9, recoil: 28,  auto: true,  radius: 0,   length: 74, color: '#4d5560' },
  m14:     { id: 'm14',     name: 'M14',           kind: 'bullet', damage: 34, rate: 3.2, mag: 12,  mags: 3, reload: 1.9, spread: 0.8, pellets: 1, speed: 1900, life: 1.0, recoil: 60,  auto: false, radius: 0,   length: 72, color: '#6b5236' },
  m93ba:   { id: 'm93ba',   name: 'M93BA Sniper',  kind: 'bullet', damage: 78, rate: 0.95, mag: 5,  mags: 3, reload: 2.4, spread: 0.1, pellets: 1, speed: 3000, life: 1.2, recoil: 120, auto: false, radius: 0,   length: 80, color: '#3d4650' },
  shotgun: { id: 'shotgun', name: 'Shotgun',       kind: 'bullet', damage: 10, rate: 1.2, mag: 6,   mags: 3, reload: 2.1, spread: 9,   pellets: 8, speed: 1200, life: 0.45, recoil: 150, auto: false, radius: 0,   length: 70, color: '#7a5a34' },
  sawgun:  { id: 'sawgun',  name: 'SAW',           kind: 'bullet', damage: 13, rate: 14,  mag: 60,  mags: 2, reload: 3.2, spread: 5,   pellets: 1, speed: 1400, life: 0.8, recoil: 30,  auto: true,  radius: 0,   length: 63, color: '#5d6a52' },
  smaw:    { id: 'smaw',    name: 'SMAW Rocket',   kind: 'rocket', damage: 95, rate: 0.75, mag: 2,  mags: 2, reload: 2.6, spread: 0.5, pellets: 1, speed: 850,  life: 3.0, recoil: 190, auto: false, radius: 125, length: 94, color: '#4f6b3c' },
  emp:     { id: 'emp',     name: 'EMP Launcher',  kind: 'emp',    damage: 12, rate: 0.8, mag: 3,   mags: 2, reload: 2.2, spread: 0.5, pellets: 1, speed: 900,  life: 2.0, recoil: 80,  auto: false, radius: 150, length: 74, color: '#4a8fc4' },
  flame:   { id: 'flame',   name: 'Flamethrower',  kind: 'flame',  damage: 6,  rate: 22,  mag: 120, mags: 1, reload: 2.8, spread: 7,   pellets: 1, speed: 520,  life: 0.38, recoil: 6,   auto: true,  radius: 0,   length: 74, color: '#b8561f' },
  riot:    { id: 'riot',    name: 'Riot Shield',   kind: 'shield', damage: 34, rate: 1.5, mag: 1,   mags: 0, reload: 0,   spread: 0,   pellets: 1, speed: 0,    life: 0,    recoil: 0,   auto: false, radius: 0,   length: 14, color: '#6f8aa6' },
};

export interface GrenadeDef {
  kind: GrenadeKind;
  name: string;
  fuse: number;
  radius: number;
  damage: number;
  color: string;
}

export const GRENADES: Record<GrenadeKind, GrenadeDef> = {
  fragnade:  { kind: 'fragnade',  name: 'Frag',      fuse: 2.2, radius: 115, damage: 85, color: '#556b2f' },
  gasnade:   { kind: 'gasnade',   name: 'Gas',       fuse: 1.6, radius: 120, damage: 0,  color: '#8fbf3c' },
  proxynade: { kind: 'proxynade', name: 'Proximity', fuse: 30,  radius: 105, damage: 85, color: '#c0392b' },
};

export const ITEM_NAMES: Record<string, string> = {
  healthpack: 'Health Pack',
  boosttank: 'Boost Tank',
  fragnade: 'Frag Grenades',
  gasnade: 'Gas Grenades',
  proxynade: 'Proximity Mines',
  ...Object.fromEntries(Object.values(WEAPONS).map((w) => [w.id, w.name])),
};


