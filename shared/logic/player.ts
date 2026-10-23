import { MATCH_RULES } from '../config/matchRules';
import { MOVEMENT } from '../config/movement';
import type { PlayerInput, PlayerState, Slot } from '../types';

/** An input that does nothing (useful as a default and in tests). */
export function emptyInput(seq = 0): PlayerInput {
  return {
    seq,
    moveX: 0,
    fly: false,
    crouch: false,
    aimAngle: 0,
    fire: false,
    melee: false,
    throwGrenade: false,
    switchGrenade: false,
    reload: false,
    swapWeapon: false,
    pickup: false,
  };
}

export interface NewPlayerInit {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  slots: [Slot, Slot];
}

/** A freshly spawned player: full health, full fuel, 2 frag + 2 gas, spawn shield running. */
export function createPlayer(init: NewPlayerInit): PlayerState {
  return {
    id: init.id,
    name: init.name,
    color: init.color,
    x: init.x,
    y: init.y,
    vx: 0,
    vy: 0,
    facing: 1,
    crouching: false,
    onGround: false,
    flying: false,
    health: MATCH_RULES.maxHealth,
    fuel: MOVEMENT.fuelCapacity,
    alive: true,
    shieldTimer: MATCH_RULES.spawnShieldSec,
    slots: init.slots,
    activeSlot: 0,
    grenades: { ...MATCH_RULES.spawnGrenades },
    selectedGrenade: 'frag',
    kills: 0,
    deaths: 0,
    points: 0,
    killsThisLife: 0,
    lastInputSeq: 0,
  };
}
