import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { GAME_NAME } from '@game/shared';
import catacombsMap from '@game/shared/maps/catacombs.json';
import tilesetUrl from '@game/shared/maps/tileset.png';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';

interface MapMarker {
  x: number;
  y: number;
}

/**
 * Renders the Catacombs-style map (Phase 02) and keeps the Phase 00
 * networking handshake alive as a small corner status line, so a deployed
 * build still shows "welcome" for the pending Phase 00 VPS verification.
 */
export class MapScene extends Phaser.Scene {
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugVisible = false;
  private statusText?: Phaser.GameObjects.Text;
  private room?: Room;
  private spawnPoints: MapMarker[] = [];
  private pickupSpots: MapMarker[] = [];

  constructor() {
    super('MapScene');
  }

  preload() {
    this.load.image('tileset', tilesetUrl);
    this.load.tilemapTiledJSON('catacombs', catacombsMap);
  }

  create() {
    const map = this.make.tilemap({ key: 'catacombs' });
    const tileset = map.addTilesetImage('catacombs-placeholder', 'tileset');
    if (tileset) {
      map.createLayer('background', tileset, 0, 0);
    }

    this.spawnPoints = (map.getObjectLayer('spawnPoints')?.objects ?? []).map((o) => ({
      x: o.x ?? 0,
      y: o.y ?? 0,
    }));
    this.pickupSpots = (map.getObjectLayer('pickupSpots')?.objects ?? []).map((o) => ({
      x: o.x ?? 0,
      y: o.y ?? 0,
    }));

    this.debugGraphics = this.add.graphics().setVisible(false);
    this.drawDebugOverlay();

    const fitZoom = Math.min(
      this.scale.width / map.widthInPixels,
      this.scale.height / map.heightInPixels,
    );
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(fitZoom);
    this.cameras.main.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);

    this.input.keyboard?.on('keydown-M', () => {
      this.debugVisible = !this.debugVisible;
      this.debugGraphics?.setVisible(this.debugVisible);
    });

    this.add
      .text(8, 8, 'M: toggle spawn/pickup debug markers', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#9aa0ac',
      })
      .setScrollFactor(0);

    this.statusText = this.add
      .text(8, 24, 'connecting…', { fontFamily: 'sans-serif', fontSize: '12px', color: '#9aa0ac' })
      .setScrollFactor(0);

    void this.connectToServer();
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

  shutdown() {
    this.room?.leave();
  }
}
