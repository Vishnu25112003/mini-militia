import type { PlayerInput } from '@game/shared';

export type RawInput = Omit<PlayerInput, 'sequence'>;

export interface InputSource {
  sample(): RawInput;
  destroy(): void;
}

/** Phase 03 placeholder: these actions don't do anything yet (Phases 07-10 wire them up). */
export function logUnwiredAction(name: string) {
  console.log(`[input] ${name} pressed — no gameplay effect yet`);
}
