import type Phaser from 'phaser';
import { emptyInput, type PlayerInput } from '@game/shared';
import { touchState } from '../sandbox/sandboxState';

/** Something the player did that has no gameplay yet (Phase 03 only logs it). */
export type LoggedAction =
  'melee' | 'throwGrenade' | 'switchGrenade' | 'reload' | 'swapWeapon' | 'pickup' | 'chat';

export interface InputControllerOptions {
  /** Where the aim line starts (the player's chest) in world coordinates; mouse aim is measured from here. */
  getAimOrigin: () => { x: number; y: number };
  /** Zoom was requested (right click, or the zoom button on touch). */
  onZoom: () => void;
  /** Scripted input for automated checks (?autoplay=1). */
  script?: ((seconds: number) => Partial<PlayerInput>) | null;
}

const GAME_KEYS = new Set([
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyV',
  'KeyG',
  'KeyQ',
  'KeyR',
  'KeyE',
  'Digit1',
  'Digit2',
  'Enter',
]);

/**
 * One abstraction for every device: `poll()` returns the shared `PlayerInput` for one physics tick, no matter
 * whether it came from the keyboard + mouse, touch joysticks, or a script.
 *
 * Taps are latched: a key or button pressed and released between two 30 Hz ticks still counts for the next tick.
 */
export class InputController {
  private down = new Set<string>();
  private tapped = new Set<string>();
  private latched: Record<LoggedAction, boolean> = {
    melee: false,
    throwGrenade: false,
    switchGrenade: false,
    reload: false,
    swapWeapon: false,
    pickup: false,
    chat: false,
  };
  private mouseFire = false;
  private mouseFireTapped = false;
  private cleanup: (() => void)[] = [];
  private seq = 0;
  /** What the last poll contained that has no gameplay yet, for the debug panel. */
  lastLogged: LoggedAction | null = null;

  constructor(
    private scene: Phaser.Scene,
    private opts: InputControllerOptions,
  ) {
    this.bind();
  }

  private listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
  ): void;
  private listen(
    target: HTMLElement,
    type: string,
    fn: (e: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
  private listen(
    target: Window | HTMLElement,
    type: string,
    fn: (e: never) => void,
    options?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn as EventListener, options);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, options));
  }

  private bind() {
    const canvas = this.scene.game.canvas;

    this.listen(window, 'keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return; // typing in the debug panel
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      if (!e.repeat) this.tapped.add(e.code);
      this.down.add(e.code);
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyV':
          this.latched.melee = true;
          break;
        case 'KeyG':
          this.latched.throwGrenade = true;
          break;
        case 'KeyQ':
          this.latched.switchGrenade = true;
          break;
        case 'KeyR':
          this.latched.reload = true;
          break;
        case 'KeyE':
          this.latched.pickup = true;
          break;
        case 'Digit1':
        case 'Digit2':
          this.latched.swapWeapon = true;
          break;
        case 'Enter':
          this.latched.chat = true;
          break;
      }
    });
    this.listen(window, 'keyup', (e) => this.down.delete(e.code));
    this.listen(window, 'blur', () => {
      this.down.clear();
      this.mouseFire = false;
    });

    // mouse (touch has its own on-screen controls)
    this.listen(canvas, 'pointerdown', (e) => {
      const p = e as PointerEvent;
      // clicking the game takes keyboard focus back from any form field (e.g. a debug slider), so keys play again
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      if (p.pointerType !== 'mouse') return;
      if (p.button === 0) {
        this.mouseFire = true;
        this.mouseFireTapped = true;
      } else if (p.button === 2) this.opts.onZoom();
    });
    this.listen(window, 'pointerup', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse' && (e as PointerEvent).button === 0)
        this.mouseFire = false;
    });
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        if (Math.abs((e as WheelEvent).deltaY) > 2) this.latched.swapWeapon = true;
      },
      { passive: false },
    );
  }

  /** The input for one physics tick. `seconds` is the time since the sandbox started (only used by scripts). */
  poll(seconds: number): PlayerInput {
    const k = (code: string) => this.down.has(code) || this.tapped.has(code);
    const input = emptyInput(++this.seq);

    const kbMove = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    input.moveX = Math.max(-1, Math.min(1, kbMove + (touchState.enabled ? touchState.moveX : 0)));
    input.fly = k('KeyW') || k('ArrowUp') || k('Space') || (touchState.enabled && touchState.fly);
    input.crouch = k('KeyS') || k('ArrowDown') || (touchState.enabled && touchState.crouch);
    input.fire = this.mouseFire || this.mouseFireTapped || (touchState.enabled && touchState.fire);

    // aim: the right joystick wins while it is held, otherwise the mouse
    if (touchState.enabled && touchState.aimActive) {
      input.aimAngle = touchState.aimAngle;
    } else {
      const o = this.opts.getAimOrigin();
      const cam = this.scene.cameras.main;
      const p = this.scene.input.activePointer;
      const world = cam.getWorldPoint(p.x, p.y);
      input.aimAngle = Math.atan2(world.y - o.y, world.x - o.x);
    }

    const t = touchState.latched;
    input.melee = this.latched.melee || t.melee;
    input.throwGrenade = this.latched.throwGrenade || t.throwGrenade;
    input.switchGrenade = this.latched.switchGrenade || t.switchGrenade;
    input.reload = this.latched.reload || t.reload;
    input.swapWeapon = this.latched.swapWeapon || t.swapWeapon;
    input.pickup = this.latched.pickup || t.pickup;
    if (t.zoom) this.opts.onZoom();

    if (this.opts.script) Object.assign(input, this.opts.script(seconds));

    // buttons that do nothing yet are only logged (Phase 03); melee / grenade / reload / pickup get logic in later phases
    this.lastLogged = null;
    for (const a of Object.keys(this.latched) as LoggedAction[]) {
      const fired = this.latched[a] || (a !== 'chat' && (t as Record<string, boolean>)[a]);
      if (fired) {
        this.lastLogged = a;
        console.info(`[input] ${a}`);
      }
    }

    // clear everything that was only a tap
    this.tapped.clear();
    this.mouseFireTapped = false;
    for (const a of Object.keys(this.latched) as LoggedAction[]) this.latched[a] = false;
    for (const a of Object.keys(t) as (keyof typeof t)[]) t[a] = false;
    return input;
  }

  destroy() {
    this.cleanup.forEach((c) => c());
    this.cleanup = [];
  }
}
