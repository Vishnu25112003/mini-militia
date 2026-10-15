---
phase: 3
title: Local Movement Sandbox (offline)
status: not-started
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
- [ ] Detect portrait on mobile → full-screen **"Rotate your phone to landscape"** message; game hidden behind it
- [ ] Rotating back to landscape removes the message instantly
- [ ] Build and test every screen from here on in landscape only

### 1. Placeholder player
- [ ] Player = colored rectangle (placeholder art), tinted with one of the 8 player colors
- [ ] Name tag above the head: small, clean text in the player's color
- [ ] Simple facing indicator (which way the player looks) — needed later for front/back crouch shield
- [ ] Aim line showing the aim direction

### 2. Input layer (one abstraction for touch and PC)
- [ ] `InputController` produces the shared `PlayerInput` every frame, no matter the device
- [ ] **Touch — default layout (from the flow):**

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
- [ ] **PC — default key mapping (from the flow):** A/D move, W or Space fly, S crouch, mouse aim, left click fire, right click zoom, V melee, G grenade, Q grenade switch, mouse wheel or 1/2 swap, R reload, E pickup/pair, Enter chat
- [ ] Buttons with no function yet (melee, grenade, reload, pickup) just log the press for now

### 3. Movement
- [ ] Run shared `physics.step` at fixed 1/30 s; draw smoothly at screen refresh rate (interpolate between steps)
- [ ] Debug panel (dev only): change **gravity** (0–100) and **boost** (0–100) live to check both settings behave as the flow says
- [ ] Fuel visible on a temporary boost bar

### 4. Camera
- [ ] Camera follows the player with slight smoothing
- [ ] Zoom button / right click cycles a test zoom level (real per-gun zoom comes in Phase 08)

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
- [ ] Gravity 0 → floating; gravity 100 → normal
- [ ] Boost 100 → no drain; 0 → very fast drain
- [ ] Can't pass through walls at any speed
- [ ] Dev4 is happy with the movement feel

## Notes / tuned values
- Walk speed: _
- Jetpack thrust: _
- Fuel capacity / drain / refill: _

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 04**
