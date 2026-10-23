import Phaser from 'phaser';
import { CATACOMBS } from '@game/shared';
import { devicePixelScale } from '../../lib/dpr';
import mapUrl from '../../../../shared/maps/catacombs.json?url';
import tilesetUrl from '../../../../shared/maps/tileset.png?url';

const SPAWN_COLOR = 0x22d3ee; // cyan
const PICKUP_COLOR = 0xfacc15; // yellow

/**
 * Phase 02: draws the Catacombs map exactly as the server sees it (same JSON file) with a debug overlay
 * showing the 16 spawn points and 14 pickup spots. Pan: WASD / arrows / drag. Zoom: wheel or + / -.
 * Toggle the overlay: G (or tap the DEBUG button).
 */
export class MapScene extends Phaser.Scene {
  private overlay!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('map');
  }

  preload() {
    this.load.tilemapTiledJSON('catacombs', mapUrl);
    this.load.image('tileset', tilesetUrl);
  }

  create() {
    const map = this.make.tilemap({ key: 'catacombs' });
    const tiles = map.addTilesetImage('placeholder', 'tileset');
    if (!tiles) throw new Error('tileset "placeholder" not found in the map');
    const background = map.createLayer('background', tiles);
    const collision = map.createLayer('collision', tiles);

    this.buildOverlay();

    // camera: fit the whole map first
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b0810');
    this.fitMap();
    this.scale.on('resize', () => this.fitMap());

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,G,PLUS,MINUS,NUMPAD_ADD,NUMPAD_SUBTRACT',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.G.on('down', () => this.toggleOverlay());

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.1, 3));
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });

    // HUD (not affected by the camera)
    this.hud = this.add
      .text(12, 10, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${15 * devicePixelScale()}px`,
        color: '#e7e5e4',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000);
    const btn = this.add
      .text(12, 70, 'DEBUG (G)', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${15 * devicePixelScale()}px`,
        color: '#fbbf24',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.toggleOverlay());
    this.refreshHud();

    // The main camera zooms (even for scrollFactor-0 objects), so the HUD gets its own camera that never does:
    // the main camera ignores the HUD, the UI camera ignores the world.
    const ui = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    cam.ignore([this.hud, btn]);
    ui.ignore([...(background ? [background] : []), ...(collision ? [collision] : []), this.overlay]);
    this.scale.on('resize', () => ui.setSize(this.scale.width, this.scale.height));
  }

  update(_time: number, delta: number) {
    const cam = this.cameras.main;
    const k = this.keys;
    const speed = (700 * delta) / 1000 / cam.zoom;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= speed;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += speed;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= speed;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += speed;
    if (k.PLUS.isDown || k.NUMPAD_ADD.isDown) cam.setZoom(Math.min(3, cam.zoom * 1.02));
    if (k.MINUS.isDown || k.NUMPAD_SUBTRACT.isDown) cam.setZoom(Math.max(0.1, cam.zoom / 1.02));
  }

  private fitMap() {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / CATACOMBS.widthPx, this.scale.height / CATACOMBS.heightPx);
    cam.setZoom(zoom);
    cam.centerOn(CATACOMBS.widthPx / 2, CATACOMBS.heightPx / 2);
  }

  private buildOverlay() {
    const g = this.add.graphics();
    const items: Phaser.GameObjects.GameObject[] = [g];
    const label = (x: number, y: number, text: string, color: string) =>
      this.add
        .text(x, y - 22, text, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);

    CATACOMBS.spawnPoints.forEach((p, i) => {
      g.fillStyle(SPAWN_COLOR, 0.9)
        .fillCircle(p.x, p.y - 6, 9)
        .lineStyle(2, 0x000000, 1)
        .strokeCircle(p.x, p.y - 6, 9);
      items.push(label(p.x, p.y - 6, `S${i + 1}`, '#67e8f9'));
    });
    CATACOMBS.pickupSpots.forEach((p, i) => {
      g.fillStyle(PICKUP_COLOR, 0.95)
        .fillRect(p.x - 8, p.y - 8, 16, 16)
        .lineStyle(2, 0x000000, 1)
        .strokeRect(p.x - 8, p.y - 8, 16, 16);
      items.push(label(p.x, p.y, `P${i + 1}`, '#fde047'));
    });
    this.overlay = this.add.container(0, 0, items).setDepth(500);
  }

  private toggleOverlay() {
    this.overlay.setVisible(!this.overlay.visible);
    this.refreshHud();
  }

  private refreshHud() {
    this.hud.setText(
      `Catacombs  ${CATACOMBS.widthTiles}x${CATACOMBS.heightTiles} tiles\n` +
        `debug overlay: ${this.overlay.visible ? 'ON' : 'off'}   ` +
        `cyan = ${CATACOMBS.spawnPoints.length} spawn points   yellow = ${CATACOMBS.pickupSpots.length} pickup spots`,
    );
  }
}
