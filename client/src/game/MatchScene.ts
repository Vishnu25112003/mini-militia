import Phaser from 'phaser';
import {
  getStateCallbacks,
  Predict,
  type InputHandle,
  type Reconciler,
  type Room,
} from '@colyseus/sdk';
import { GAME_NAME, MOVEMENT, WEAPONS, loadMap, type TiledMapJson, type WeaponId } from '@game/shared';
import catacombsMap from '@game/shared/maps/catacombs.json';
import tilesetUrl from '@game/shared/maps/tileset.png';
import { IS_TOUCH_DEVICE } from '../isTouchDevice';
import { InputController } from './input/InputController';
import { TouchButton } from './input/TouchButton';
import { loadTouchLayout } from './input/touchLayout';
import { registerControl, unregisterControl } from './input/touchControlRegistry';
import { EffectPool } from './EffectPool';
import { drawGroundItemIcon } from './groundItemIcon';
import { PlayerView } from './PlayerView';
import {
  playExplosion,
  playGasHiss,
  playHit,
  playHitscanShot,
  playDeath,
  playMelee,
  playPickup,
  playProjectileShot,
  playReload,
  setJetpackActive,
} from './sound';
import { createPredictStep } from './net/predictStep';
import type {
  GroundItemWire,
  MatchRoomWireState,
  PlayerInputWire,
  PlayerWireState,
} from './net/wireTypes';

const INTERP_DELAY_MS = 100;
const TRACER_LIFETIME_MS = 80;
const HIT_MARKER_LIFETIME_MS = 150;
const DAMAGE_FLASH_LIFETIME_MS = 200;
const EXPLOSION_FLASH_LIFETIME_MS = 250;
const GAS_CLOUD_LIFETIME_MS = 5000;

export interface MatchSceneData {
  /** Already connected — the lobby (Phase 05) establishes this before the match starts. */
  room: Room;
  /** Enter (desktop) or tapping the chat button (touch) — opens the React chat popup. */
  onOpenChatRequested?: () => void;
  /** Hands the parent React component a live reference once the scene has booted, so it can call `setChatOpen`. */
  onSceneReady?: (scene: MatchScene) => void;
}

/**
 * Phase 04 — the same map and physics as the Phase 03 sandbox, now driven by
 * the authoritative server: client prediction + reconciliation for the
 * locally-controlled player (`predict.reconciler`), buffered interpolation
 * for everyone else (`predict.attachAll`), both built on `@colyseus/sdk`'s
 * rollback framework rather than hand-rolled.
 */
export class MatchScene extends Phaser.Scene {
  // Defaults its generic to `any` internally — written bare rather than
  // `Predict<any>` to satisfy the no-explicit-any lint rule without
  // reaching across the client/server package boundary for exact types.
  private room!: Room;
  private onOpenChatRequested?: () => void;
  private onSceneReady?: (scene: MatchScene) => void;
  private zoomButton?: TouchButton;
  private chatButton?: TouchButton;
  private predict!: Predict;
  private inputHandle!: InputHandle<PlayerInputWire>;
  private myReconciler?: Reconciler<PlayerWireState, PlayerInputWire>;
  private inputController!: InputController;
  private myLastAimAngle = 0;
  private wasAlive = true;

  private playerViews = new Map<string, PlayerView>();
  private groundItemViews = new Map<
    string,
    { marker: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }
  >();
  private collisionMap!: ReturnType<typeof loadMap>['collisionMap'];

  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugVisible = false;
  private statusText?: Phaser.GameObjects.Text;
  private netStatsText?: Phaser.GameObjects.Text;
  private fuelBarFill?: Phaser.GameObjects.Rectangle;
  private healthText?: Phaser.GameObjects.Text;
  private gunBoxText?: Phaser.GameObjects.Text;
  private hitMarker?: Phaser.GameObjects.Text;
  private damageFlash?: Phaser.GameObjects.Rectangle;
  private zoomLabelText?: Phaser.GameObjects.Text;
  private grenadeBoxText?: Phaser.GameObjects.Text;
  private pickupPromptText?: Phaser.GameObjects.Text;

  /** Toggled 1x ↔ the currently held gun's own zoom stat (e.g. M93BA 3x) — not a fixed cycle. */
  private zoomedIn = false;
  private cameraX = 0;
  private cameraY = 0;

  // Pooled rather than created/destroyed per shot — a full-auto weapon across
  // 8 players would otherwise allocate and GC a new GameObject every frame.
  private tracerPool = new EffectPool(() =>
    this.add.line(0, 0, 0, 0, 0, 0, 0xffffaa, 0.8).setOrigin(0, 0).setLineWidth(1.5).setDepth(500),
  );
  private muzzleFlashPool = new EffectPool(() =>
    this.add.circle(0, 0, 6, 0xffee88, 0.9).setDepth(501),
  );
  // Dedicated Flame / Phasr visuals — flame is a short orange puff, laser a thick cyan beam.
  private flamePuffPool = new EffectPool(() => this.add.circle(0, 0, 9, 0xff7722, 0.7).setDepth(501));
  private laserBeamPool = new EffectPool(() =>
    this.add.line(0, 0, 0, 0, 0, 0, 0x55ffff, 0.9).setOrigin(0, 0).setLineWidth(4).setDepth(500),
  );
  private explosionFlashPool = new EffectPool(() =>
    this.add.circle(0, 0, 48, 0xffaa33, 0.5).setDepth(502),
  );
  private gasCloudPool = new EffectPool(() => this.add.circle(0, 0, 96, 0x88cc44, 0.3).setDepth(400));

  constructor() {
    super('MatchScene');
  }

  init(data: MatchSceneData) {
    this.room = data.room;
    this.onOpenChatRequested = data.onOpenChatRequested;
    this.onSceneReady = data.onSceneReady;
  }

  preload() {
    this.load.image('tileset', tilesetUrl);
    this.load.tilemapTiledJSON('catacombs', catacombsMap);
  }

  create() {
    const tilemap = this.make.tilemap({ key: 'catacombs' });
    const tileset = tilemap.addTilesetImage('catacombs-placeholder', 'tileset');
    if (tileset) tilemap.createLayer('background', tileset, 0, 0);

    const loaded = loadMap(catacombsMap as TiledMapJson);
    this.collisionMap = loaded.collisionMap;

    this.debugGraphics = this.add.graphics().setVisible(false).setDepth(900);
    this.debugGraphics.fillStyle(0x00ff66, 1);
    for (const p of loaded.spawnPoints) this.debugGraphics.fillCircle(p.x, p.y, 6);
    this.debugGraphics.fillStyle(0xffcc00, 1);
    for (const p of loaded.pickupSpots) this.debugGraphics.fillCircle(p.x, p.y, 6);

    this.cameraX = tilemap.widthInPixels / 2;
    this.cameraY = tilemap.heightInPixels / 2;
    this.cameras.main.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(this.cameraX, this.cameraY);

    this.setUpZoomControl();
    this.setUpDebugToggle();
    this.setUpHud();

    // `shutdown` is an event, not an auto-invoked lifecycle method.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.setUpNetworking();
    this.onSceneReady?.(this);
  }

  /**
   * Disables Phaser's own keyboard handling while the chat popup is focused —
   * otherwise typing would also trigger game actions bound to the same keys
   * (e.g. typing "v" would swing melee). Suppressing at the `InputController`
   * level (rather than disabling Phaser's keyboard plugin outright) avoids a
   * stuck-key bug: if a movement key is held when chat opens, Phaser would
   * stop polling it entirely and `isDown` would freeze at `true`. The match
   * itself keeps running; only this player's own input stops being sent.
   */
  setChatOpen(open: boolean) {
    this.inputController.setSuppressed(open);
  }

  private setUpNetworking() {
    const $ = getStateCallbacks(this.room);
    $(this.room.state).players.onAdd((player: PlayerWireState, sessionId: string) => {
      this.playerViews.set(sessionId, new PlayerView(this, player.color, player.name));
    });
    $(this.room.state).players.onRemove((_player: PlayerWireState, sessionId: string) => {
      this.playerViews.get(sessionId)?.destroy();
      this.playerViews.delete(sessionId);
    });

    $(this.room.state).groundItems.onAdd((item: GroundItemWire, id: string) => {
      const marker = this.add.graphics().setPosition(item.x, item.y).setDepth(300);
      drawGroundItemIcon(marker, item);
      const labelText = item.kind === 'gun' ? item.weapon : item.kind === 'grenadePair' ? item.grenadeType : item.kind;
      const label = this.add
        .text(item.x, item.y - 18, labelText ?? '', {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: '#e5e7eb',
        })
        .setOrigin(0.5)
        .setDepth(300);
      this.groundItemViews.set(id, { marker, label });
    });
    $(this.room.state).groundItems.onRemove((_item: GroundItemWire, id: string) => {
      const view = this.groundItemViews.get(id);
      view?.marker.destroy();
      view?.label.destroy();
      this.groundItemViews.delete(id);
      // Also fires on the 14-spot refresh cycle's despawns, not just real
      // pickups — a reasonable approximation given there's no dedicated
      // "picked up" broadcast to key off instead.
      playPickup();
    });

    this.predict = Predict.get(this.room, { mode: 'lerp', delay: INTERP_DELAY_MS });
    this.predict.attachAll('players', { fields: ['x', 'y'], mode: 'lerp' });
    this.predict.attachAll('players', { fields: ['aimAngle'], mode: 'lerp', angle: true });

    this.inputHandle = this.room.input<PlayerInputWire>({ mode: 'reliable' });

    const myPlayer: PlayerWireState | undefined = this.room.state.players.get(this.room.sessionId);
    if (myPlayer) {
      const roomState = this.room.state as unknown as MatchRoomWireState;
      this.myReconciler = this.predict.reconciler(myPlayer, {
        input: this.inputHandle,
        // The server only calls setFixedTimestep when the match starts, after clients joined,
        // so the input handle never learns the tick rate — pass it explicitly.
        stepMs: 1000 / MOVEMENT.tickRate,
        fields: ['x', 'y', 'vx', 'vy', 'facing', 'crouching', 'onGround', 'fuel'],
        step: createPredictStep(this.collisionMap, {
          gravity: roomState.settings.gravity,
          boost: roomState.settings.boost,
        }),
      });
    }

    this.room.onMessage('shotFired', (msg: { shooterId: string; x: number; y: number; angle: number; weapon?: string }) => {
      if (msg.weapon === 'Flame') this.showFlamePuff(msg.x, msg.y, msg.angle);
      else if (msg.weapon === 'Phasr') this.showLaserBeam(msg.x, msg.y, msg.angle);
      else this.showTracer(msg.x, msg.y, msg.angle);
      if (msg.shooterId === this.room.sessionId) this.showMuzzleFlash(msg.x, msg.y, msg.angle);
      playHitscanShot();
    });
    this.room.onMessage('hit', (msg: { shooterId: string; targetId: string }) => {
      if (msg.shooterId === this.room.sessionId) {
        this.showHitMarker();
        playHit();
      }
      if (msg.targetId === this.room.sessionId) this.showDamageFlash();
    });
    this.room.onMessage('projectileFired', (msg: { ownerId: string; x: number; y: number; angle: number }) => {
      if (msg.ownerId === this.room.sessionId) this.showMuzzleFlash(msg.x, msg.y, msg.angle);
      playProjectileShot();
    });
    this.room.onMessage('explosion', (msg: { x: number; y: number }) => {
      this.showExplosion(msg.x, msg.y);
      playExplosion();
    });
    this.room.onMessage('grenadeExploded', (msg: { x: number; y: number }) => {
      this.showExplosion(msg.x, msg.y);
      playExplosion();
    });
    this.room.onMessage('gasLanded', (msg: { x: number; y: number }) => {
      this.showGasCloud(msg.x, msg.y);
      playGasHiss();
    });
    this.room.onMessage('melee', (msg: { attackerId: string; targetId: string }) => {
      if (msg.attackerId === this.room.sessionId) this.showHitMarker();
      if (msg.targetId === this.room.sessionId) this.showDamageFlash();
      this.playerViews.get(msg.attackerId)?.playMeleeSwing();
      playMelee();
    });

    this.inputController = new InputController(this, IS_TOUCH_DEVICE, () => {
      const me: PlayerWireState | undefined = this.room.state.players.get(this.room.sessionId);
      if (!me) return { x: 0, y: 0 };
      return { x: this.predict.value(me, 'x'), y: this.predict.value(me, 'y') };
    });

    const myName = this.room.state.players.get(this.room.sessionId)?.name ?? '?';
    this.statusText?.setText(
      `${GAME_NAME}: playing as ${myName} (${this.room.sessionId.slice(0, 6)})`,
    );
  }

  private setUpZoomControl() {
    const toggleZoom = () => {
      this.zoomedIn = !this.zoomedIn;
      this.applyZoomForActiveWeapon();
    };

    if (IS_TOUCH_DEVICE) {
      const { width, height } = this.scale;
      const layout = loadTouchLayout(width, height);

      this.zoomButton = new TouchButton(this, layout.zoomButton.x, layout.zoomButton.y, 'zoom', 24, 'zoom');
      this.zoomButton.setLayout(layout.zoomButton);
      registerControl('zoomButton', this.zoomButton, width, height);

      this.chatButton = new TouchButton(this, layout.chatButton.x, layout.chatButton.y, 'chat', 24, 'chat');
      this.chatButton.setLayout(layout.chatButton);
      registerControl('chatButton', this.chatButton, width, height);
    } else {
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) toggleZoom();
      });
    }

    // Edit mode (Phase 13) disables presses while a control is being dragged/resized, so this
    // runs every frame rather than wiring a one-shot 'pointerdown' listener on the zoom button.
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (this.zoomButton?.consumePress()) toggleZoom();
      if (this.chatButton?.consumePress()) this.onOpenChatRequested?.();
    });
  }

  /** Re-applied every frame too, so swapping guns while zoomed in updates the zoom level. */
  private applyZoomForActiveWeapon() {
    const me: PlayerWireState | undefined = this.room?.state.players.get(this.room.sessionId);
    const slot = me ? (me.activeSlotIndex === 0 ? me.slot1 : me.slot2) : undefined;
    const weapon = slot ? WEAPONS[slot.weapon1 as WeaponId] : undefined;
    const zoom = this.zoomedIn && weapon ? weapon.zoom : 1;

    this.cameras.main.setZoom(zoom);
    this.zoomLabelText?.setText(`${zoom.toFixed(1)}X`);
  }

  private setUpDebugToggle() {
    this.input.keyboard?.on('keydown-M', () => {
      this.debugVisible = !this.debugVisible;
      this.debugGraphics?.setVisible(this.debugVisible);
    });
  }

  private setUpHud() {
    this.add
      .text(
        8,
        8,
        IS_TOUCH_DEVICE
          ? 'Joysticks move/aim · M: debug markers'
          : 'WASD/Space move/fly · Mouse aim · M: debug markers',
        { fontFamily: 'sans-serif', fontSize: '12px', color: '#9aa0ac' },
      )
      .setScrollFactor(0)
      .setDepth(1000);

    this.statusText = this.add
      .text(8, 24, 'connecting…', { fontFamily: 'sans-serif', fontSize: '12px', color: '#9aa0ac' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.netStatsText = this.add
      .text(8, 40, '', { fontFamily: 'sans-serif', fontSize: '11px', color: '#6b7280' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.add
      .rectangle(8, 72, 120, 10, 0x000000, 0.4)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.fuelBarFill = this.add
      .rectangle(9, 73, 118, 8, 0x3cb44b, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.healthText = this.add
      .text(8, 90, 'HP 100', { fontFamily: 'sans-serif', fontSize: '16px', color: '#3cb44b' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.gunBoxText = this.add
      .text(this.scale.width - 8, 8, '', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#e5e7eb',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive()
      .on('pointerdown', () => this.inputController?.requestSwap());

    this.hitMarker = this.add
      .text(0, 0, '✕', { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    this.damageFlash = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xff0000, 0.25)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999)
      .setVisible(false);

    this.zoomLabelText = this.add
      .text(IS_TOUCH_DEVICE ? 70 : 8, IS_TOUCH_DEVICE ? 40 : 56, '1.0X', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#e5e7eb',
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.grenadeBoxText = this.add
      .text(this.scale.width - 8, 28, '', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#e5e7eb',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive()
      .on('pointerdown', () => this.inputController?.requestSwitchGrenade());

    this.pickupPromptText = this.add
      .text(this.scale.width / 2, this.scale.height - (IS_TOUCH_DEVICE ? 260 : 60), '', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#ffcc00',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);
  }

  private updatePickupPrompt(me: PlayerWireState) {
    if (!this.pickupPromptText) return;
    const label: Record<string, string> = {
      pair: 'Pair',
      replace: 'Pick up',
      chooseReplace: 'Pick up (hold Shift to swap the 2nd gun)',
    };
    const text = label[me.nearbyGunAction];
    if (!text) {
      this.pickupPromptText.setVisible(false);
      return;
    }
    this.pickupPromptText.setText(IS_TOUCH_DEVICE ? text : `${text} — [E]`).setVisible(true);
  }

  private showExplosion(x: number, y: number) {
    const flash = this.explosionFlashPool.acquire();
    this.tweens.killTweensOf(flash);
    flash.setPosition(x, y).setScale(1).setAlpha(0.5).setVisible(true);
    this.tweens.add({
      targets: flash,
      scale: 1.6,
      alpha: 0,
      duration: EXPLOSION_FLASH_LIFETIME_MS,
      onComplete: () => this.explosionFlashPool.release(flash),
    });
  }

  /** Placeholder gas cloud — matches the Gasnade's 5-second duration (`MATCH_RULES` / `GRENADES.Gasnade`). */
  private showGasCloud(x: number, y: number) {
    const cloud = this.gasCloudPool.acquire();
    this.tweens.killTweensOf(cloud);
    cloud.setPosition(x, y).setScale(1).setAlpha(0.3).setVisible(true);
    this.tweens.add({
      targets: cloud,
      alpha: 0,
      duration: GAS_CLOUD_LIFETIME_MS,
      onComplete: () => this.gasCloudPool.release(cloud),
    });
  }

  private showTracer(x: number, y: number, angle: number) {
    const length = 300;
    const line = this.tracerPool.acquire();
    line.setTo(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length).setVisible(true);
    this.time.delayedCall(TRACER_LIFETIME_MS, () => this.tracerPool.release(line));
  }

  private showFlamePuff(x: number, y: number, angle: number) {
    const puff = this.flamePuffPool.acquire();
    const distance = 24 + Math.random() * 40;
    puff.setPosition(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance).setVisible(true);
    this.time.delayedCall(TRACER_LIFETIME_MS * 2, () => this.flamePuffPool.release(puff));
  }

  private showLaserBeam(x: number, y: number, angle: number) {
    const length = 500;
    const beam = this.laserBeamPool.acquire();
    beam.setTo(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length).setVisible(true);
    this.time.delayedCall(TRACER_LIFETIME_MS * 2, () => this.laserBeamPool.release(beam));
  }

  private showMuzzleFlash(x: number, y: number, angle: number) {
    const flash = this.muzzleFlashPool.acquire();
    flash.setPosition(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18).setVisible(true);
    this.time.delayedCall(TRACER_LIFETIME_MS, () => this.muzzleFlashPool.release(flash));
  }

  private showHitMarker() {
    if (!this.hitMarker) return;
    this.hitMarker.setPosition(this.scale.width / 2, this.scale.height / 2).setVisible(true);
    this.time.delayedCall(HIT_MARKER_LIFETIME_MS, () => this.hitMarker?.setVisible(false));
  }

  private showDamageFlash() {
    if (!this.damageFlash) return;
    this.damageFlash.setVisible(true);
    this.time.delayedCall(DAMAGE_FLASH_LIFETIME_MS, () => this.damageFlash?.setVisible(false));
  }

  private updateCombatHud(me: PlayerWireState) {
    if (this.healthText) {
      this.healthText.setText(`HP ${Math.round(me.health)}`);
      this.healthText.setColor(me.health > 50 ? '#3cb44b' : me.health > 25 ? '#f58231' : '#e6194b');
    }

    if (this.gunBoxText) {
      const slot = me.activeSlotIndex === 0 ? me.slot1 : me.slot2;
      const label =
        slot.kind === 'dual'
          ? `${slot.weapon1} ${slot.ammoInMagazine1}/${slot.ammoReserve1}  +  ${slot.weapon2} ${slot.ammoInMagazine2}/${slot.ammoReserve2}`
          : `${slot.weapon1}  ${slot.ammoInMagazine1}/${slot.ammoReserve1}`;
      const reloading = slot.reloadRemainingSeconds > 0;
      this.gunBoxText.setText(reloading ? `${label} (reloading…)` : label);
    }

    if (this.grenadeBoxText) {
      const counts: Record<PlayerWireState['selectedGrenade'], number> = {
        Fragnade: me.fragnades,
        Gasnade: me.gasnades,
        Proxynade: me.proxynades,
      };
      this.grenadeBoxText.setText(`${me.selectedGrenade}: ${counts[me.selectedGrenade]}`);
    }
  }

  private updateDebugHud() {
    if (!this.netStatsText || !this.room) return;
    const ping = Math.round(this.room.clock.smoothedRtt());
    const tickRate = this.inputHandle?.tickRate ?? '?';
    const patchRate = this.inputHandle?.patchRate ?? '?';

    let correctionText = '';
    if (this.myReconciler) {
      const me: PlayerWireState | undefined = this.room.state.players.get(this.room.sessionId);
      if (me) {
        const dx = this.myReconciler.state.x - me.x;
        const dy = this.myReconciler.state.y - me.y;
        correctionText = ` | drift ${Math.hypot(dx, dy).toFixed(1)}px`;
      }
    }

    this.netStatsText.setText(
      `ping ${ping}ms | tick ${tickRate}Hz | snapshots ${patchRate ? Math.round(1000 / Number(patchRate)) : '?'}/s${correctionText}`,
    );
  }

  update(time: number) {
    if (!this.room || !this.predict || !this.inputController) return;

    const steps = this.predict.tick(time);
    for (let i = 0; i < steps; i++) {
      const sample = this.inputController.sample();
      this.myLastAimAngle = sample.aimAngle;
      this.inputHandle.data.moveX = sample.moveX;
      this.inputHandle.data.fly = sample.fly;
      this.inputHandle.data.crouch = sample.crouch;
      this.inputHandle.data.aimAngle = sample.aimAngle;
      this.inputHandle.data.fire = sample.fire;
      this.inputHandle.data.melee = sample.melee;
      this.inputHandle.data.throwGrenade = sample.throwGrenade;
      this.inputHandle.data.switchGrenade = sample.switchGrenade;
      this.inputHandle.data.reload = sample.reload;
      if (sample.reload) playReload();
      this.inputHandle.data.swapSlot = sample.swapSlot;
      this.inputHandle.data.pickupOrPair = sample.pickupOrPair;
      this.inputHandle.data.replaceSlotChoice = sample.replaceSlotChoice;
      this.inputHandle.send();
    }

    if (this.inputController.consumeChatToggle()) this.onOpenChatRequested?.();

    for (const [sessionId, view] of this.playerViews) {
      const schemaPlayer: PlayerWireState | undefined = this.room.state.players.get(sessionId);
      if (!schemaPlayer) continue;
      const x = this.predict.value(schemaPlayer, 'x');
      const y = this.predict.value(schemaPlayer, 'y');
      const isMe = sessionId === this.room.sessionId;
      const aimAngle = isMe ? this.myLastAimAngle : this.predict.value(schemaPlayer, 'aimAngle');
      const activeSlot = schemaPlayer.activeSlotIndex === 0 ? schemaPlayer.slot1 : schemaPlayer.slot2;
      const weaponId = (activeSlot.weapon1 || null) as WeaponId | null;
      view.render(
        x,
        y,
        schemaPlayer.facing,
        schemaPlayer.crouching,
        aimAngle,
        schemaPlayer.alive && schemaPlayer.connected,
        schemaPlayer.health,
        schemaPlayer.shieldSecondsRemaining,
        schemaPlayer.onGround,
        schemaPlayer.vx,
        weaponId,
      );
      if (isMe) {
        if (this.wasAlive && !schemaPlayer.alive) playDeath();
        this.wasAlive = schemaPlayer.alive;
        setJetpackActive(schemaPlayer.alive && !schemaPlayer.onGround);

        this.fuelBarFill?.setSize(118 * Phaser.Math.Clamp(schemaPlayer.fuel / 100, 0, 1), 8);
        this.updateCombatHud(schemaPlayer);
        this.updatePickupPrompt(schemaPlayer);
        this.applyZoomForActiveWeapon();
      }
    }

    const me: PlayerWireState | undefined = this.room.state.players.get(this.room.sessionId);
    if (me) {
      const targetX = this.predict.value(me, 'x');
      const targetY = this.predict.value(me, 'y');
      this.cameraX = Phaser.Math.Linear(this.cameraX, targetX, 0.15);
      this.cameraY = Phaser.Math.Linear(this.cameraY, targetY, 0.15);
      this.cameras.main.centerOn(this.cameraX, this.cameraY);
    }

    this.updateDebugHud();
  }

  private handleShutdown() {
    this.room?.leave();
    this.inputController?.destroy();
    for (const view of this.playerViews.values()) view.destroy();
    this.playerViews.clear();
    for (const view of this.groundItemViews.values()) {
      view.marker.destroy();
      view.label.destroy();
    }
    this.groundItemViews.clear();

    this.zoomButton?.destroy();
    this.chatButton?.destroy();
    unregisterControl('zoomButton');
    unregisterControl('chatButton');

    setJetpackActive(false); // leaving mid-flight shouldn't leave the hum looping forever
  }
}
