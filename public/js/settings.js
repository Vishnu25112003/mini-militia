// Per-device player settings: key bindings, touch control placement, sound, blood.
// Mirrors the original's CONTROLS (MOVEMENT/AIMING invert, SWAP) and PLACEMENT screens
// (drag to move, BUTTON SIZE 0.4-2.3, HUD OPACITY, DEFAULTS), saved in localStorage.

export const ACTIONS = [
  ['left', 'Move left'], ['right', 'Move right'], ['jet', 'Jetpack'], ['crouch', 'Crouch'],
  ['fire', 'Shoot'], ['throw', 'Throw grenade'], ['nade', 'Switch grenade'], ['swap', 'Switch weapon'],
  ['reload', 'Reload'], ['melee', 'Melee'], ['pickup', 'Pick up weapon'], ['zoom', 'Scope zoom'], ['scores', 'Scoreboard'],
];

export const DEFAULT_KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jet: ['KeyW', 'Space'], crouch: ['KeyS', 'ArrowDown'],
  fire: ['Mouse0', ''], throw: ['KeyG', 'Mouse2'], nade: ['KeyC', ''], swap: ['KeyQ', ''], reload: ['KeyR', ''],
  melee: ['KeyF', 'Mouse1'], pickup: ['KeyE', ''], zoom: ['KeyZ', ''], scores: ['Tab', ''],
};

// Touch controls that can be placed; ids match Input.buttons / pads.
export const TOUCH_CONTROLS = [
  ['move', 'Move stick'], ['fire', 'Aim & fire stick'], ['swap', 'Switch weapon'], ['throw', 'Grenade'],
  ['nade', 'Switch grenade'], ['melee', 'Melee'], ['reload', 'Reload'], ['crouch', 'Crouch'],
];

export const SIZE_MIN = 0.4, SIZE_MAX = 2.3; // ControlsPlacementLayer::onSizeUp/Down

const DEFAULTS = {
  keys: DEFAULT_KEYS,
  touch: { pos: {}, size: {}, opacity: 1, moveInvert: false, aimInvert: false, swap: false, fireAt: 0.35 },
  volume: 0.7,
  blood: true,
};

const KEY = 'catacombs.settings';
let data = load();
const listeners = new Set();

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* private mode */ }
  return {
    ...DEFAULTS, ...saved,
    keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) },
    touch: { ...DEFAULTS.touch, ...(saved.touch || {}), pos: { ...(saved.touch?.pos || {}) }, size: { ...(saved.touch?.size || {}) } },
  };
}

export const settings = () => data;

export function save(patch) {
  if (patch) data = { ...data, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
  for (const f of listeners) f(data);
}

export function onChange(f) { listeners.add(f); }

export function bindKey(action, slot, code) {
  const keys = { ...data.keys };
  // a key does one thing: take it off any other action first
  for (const a in keys) keys[a] = keys[a].map((c) => (c === code ? '' : c));
  const pair = [...(keys[action] || ['', ''])];
  pair[slot] = code;
  keys[action] = pair;
  save({ keys });
}

export function resetKeys() { save({ keys: { ...DEFAULT_KEYS } }); }
export function resetTouch() { save({ touch: { ...DEFAULTS.touch, pos: {}, size: {} } }); }

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return ['Left click', 'Middle click', 'Right click', 'Mouse 4', 'Mouse 5'][+code.slice(5)] || code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return `${code.slice(5)} arrow`;
  return { Space: 'Space', Tab: 'Tab', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock' }[code] || code;
}
