// Weapon table.
//
// Numbers marked [RE] come straight from the WeaponAttributeModel switch that every weapon's init()
// inlines in libcocos2dcpp.so (Mini Militia Classic 0.14.4), e.g. AK47::init() @0x554b94:
//   { pellets, spread(deg), damage, range(pt), fireInterval(s), reloadTime(s), ?, mag, maxAmmo, ? }
// Fields without the marker are design values for this rebuild where the binary was not decoded.

export const ITEM_TYPES = {
  machete: 1, fragnade: 2, deagle: 3, magnum: 4, uzi: 5, mp5: 6, ak47: 7, m16: 8, shotgun: 9, m93ba: 10,
  smaw: 11, rocket: 12, riot: 13, healthpack: 14, boosttank: 15, m14: 16, phasr: 17, gdeagle: 18, flame: 19,
  gasnade: 20, emp: 21, proxynade: 23, saw: 24, sawgun: 25, tavor: 26, minigun: 27, tec9: 28, rg6: 29,
  empnade: 30, xm8: 31, mortar: 32, aa12: 37, m1881: 39,
};

// kind: hitscan | rocket | saw | flame | emp | shield
export const GUNS = {
  //            [RE] pellets spread dmg range interval reload mag maxAmmo      design
  deagle:  { name: 'Desert Eagle', kind: 'hitscan', pellets: 1, spread: 2, damage: 8, range: 500, interval: 0.25, reload: 1.25, mag: 15, maxAmmo: 75, sprite: 'desertEagle', sound: 'deagle', auto: false, hand: 1 },
  magnum:  { name: 'Magnum', kind: 'hitscan', pellets: 1, spread: 1, damage: 30, range: 650, interval: 0.6, reload: 2.0, mag: 6, maxAmmo: 36, sprite: 'magnum', sound: 'magnum', auto: false, hand: 1 },
  uzi:     { name: 'Uzi', kind: 'hitscan', pellets: 1, spread: 6, damage: 7, range: 500, interval: 0.1, reload: 1.5, mag: 40, maxAmmo: 400, sprite: 'uzi', sound: 'uzi', auto: true, hand: 1 },
  tec9:    { name: 'Tec-9', kind: 'hitscan', pellets: 1, spread: 4, damage: 10, range: 600, interval: 0.15, reload: 1.5, mag: 40, maxAmmo: 400, sprite: 'tec9', sound: 'tec9', auto: true, hand: 1 },
  mp5:     { name: 'MP5', kind: 'hitscan', pellets: 1, spread: 5, damage: 7, range: 700, interval: 0.06, reload: 1.75, mag: 45, maxAmmo: 360, sprite: 'mp5', sound: 'mp5', auto: true },
  ak47:    { name: 'AK-47', kind: 'hitscan', pellets: 1, spread: 4, damage: 10, range: 800, interval: 0.1, reload: 2.0, mag: 35, maxAmmo: 250, sprite: 'ak47', sound: 'ak47', auto: true },
  m16:     { name: 'M16', kind: 'hitscan', pellets: 1, spread: 2, damage: 14, range: 1000, interval: 0.5, reload: 2.0, mag: 24, maxAmmo: 300, sprite: 'm16', sound: 'm16', auto: true, burst: 3, burstGap: 0.07 },
  m14:     { name: 'M14', kind: 'hitscan', pellets: 1, spread: 0, damage: 36, range: 1200, interval: 0.55, reload: 2.25, mag: 6, maxAmmo: 42, sprite: 'hunting', sound: 'm14', auto: false, zoom: 1.35 },
  m93ba:   { name: 'M93BA Sniper', kind: 'hitscan', pellets: 1, spread: 0, damage: 75, range: 1500, interval: 0.8, reload: 2.5, mag: 3, maxAmmo: 18, sprite: 'sniper', sound: 'm93ba', auto: false, zoom: 1.7 },
  shotgun: { name: 'Shotgun', kind: 'hitscan', pellets: 6, spread: 10, damage: 25, range: 325, interval: 0.75, reload: 2.5, mag: 4, maxAmmo: 28, sprite: 'shotgun', sound: 'shotgun', auto: false },
  smaw:    { name: 'SMAW', kind: 'rocket', pellets: 1, spread: 0, damage: 100, range: 1, interval: 1.25, reload: 4.0, mag: 3, maxAmmo: 6, sprite: 'smaw', sound: 'rocket', auto: false, speed: 620, radius: 105 },
  sawgun:  { name: 'Saw Gun', kind: 'saw', pellets: 1, spread: 0, damage: 80, range: 150, interval: 1.0, reload: 2.5, mag: 1, maxAmmo: 12, sprite: 'sawgun', sound: 'saw', auto: false, speed: 520, bounces: 3, life: 2.6 },
  flame:   { name: 'Flamethrower', kind: 'flame', pellets: 1, spread: 5, damage: 30, range: 150, interval: 0.15, reload: 5.0, mag: 125, maxAmmo: 125, sprite: 'flamethrower', sound: 'flame', auto: true }, // [RE] FLAME: 10-30 per flame by freshness, reach 150, no afterburn
  emp:     { name: 'EMP Gun', kind: 'emp', pellets: 1, spread: 0, damage: 10, range: 1, interval: 1.5, reload: 2.0, mag: 1, maxAmmo: 16, sprite: 'emp', sound: 'energy', auto: false, speed: 760, stun: 3.0 },
  riot:    { name: 'Riot Shield', kind: 'shield', pellets: 0, spread: 0, damage: 0, range: 0, interval: 0, reload: 0, mag: 0, maxAmmo: 0, sprite: 'shield', sound: 'clank', auto: false, arc: 70 },
  gdeagle: { name: 'Gold Desert Eagle', kind: 'hitscan', pellets: 1, spread: 2, damage: 10, range: 600, interval: 0.2, reload: 1.25, mag: 16, maxAmmo: 75, sprite: 'gDesertEagle', sound: 'deagle', auto: false, hand: 1 },
  tavor:   { name: 'Tavor', kind: 'hitscan', pellets: 1, spread: 2, damage: 9, range: 750, interval: 0.12, reload: 1.5, mag: 35, maxAmmo: 200, sprite: 'tavor', sound: 'tavor', auto: true },
  xm8:     { name: 'XM8', kind: 'hitscan', pellets: 1, spread: 3.25, damage: 8, range: 875, interval: 0.085, reload: 1.9, mag: 30, maxAmmo: 240, sprite: 'xm8', sound: 'xm8', auto: true },
  aa12:    { name: 'AA-12', kind: 'hitscan', pellets: 5, spread: 6, damage: 8, range: 480, interval: 0.45, reload: 2.0, mag: 6, maxAmmo: 42, sprite: 'aa12', sound: 'shotgun', auto: true },
  m1881:   { name: 'M1881', kind: 'hitscan', pellets: 7, spread: 20, damage: 16, range: 250, interval: 0.25, reload: 2.0, mag: 2, maxAmmo: 16, sprite: 'm1881', sound: 'shotgun', auto: false, hand: 1 },
  minigun: { name: 'Minigun', kind: 'hitscan', pellets: 1, spread: 7, damage: 30, range: 650, interval: 0.08, reload: 4.25, mag: 50, maxAmmo: 200, sprite: 'm61', sound: 'm61', auto: true, spinUp: 0.5 },
  rg6:     { name: 'RG-6 Launcher', kind: 'launcher', pellets: 1, spread: 2, damage: 1, range: 1, interval: 0.25, reload: 3.75, mag: 6, maxAmmo: 36, sprite: 'rg6', sound: 'rg6', auto: false, speed: 620 },
  phasr:   { name: 'Phasr', kind: 'hitscan', beam: true, pellets: 1, spread: 0, damage: 6, range: 1300, interval: 0.15, reload: 4.0, mag: 200, maxAmmo: 200, sprite: 'laser', sound: 'laser', auto: true },
};
// [RE] the minigun, RG-6, Phasr, Tavor, XM8, AA-12, M1881 and Gold Eagle numbers come from the same
// WeaponAttributeModel table; spin-up (the m61Pre sound) and the RG-6 grenade are this rebuild's reading.

// Guns that can be held in pairs: WeaponStructures::isValidDualType and the classes defining
// setDualConfiguration (DEAGLE, GDEAGLE, MAGNUM, UZI, TEC9, M1881). The riot shield can be held off-hand.
export const DUAL_TYPES = ['deagle', 'gdeagle', 'magnum', 'uzi', 'tec9', 'm1881'];
export const OFFHAND_TYPES = [...DUAL_TYPES, 'riot'];
export const isDual = (t) => DUAL_TYPES.includes(t);
export const DUAL_SCALE = 0.8; // DUAL_SCL

// Loadout picker tabs (sheet 6)
export const CATEGORIES = {
  pistol: { name: 'Pistol', guns: ['deagle', 'gdeagle', 'magnum'] },
  smg: { name: 'SMG', guns: ['uzi', 'tec9', 'mp5'] },
  shotgun: { name: 'Shotgun', guns: ['shotgun', 'aa12', 'm1881'] },
  rifle: { name: 'Rifle', guns: ['ak47', 'm16', 'xm8', 'tavor', 'm14'] },
  sniper: { name: 'Sniper', guns: ['m93ba'] },
  special: { name: 'Special', guns: ['minigun', 'smaw', 'rg6', 'flame', 'sawgun', 'emp', 'phasr', 'riot'] },
};
export const ALL_GUNS = Object.values(CATEGORIES).flatMap((c) => c.guns);

export const NADES = {
  fragnade:  { name: 'Frag', sprite: 'grenade', fuse: 2.6, radius: 110, damage: 100, sound: 'explode' },
  gasnade:   { name: 'Gas', sprite: 'gasNade', fuse: 1.6, radius: 95, damage: 9, cloud: 7.0, sound: 'gas' },
  proxynade: { name: 'Proxy', sprite: 'mine1', fuse: 22, arm: 1.0, trigger: 55, radius: 100, damage: 90, sound: 'proxy', sticky: true },
  rg6: { name: 'RG-6 grenade', sprite: 'grenade', fuse: 1.1, radius: 90, damage: 80, sound: 'explode', launched: true },
};

export const PICKUPS = {
  healthpack: { name: 'Med Pack', sprite: 'medPack' },
  boosttank: { name: 'Boost', sprite: 'boost' },
};

export const MELEE = { damage: 35, range: 42, swing: 0.25, sound: 'swipe' }; // [RE] machete damage 35, range 35; swing gap 0.5 s is PHYS.MELEE_INTERVAL

export const isGun = (t) => t in GUNS;
export const isNade = (t) => t in NADES;
export const itemSprite = (t) => (GUNS[t] || NADES[t] || PICKUPS[t])?.sprite;
export const itemName = (t) => (GUNS[t] || NADES[t] || PICKUPS[t])?.name ?? t;

// What a soldier spawns with (Mini Militia gives a sidearm, a starter gun and two frags).
export const SPAWN_LOADOUT = { primary: 'uzi', secondary: 'deagle', nades: { fragnade: 2, gasnade: 0, proxynade: 0 } };
