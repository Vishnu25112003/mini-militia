import type { Facing } from '@game/shared';

/**
 * Mirrors `server/src/schema/PlayerInputSchema.ts` — the client has no
 * compile-time reference to that server-only package, so this plain
 * interface is kept in sync by hand. Used only for typing `room.input<T>()`;
 * the actual schema (and wire format) comes from the server via reflection.
 */
export interface PlayerInputWire {
  moveX: number;
  fly: boolean;
  crouch: boolean;
  aimAngle: number;
  fire: boolean;
  melee: boolean;
  throwGrenade: boolean;
  reload: boolean;
  swapSlot: boolean;
  pickupOrPair: boolean;
}

/**
 * Mirrors `server/src/schema/PlayerSchema.ts`'s scalar fields — the flat
 * shape `predict.reconciler` mirrors locally for rollback. Also what a
 * decoded `PlayerSchema` instance structurally looks like on the client.
 */
export interface PlayerWireState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  aimAngle: number;
  crouching: boolean;
  onGround: boolean;
  fuel: number;
  color: string;
  name: string;
  /** Lobby-only: has this player pressed Start? Unused once the match is playing. */
  ready: boolean;
}

/** Mirrors `server/src/schema/MatchRoomState.ts`. */
export interface MatchRoomWireState {
  phase: 'lobby' | 'playing' | 'ended';
  roomCode: string;
  hostSessionId: string;
  autoStartRemainingSeconds: number;
}
