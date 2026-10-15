export interface RangeSetting {
  min: number;
  max: number;
  step: number;
  default: number;
}

export const HOST_SETTING_RANGES = {
  playerCount: { min: 2, max: 8, step: 1, default: 8 } satisfies RangeSetting,
  gameTimeSeconds: { min: 60, max: 900, step: 30, default: 300 } satisfies RangeSetting,
  mapDropsCountdownSeconds: { min: 5, max: 60, step: 5, default: 15 } satisfies RangeSetting,
  /** 100 = normal gravity, 0 = no gravity (floating only). */
  gravity: { min: 0, max: 100, step: 10, default: 100 } satisfies RangeSetting,
  /** 100 = no drain (unlimited boost), 0 = very fast drain. */
  boost: { min: 0, max: 100, step: 10, default: 100 } satisfies RangeSetting,
} as const;

export const DEFAULT_LOADOUT_ENABLED_DEFAULT = false;

/** Clamp a value to a range setting's min/max, snapped to its step. */
export function clampToRangeSetting(value: number, range: RangeSetting): number {
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const steps = Math.round((clamped - range.min) / range.step);
  return range.min + steps * range.step;
}
