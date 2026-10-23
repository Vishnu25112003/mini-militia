import { MOVEMENT, type MovementConfig } from '@game/shared';

// Small shared state between the sandbox's Phaser scenes (world + touch HUD) and the React debug panel.
// Plain mutable singletons on purpose: Phaser reads them every frame, React polls them a few times a second.

export interface TouchState {
  /** Touch controls are on screen (touch device, or forced with ?touch=1). */
  enabled: boolean;
  moveX: number;
  fly: boolean;
  crouch: boolean;
  aimAngle: number;
  /** The right joystick is being held, so its angle overrides the mouse. */
  aimActive: boolean;
  fire: boolean;
  /** Button taps waiting to be picked up by the next input poll. */
  latched: {
    melee: boolean;
    throwGrenade: boolean;
    switchGrenade: boolean;
    reload: boolean;
    swapWeapon: boolean;
    pickup: boolean;
    zoom: boolean;
  };
}

export const touchState: TouchState = {
  enabled: false,
  moveX: 0,
  fly: false,
  crouch: false,
  aimAngle: 0,
  aimActive: false,
  fire: false,
  latched: {
    melee: false,
    throwGrenade: false,
    switchGrenade: false,
    reload: false,
    swapWeapon: false,
    pickup: false,
    zoom: false,
  },
};

/** Live tweakable values (dev only). `movement` is a copy; the shared config is never modified. */
export const debugState = {
  gravity: 100,
  boost: 100,
  movement: { ...MOVEMENT } as MovementConfig,
};

/** Setters live here (not in the React panel) so the panel never assigns to module-level state itself. */
export function setHostSetting(key: 'gravity' | 'boost', value: number) {
  debugState[key] = value;
}

export function setMovementValue(key: keyof MovementConfig, value: number) {
  debugState.movement = { ...debugState.movement, [key]: value };
}

export function resetTuning() {
  debugState.movement = { ...MOVEMENT };
  debugState.gravity = 100;
  debugState.boost = 100;
}

/** Numbers the world scene publishes every frame for the HUD scene and the debug panel. */
export const telemetry = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  fuel: 100,
  fuelCapacity: 100,
  onGround: false,
  crouching: false,
  flying: false,
  zoomLabel: '1X',
  grenadeLabel: 'FRAG 2',
  /** True when a gun lies within reach, so the Pickup / Pair button should show (Phase 10). */
  nearGun: false,
  lastAction: '—',
  fps: 0,
  ticks: 0,
};

const params = () => new URLSearchParams(window.location.search);

/** Dev switches read from the URL. */
export const flags = {
  get autoplay() {
    return params().get('autoplay') === '1';
  },
  get forceTouch() {
    return params().get('touch') === '1';
  },
  get spawn() {
    const n = Number(params().get('spawn'));
    return Number.isInteger(n) && n >= 0 ? n : null;
  },
  get color() {
    const n = Number(params().get('color'));
    return Number.isInteger(n) && n >= 0 && n <= 7 ? n : null;
  },
};
