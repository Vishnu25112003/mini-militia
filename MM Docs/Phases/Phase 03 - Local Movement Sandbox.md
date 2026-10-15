---
phase: 3
title: Local Movement Sandbox (offline)
status: in-progress
depends_on: [1, 2]
tags: [phase, client, input, movement]
---

# Phase 03 — Local Movement Sandbox (offline)

← [[Phase 02 - Map]] | Next → [[Phase 04 - Networking Foundation]]

## Goal
One player, **no network**, on the real map: walk, fly with the jetpack, crouch, aim — using **touch joysticks on phone** and **keyboard/mouse on PC**, driven by the shared physics. This is where the game starts to *feel* like Mini Militia.

## Why offline first
Movement feel is the heart of the game. Tuning it without lag in the way is much easier. Because it uses the shared physics, everything built here works unchanged once the server takes over in Phase 04.

## Flow references
- [[Game Flow#13. Player Controls]]
- [[Game Flow#14. Tech Stack & Architecture]]
- [[Game Flow#17. Player Identity]] (color tint + name above head)
- [[Game Flow#1. Scope (v1)]] (mobile orientation: landscape only)

## Tasks

### 0. Landscape-only on mobile (from the start)
- [x] Detect portrait on mobile → full-screen **"Rotate your phone to landscape"** message; game hidden behind it
- [x] Rotating back to landscape removes the message instantly
- [x] Build and test every screen from here on in landscape only — `OrientationGate` wraps the whole `App`, not just the canvas

### 1. Placeholder player
- [x] Player = colored rectangle (placeholder art), tinted with one of the 8 player colors
- [x] Name tag above the head: small, clean text in the player's color
- [x] Simple facing indicator (which way the player looks) — needed later for front/back crouch shield
- [x] Aim line showing the aim direction

### 2. Input layer (one abstraction for touch and PC)
- [x] `InputController` produces the shared `PlayerInput` every frame, no matter the device
- [x] **Touch — default layout (from the flow):**

  | Position | Control |
  |---|---|
  | Bottom-left | Movement / jetpack joystick |
  | Next to left joystick | Grenade throw button (shows count) |
  | Bottom-right | Aim + fire joystick |
  | Left of right joystick | Melee button |
  | Near right joystick | Reload button |
  | Near right joystick (only near a gun) | Pickup / Pair button |
  | Top-left | Zoom button |

- [x] Left joystick: left/right = walk, push up = fly; **pull down while on the ground = crouch**
- [x] Right joystick: direction = aim, holding = fire
- [x] Multi-touch: both joysticks + a button at the same time (3 fingers) — needed `input: { activePointers: 4 }` in the Phaser game config, since Phaser only tracks 2 pointers (mouse + 1 touch) by default; caught by checking Phaser's own docs rather than assuming, worth stress-testing on a real device regardless
- [x] **PC — default key mapping (from the flow):** A/D move, W or Space fly, S crouch, mouse aim, left click fire, right click zoom, V melee, G grenade, Q grenade switch, mouse wheel or 1/2 swap, R reload, E pickup/pair, Enter chat
- [x] Buttons with no function yet (melee, grenade, reload, pickup) just log the press for now — also wired for grenade-switch, weapon-swap, and chat even though the task only named the first four, for consistency

### 3. Movement
- [x] Run shared `physics.step` at fixed 1/30 s; draw smoothly at screen refresh rate (interpolate between steps)
- [x] Debug panel (dev only): change **gravity** (0–100) and **boost** (0–100) live to check both settings behave as the flow says
- [x] Fuel visible on a temporary boost bar

### 4. Camera
- [x] Camera follows the player with slight smoothing
- [x] Zoom button / right click cycles a test zoom level (real per-gun zoom comes in Phase 08)

### 5. Tune movement
- [ ] Adjust speed, jump, thrust, fuel numbers in `shared/config/movement.ts` until it feels right — **this agent can't feel movement without a browser**; the Phase 01 placeholder values are left as the starting point for Dev4 to tune by actually playing
- [ ] Record final values in the notes below — blocked on the above

## Deliverables
- Playable offline sandbox on phone and PC
- Tuned movement config

## Acceptance criteria
All of these need Dev4's hands-on verification — this agent built and code-reviewed everything carefully (including a production build, a dev-server module-resolution check for every new file, and 45 passing Vitest tests for the underlying physics), but has no browser access in this environment (same limitation noted in Phases 00/02), so none of the following has actually been seen running:
- [ ] On a phone in portrait → rotate message shows; in landscape → game shows
- [ ] On a phone: walk, fly, crouch, aim with joysticks, smooth (target 60 fps)
- [ ] On PC: same with keyboard/mouse
- [ ] Gravity 0 → floating; gravity 100 → normal
- [ ] Boost 100 → no drain; 0 → very fast drain
- [ ] Can't pass through walls at any speed (physics-level tunneling is covered by a Phase 01 test at terminal velocity; this is about confirming it holds with real input, e.g. mashing into a corner)
- [ ] Dev4 is happy with the movement feel

## Notes / tuned values
Not yet tuned by play — these are still Phase 01's placeholder numbers (`shared/config/movement.ts`), carried forward as the starting point. Tune by actually playing (`npm run dev`), then record final values here:
- Walk speed: _ (currently 180 px/s)
- Jetpack thrust: _ (currently 1400 px/s²)
- Fuel capacity / drain / refill: _ (currently 100 / up to 60 per sec at boost=0 / 35 per sec)

## Notes / decisions log
- 2026-10-15: Built the full input layer (hand-rolled touch joysticks + buttons, PC keyboard/mouse, chosen by a shared `pointer: coarse` media-query check also used by the orientation gate), a placeholder player (tinted rectangle + name tag + facing marker + aim line), a fixed-1/30s physics loop with render interpolation, smoothed camera follow with a cycling test zoom, a live gravity/boost debug panel, and the landscape-only orientation gate wrapping the whole app.
- Changed a Phase 01 design decision while wiring up the real input model: `facing` now comes from aim direction (`Math.cos(aimAngle) >= 0`) instead of movement direction. The crouch shield and melee direction rules are clearly about which way the player is looking/shooting, not which way they last walked — Phase 01 guessed movement-direction before `aimAngle` was a real, continuously-driven input. Existing Phase 01 tests still pass (they happened to use `aimAngle: 0`, which maps to 'right' either way); added a dedicated test for the new behavior.
- Caught two real bugs via code review (no browser to catch them by trial and error): (1) a `shutdown()` method that Phaser never actually calls — it's an event (`Phaser.Scenes.Events.SHUTDOWN`) you must explicitly subscribe to, not an auto-invoked lifecycle method, so cleanup was silently dead code; (2) Phaser only tracks 2 pointers by default (mouse + 1 touch), which would have silently broken the required 3-finger multi-touch (both joysticks + a button) — fixed with `input: { activePointers: 4 }` in the game config, verified against Phaser's own type definitions rather than assumed.
- Verified every new/changed file resolves and transforms correctly through Vite's dev server (not just the production build) by curling each module path directly, since this agent can't load the page in a real browser to see it fail.

## Approval gate
- [ ] All acceptance criteria met — blocked entirely on Dev4 actually playing it
- [ ] **Dev4 approval to move to Phase 04**
