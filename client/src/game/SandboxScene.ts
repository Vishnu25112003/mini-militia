import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import {
  GAME_NAME,
  loadMap,
  step,
  type PlayerInput,
  type PlayerState,
  type TiledMapJson,
} from '@game/shared';
import catacombsMap from '@game/shared/maps/catacombs.json';
import tilesetUrl from '@game/shared/maps/tileset.png';
import { IS_TOUCH_DEVICE } from '../isTouchDevice';
import { InputController } from './input/InputController';
import { PlayerView } from './PlayerView';
import { createSandboxPlayer } from './createSandboxPlayer';
import { sandboxSettings } from './sandboxSettings';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';
const STEP_MS = 1000 / 30;
const ZOOM_LEVELS = [1, 1.6, 2.4];
/** Caps the catch-up after a backgrounded tab resumes, so it doesn't run hundreds of physics steps in one frame. */
const MAX_FRAME_DELTA_MS = 250;

/**
 * Phase 03 — one player, no network, on the real map: the shared physics
 * `step` runs at a fixed 1/30s tick, driven by touch joysticks or
 * keyboard/mouse, with the view interpolated smoothly in between ticks.
 */
export class SandboxScene extends Phaser.Scene {
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugVisible = false;
  private statusText?: Phaser.GameObjects.Text;
  private fuelBarFill?: Phaser.GameObjects.Rectangle;
  private room?: Room;

  private collisionMap!: ReturnType<typeof loadMap>['collisionMap'];
  private spawnPoints: ReturnType<typeof loadMap>['spawnPoints'] = [];
  private pickupSpots: ReturnType<typeof loadMap>['pickupSpots'] = [];

  private playerState!: PlayerState;
  private previousPlayerState!: PlayerState;
  private playerView!: PlayerView;
  private inputController!: InputController;
  private latestInput!: PlayerInput;
  private accumulatorMs = 0;

  private zoomIndex = 0;
  private cameraX = 0;
  private cameraY = 0;

  constructor() {
    super('SandboxScene');
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
    this.spawnPoints = loaded.spawnPoints;
    this.pickupSpots = loaded.pickupSpots;

    const spawn = this.spawnPoints[0] ?? {
      x: tilemap.widthInPixels / 2,
      y: tilemap.heightInPixels / 2,
    };
    this.playerState = createSandboxPlayer(spawn);
    this.previousPlayerState = this.playerState;
    this.playerView = new PlayerView(this, this.playerState.color, this.playerState.name);

    this.inputController = new InputController(
      this,
      IS_TOUCH_DEVICE,
      () => this.playerState.position,
    );

    this.debugGraphics = this.add.graphics().setVisible(false).setDepth(900);
    this.drawDebugOverlay();

    this.cameraX = spawn.x;
    this.cameraY = spawn.y;
    this.cameras.main.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
    this.cameras.main.setZoom(ZOOM_LEVELS[0]!);
    this.cameras.main.centerOn(this.cameraX, this.cameraY);

    this.setUpZoomControl();
    this.setUpDebugToggle();
    this.setUpHud();

    // `shutdown` is an event, not an auto-invoked lifecycle method — Phaser
    // never calls a plain `shutdown()` method on its own.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    void this.connectToServer();
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
        {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#9aa0ac',
        },
      )
      .setScrollFactor(0)
      .setDepth(1000);

    this.statusText = this.add
      .text(8, 24, 'connecting…', { fontFamily: 'sans-serif', fontSize: '12px', color: '#9aa0ac' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.add
      .rectangle(8, 44, 120, 10, 0x000000, 0.4)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.fuelBarFill = this.add
      .rectangle(9, 45, 118, 8, 0x3cb44b, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private drawDebugOverlay() {
    const g = this.debugGraphics;
    if (!g) return;
    g.clear();
    g.fillStyle(0x00ff66, 1);
    for (const p of this.spawnPoints) g.fillCircle(p.x, p.y, 6);
    g.fillStyle(0xffcc00, 1);
    for (const p of this.pickupSpots) g.fillCircle(p.x, p.y, 6);
  }

  update(_time: number, deltaMs: number) {
    this.latestInput = this.inputController.sample();

    this.accumulatorMs += Math.min(deltaMs, MAX_FRAME_DELTA_MS);
    while (this.accumulatorMs >= STEP_MS) {
      this.previousPlayerState = this.playerState;
      this.playerState = step(
        this.playerState,
        this.latestInput,
        this.collisionMap,
        sandboxSettings,
      );
      this.accumulatorMs -= STEP_MS;
    }

    const alpha = this.accumulatorMs / STEP_MS;
    this.playerView.render(
      this.previousPlayerState,
      this.playerState,
      alpha,
      this.latestInput.aimAngle,
    );

    const followX = Phaser.Math.Linear(
      this.previousPlayerState.position.x,
      this.playerState.position.x,
      alpha,
    );
    const followY = Phaser.Math.Linear(
      this.previousPlayerState.position.y,
      this.playerState.position.y,
      alpha,
    );
    const cameraSmoothing = 0.12;
    this.cameraX = Phaser.Math.Linear(this.cameraX, followX, cameraSmoothing);
    this.cameraY = Phaser.Math.Linear(this.cameraY, followY, cameraSmoothing);
    this.cameras.main.centerOn(this.cameraX, this.cameraY);

    const fuelRatio = Phaser.Math.Clamp(this.playerState.fuel / 100, 0, 1);
    this.fuelBarFill?.setSize(118 * fuelRatio, 8);
  }

  private async connectToServer() {
    try {
      const client = new Client(SERVER_URL);
      this.room = await client.joinOrCreate('hello_room');
      this.room.onMessage('welcome', (payload: { message: string }) => {
        this.statusText?.setText(`${GAME_NAME}: ${payload.message}`);
      });
    } catch (err) {
      this.statusText?.setText(`connection failed: ${(err as Error).message}`);
    }
  }

  private handleShutdown() {
    this.room?.leave();
    this.inputController.destroy();
    this.playerView.destroy();
  }
}
