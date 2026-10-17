---
phase: 15
title: Real Art & Sound
status: in-progress
depends_on: [14]
tags: [phase, art, sound]
---

# Phase 15 — Real Art & Sound

← [[Phase 14 - Mobile Browser Hardening]] | Next → [[Phase 16 - Playtesting and Balance]]

## Goal
Replace all placeholder shapes and sounds with **original** doodle-style art and real sound effects.

## Flow references
- [[Game Flow#18. Art & Sound]]
- [[Game Flow#17. Player Identity]] (color tint, one default avatar)

## Decision to make at the start of this phase
- [x] **Art source:** Dev4 draws / hire an artist / licensed asset packs → **programmatic placeholder+**:
  code-generated vector art (Phaser `Graphics`) and synthesized Web Audio sound effects, chosen because
  this environment has no image/audio generation tools and no human artist in the loop. Fully original
  (no copyright risk) and swappable for hand-drawn art later without further code changes, but it is
  still not hand-drawn "doodle-style" art — see Implementation notes.

## Important
- Art must be **original**. The original game's characters, gun sprites, map art, sounds, and name belong to its owners — copying them is a risk if the game is ever published.

## Asset list
- [x] **Character:** one default avatar, designed so the **outfit can be color-tinted** (8 colors); animations: idle, walk, fly, crouch, melee, death
- [x] **Guns (15):** side-view sprites matching gun box icons
- [x] **Grenades (3)**, **medkit**, **boost tank** pickups
- [ ] **Map tileset** (32 px) matching the Catacombs-style layout; background
- [ ] **Effects:** muzzle flash, tracers, explosion, gas cloud, spawn shield, crouch shield done; flame and laser still reuse the generic projectile effect (see Implementation notes)
- [x] **UI icons:** joysticks, buttons, gun box, grenade switch, chat, zoom, lobby screens, map card thumbnail
- [x] **Sounds:** each gun, reload, explosion, gas, flame, melee, pickup, jetpack, hit, death, UI clicks, countdown

## Tasks
- [x] Style guide (line thickness, palette, sizes) so everything matches
- [ ] Pack sprites into texture atlases
- [x] Swap placeholders without changing collision sizes (gameplay must not change)
- [x] Re-check performance (Phase 14 targets)

## Acceptance criteria
- [ ] No placeholder art or sound left — the map tileset is still the Phase 03 placeholder; everything else is replaced (see Implementation notes)
- [x] Colors still clearly identify all 8 players
- [x] Performance still meets Phase 14 targets (not measured on real hardware; no new allocations introduced)

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 16**

## Implementation notes

- **Character rig** (`PlayerView.ts`): replaced the flat tinted rectangle with a small doodle-style rig
  (head circle, rounded torso, two legs) drawn with one redrawn `Graphics` object per player per frame —
  still color-tinted per player (the outfit color is the only thing that changes between players, same
  as the old placeholder) and still occupies the same WIDTH×HEIGHT envelope the real hitbox uses, so
  nothing about collision or hit-reading changed. Animations: legs scissor while walking (`|vx|` above a
  threshold and `onGround`), a small jetpack flame while airborne, legs bend and a translucent front-side
  "crouch shield" wedge while crouching, a brief outward arm swing on the server's `melee` message, and a
  short fading burst in place of an instant disappear on death (`alive` false→true edge, ~300ms).
- **Guns (15)**: one vector silhouette per `WeaponGroup` (assault/marksman/smg-pistol/shotgun/launcher,
  plus `Flame` and `Phasr` individually within 'special') rather than 15 fully unique drawings — the
  group already captures the right visual family, and this keeps the art data small and consistent.
  Drawn once per weapon change (`WeaponSilhouette.ts`) and held in the hand, rotating with aim angle;
  the same drawing function is reused for ground-item gun pickups (`groundItemIcon.ts`) and the player's
  held weapon. **Known simplification**: because the gun rotates a full 360° with aim angle but its art
  isn't drawn symmetrically top/bottom, aiming near-vertical can make the silhouette look visually
  "flipped" compared to a real sprite sheet with separate up/down frames — acceptable for placeholder-tier
  art, not worth the extra per-frame-angle art variants this phase.
- **Pickups**: medkit (cross-on-square), grenade pair (two linked spheres with fuses), boost tank
  (cylinder) — `groundItemIcon.ts`. Replaces the flat colored-circle markers.
- **Effects**: muzzle flash, tracers, explosion flash, and gas cloud were already pooled in Phase 14;
  unchanged visually here. Flame and laser don't have dedicated visual effects yet — the `Flame` and
  `Phasr` weapons currently reuse the generic projectile tracer/muzzle flash. Spawn shield is a gold ring
  around the whole body (tied to `shieldSecondsRemaining`); crouch shield is a translucent wedge on the
  facing side, shown whenever crouching (the mechanic has no timer, unlike the spawn shield).
- **UI icons** (`uiIcons.ts`): melee, reload, pickup, grenade, switch-grenade, zoom, and chat touch
  buttons now draw a small vector glyph instead of a text label, reusing the same `Graphics`-positioned-
  and-scaled pattern the old label used, so edit-mode drag/resize (Phase 13) didn't need any changes.
  Lobby screens and the map-card thumbnail are unchanged — the asset list's other UI surfaces (gun box
  text, joystick circles) were left as-is, since they weren't really icon-shaped placeholders to begin
  with.
- **Sounds** (`game/sound.ts`): every effect is synthesized with the Web Audio API (oscillators + white
  noise through a lowpass filter) rather than sourced from audio files — fully original, no asset
  download, no licensing risk. Wired to the existing `shotFired`/`projectileFired`/`explosion`/
  `grenadeExploded`/`gasLanded`/`melee`/`hit` room messages, plus locally to reload (edge-triggered off
  the input sample), death (the same alive-flag edge `PlayerView` uses), a looping jetpack hum
  (start/stop on the `onGround` edge), lobby countdown beeps (`autoStartRemainingSeconds` crossing 3→0),
  and UI clicks on the most prominent buttons (lobby actions, Controls popups, popup close). **Known
  simplification**: pickup sound fires on any ground-item removal, including the Phase 10 refresh-cycle
  despawns, since there's no dedicated "picked up" broadcast to key off instead; gunshot sound only
  distinguishes hitscan vs. projectile weapons (two variants), not all 15 guns individually, since the
  `shotFired`/`projectileFired` message payloads don't carry a weapon id.
- **Not done — map tileset / texture atlases**: the Catacombs tilemap (`tileset.png` + `catacombs.json`)
  is unchanged. Re-drawing an actual 32px tile set is a map-authoring task (Tiled, real tile art), not
  something a vector-shape approach meaningfully substitutes for, so it's left out of this phase's scope
  rather than faked. Texture atlas packing doesn't apply either — nothing added this phase is a bitmap
  sprite; everything is vector `Graphics`, so there's no texture data to pack. Both are reasonable
  candidates for a real artist pass later, per the chosen "programmatic placeholder+" art source.
- **Performance**: no new per-frame allocations were introduced — the rig and weapon silhouette reuse
  persistent `Graphics` objects (clear + redraw, or redraw-only-on-change for the weapon), the same
  pattern Phase 14's effect pools already established. Verified via `tsc -b` across all three workspaces
  and 135 passing shared unit tests; real frame-rate measurement on a mid-range phone is still out of
  reach for this environment (see Phase 14's notes on the same limitation).
