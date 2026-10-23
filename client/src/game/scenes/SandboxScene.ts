import Phaser from 'phaser';
import {
  CATACOMBS,
  MOVEMENT,
  PLAYER_COLORS,
  TICK_DT,
  createPlayer,
  step,
  type PlayerInput,
  type PlayerState,
} from '@game/shared';
import mapUrl from '../../../../shared/maps/catacombs.json?url';
import tilesetUrl from '../../../../shared/maps/tileset.png?url';
import { InputController } from '../input/InputController';
import { debugState, flags, telemetry, touchState } from '../sandbox/sandboxState';

/** Test zoom levels (the real per-gun zoom arrives in Phase 08). */
const ZOOMS = [1, 1.5, 2.2];
/** World pixels visible from top to bottom at zoom 1 (about 20 tiles). */
const VISIBLE_HEIGHT = 640;
const MAX_STEPS_PER_FRAME = 5;

/**
 * Phase 03: one player, no network, on the real map. The shared physics `step` runs at a fixed 1/30 s;
 * drawing is smoothed by interpolating between the last two physics states. The same code will run on the
 * server in Phase 04.
 */
export class SandboxScene extends Phaser.Scene {
  private cur!: PlayerState;
  private prev!: PlayerState;
  private acc = 0;
  private seconds = 0;
  private input2!: InputController;
  private gfx!: Phaser.GameObjects.Graphics;
  private nameTag!: Phaser.GameObjects.Text;
  private follow!: Phaser.GameObjects.Zone;
  private zoomIndex = 0;
  private lastInput: PlayerInput | null = null;

  constructor() {
    super('sandbox');
  }

  preload() {
    this.load.tilemapTiledJSON('catacombs', mapUrl);
    this.load.image('tileset', tilesetUrl);
  }

  create() {
    const map = this.make.tilemap({ key: 'catacombs' });
    const tiles = map.addTilesetImage('placeholder', 'tileset');
    if (!tiles) throw new Error('tileset "placeholder" not found in the map');
    map.createLayer('background', tiles);
    map.createLayer('collision', tiles);

    // spawn at a random (or ?spawn=n) spawn point; randomness is fine here, it is outside the physics step
    const sp = flags.spawn ?? Math.floor(Math.random() * CATACOMBS.spawnPoints.length);
    const spawn = CATACOMBS.spawnPoints[sp % CATACOMBS.spawnPoints.length];
    this.cur = createPlayer({
      id: 'local',
      name: 'Player',
      color: flags.color ?? Math.floor(Math.random() * PLAYER_COLORS.length),
      x: spawn.x,
      y: spawn.y,
      slots: [
        { kind: 'single', gun: 'ak47', ammo: { magazine: 30, reserve: 90 } },
        { kind: 'single', gun: 'm14', ammo: { magazine: 15, reserve: 45 } },
      ],
    });
    this.prev = this.cur;

    this.gfx = this.add.graphics().setDepth(10);
    const hex = PLAYER_COLORS[this.cur.color].hex;
    this.nameTag = this.add
      .text(0, 0, this.cur.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: hex,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);
    this.follow = this.add.zone(spawn.x, spawn.y, 1, 1);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b0810');
    cam.setBounds(0, 0, CATACOMBS.widthPx, CATACOMBS.heightPx);
    cam.startFollow(this.follow, false, 0.12, 0.12);
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());

    this.input2 = new InputController(this, {
      getAimOrigin: () => this.chest(this.cur),
      onZoom: () => this.cycleZoom(),
      script: flags.autoplay ? autoplayScript : null,
    });

    this.scene.launch('sandbox-hud');
    this.events.once('shutdown', () => {
      this.input2.destroy();
      this.scene.stop('sandbox-hud');
    });
  }

  update(_time: number, deltaMs: number) {
    // cap the frame time so a background tab does not trigger a huge catch-up
    const dt = Math.min(deltaMs / 1000, 0.25);
    this.acc += dt;
    this.seconds += dt;

    let steps = 0;
    while (this.acc >= TICK_DT && steps < MAX_STEPS_PER_FRAME) {
      const input = this.input2.poll(this.seconds);
      this.lastInput = input;
      this.prev = this.cur;
      this.cur = step(
        this.cur,
        input,
        CATACOMBS.collision,
        { gravity: debugState.gravity, boost: debugState.boost },
        debugState.movement,
      );
      this.acc -= TICK_DT;
      steps++;
      telemetry.ticks++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // fell too far behind: drop the backlog

    const alpha = this.acc / TICK_DT;
    this.draw(alpha);
    this.publish(deltaMs);
  }

  // ---------- drawing ----------
  private lerpState(alpha: number) {
    const L = (a: number, b: number) => a + (b - a) * alpha;
    return { x: L(this.prev.x, this.cur.x), y: L(this.prev.y, this.cur.y) };
  }

  private chest(s: PlayerState) {
    const h = s.crouching ? debugState.movement.crouchHeight : debugState.movement.standHeight;
    return { x: s.x, y: s.y - h * 0.65 };
  }

  private draw(alpha: number) {
    const s = this.cur;
    const pos = this.lerpState(alpha);
    const M = debugState.movement;
    const h = s.crouching ? M.crouchHeight : M.standHeight;
    const w = M.width;
    const color = Phaser.Display.Color.HexStringToColor(PLAYER_COLORS[s.color].hex).color;
    const g = this.gfx;
    g.clear();

    // jetpack flame (placeholder)
    if (s.flying) {
      const f = 14 + Math.random() * 10;
      g.fillStyle(0xffb347, 1).fillTriangle(pos.x - 7, pos.y, pos.x + 7, pos.y, pos.x, pos.y + f);
      g.fillStyle(0xfff3c4, 1).fillTriangle(pos.x - 3, pos.y, pos.x + 3, pos.y, pos.x, pos.y + f * 0.55);
    }

    // body: a rectangle tinted with the player's colour
    g.fillStyle(color, 1).fillRect(pos.x - w / 2, pos.y - h, w, h);
    g.lineStyle(2, 0x000000, 1).strokeRect(pos.x - w / 2, pos.y - h, w, h);

    // facing indicator: a visor on the side the player looks toward (decides front vs back for the crouch shield)
    const visorW = 9;
    const vx = s.facing === 1 ? pos.x + w / 2 - visorW : pos.x - w / 2;
    g.fillStyle(0xffffff, 0.95).fillRect(vx, pos.y - h + 6, visorW, 8);

    // aim line from the chest
    const cx = pos.x;
    const cy = pos.y - h * 0.65;
    const a = this.lastInput?.aimAngle ?? 0;
    g.lineStyle(2, 0xffffff, 0.8).lineBetween(cx, cy, cx + Math.cos(a) * 64, cy + Math.sin(a) * 64);
    g.fillStyle(0xffffff, 1).fillCircle(cx + Math.cos(a) * 64, cy + Math.sin(a) * 64, 3);

    // name tag above the head, in the player's colour
    this.nameTag.setPosition(pos.x, pos.y - h - 6);

    // keep the camera target on the (smoothed) player
    this.follow.setPosition(pos.x, pos.y - h / 2);
  }

  // ---------- zoom ----------
  private cycleZoom() {
    this.zoomIndex = (this.zoomIndex + 1) % ZOOMS.length;
    this.applyZoom();
  }

  private applyZoom() {
    const base = this.scale.height / VISIBLE_HEIGHT;
    this.cameras.main.setZoom(base * ZOOMS[this.zoomIndex]);
    telemetry.zoomLabel = `${ZOOMS[this.zoomIndex]}X`;
  }

  // ---------- numbers for the HUD and the debug panel ----------
  private publish(deltaMs: number) {
    const s = this.cur;
    telemetry.x = s.x;
    telemetry.y = s.y;
    telemetry.vx = s.vx;
    telemetry.vy = s.vy;
    telemetry.fuel = s.fuel;
    telemetry.fuelCapacity = MOVEMENT.fuelCapacity;
    telemetry.onGround = s.onGround;
    telemetry.crouching = s.crouching;
    telemetry.flying = s.flying;
    telemetry.grenadeLabel = `${s.selectedGrenade.toUpperCase()} ${s.grenades[s.selectedGrenade]}`;
    telemetry.fps = 0.9 * telemetry.fps + 0.1 * (1000 / Math.max(1, deltaMs));
    if (this.input2.lastLogged) telemetry.lastAction = this.input2.lastLogged;
    void touchState;
  }
}

/** ?autoplay=1: a repeating 12 s scripted route (walk, fly, crouch, walk back) for automated checks. */
function autoplayScript(t: number): Partial<PlayerInput> {
  const p = t % 12;
  const aimAngle = Math.sin(t * 0.7) * 1.2;
  if (p < 2.5) return { moveX: 1, aimAngle };
  if (p < 4.5) return { moveX: 1, fly: true, aimAngle };
  if (p < 5.5) return { aimAngle };
  if (p < 6.5) return { crouch: true, aimAngle };
  if (p < 9) return { moveX: -1, aimAngle };
  return { moveX: -1, fly: p < 10.5, aimAngle };
}
