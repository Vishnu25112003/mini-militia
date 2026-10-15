import { Room, Client, type StepContext, type Rewind, type Delayed } from 'colyseus';
import {
  HOST_SETTING_RANGES,
  MATCH_RULES,
  PLAYER_COLORS,
  step,
  validateName,
  type PlayerInput,
  type PlayerState,
} from '@game/shared';
import { MatchRoomState } from '../schema/MatchRoomState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { PlayerInputSchema } from '../schema/PlayerInputSchema.js';
import { createServerPlayer } from '../createServerPlayer.js';
import { loadCatacombsMap } from '../map.js';
import { generateUniqueRoomCode } from '../roomCode.js';

export const MATCH_ROOM_NAME = 'match_room';

const TICK_RATE = 30;
const PATCH_RATE_MS = 50; // 20 Hz, per the flow's fixed decisions
const REWIND_WINDOW_MS = 1000;
const PHYSICS_SETTINGS = {
  gravity: HOST_SETTING_RANGES.gravity.default,
  boost: HOST_SETTING_RANGES.boost.default,
};
const CHAT_MAX_LENGTH = 100;

/** Custom WebSocket close codes clients can branch on in `room.onLeave((code, reason) => ...)`. */
const LEAVE_CODE = { REMOVED_BY_HOST: 4000, ROOM_CANCELLED: 4001 } as const;

interface JoinOptions {
  name?: string;
}

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
  private autoStartTimeout?: Delayed;
  private autoStartCountdownInterval?: Delayed;

  inputs = this.defineInput(PlayerInputSchema, {
    sanitize: { moveX: [-1, 1] },
    // A tick with no fresh input (network jitter, not a real pause) should
    // still simulate — holding the last known input, not freezing gravity.
    idle: ({ latest }) => latest ?? true,
  });

  async onCreate() {
    this.setState(new MatchRoomState());
    this.patchRate = PATCH_RATE_MS;

    this.state.roomCode = await generateUniqueRoomCode(MATCH_ROOM_NAME);
    this.setMetadata({ code: this.state.roomCode });

    this.rewind = this.allowRewindState({ maxRewindMs: REWIND_WINDOW_MS });
    this.rewind.attachAll(this.state.players, { fields: ['x', 'y'] });

    this.onMessage('ready', (client) => this.handleReady(client));
    this.onMessage('chat', (client, payload: { text?: string }) =>
      this.handleChat(client, payload),
    );
    this.onMessage('removePlayer', (client, payload: { sessionId?: string }) =>
      this.handleRemovePlayer(client, payload),
    );

    this.startAutoStartTimer();
  }

  private startAutoStartTimer() {
    this.state.autoStartRemainingSeconds = MATCH_RULES.autoStartLobbySeconds;
    this.autoStartCountdownInterval = this.clock.setInterval(() => {
      this.state.autoStartRemainingSeconds = Math.max(0, this.state.autoStartRemainingSeconds - 1);
    }, 1000);
    this.autoStartTimeout = this.clock.setTimeout(() => {
      if (this.state.phase === 'lobby') this.startMatch();
    }, MATCH_RULES.autoStartLobbySeconds * 1000);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const name = (options.name ?? '').trim();
    if (!validateName(name)) {
      throw new Error('invalid_name');
    }

    if (this.state.phase === 'lobby') {
      this.joinLobby(client, name);
    } else if (this.state.phase === 'playing') {
      // Basic late join for now — Phase 12 owns the full reconnect/late-join rules.
      this.joinMatchInProgress(client, name);
    } else {
      throw new Error('match_ended');
    }
  }

  private joinLobby(client: Client, name: string) {
    const nameTaken = [...this.state.players.values()].some(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (nameTaken) {
      throw new Error('name_taken');
    }

    const usedColors = new Set([...this.state.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[0]!;

    const schemaPlayer = new PlayerSchema();
    schemaPlayer.name = name;
    schemaPlayer.color = color;
    schemaPlayer.ready = false;
    this.state.players.set(client.sessionId, schemaPlayer);

    if (!this.state.hostSessionId) {
      this.state.hostSessionId = client.sessionId;
    }
  }

  private joinMatchInProgress(client: Client, name: string) {
    const spawn =
      this.catacombs.spawnPoints[Math.floor(Math.random() * this.catacombs.spawnPoints.length)]!;
    const usedColors = new Set([...this.state.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[0]!;

    const playerState = createServerPlayer(spawn, name, color);
    this.players.set(client.sessionId, playerState);

    const schemaPlayer = new PlayerSchema();
    schemaPlayer.color = color;
    schemaPlayer.name = name;
    syncSchemaFromState(schemaPlayer, playerState, 0);
    this.state.players.set(client.sessionId, schemaPlayer);
  }

  private handleReady(client: Client) {
    if (this.state.phase !== 'lobby') return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.ready = true;

    const allReady = [...this.state.players.values()].every((p) => p.ready);
    if (allReady) this.startMatch();
  }

  private handleChat(client: Client, payload: { text?: string }) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const text = (payload.text ?? '').slice(0, CHAT_MAX_LENGTH).trim();
    if (!text) return;
    this.broadcast('chat', { name: player.name, color: player.color, text });
  }

  private handleRemovePlayer(client: Client, payload: { sessionId?: string }) {
    if (this.state.phase !== 'lobby') return;
    if (client.sessionId !== this.state.hostSessionId) return; // host-only
    const targetId = payload.sessionId;
    if (!targetId || targetId === this.state.hostSessionId) return; // can't remove self/host

    const target = this.clients.getById(targetId);
    this.state.players.delete(targetId);
    target?.leave(LEAVE_CODE.REMOVED_BY_HOST, 'removed_by_host');
  }

  private startMatch() {
    this.autoStartTimeout?.clear();
    this.autoStartCountdownInterval?.clear();
    this.state.autoStartRemainingSeconds = 0;
    this.state.phase = 'playing';

    for (const [sessionId, schemaPlayer] of this.state.players) {
      const spawn =
        this.catacombs.spawnPoints[Math.floor(Math.random() * this.catacombs.spawnPoints.length)]!;
      const playerState = createServerPlayer(spawn, schemaPlayer.name, schemaPlayer.color);
      this.players.set(sessionId, playerState);
      syncSchemaFromState(schemaPlayer, playerState, 0);
    }

    this.setFixedTimestep((ctx) => this.fixedTick(ctx), TICK_RATE);
  }

  onLeave(client: Client) {
    if (this.state.phase === 'lobby' && client.sessionId === this.state.hostSessionId) {
      this.cancelRoom();
      return;
    }

    this.players.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  /** Host left (or disconnected) while still in the lobby — the whole room is cancelled, per the flow. */
  private cancelRoom() {
    this.state.players.delete(this.state.hostSessionId);
    for (const client of [...this.clients]) {
      client.leave(LEAVE_CODE.ROOM_CANCELLED, 'room_cancelled');
    }
  }

  onDispose() {
    this.autoStartTimeout?.clear();
    this.autoStartCountdownInterval?.clear();
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
