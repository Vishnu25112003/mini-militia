import type { HostSettings } from '../types';

// Host settings. Source of truth: Game Flow, Section 2 "Host settings popup".

export interface NumericSettingSpec {
  min: number;
  max: number;
  step: number;
  default: number;
}

export const HOST_SETTING_SPECS = {
  playerCount: { min: 2, max: 8, step: 1, default: 8 },
  gameTimeSec: { min: 60, max: 900, step: 30, default: 300 },
  mapDropsSec: { min: 5, max: 60, step: 5, default: 15 },
  gravity: { min: 0, max: 100, step: 10, default: 100 },
  boost: { min: 0, max: 100, step: 10, default: 100 },
} as const satisfies Record<string, NumericSettingSpec>;

export type NumericHostSetting = keyof typeof HOST_SETTING_SPECS;

export function defaultHostSettings(): HostSettings {
  return {
    playerCount: HOST_SETTING_SPECS.playerCount.default,
    gameTimeSec: HOST_SETTING_SPECS.gameTimeSec.default,
    mapDropsSec: HOST_SETTING_SPECS.mapDropsSec.default,
    gravity: HOST_SETTING_SPECS.gravity.default,
    boost: HOST_SETTING_SPECS.boost.default,
    defaultLoadout: false,
    loadout: null,
  };
}

/** Clamp a value to a setting's range and snap it to its step. Non-numbers fall back to the default. */
export function clampSetting(name: NumericHostSetting, value: unknown): number {
  const spec: NumericSettingSpec = HOST_SETTING_SPECS[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) return spec.default;
  const snapped = spec.min + Math.round((value - spec.min) / spec.step) * spec.step;
  return Math.min(spec.max, Math.max(spec.min, snapped));
}
