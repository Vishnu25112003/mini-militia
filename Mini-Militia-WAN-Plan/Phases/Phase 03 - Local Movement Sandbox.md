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
- [ ] Rotating back to landscape removes the message instantly
- [ ] Build and test every screen from here on in landscape only

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

- [ ] Left joystick: left/right = walk, push up = fly; **pull down while on the ground = crouch**
- [ ] Right joystick: direction = aim, holding = fire
- [ ] Multi-touch: both joysticks + a button at the same time (3 fingers)
- [x] **PC — default key mapping (from the flow):** A/D move, W or Space fly, S crouch, mouse aim, left click fire, right click zoom, V melee, G grenade, Q grenade switch, mouse wheel or 1/2 swap, R reload, E pickup/pair, Enter chat
- [x] Buttons with no function yet (melee, grenade, reload, pickup) just log the press for now

### 3. Movement
- [x] Run shared `physics.step` at fixed 1/30 s; draw smoothly at screen refresh rate (interpolate between steps)
- [x] Debug panel (dev only): change **gravity** (0–100) and **boost** (0–100) live to check both settings behave as the flow says
- [x] Fuel visible on a temporary boost bar

### 4. Camera
- [x] Camera follows the player with slight smoothing
- [x] Zoom button / right click cycles a test zoom level (real per-gun zoom comes in Phase 08)

### 5. Tune movement
- [ ] Adjust speed, jump, thrust, fuel numbers in `shared/config/movement.ts` until it feels right
- [ ] Record final values in the notes below

## Deliverables
- Playable offline sandbox on phone and PC
- Tuned movement config

## Acceptance criteria
- [ ] On a phone in portrait → rotate message shows; in landscape → game shows
- [ ] On a phone: walk, fly, crouch, aim with joysticks, smooth (target 60 fps)
- [ ] On PC: same with keyboard/mouse
- [x] Gravity 0 → floating; gravity 100 → normal
- [x] Boost 100 → no drain; 0 → very fast drain
- [x] Can't pass through walls at any speed
- [ ] Dev4 is happy with the movement feel

## Notes / tuned values
- Walk speed: _
- Jetpack thrust: _
- Fuel capacity / drain / refill: _

## Notes / decisions log

**Built and checked 2026-10-23.** Open the sandbox with `npm run dev` → http://localhost:5173/ (it is the default scene; `?scene=map` and `?scene=hello` show the earlier phases). Dev switches: `?autoplay=1` (scripted route), `?touch=1` (show touch controls on a desktop), `?forcemobile=1` (pretend to be a phone), `?spawn=n`, `?color=n`, `?debug=1` (show the debug panel on touch devices).

**Verified in Chrome (and by tests):**
- Input → shared physics → drawing works end to end: ticks advance at 30/s, the player walks, flies and falls across the real map, rendering runs at ~75-140 fps (autoplay route; numbers read from the debug panel in the DOM).
- Landscape rule: a phone-shaped portrait window (390×844) shows only "Rotate your phone to landscape"; the same phone in landscape (844×390) shows the game and touch controls. (Logic also covered by 4 unit tests.)
- Keyboard: A moved left, D moved right, W lifts off; R, V, G, Q, E, 1, Enter are each picked up and logged (`[input] reload`, `melee`, `throwGrenade`, `switchGrenade`, `pickup`, `swapWeapon`, `chat`); right click cycles zoom 1X → 1.5X.
- Gravity 0: one tap of W lifted the player, it slowed and **settled in mid-air** (y 576 → ~525, velocity ~0, not on ground). Boost 0 + holding fly: fuel hit 0.0 quickly and the jetpack cut out; boost 100: fuel stayed 100.
- Touch layout (default positions from the flow) renders correctly at phone size: left joystick + grenade button (shows "FRAG 2"), right joystick + melee + reload (pickup button only appears near a gun), zoom button top-left, temporary fuel bar.
- Canvas is rendered at the screen's real pixel density (capped 2×) so it is sharp on phones.

**Things found while testing, and fixed:** (1) the first debug panel covered the left joystick and the zoom button → it now starts collapsed on small screens and is hidden on touch devices unless `?debug=1`; (2) the picture was blurry at 2× density because Phaser's resize mode ignores pixel density → the canvas is now sized in device pixels; (3) keyboard focus stayed on a debug slider and swallowed game keys → clicking the game now takes focus back; (4) a lint error (React's compiler rule) in the panel → state setters moved next to the state.

**Not verified — needs hardware or Dev4:**
- Touch *interaction* (joysticks, multi-touch with 3 fingers, button taps) on a real phone: the on-screen layout was checked, but no finger input could be simulated here.
- Keyboard crouch (S), mouse aim, left-click fire (no gun yet), mouse-wheel swap: implemented, not individually exercised in the browser. Crouch physics itself is covered by unit tests.
- Rotating a phone *while the game is open* (the message appearing and disappearing live): both states were checked on separate page loads; the code listens for resize / orientation changes.
- Movement **feel**: the numbers are still the Phase 01 placeholders (walk 200 px/s, air 200, ground accel 2400, air accel 1100, gravity 1400 px/s², max fall 900, jet thrust 2600, max rise 380, crouch ×0.45, fuel drain 1.0 × (100 − boost)/100 per second). The sandbox has a live tuning panel with a "Copy values" button — tune on a phone and PC, then paste the result into `shared/config/movement.ts` and record it under "Notes / tuned values" below.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 04**
