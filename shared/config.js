// Host-configurable match rules, modelled on the original's "CONFIGURE GAME" screen
// (GameCustomizeLayer: GAME MODE, MAX PLAYERS, GAME TIME, GRAVITY, BOOST, MAP DROPS, GLOBAL SPECIALS,
// DEFAULT LOADOUT) plus a few LAN-party extras. Shared by the server (rules), the client (movement
// prediction must use the same gravity and boost) and the lobby UI.
import { GUNS, ALL_GUNS, isDual } from './weapons.js';

export const MODES = {
  ffa: { name: 'Deathmatch', teams: false, limit: 15, limitLabel: 'Kill limit' },
  tdm: { name: 'Team Deathmatch', teams: true, limit: 30, limitLabel: 'Team kills to win' },
  ctf: { name: 'Capture the Flag', teams: true, limit: 3, limitLabel: 'Captures to win' },
};

// The original's GLOBAL SPECIALS (SpecialType). Effects are this rebuild's reading of each name.
export const SPECIALS = {
  healthRegen: { name: 'Health Regen', info: 'Health refills twice as fast' },
  boostRegen: { name: 'Boost Regen', info: 'Jetpack refuels twice as fast' },
  boostIncrease: { name: 'Boost Increase', info: '50% more jetpack fuel' },
  shotStabilizer: { name: 'Shot Stabilizer', info: 'Half the bullet spread' },
  meleePower: { name: 'Melee Power', info: 'Melee hits twice as hard' },
  hiCapMags: { name: 'Hi-Cap Magazines', info: '50% bigger magazines' },
  fastReload: { name: 'Fast Reload', info: 'Reloads take 40% less time' },
  grenadier: { name: 'Grenadier', info: 'Spawn with +2 frags, carry up to 5' },
  ace: { name: 'Adv. Combat Equip.', info: 'Spawn with a proxy mine and a gas nade' },
  deflector: { name: 'Deflector', info: 'Take half damage from explosions' },
  hiVelocity: { name: 'Hi-Velocity Ammo', info: 'Guns reach 30% further' },
  autoReloader: { name: 'Auto Reloader', info: 'Holstered gun reloads itself' },
};

export const GRAVITY_STEPS = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.25, 1.5, 2]; // 0 = float (zero gravity)
export const BOOST_STEPS = [0, 25, 50, 75, 100, 150, 200, -1]; // percent of a full tank; -1 = unlimited
export const DROP_STEPS = [0, 10, 18, 30, 60]; // map drop respawn seconds; 0 = map drops off
export const RESPAWN_STEPS = [1, 2, 3, 5, 8];
export const PRIMARY_CHOICES = ALL_GUNS;
export const SECONDARY_CHOICES = ALL_GUNS;

export const DEFAULT_CONFIG = {
  mode: 'ffa',
  limit: MODES.ffa.limit,
  minutes: 8,
  maxPlayers: 8,
  gravity: 1, // multiplier of normal gravity
  boost: 100, // jetpack tank, percent of normal; -1 = unlimited
  drops: 18, // seconds before a taken map weapon respawns; 0 = no map drops
  respawn: 3,
  friendlyFire: false,
  healthRegen: true,
  specials: [],
  defaultLoadout: true, // ON: everyone spawns with the host's loadout; OFF: each soldier brings their own
  loadout: { primary: 'uzi', primaryDual: false, secondary: 'deagle', secondaryDual: false, fragnade: 2, gasnade: 0, proxynade: 0 },
};

const pickStep = (v, steps, dflt) => (steps.includes(Number(v)) ? Number(v) : dflt);
const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

// Validate a (possibly partial) config from the network against the current one.
export function sanitizeConfig(input = {}, current = DEFAULT_CONFIG) {
  const c = { ...DEFAULT_CONFIG, ...current, loadout: { ...DEFAULT_CONFIG.loadout, ...current.loadout } };
  if (MODES[input.mode]) {
    if (input.mode !== c.mode && input.limit === undefined) c.limit = MODES[input.mode].limit;
    c.mode = input.mode;
  }
  if (input.limit !== undefined) c.limit = clampInt(input.limit, 1, 99, c.limit);
  if (input.minutes !== undefined) c.minutes = clampInt(input.minutes, 2, 30, c.minutes);
  if (input.maxPlayers !== undefined) c.maxPlayers = clampInt(input.maxPlayers, 2, 12, c.maxPlayers);
  if (input.gravity !== undefined) c.gravity = pickStep(input.gravity, GRAVITY_STEPS, c.gravity);
  if (input.boost !== undefined) c.boost = pickStep(input.boost, BOOST_STEPS, c.boost);
  if (input.drops !== undefined) c.drops = pickStep(input.drops, DROP_STEPS, c.drops);
  if (input.respawn !== undefined) c.respawn = pickStep(input.respawn, RESPAWN_STEPS, c.respawn);
  if (input.friendlyFire !== undefined) c.friendlyFire = !!input.friendlyFire;
  if (input.healthRegen !== undefined) c.healthRegen = !!input.healthRegen;
  if (input.defaultLoadout !== undefined) c.defaultLoadout = !!input.defaultLoadout;
  if (Array.isArray(input.specials)) c.specials = [...new Set(input.specials.filter((s) => s in SPECIALS))];
  if (input.loadout && typeof input.loadout === 'object') {
    const l = input.loadout;
    // the two slots hold different guns (a pair counts as one slot)
    if (PRIMARY_CHOICES.includes(l.primary) && l.primary !== (l.secondary ?? c.loadout.secondary)) c.loadout.primary = l.primary;
    if (SECONDARY_CHOICES.includes(l.secondary) && l.secondary !== c.loadout.primary) c.loadout.secondary = l.secondary;
    if (l.primaryDual !== undefined) c.loadout.primaryDual = !!l.primaryDual;
    if (l.secondaryDual !== undefined) c.loadout.secondaryDual = !!l.secondaryDual;
    for (const n of ['fragnade', 'gasnade', 'proxynade']) if (l[n] !== undefined) c.loadout[n] = clampInt(l[n], 0, 3, c.loadout[n]);
  }
  // LoadoutMenu::onDual only offers pairs for guns that can be paired
  if (!isDual(c.loadout.primary)) c.loadout.primaryDual = false;
  if (!isDual(c.loadout.secondary)) c.loadout.secondaryDual = false;
  return c;
}

// A soldier's own loadout (used when the host turns DEFAULT LOADOUT off), validated like the host's.
export function sanitizeLoadout(l, base = DEFAULT_CONFIG.loadout) {
  return sanitizeConfig({ loadout: l || {} }, { ...DEFAULT_CONFIG, loadout: { ...DEFAULT_CONFIG.loadout, ...base } }).loadout;
}

export const has = (config, special) => config.specials?.includes(special);

// Movement options both the server and the predicting client feed into stepBody().
export function physicsOptions(config) {
  const tank = config.boost < 0 ? Infinity : (config.boost / 100) * (has(config, 'boostIncrease') ? 1.5 : 1);
  return { gravity: config.gravity, tank, regen: has(config, 'boostRegen') ? 2 : 1 };
}

// Human-readable values for the lobby.
export const labels = {
  gravity: (g) => (g === 0 ? 'Zero' : g === 1 ? 'Normal' : `${g}x`),
  boost: (b) => (b < 0 ? 'Unlimited' : b === 0 ? 'No jetpack' : `${b}%`),
  drops: (d) => (d === 0 ? 'Off' : `${d} sec`),
  respawn: (r) => `${r}s`,
};

export const gunName = (t) => GUNS[t]?.name ?? t;
