import type { PlayerInput } from '@game/shared';

export type RawInput = Omit<PlayerInput, 'sequence'>;

export interface InputSource {
  sample(): RawInput;
  /** True for exactly one call after the chat-open action fires (Enter on desktop; always false on touch). */
  consumeChatToggle(): boolean;
  destroy(): void;
}

/** Phase 03 placeholder: these actions don't do anything yet (Phases 07-10 wire them up). */
export function logUnwiredAction(name: string) {
  console.log(`[input] ${name} pressed — no gameplay effect yet`);
}
