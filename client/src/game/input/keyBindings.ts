import Phaser from 'phaser';

export type ActionId =
  | 'moveLeft'
  | 'moveRight'
  | 'fly'
  | 'crouch'
  | 'melee'
  | 'throwGrenade'
  | 'switchGrenade'
  | 'swapSlot'
  | 'reload'
  | 'pickupOrPair'
  | 'chat';

export const ACTION_LABELS: Record<ActionId, string> = {
  moveLeft: 'Move left',
  moveRight: 'Move right',
  fly: 'Fly / jump',
  crouch: 'Crouch',
  melee: 'Melee',
  throwGrenade: 'Throw grenade',
  switchGrenade: 'Switch grenade',
  swapSlot: 'Swap weapon slot',
  reload: 'Reload',
  pickupOrPair: 'Pickup / pair',
  chat: 'Open chat',
};

export const ACTION_IDS: ActionId[] = Object.keys(ACTION_LABELS) as ActionId[];

export type KeyBindings = Record<ActionId, number>;

const K = Phaser.Input.Keyboard.KeyCodes;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveLeft: K.A,
  moveRight: K.D,
  fly: K.SPACE,
  crouch: K.S,
  melee: K.V,
  throwGrenade: K.G,
  switchGrenade: K.Q,
  swapSlot: K.ONE,
  reload: K.R,
  pickupOrPair: K.E,
  chat: K.ENTER,
};

const STORAGE_KEY = 'mm_key_bindings';

type Listener = (bindings: KeyBindings) => void;
const listeners = new Set<Listener>();

function loadFromStorage(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEY_BINDINGS };
    return { ...DEFAULT_KEY_BINDINGS, ...(JSON.parse(raw) as Partial<KeyBindings>) };
  } catch {
    return { ...DEFAULT_KEY_BINDINGS };
  }
}

let current: KeyBindings = loadFromStorage();

export function getKeyBindings(): KeyBindings {
  return current;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private browsing / storage disabled — bindings just won't persist across reloads.
  }
  for (const listener of listeners) listener(current);
}

/** Rebinds `action` to `keyCode` — if another action already uses that key, prevent two actions on one key (per the flow) by swapping them. */
export function setKeyBinding(action: ActionId, keyCode: number) {
  const next = { ...current };
  const conflicting = ACTION_IDS.find((a) => a !== action && next[a] === keyCode);
  if (conflicting) next[conflicting] = current[action];
  next[action] = keyCode;
  current = next;
  persist();
}

export function resetKeyBindings() {
  current = { ...DEFAULT_KEY_BINDINGS };
  persist();
}

export function onKeyBindingsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const CODE_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(K).map(([name, code]) => [code as number, name]),
);

/** A readable label for a key code, e.g. "SPACE", "ONE", "A" — for the rebinding UI. */
export function keyCodeLabel(code: number): string {
  return CODE_TO_NAME[code] ?? `#${code}`;
}
