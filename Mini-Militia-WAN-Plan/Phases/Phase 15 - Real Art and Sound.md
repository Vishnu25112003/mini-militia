---
phase: 15
title: Real Art & Sound
status: not-started
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
- [ ] **Art source:** Dev4 draws / hire an artist / licensed asset packs → _(fill in)_

## Important
- Art must be **original**. The original game's characters, gun sprites, map art, sounds, and name belong to its owners — copying them is a risk if the game is ever published.

## Asset list
- [ ] **Character:** one default avatar, designed so the **outfit can be color-tinted** (8 colors); animations: idle, walk, fly, crouch, melee, death
- [ ] **Guns (15):** side-view sprites matching gun box icons
- [ ] **Grenades (3)**, **medkit**, **boost tank** pickups
- [ ] **Map tileset** (32 px) matching the Catacombs-style layout; background
- [ ] **Effects:** muzzle flash, tracers, explosion, gas cloud, flame, laser, spawn shield, crouch shield
- [ ] **UI icons:** joysticks, buttons, gun box, grenade switch, chat, zoom, lobby screens, map card thumbnail
- [ ] **Sounds:** each gun, reload, explosion, gas, flame, melee, pickup, jetpack, hit, death, UI clicks, countdown

## Tasks
- [ ] Style guide (line thickness, palette, sizes) so everything matches
- [ ] Pack sprites into texture atlases
- [ ] Swap placeholders without changing collision sizes (gameplay must not change)
- [ ] Re-check performance (Phase 14 targets)

## Acceptance criteria
- [ ] No placeholder art or sound left
- [ ] Colors still clearly identify all 8 players
- [ ] Performance still meets Phase 14 targets

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 16**
