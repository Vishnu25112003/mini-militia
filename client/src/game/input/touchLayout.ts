export type ControlId =
  | 'moveJoystick'
  | 'aimJoystick'
  | 'grenadeButton'
  | 'switchGrenadeButton'
  | 'meleeButton'
  | 'reloadButton'
  | 'pickupButton'
  | 'zoomButton'
  | 'chatButton';

export interface ControlLayout {
  x: number;
  y: number;
  scale: number;
}

export type TouchLayout = Record<ControlId, ControlLayout>;

const STORAGE_KEY = 'mm_touch_layout';

/** The flow's default touch layout — same positions every control already used before Phase 13. */
export function defaultTouchLayout(width: number, height: number): TouchLayout {
  return {
    moveJoystick: { x: 90, y: height - 90, scale: 1 },
    grenadeButton: { x: 175, y: height - 160, scale: 1 },
    switchGrenadeButton: { x: 175, y: height - 230, scale: 1 },
    aimJoystick: { x: width - 90, y: height - 90, scale: 1 },
    meleeButton: { x: width - 175, y: height - 90, scale: 1 },
    reloadButton: { x: width - 90, y: height - 160, scale: 1 },
    pickupButton: { x: width - 165, y: height - 160, scale: 1 },
    zoomButton: { x: 40, y: 40, scale: 1 },
    // Near top-center, just below the match timer (per the HUD table).
    chatButton: { x: width / 2 - 70, y: 40, scale: 1 },
  };
}

export function loadTouchLayout(width: number, height: number): TouchLayout {
  const defaults = defaultTouchLayout(width, height);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<TouchLayout>;
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export function saveTouchLayout(layout: TouchLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Private browsing / storage disabled — layout just won't persist across reloads.
  }
}

export function clearSavedTouchLayout() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage isn't available in the first place.
  }
}
