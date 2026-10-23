import Phaser from 'phaser';
import { flags, telemetry, touchState } from '../sandbox/sandboxState';

type ButtonKey = 'melee' | 'throwGrenade' | 'reload' | 'pickup' | 'zoom';

interface Stick {
  id: number | null;
  cx: number;
  cy: number;
  r: number;
  nx: number; // knob offset, -1..1
  ny: number;
}

interface Button {
  key: ButtonKey;
  x: number;
  y: number;
  r: number;
  label: () => string;
  /** Only drawn / usable when this returns true. */
  visible: () => boolean;
  pressedId: number | null;
}

/**
 * The on-screen controls, drawn by their own scene on top of the world (so the world camera's zoom never touches
 * them). Default layout from the Game Flow, Section 13:
 *   bottom-left  movement / jetpack joystick     next to it   grenade throw button (shows count)
 *   bottom-right aim + fire joystick             left of it   melee       near it   reload, pickup / pair
 *   top-left     zoom button                      top          temporary fuel (boost) bar
 * Several fingers work at once: every pointer is tied to the control it first touched.
 */
export class SandboxHud extends Phaser.Scene {
  private left!: Stick;
  private right!: Stick;
  private buttons: Button[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private texts = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super('sandbox-hud');
  }

  create() {
    // up to 5 fingers (the default is 2)
    this.input.addPointer(3);
    touchState.enabled = this.sys.game.device.input.touch || flags.forceTouch;

    this.left = { id: null, cx: 0, cy: 0, r: 0, nx: 0, ny: 0 };
    this.right = { id: null, cx: 0, cy: 0, r: 0, nx: 0, ny: 0 };
    const b = (key: ButtonKey, label: () => string, visible: () => boolean = () => true): Button => ({
      key,
      x: 0,
      y: 0,
      r: 0,
      label,
      visible,
      pressedId: null,
    });
    this.buttons = [
      b('throwGrenade', () => telemetry.grenadeLabel),
      b('melee', () => 'MELEE'),
      b('reload', () => 'R'),
      b(
        'pickup',
        () => 'PICK',
        () => telemetry.nearGun,
      ), // shown only near a gun
      b('zoom', () => telemetry.zoomLabel),
    ];

    this.g = this.add.graphics();
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
  }

  /** Place everything from the current screen size (landscape). */
  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    const u = Phaser.Math.Clamp(h / 420, 0.7, 1.7); // one "control unit" scales with the screen
    const R = 62 * u;
    this.left.r = R;
    this.left.cx = 24 * u + R;
    this.left.cy = h - 24 * u - R;
    this.right.r = R;
    this.right.cx = w - 24 * u - R;
    this.right.cy = h - 24 * u - R;

    const set = (key: ButtonKey, x: number, y: number, r: number) => {
      const btn = this.buttons.find((q) => q.key === key)!;
      btn.x = x;
      btn.y = y;
      btn.r = r;
    };
    set('throwGrenade', this.left.cx + R + 52 * u, h - 24 * u - 36 * u, 36 * u); // next to the left joystick
    set('melee', this.right.cx - R - 52 * u, h - 24 * u - 36 * u, 36 * u); // left of the right joystick
    set('reload', this.right.cx - R - 18 * u, this.right.cy - R - 6 * u, 28 * u); // near the right joystick
    set('pickup', this.right.cx, this.right.cy - R - 44 * u, 30 * u); // near the right joystick, only near a gun
    set('zoom', 16 * u + 28 * u, 16 * u + 28 * u, 28 * u); // top-left
  }

  // ---------- touch handling ----------
  private inside(x: number, y: number, cx: number, cy: number, r: number) {
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (!touchState.enabled) return;
    for (const btn of this.buttons) {
      if (btn.visible() && btn.pressedId === null && this.inside(p.x, p.y, btn.x, btn.y, btn.r * 1.15)) {
        btn.pressedId = p.id;
        if (btn.key === 'zoom') touchState.latched.zoom = true;
        else touchState.latched[btn.key] = true;
        return;
      }
    }
    // a stick starts when the finger lands in (or near) its ring
    for (const [stick, which] of [
      [this.left, 'left'],
      [this.right, 'right'],
    ] as const) {
      if (stick.id === null && this.inside(p.x, p.y, stick.cx, stick.cy, stick.r * 1.8)) {
        stick.id = p.id;
        this.moveStick(stick, which, p);
        return;
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.left.id === p.id) this.moveStick(this.left, 'left', p);
    if (this.right.id === p.id) this.moveStick(this.right, 'right', p);
  }

  private onUp(p: Phaser.Input.Pointer) {
    for (const btn of this.buttons) if (btn.pressedId === p.id) btn.pressedId = null;
    if (this.left.id === p.id) {
      this.left.id = null;
      this.left.nx = this.left.ny = 0;
      touchState.moveX = 0;
      touchState.fly = false;
      touchState.crouch = false;
    }
    if (this.right.id === p.id) {
      this.right.id = null;
      this.right.nx = this.right.ny = 0;
      touchState.aimActive = false;
      touchState.fire = false;
    }
  }

  private moveStick(stick: Stick, which: 'left' | 'right', p: Phaser.Input.Pointer) {
    let dx = p.x - stick.cx;
    let dy = p.y - stick.cy;
    const mag = Math.hypot(dx, dy);
    if (mag > stick.r) {
      dx = (dx / mag) * stick.r;
      dy = (dy / mag) * stick.r;
    }
    stick.nx = dx / stick.r;
    stick.ny = dy / stick.r;

    if (which === 'left') {
      // left / right = walk, push up = fly, pull down = crouch (physics only crouches on the ground)
      const dead = 0.2;
      touchState.moveX =
        Math.abs(stick.nx) < dead ? 0 : Math.sign(stick.nx) * ((Math.abs(stick.nx) - dead) / (1 - dead));
      touchState.fly = stick.ny < -0.4;
      touchState.crouch = stick.ny > 0.6;
    } else {
      // direction = aim, holding = fire
      const m = Math.hypot(stick.nx, stick.ny);
      touchState.aimActive = m > 0.2;
      if (touchState.aimActive) touchState.aimAngle = Math.atan2(stick.ny, stick.nx);
      touchState.fire = m > 0.3;
    }
  }

  // ---------- drawing ----------
  update() {
    const g = this.g;
    g.clear();
    const w = this.scale.width;
    const h = this.scale.height;
    const u = Phaser.Math.Clamp(h / 420, 0.7, 1.7);

    // temporary fuel (boost) bar, top centre-left
    const barW = 190 * u;
    const bx = w * 0.3;
    const by = 14 * u;
    const frac = Phaser.Math.Clamp(telemetry.fuel / telemetry.fuelCapacity, 0, 1);
    g.fillStyle(0x000000, 0.55).fillRoundedRect(bx - 3, by - 3, barW + 6, 14 * u + 6, 6);
    g.fillStyle(frac > 0.25 ? 0xfb923c : 0xef4444, 1).fillRoundedRect(bx, by, barW * frac, 14 * u, 4);
    this.text('fuel', bx, by + 14 * u + 6, `FUEL ${Math.round(frac * 100)}%`, 11 * u, '#fbbf24');

    if (!touchState.enabled) {
      for (const t of this.texts.values()) if (t.name !== 'fuel') t.setVisible(false);
      return;
    }

    // joysticks
    for (const stick of [this.left, this.right]) {
      g.fillStyle(0xffffff, 0.12).fillCircle(stick.cx, stick.cy, stick.r);
      g.lineStyle(2, 0xffffff, 0.35).strokeCircle(stick.cx, stick.cy, stick.r);
      g.fillStyle(0xffffff, stick.id === null ? 0.3 : 0.55).fillCircle(
        stick.cx + stick.nx * stick.r,
        stick.cy + stick.ny * stick.r,
        stick.r * 0.42,
      );
    }
    this.text(
      'left',
      this.left.cx,
      this.left.cy - this.left.r - 12 * u,
      'MOVE · UP = FLY · DOWN = CROUCH',
      9 * u,
      '#d6d3d1',
    );
    this.text(
      'right',
      this.right.cx,
      this.right.cy - this.right.r - 12 * u,
      'AIM · HOLD = FIRE',
      9 * u,
      '#d6d3d1',
    );

    // buttons
    for (const btn of this.buttons) {
      const label = this.text(`btn-${btn.key}`, btn.x, btn.y, btn.label(), 12 * u, '#ffffff', true);
      const show = btn.visible();
      label.setVisible(show);
      if (!show) continue;
      g.fillStyle(
        btn.pressedId === null ? 0xffffff : 0xfbbf24,
        btn.pressedId === null ? 0.16 : 0.5,
      ).fillCircle(btn.x, btn.y, btn.r);
      g.lineStyle(2, 0xffffff, 0.45).strokeCircle(btn.x, btn.y, btn.r);
    }
  }

  private text(
    name: string,
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    center = false,
  ) {
    let t = this.texts.get(name);
    if (!t) {
      t = this.add.text(x, y, value, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${size}px`,
        color,
        align: 'center',
      });
      t.setName(name);
      this.texts.set(name, t);
    }
    t.setVisible(true)
      .setText(value)
      .setPosition(x, y)
      .setFontSize(size)
      .setOrigin(center ? 0.5 : 0.5, center ? 0.5 : 0);
    return t;
  }
}
