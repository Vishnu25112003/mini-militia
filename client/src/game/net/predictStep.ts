import {
  MATCH_RULES,
  WEAPONS,
  step as sharedStep,
  type CollisionMap,
  type PlayerInput,
  type PlayerState,
} from '@game/shared';
import type { StepContext } from '@colyseus/sdk';
import type { PlayerInputWire, PlayerWireState } from './wireTypes';

const ak47 = WEAPONS.AK47;
const m14 = WEAPONS.M14;

/**
 * The shared `step()` needs a full `PlayerState` (slots, grenades, etc.),
 * but the Reconciler only mirrors the flat movement fields. The extra fields
 * are placeholders `step()` never reads or writes — only used so the shared
 * physics function's signature is satisfied without a second code path.
 */
function toPlayerState(flat: PlayerWireState): PlayerState {
  return {
    id: flat.name,
    name: flat.name,
    color: flat.color as PlayerState['color'],
    position: { x: flat.x, y: flat.y },
    velocity: { x: flat.vx, y: flat.vy },
    facing: flat.facing,
    health: MATCH_RULES.maxHealth,
    fuel: flat.fuel,
    crouching: flat.crouching,
    onGround: flat.onGround,
    slots: [
      {
        kind: 'single',
        weapon: ak47.id,
        ammoInMagazine: ak47.magazine,
        ammoReserve: ak47.reserve ?? 0,
      },
      {
        kind: 'single',
        weapon: m14.id,
        ammoInMagazine: m14.magazine,
        ammoReserve: m14.reserve ?? 0,
      },
    ],
    activeSlotIndex: 0,
    grenades: { Fragnade: 0, Gasnade: 0, Proxynade: 0 },
    kills: 0,
    deaths: 0,
    points: 0,
    gotKillThisLife: false,
    shieldSecondsRemaining: 0,
    alive: true,
  };
}

function toPlayerInput(wire: PlayerInputWire, sequence: number): PlayerInput {
  return {
    moveX: wire.moveX as PlayerInput['moveX'],
    fly: wire.fly,
    crouch: wire.crouch,
    aimAngle: wire.aimAngle,
    fire: wire.fire,
    melee: wire.melee,
    throwGrenade: wire.throwGrenade,
    reload: wire.reload,
    swapSlot: wire.swapSlot,
    pickupOrPair: wire.pickupOrPair,
    sequence,
  };
}

/**
 * Builds the Reconciler's `step` callback: adapts the flat mirrored state to
 * the shared `PlayerState` shape, runs the SAME shared physics the server
 * runs, and writes the movement fields back — the one rule that keeps
 * prediction and server truth from diverging is "always the shared `step`,
 * never a copy."
 */
export function createPredictStep(
  collisionMap: CollisionMap,
  settings: { gravity: number; boost: number },
) {
  return (ctx: StepContext, state: PlayerWireState, command: PlayerInputWire) => {
    const playerState = toPlayerState(state);
    const input = toPlayerInput(command, ctx.tick);
    const next = sharedStep(playerState, input, collisionMap, settings);

    state.x = next.position.x;
    state.y = next.position.y;
    state.vx = next.velocity.x;
    state.vy = next.velocity.y;
    state.facing = next.facing;
    state.crouching = next.crouching;
    state.onGround = next.onGround;
    state.fuel = next.fuel;
  };
}
