import { Room, Client, type StepContext, type Rewind, type Delayed } from 'colyseus';
import {
  GRENADES,
  GRENADE_RADIUS_PX,
  HOST_SETTING_RANGES,
  MATCH_RULES,
  PLAYER_COLORS,
  PROJECTILE_WEAPONS,
  WEAPONS,
  WEAPON_RANGE_PX,
  applyDamage,
  canFireActiveSlot,
  canMelee,
  canThrowGrenade,
  damageParamsForShot,
  fireActiveSlot,
  gravityForSetting,
  grenadeDamageAtDistance,
  hitscanRangeForWeapons,
  isFrontHit,
  isWithinMeleeRange,
  performMeleeSwing,
  pointsOnDeath,
  pointsOnKill,
  projectileHitsPlayer,
  projectileHitsWall,
  resolveHitscanShot,
  resolveMeleeClash,
  resolveSplashDamage,
  startReloadActiveSlot,
  step,
  stepGrenade,
  stepProjectile,
  swapActiveSlot,
  switchGrenadeType,
  throwGrenade,
  tickCombatTimers,
  tickGrenadeThrowCooldown,
  tickMeleeCooldown,
  validateName,
  type GrenadeId,
  type GrenadeProjectile,
  type HitscanTarget,
  type PlayerInput,
  type PlayerState,
  type Projectile,
  type Slot,
  type SplashTarget,
  type WeaponStats,
} from '@game/shared';
import { MatchRoomState } from '../schema/MatchRoomState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { PlayerInputSchema } from '../schema/PlayerInputSchema.js';
import { SlotSchema } from '../schema/SlotSchema.js';
import { createServerPlayer, respawnServerPlayer } from '../createServerPlayer.js';
import { loadCatacombsMap } from '../map.js';
import { generateUniqueRoomCode } from '../roomCode.js';
import { applyHostSettingsUpdate, spawnLoadoutFor, type HostSettingsUpdate } from '../hostSettings.js';

export const MATCH_ROOM_NAME = 'match_room';

const TICK_RATE = 30;
const DT_SECONDS = 1 / TICK_RATE;
const PATCH_RATE_MS = 50; // 20 Hz, per the flow's fixed decisions
const REWIND_WINDOW_MS = 1000;
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
    switchGrenade: wire.switchGrenade,
    reload: wire.reload,
    swapSlot: wire.swapSlot,
    pickupOrPair: wire.pickupOrPair,
    sequence: tick,
  };
}

function syncSlotSchema(target: InstanceType<typeof SlotSchema>, slot: Slot) {
  target.kind = slot.kind;
  target.cooldownRemainingSeconds = slot.cooldownRemainingSeconds;
  target.reloadRemainingSeconds = slot.reloadRemainingSeconds;

  if (slot.kind === 'single') {
    target.weapon1 = slot.weapon;
    target.weapon2 = '';
    target.ammoInMagazine1 = slot.ammoInMagazine;
    target.ammoInMagazine2 = 0;
    target.ammoReserve1 = slot.ammoReserve;
    target.ammoReserve2 = 0;
  } else {
    target.weapon1 = slot.weapons[0];
    target.weapon2 = slot.weapons[1];
    target.ammoInMagazine1 = slot.ammoInMagazine[0];
    target.ammoInMagazine2 = slot.ammoInMagazine[1];
    target.ammoReserve1 = slot.ammoReserve[0];
    target.ammoReserve2 = slot.ammoReserve[1];
  }
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

  target.health = source.health;
  target.alive = source.alive;
  target.shieldSecondsRemaining = source.shieldSecondsRemaining;
  target.activeSlotIndex = source.activeSlotIndex;
  syncSlotSchema(target.slot1, source.slots[0]);
  syncSlotSchema(target.slot2, source.slots[1]);
  target.kills = source.kills;
  target.deaths = source.deaths;
  target.points = source.points;

  target.fragnades = source.grenades.Fragnade;
  target.gasnades = source.grenades.Gasnade;
  target.proxynades = source.grenades.Proxynade;
  target.selectedGrenade = source.selectedGrenade;
}

export class MatchRoom extends Room<{
  state: InstanceType<typeof MatchRoomState>;
  input: InstanceType<typeof PlayerInputSchema>;
}> {
  maxClients = HOST_SETTING_RANGES.playerCount.default;

  private catacombs = loadCatacombsMap();
  private players = new Map<string, PlayerState>();
  private rewind!: Rewind;
  private autoStartTimeout?: Delayed;
  private autoStartCountdownInterval?: Delayed;
  private respawnTimers = new Map<string, Delayed>();
  /** Edge-detects `swapSlot` so holding the button doesn't toggle every tick. */
  private prevSwapHeld = new Map<string, boolean>();
  /** Edge-detects `switchGrenade` the same way. */
  private prevSwitchGrenadeHeld = new Map<string, boolean>();
  private projectiles: Projectile[] = [];
  private projectileIdCounter = 0;
  private grenades: GrenadeProjectile[] = [];
  private grenadeIdCounter = 0;
  private gasClouds: Array<{ x: number; y: number; remainingSeconds: number; ownerId: string }> = [];
  /**
   * A melee swing isn't applied the instant it lands — it's held pending for
   * `meleeClashWindowSeconds` so a near-simultaneous swing back can still
   * register as a clash. Keyed by the attacker's sessionId.
   */
  private pendingMeleeHits = new Map<string, { targetId: string; tick: number }>();

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
    this.onMessage('updateHostSettings', (client, payload: HostSettingsUpdate) =>
      this.handleUpdateHostSettings(client, payload),
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

    const playerState = createServerPlayer(spawn, name, color, spawnLoadoutFor(this.state.settings));
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
    this.forgetPlayer(targetId);
    target?.leave(LEAVE_CODE.REMOVED_BY_HOST, 'removed_by_host');
  }

  private handleUpdateHostSettings(client: Client, payload: HostSettingsUpdate) {
    if (client.sessionId !== this.state.hostSessionId) return; // host-only
    if (this.state.phase !== 'lobby') return; // locked once the match starts

    applyHostSettingsUpdate(this.state.settings, payload, this.state.players.size);
    this.maxClients = this.state.settings.playerCount;
  }

  private startMatch() {
    this.autoStartTimeout?.clear();
    this.autoStartCountdownInterval?.clear();
    this.state.autoStartRemainingSeconds = 0;
    this.state.phase = 'playing';

    for (const [sessionId, schemaPlayer] of this.state.players) {
      const spawn =
        this.catacombs.spawnPoints[Math.floor(Math.random() * this.catacombs.spawnPoints.length)]!;
      const playerState = createServerPlayer(
        spawn,
        schemaPlayer.name,
        schemaPlayer.color,
        spawnLoadoutFor(this.state.settings),
      );
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

    this.forgetPlayer(client.sessionId);
  }

  /** Host left (or disconnected) while still in the lobby — the whole room is cancelled, per the flow. */
  private cancelRoom() {
    this.forgetPlayer(this.state.hostSessionId);
    for (const client of [...this.clients]) {
      client.leave(LEAVE_CODE.ROOM_CANCELLED, 'room_cancelled');
    }
  }

  private forgetPlayer(sessionId: string) {
    this.players.delete(sessionId);
    this.state.players.delete(sessionId);
    this.respawnTimers.get(sessionId)?.clear();
    this.respawnTimers.delete(sessionId);
    this.prevSwapHeld.delete(sessionId);
    this.prevSwitchGrenadeHeld.delete(sessionId);
    this.pendingMeleeHits.delete(sessionId);
  }

  onDispose() {
    this.autoStartTimeout?.clear();
    this.autoStartCountdownInterval?.clear();
    for (const timer of this.respawnTimers.values()) timer.clear();
  }

  private fixedTick(ctx: StepContext) {
    const physicsSettings = { gravity: this.state.settings.gravity, boost: this.state.settings.boost };

    for (const [sessionId, playerState] of this.players) {
      if (!playerState.alive) continue; // waiting out the respawn timer, which will replace this entry

      let latest = playerState;
      let latestAimAngle = this.state.players.get(sessionId)?.aimAngle ?? 0;

      for (const wireInput of this.inputs.get(sessionId)) {
        const input = toPlayerInput(wireInput, ctx.tick);
        latest = step(latest, input, this.catacombs.collisionMap, physicsSettings);
        latest = tickCombatTimers(latest, DT_SECONDS);
        latest = tickMeleeCooldown(latest, DT_SECONDS);
        latest = tickGrenadeThrowCooldown(latest, DT_SECONDS);
        latestAimAngle = input.aimAngle;

        if (input.reload) latest = startReloadActiveSlot(latest);

        const swapEdge = input.swapSlot && !this.prevSwapHeld.get(sessionId);
        if (swapEdge) latest = swapActiveSlot(latest);
        this.prevSwapHeld.set(sessionId, input.swapSlot);

        const switchGrenadeEdge = input.switchGrenade && !this.prevSwitchGrenadeHeld.get(sessionId);
        if (switchGrenadeEdge) latest = switchGrenadeType(latest);
        this.prevSwitchGrenadeHeld.set(sessionId, input.switchGrenade);

        if (input.throwGrenade && canThrowGrenade(latest)) {
          const thrown = throwGrenade(latest);
          latest = thrown.state;
          this.spawnGrenade(sessionId, latest, input.aimAngle, thrown.thrown);
        }

        if (input.melee && canMelee(latest)) {
          latest = performMeleeSwing(latest);
          const target = this.findMeleeTarget(sessionId, latest);
          if (target) {
            const reciprocal = this.pendingMeleeHits.get(target);
            if (reciprocal && reciprocal.targetId === sessionId) {
              // `target` swung first (their pending entry already existed) — a clash.
              this.pendingMeleeHits.delete(target);
              this.pendingMeleeHits.delete(sessionId);
              this.applyMeleeClash(target, sessionId);
              // The clash may have updated (even killed) `sessionId` — fold that back into
              // `latest`, same reasoning as the hitscan kill-credit fold-back above.
              const updatedSelf = this.players.get(sessionId);
              if (updatedSelf) latest = updatedSelf;
            } else {
              this.pendingMeleeHits.set(sessionId, { targetId: target, tick: ctx.tick });
            }
          }
        }

        if (input.fire && canFireActiveSlot(latest)) {
          const fired = fireActiveSlot(latest, input.aimAngle);
          latest = fired.state;

          if (fired.fireKind === 'projectile') {
            this.spawnProjectile(sessionId, latest, input.aimAngle, fired.weaponsFired[0]!);
          } else {
            for (const rayAngle of fired.rayAngles) {
              this.broadcast('shotFired', {
                shooterId: sessionId,
                x: latest.position.x,
                y: latest.position.y,
                angle: rayAngle,
              });
              // May return the shooter's own state updated with kill credit — fold it into
              // `latest` so the end-of-iteration `this.players.set(sessionId, latest)` below
              // doesn't clobber it with the pre-kill value.
              const shooterAfterResolve = this.resolveShot(sessionId, latest, rayAngle, fired.weaponsFired);
              if (shooterAfterResolve) latest = shooterAfterResolve;
            }
          }
        }

        if (!latest.alive) break; // this tick's own shot (or another's) just killed them
      }

      this.players.set(sessionId, latest);

      const schemaPlayer = this.state.players.get(sessionId);
      if (schemaPlayer) syncSchemaFromState(schemaPlayer, latest, latestAimAngle);

      if (!latest.alive) this.scheduleRespawn(sessionId);
    }

    // Separate passes, after every player's own turn — none of these ever need folding back
    // into a `latest` local like the hitscan/melee paths above, since every player's
    // end-of-iteration write has already happened by this point.
    this.tickProjectiles();
    this.tickGrenades();
    this.resolveExpiredMeleeHits(ctx.tick);
  }

  /** Nearest alive enemy within melee range, if any. */
  private findMeleeTarget(attackerId: string, attackerState: PlayerState): string | null {
    let closestId: string | null = null;
    let closestDistance = Infinity;

    for (const [otherId, otherState] of this.players) {
      if (otherId === attackerId || !otherState.alive) continue;
      const distance = Math.hypot(
        attackerState.position.x - otherState.position.x,
        attackerState.position.y - otherState.position.y,
      );
      if (distance <= MATCH_RULES.meleeRangePx && distance < closestDistance) {
        closestId = otherId;
        closestDistance = distance;
      }
    }
    return closestId;
  }

  /** A melee swing with nobody swinging back within the clash window — resolves as a clean, instant kill. */
  private resolveExpiredMeleeHits(tick: number) {
    if (this.pendingMeleeHits.size === 0) return;
    const clashWindowTicks = Math.ceil(MATCH_RULES.meleeClashWindowSeconds * TICK_RATE);

    for (const [attackerId, pending] of [...this.pendingMeleeHits]) {
      if (tick - pending.tick < clashWindowTicks) continue; // still within the window
      this.pendingMeleeHits.delete(attackerId);
      this.resolveMeleeKill(attackerId, pending.targetId);
    }
  }

  private resolveMeleeKill(attackerId: string, targetId: string) {
    const attacker = this.players.get(attackerId);
    const target = this.players.get(targetId);
    if (!attacker?.alive || !target?.alive) return; // one of them is gone/already dead

    // Melee always kills — ignores health, crouch shield, and spawn shield.
    const killed: PlayerState = { ...target, health: 0, alive: false };
    this.players.set(targetId, killed);
    const targetSchema = this.state.players.get(targetId);
    if (targetSchema) syncSchemaFromState(targetSchema, killed, targetSchema.aimAngle);

    this.broadcast('melee', { attackerId, targetId });
    this.handleKill(attackerId, attacker, targetId, killed);
  }

  /**
   * `firstHitterId` swung first — they get the kill and only lose a fixed 50
   * health (or die too, if that leaves them at 0). `secondHitterId` dies
   * outright, same as any other melee hit.
   */
  private applyMeleeClash(firstHitterId: string, secondHitterId: string) {
    const firstHitter = this.players.get(firstHitterId);
    const secondHitter = this.players.get(secondHitterId);
    if (!firstHitter?.alive || !secondHitter?.alive) return;

    this.broadcast('melee', { attackerId: firstHitterId, targetId: secondHitterId });

    const clash = resolveMeleeClash(firstHitter.health);
    const creditedFirstHitter: PlayerState = {
      ...firstHitter,
      health: clash.firstHitterHealthAfter,
      alive: !clash.firstHitterDies,
      kills: firstHitter.kills + 1,
      points: firstHitter.points + pointsOnKill(),
      gotKillThisLife: true,
    };
    this.players.set(firstHitterId, creditedFirstHitter);
    const firstSchema = this.state.players.get(firstHitterId);
    if (firstSchema) syncSchemaFromState(firstSchema, creditedFirstHitter, firstSchema.aimAngle);

    const deadSecondHitter: PlayerState = {
      ...secondHitter,
      health: 0,
      alive: false,
      deaths: secondHitter.deaths + 1,
      points: secondHitter.points + pointsOnDeath(secondHitter.gotKillThisLife),
    };
    this.players.set(secondHitterId, deadSecondHitter);
    const secondSchema = this.state.players.get(secondHitterId);
    if (secondSchema) syncSchemaFromState(secondSchema, deadSecondHitter, secondSchema.aimAngle);
    this.scheduleRespawn(secondHitterId);

    if (clash.firstHitterDies) {
      // Their own death has no -1 penalty — they got a kill this life (pointsOnDeath(true) === 0).
      const firstHitterAfterOwnDeath: PlayerState = {
        ...creditedFirstHitter,
        deaths: creditedFirstHitter.deaths + 1,
        points: creditedFirstHitter.points + pointsOnDeath(creditedFirstHitter.gotKillThisLife),
      };
      this.players.set(firstHitterId, firstHitterAfterOwnDeath);
      if (firstSchema) syncSchemaFromState(firstSchema, firstHitterAfterOwnDeath, firstSchema.aimAngle);
      this.scheduleRespawn(firstHitterId);
    }
  }

  private spawnGrenade(ownerId: string, throwerState: PlayerState, angle: number, grenadeId: GrenadeId) {
    const stats = GRENADES[grenadeId];
    const speed = MATCH_RULES.grenadeThrowSpeedPxPerSec;
    const countdownSeconds =
      stats.trigger.kind === 'fuse'
        ? stats.trigger.fuseSeconds
        : stats.trigger.kind === 'arm-and-proximity'
          ? stats.trigger.armSeconds
          : 0; // 'on-landing' (Gasnade) has no timer — it triggers on touching the ground

    const grenade: GrenadeProjectile = {
      id: `${ownerId}-g${this.grenadeIdCounter++}`,
      ownerId,
      grenade: grenadeId,
      x: throwerState.position.x,
      y: throwerState.position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fuseRemainingSeconds: countdownSeconds,
      landed: false,
    };
    this.grenades.push(grenade);
    this.broadcast('grenadeThrown', { ownerId, x: grenade.x, y: grenade.y, angle, grenade: grenadeId });
  }

  private tickGrenades() {
    this.applyGasDamage();
    if (this.gasClouds.length > 0) {
      this.gasClouds = this.gasClouds.filter((cloud) => {
        cloud.remainingSeconds -= DT_SECONDS;
        return cloud.remainingSeconds > 0;
      });
    }

    if (this.grenades.length === 0) return;

    const stillFlying: GrenadeProjectile[] = [];
    for (const flying of this.grenades) {
      const stats = GRENADES[flying.grenade];
      const wasLanded = flying.landed;
      const moved = stepGrenade(
        flying,
        this.catacombs.collisionMap,
        gravityForSetting(this.state.settings.gravity),
        DT_SECONDS,
      );

      if (stats.trigger.kind === 'fuse' && moved.fuseRemainingSeconds <= 0) {
        this.explodeGrenade(moved);
        continue;
      }

      if (stats.trigger.kind === 'arm-and-proximity') {
        const armed = moved.fuseRemainingSeconds <= 0;
        if (armed && this.proxyHasNearbyEnemy(moved)) {
          this.explodeGrenade(moved);
          continue;
        }
        stillFlying.push(moved);
        continue;
      }

      // 'on-landing' (Gasnade) — becomes a stationary cloud the instant it comes to rest.
      if (stats.trigger.kind === 'on-landing' && !wasLanded && moved.landed) {
        this.gasClouds.push({
          x: moved.x,
          y: moved.y,
          remainingSeconds: stats.durationSeconds ?? 0,
          ownerId: moved.ownerId,
        });
        this.broadcast('gasLanded', { x: moved.x, y: moved.y });
        continue;
      }
      stillFlying.push(moved);
    }
    this.grenades = stillFlying;
  }

  /** The owner can safely stand next to their own armed Proxynade — it only arms against others. */
  private proxyHasNearbyEnemy(grenade: GrenadeProjectile): boolean {
    const radius = GRENADE_RADIUS_PX.small;
    for (const [sessionId, playerState] of this.players) {
      if (!playerState.alive || sessionId === grenade.ownerId) continue;
      if (Math.hypot(playerState.position.x - grenade.x, playerState.position.y - grenade.y) <= radius) {
        return true;
      }
    }
    return false;
  }

  /** Fragnade/Proxynade detonation — center-to-edge falloff damage, the owner included (self-damage applies, per the flow). */
  private explodeGrenade(grenade: GrenadeProjectile) {
    const stats = GRENADES[grenade.grenade];
    const radius = GRENADE_RADIUS_PX[stats.radius];
    this.broadcast('grenadeExploded', { x: grenade.x, y: grenade.y, grenade: grenade.grenade });

    for (const [sessionId, playerState] of this.players) {
      if (!playerState.alive || playerState.shieldSecondsRemaining > 0) continue;

      const distance = Math.hypot(playerState.position.x - grenade.x, playerState.position.y - grenade.y);
      const amount = grenadeDamageAtDistance(stats.damage, distance, radius);
      if (amount <= 0) continue;
      const crouchAmount = grenadeDamageAtDistance(stats.crouchDamage, distance, radius);
      const hitDirection = isFrontHit(playerState.facing, grenade.x, playerState.position.x);

      const damaged = applyDamage(playerState, { amount, crouchAmount, hitDirection });
      this.players.set(sessionId, damaged);
      const schema = this.state.players.get(sessionId);
      if (schema) syncSchemaFromState(schema, damaged, schema.aimAngle);

      this.broadcast('hit', { shooterId: grenade.ownerId, targetId: sessionId });
      if (!damaged.alive) this.handleExplosionKill(grenade.ownerId, sessionId, damaged);
    }
  }

  private applyGasDamage() {
    if (this.gasClouds.length === 0) return;
    const gasStats = GRENADES.Gasnade;
    const gasRadius = GRENADE_RADIUS_PX[gasStats.radius];

    for (const [sessionId, playerState] of this.players) {
      if (!playerState.alive || playerState.shieldSecondsRemaining > 0) continue;

      // No stacking (Dev4-confirmed): standing in overlapping clouds still only takes one cloud's worth.
      const cloud = this.gasClouds.find(
        (c) => Math.hypot(playerState.position.x - c.x, playerState.position.y - c.y) <= gasRadius,
      );
      if (!cloud) continue;

      const hitDirection = isFrontHit(playerState.facing, cloud.x, playerState.position.x);
      const damaged = applyDamage(playerState, {
        amount: gasStats.damage * DT_SECONDS,
        crouchAmount: gasStats.crouchDamage * DT_SECONDS,
        hitDirection,
      });
      this.players.set(sessionId, damaged);
      const schema = this.state.players.get(sessionId);
      if (schema) syncSchemaFromState(schema, damaged, schema.aimAngle);

      if (!damaged.alive) this.handleExplosionKill(cloud.ownerId, sessionId, damaged);
    }
  }

  /** Shared by grenade explosions and gas ticks: normal kill credit, or no credit for self-damage / an owner who's since left. */
  private handleExplosionKill(ownerId: string, victimId: string, victimState: PlayerState) {
    const ownerState = victimId !== ownerId ? this.players.get(ownerId) : undefined;
    if (ownerState) {
      this.handleKill(ownerId, ownerState, victimId, victimState);
    } else {
      this.handleDeathNoKillCredit(victimId, victimState);
    }
  }

  /**
   * Hitscan fire resolution: lag-compensated against where the shooter last
   * saw everyone else. Returns the shooter's own state ONLY when this shot
   * just killed someone (kill credit updates the shooter's state too) — the
   * caller (mid-iteration in `fixedTick`) must fold that into its `latest`
   * local, since a direct write to `this.players` here would otherwise be
   * overwritten by that iteration's own end-of-loop write.
   */
  private resolveShot(
    shooterSessionId: string,
    shooterState: PlayerState,
    aimAngle: number,
    weaponsFired: readonly WeaponStats[],
  ): PlayerState | undefined {
    const seen = this.rewind.lastSeenBy(shooterSessionId);
    const targets: HitscanTarget[] = [];

    for (const [otherSessionId, otherState] of this.players) {
      if (otherSessionId === shooterSessionId || !otherState.alive) continue;
      const schemaPlayer = this.state.players.get(otherSessionId);
      if (!schemaPlayer) continue;
      const rewound = seen.read(schemaPlayer, ['x', 'y']);
      targets.push({ id: otherSessionId, x: rewound.x, y: rewound.y, facing: otherState.facing });
    }

    const result = resolveHitscanShot(
      this.catacombs.collisionMap,
      shooterState.position.x,
      shooterState.position.y,
      aimAngle,
      hitscanRangeForWeapons(weaponsFired),
      targets,
    );
    if (!result) return undefined;

    const targetState = this.players.get(result.targetId);
    if (!targetState || targetState.shieldSecondsRemaining > 0) return undefined; // spawn shield absorbs it

    const damaged = applyDamage(targetState, damageParamsForShot(weaponsFired, result.hitDirection));
    this.players.set(result.targetId, damaged);
    const targetSchema = this.state.players.get(result.targetId);
    if (targetSchema) syncSchemaFromState(targetSchema, damaged, targetSchema.aimAngle);

    this.broadcast('hit', { shooterId: shooterSessionId, targetId: result.targetId });
    if (!damaged.alive) return this.handleKill(shooterSessionId, shooterState, result.targetId, damaged);
    return undefined;
  }

  private handleKill(
    shooterSessionId: string,
    shooterState: PlayerState,
    victimSessionId: string,
    victimState: PlayerState,
  ): PlayerState {
    const updatedShooter: PlayerState = {
      ...shooterState,
      kills: shooterState.kills + 1,
      points: shooterState.points + pointsOnKill(),
      gotKillThisLife: true,
    };
    this.players.set(shooterSessionId, updatedShooter);
    const shooterSchema = this.state.players.get(shooterSessionId);
    if (shooterSchema) syncSchemaFromState(shooterSchema, updatedShooter, shooterSchema.aimAngle);

    this.handleDeathNoKillCredit(victimSessionId, victimState);
    return updatedShooter;
  }

  /**
   * Death scoring with no kill credited to anyone — a self-kill (SMAW/RG6
   * self-damage, per the flow) or a death whose shooter has since left the
   * room. Shared by `handleKill` for the victim half of a normal kill too.
   */
  private handleDeathNoKillCredit(victimSessionId: string, victimState: PlayerState): PlayerState {
    const updatedVictim: PlayerState = {
      ...victimState,
      deaths: victimState.deaths + 1,
      points: victimState.points + pointsOnDeath(victimState.gotKillThisLife),
    };
    this.players.set(victimSessionId, updatedVictim);
    const victimSchema = this.state.players.get(victimSessionId);
    if (victimSchema) syncSchemaFromState(victimSchema, updatedVictim, victimSchema.aimAngle);

    this.scheduleRespawn(victimSessionId);
    return updatedVictim;
  }

  private spawnProjectile(ownerId: string, shooterState: PlayerState, angle: number, weapon: WeaponStats) {
    const config = PROJECTILE_WEAPONS[weapon.id];
    if (!config) return; // shouldn't happen — fireKindForWeapon only returns 'projectile' for SMAW/RG6

    const projectile: Projectile = {
      id: `${ownerId}-${this.projectileIdCounter++}`,
      ownerId,
      weapon: weapon.id,
      x: shooterState.position.x,
      y: shooterState.position.y,
      angle,
      speedPxPerSec: config.speedPxPerSec,
      travelledPx: 0,
      maxRangePx: WEAPON_RANGE_PX[weapon.range],
    };
    this.projectiles.push(projectile);
    this.broadcast('projectileFired', {
      ownerId,
      x: projectile.x,
      y: projectile.y,
      angle,
      weapon: weapon.id,
    });
  }

  private tickProjectiles() {
    if (this.projectiles.length === 0) return;

    const stillFlying: Projectile[] = [];
    for (const flying of this.projectiles) {
      const moved = stepProjectile(flying, DT_SECONDS);
      const hitWall = projectileHitsWall(this.catacombs.collisionMap, moved);

      // The owner can never be a DIRECT-hit target — the projectile spawns at their own
      // body center, so for some aim angles it wouldn't otherwise clear their hitbox
      // before this very first collision check. Self-damage still happens normally,
      // just only via splash (explodeProjectile includes the owner as a splash target).
      let hitPlayerId: string | null = null;
      if (!hitWall) {
        for (const [sessionId, playerState] of this.players) {
          if (!playerState.alive || sessionId === flying.ownerId) continue;
          if (projectileHitsPlayer(moved, playerState.position.x, playerState.position.y)) {
            hitPlayerId = sessionId;
            break;
          }
        }
      }

      if (hitWall || hitPlayerId || moved.travelledPx >= moved.maxRangePx) {
        this.explodeProjectile(moved, hitPlayerId);
      } else {
        stillFlying.push(moved);
      }
    }
    this.projectiles = stillFlying;
  }

  private explodeProjectile(projectile: Projectile, directHitTargetId: string | null) {
    const weapon = WEAPONS[projectile.weapon];
    const config = PROJECTILE_WEAPONS[projectile.weapon]!;
    this.broadcast('explosion', { x: projectile.x, y: projectile.y, weapon: projectile.weapon });

    const targets: SplashTarget[] = [];
    for (const [sessionId, playerState] of this.players) {
      if (!playerState.alive) continue;
      targets.push({
        id: sessionId,
        x: playerState.position.x,
        y: playerState.position.y,
        crouching: playerState.crouching,
        facing: playerState.facing,
      });
    }

    const hits = resolveSplashDamage(weapon, projectile.x, projectile.y, config.splashRadiusPx, directHitTargetId, targets);

    for (const hit of hits) {
      const targetState = this.players.get(hit.targetId);
      if (!targetState || targetState.shieldSecondsRemaining > 0) continue; // spawn shield absorbs it

      const damaged = applyDamage(targetState, hit.params);
      this.players.set(hit.targetId, damaged);
      const targetSchema = this.state.players.get(hit.targetId);
      if (targetSchema) syncSchemaFromState(targetSchema, damaged, targetSchema.aimAngle);

      this.broadcast('hit', { shooterId: projectile.ownerId, targetId: hit.targetId });
      if (!damaged.alive) this.handleExplosionKill(projectile.ownerId, hit.targetId, damaged);
    }
  }

  private scheduleRespawn(sessionId: string) {
    if (this.respawnTimers.has(sessionId)) return; // already waiting out this death
    const timer = this.clock.setTimeout(() => {
      this.respawnTimers.delete(sessionId);
      this.respawnPlayer(sessionId);
    }, MATCH_RULES.respawnWaitSeconds * 1000);
    this.respawnTimers.set(sessionId, timer);
  }

  private respawnPlayer(sessionId: string) {
    const previous = this.players.get(sessionId);
    const schemaPlayer = this.state.players.get(sessionId);
    if (!previous || !schemaPlayer) return; // left mid-wait

    const spawn =
      this.catacombs.spawnPoints[Math.floor(Math.random() * this.catacombs.spawnPoints.length)]!;
    const respawned = respawnServerPlayer(previous, spawn, spawnLoadoutFor(this.state.settings));
    this.players.set(sessionId, respawned);
    syncSchemaFromState(schemaPlayer, respawned, 0);
  }
}
