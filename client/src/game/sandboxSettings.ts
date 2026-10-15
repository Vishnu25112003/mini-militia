import { HOST_SETTING_RANGES } from '@game/shared';

/**
 * Dev-only mutable settings the debug panel edits live and the sandbox
 * scene reads every tick — deliberately a plain object, not React state,
 * since the Phaser scene isn't a React component and this is throwaway
 * tooling, not game state.
 */
export const sandboxSettings = {
  gravity: HOST_SETTING_RANGES.gravity.default,
  boost: HOST_SETTING_RANGES.boost.default,
  /** Artificial delay (ms) added before sending each input, to test bad networks locally (Phase 04). */
  artificialLagMs: 0,
  /** Chance (0-100) of silently dropping an outgoing input, to test lossy networks locally (Phase 04). */
  packetLossPercent: 0,
};
