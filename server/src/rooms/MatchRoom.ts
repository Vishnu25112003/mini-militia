import { Room, Client, type StepContext, type Rewind } from 'colyseus';
import {
  HOST_SETTING_RANGES,
  PLAYER_COLORS,
  step,
  type PlayerInput,
  type PlayerState,
} from '@game/shared';
import { MatchRoomState } from '../schema/MatchRoomState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { PlayerInputSchema } from '../schema/PlayerInputSchema.js';
import { createServerPlayer } from '../createServerPlayer.js';
import { loadCatacombsMap } from '../map.js';

const TICK_RATE = 30;
const PATCH_RATE_MS = 50; // 20 Hz, per the flow's fixed decisions
const REWIND_WINDOW_MS = 1000;
const PHYSICS_SETTINGS = {
  gravity: HOST_SETTING_RANGES.gravity.default,
  boost: HOST_SETTING_RANGES.boost.default,
};

/** `sequence` isn't read by `step()` itself — it's informational only, so `tick` (free from the StepContext) is a fine value to carry. */
function toPlayerInput(wire: InstanceType<typeof PlayerInputSchema>, tick: number): PlayerInput {
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
    sequence: tick,
  };
}

function syncSchemaFromState(
  target: InstanceType<typeof PlayerSchema>,
  source: PlayerState,
  latestAimAngle: number,
) {
  target.x = source.position.x;
  target.y = source.position.y;
  target.vx = source.velocity.x;
  target.vy = source.velocity.y;
  target.facing = source.facing;
  target.aimAngle = latestAimAngle;
  target.crouching = source.crouching;
  target.onGround = source.onGround;
  target.fuel = source.fuel;
}

export class MatchRoom extends Room<{
  state: InstanceType<typeof MatchRoomState>;
  input: InstanceType<typeof PlayerInputSchema>;
}> {
  maxClients = 8;

  private catacombs = loadCatacombsMap();
  private players = new Map<string, PlayerState>();
  private rewind!: Rewind;

  inputs = this.defineInput(PlayerInputSchema, {
    sanitize: { moveX: [-1, 1] },
    // A tick with no fresh input (network jitter, not a real pause) should
    // still simulate — holding the last known input, not freezing gravity.
    idle: ({ latest }) => latest ?? true,
  });

  onCreate() {
    this.setState(new MatchRoomState());
    this.patchRate = PATCH_RATE_MS;

    this.rewind = this.allowRewindState({ maxRewindMs: REWIND_WINDOW_MS });
    this.rewind.attachAll(this.state.players, { fields: ['x', 'y'] });

    this.setFixedTimestep((ctx) => this.fixedTick(ctx), TICK_RATE);
  }

  onJoin(client: Client, options: { name?: string } = {}) {
    const spawn =
      this.catacombs.spawnPoints[Math.floor(Math.random() * this.catacombs.spawnPoints.length)]!;
    const color = PLAYER_COLORS[this.state.players.size % PLAYER_COLORS.length]!;
    const name = options.name?.trim() || `Player${client.sessionId.slice(0, 4)}`;

    const playerState = createServerPlayer(spawn, name, color);
    this.players.set(client.sessionId, playerState);

    const schemaPlayer = new PlayerSchema();
    schemaPlayer.color = color;
    schemaPlayer.name = name;
    syncSchemaFromState(schemaPlayer, playerState, 0);
    this.state.players.set(client.sessionId, schemaPlayer);
  }

  onLeave(client: Client) {
    this.players.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private fixedTick(ctx: StepContext) {
    for (const [sessionId, playerState] of this.players) {
      let latest = playerState;
      let latestAimAngle = this.state.players.get(sessionId)?.aimAngle ?? 0;

      for (const wireInput of this.inputs.get(sessionId)) {
        const input = toPlayerInput(wireInput, ctx.tick);
        latest = step(latest, input, this.catacombs.collisionMap, PHYSICS_SETTINGS);
        latestAimAngle = input.aimAngle;
      }

      this.players.set(sessionId, latest);

      const schemaPlayer = this.state.players.get(sessionId);
      if (schemaPlayer) syncSchemaFromState(schemaPlayer, latest, latestAimAngle);
    }
  }
}
