import Phaser from 'phaser';
import {
  getStateCallbacks,
  Predict,
  type InputHandle,
  type Reconciler,
  type Room,
} from '@colyseus/sdk';
import { GAME_NAME, HOST_SETTING_RANGES, loadMap, type TiledMapJson } from '@game/shared';
import catacombsMap from '@game/shared/maps/catacombs.json';
import tilesetUrl from '@game/shared/maps/tileset.png';
import { IS_TOUCH_DEVICE } from '../isTouchDevice';
import { InputController } from './input/InputController';
import { PlayerView } from './PlayerView';
import { createPredictStep } from './net/predictStep';
import type { PlayerInputWire, PlayerWireState } from './net/wireTypes';

const INTERP_DELAY_MS = 100;
const ZOOM_LEVELS = [1, 1.6, 2.4];
const PHYSICS_SETTINGS = {
  gravity: HOST_SETTING_RANGES.gravity.default,
  boost: HOST_SETTING_RANGES.boost.default,
};

export interface MatchSceneData {
  /** Already connected — the lobby (Phase 05) establishes this before the match starts. */
  room: Room;
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
  private predict!: Predict;
  private inputHandle!: InputHandle<PlayerInputWire>;
  private myReconciler?: Reconciler<PlayerWireState, PlayerInputWire>;
  private inputController!: InputController;
  private myLastAimAngle = 0;

  private playerViews = new Map<string, PlayerView>();
  private collisionMap!: ReturnType<typeof loadMap>['collisionMap'];

  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugVisible = false;
  private statusText?: Phaser.GameObjects.Text;
  private netStatsText?: Phaser.GameObjects.Text;
  private fuelBarFill?: Phaser.GameObjects.Rectangle;

  private zoomIndex = 0;
  private cameraX = 0;
  private cameraY = 0;

  constructor() {
    super('MatchScene');
  }

  init(data: MatchSceneData) {
    this.room = data.room;
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
    this.cameras.main.setZoom(ZOOM_LEVELS[0]!);
    this.cameras.main.centerOn(this.cameraX, this.cameraY);

    this.setUpZoomControl();
    this.setUpDebugToggle();
    this.setUpHud();

    // `shutdown` is an event, not an auto-invoked lifecycle method.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.setUpNetworking();
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

    this.predict = Predict.get(this.room, { mode: 'lerp', delay: INTERP_DELAY_MS });
    this.predict.attachAll('players', { fields: ['x', 'y'], mode: 'lerp' });
    this.predict.attachAll('players', { fields: ['aimAngle'], mode: 'lerp', angle: true });

    this.inputHandle = this.room.input<PlayerInputWire>({ mode: 'reliable' });

    const myPlayer: PlayerWireState | undefined = this.room.state.players.get(this.room.sessionId);
    if (myPlayer) {
      this.myReconciler = this.predict.reconciler(myPlayer, {
        input: this.inputHandle,
        fields: ['x', 'y', 'vx', 'vy', 'facing', 'crouching', 'onGround', 'fuel'],
        step: createPredictStep(this.collisionMap, PHYSICS_SETTINGS),
      });
    }

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
    const cycleZoom = () => {
      this.zoomIndex = (this.zoomIndex + 1) % ZOOM_LEVELS.length;
      this.cameras.main.setZoom(ZOOM_LEVELS[this.zoomIndex]!);
    };

    if (IS_TOUCH_DEVICE) {
      const button = this.add
        .circle(40, 40, 24, 0xffffff, 0.15)
        .setScrollFactor(0)
        .setDepth(1000)
        .setInteractive();
      this.add
        .text(40, 40, 'zoom', { fontFamily: 'sans-serif', fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001);
      button.on('pointerdown', cycleZoom);
    } else {
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) cycleZoom();
      });
    }
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
      this.inputHandle.data.reload = sample.reload;
      this.inputHandle.data.swapSlot = sample.swapSlot;
      this.inputHandle.data.pickupOrPair = sample.pickupOrPair;
      this.inputHandle.send();
    }

    for (const [sessionId, view] of this.playerViews) {
      const schemaPlayer: PlayerWireState | undefined = this.room.state.players.get(sessionId);
      if (!schemaPlayer) continue;
      const x = this.predict.value(schemaPlayer, 'x');
      const y = this.predict.value(schemaPlayer, 'y');
      const isMe = sessionId === this.room.sessionId;
      const aimAngle = isMe ? this.myLastAimAngle : this.predict.value(schemaPlayer, 'aimAngle');
      view.render(x, y, schemaPlayer.facing, schemaPlayer.crouching, aimAngle);
      if (isMe)
        this.fuelBarFill?.setSize(118 * Phaser.Math.Clamp(schemaPlayer.fuel / 100, 0, 1), 8);
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
  }
}
