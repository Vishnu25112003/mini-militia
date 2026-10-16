---
phase: 8
title: Full Weapon Set
status: in-progress
depends_on: [7]
tags: [phase, weapons, combat]
---

# Phase 08 — Full Weapon Set

← [[Phase 07 - Combat Core]] | Next → [[Phase 09 - Grenades and Melee]]

## Goal
All **15 guns** working with their approved stats, plus zoom, dual wield, explosions, and self-damage.

## Flow references
- [[Game Flow#7. Weapons]] (gun stats, dual-wield firing, self-damage)
- [[Game Flow#8. Crouch Shield]] (explosions, gas, flame)

## Approach: behaviour types
Guns share code by **behaviour**; each gun is config data.

| Behaviour | Guns |
|---|---|
| Hitscan, automatic | AK47, Tavor, XM8, Uzi, MP5, TEC9 |
| Hitscan, burst (3-shot) | M16 |
| Hitscan, precision | M14, M93BA, Desert Eagle, Phasr |
| Pellet spread (8 pellets) | Shotgun |
| Rocket projectile + splash | SMAW |
| Grenade projectile + splash | RG6 |
| Stream (ticks + short burn) | Flame |

## Tasks

### 1. Behaviours
- [x] Hitscan automatic (already done for AK47 — generalise) — generic engine, data-driven per weapon
- [x] Burst fire (M16) — 3 rounds consumed and resolved as 3 separate rays per trigger pull, on the same tick (real sub-tick burst timing is a later refinement); a partial burst (magazine runs out mid-burst) fires only the rounds it actually had
- [x] Precision (single shot per fire rate) — same hitscan path as automatic, just the weapon's own slower fire rate
- [x] Pellet spread (Shotgun: 10 × 8, crouch 3 per pellet) — 1 shell consumed, 8 independent rays with small random spread
- [x] Projectiles simulated on the server: SMAW rocket, RG6 grenade, with travel time and wall collision — straight-line flight, no arc (a later-phase refinement); collides with the first wall tile or player hit
- [x] **SMAW:** direct hit **100** (crouch front **70**, back 100); splash **50** (crouch front **40**)
- [x] **RG6:** splash 50 (crouch front 40)
- [x] **Flame:** 4 per tick + short burn (crouch front 3), 100 fuel, very short range — *(resolved: no lingering burn-over-time; implemented as the existing generic hitscan path with Flame's own very-short range/fire-rate/fuel stats, no special-case code needed)*
- [x] Explosions/gas/flame on a crouching player's front → **× 0.8** — SMAW/RG6 already carry their own explicit crouch numbers in `weapons.ts` (not derived from 0.8×, since those differ per weapon); Flame's crouch number is likewise already in config

### 2. Stats from config
- [x] Every gun reads damage, crouch damage, fire rate, magazine, reserve, reload, range, zoom from `weapons.ts`
- [x] "Range" words (Short … Very long) converted to pixel distances in config (`config/weaponRange.ts`) — **tune during build**, per the doc

### 3. Zoom
- [x] Zoom button (top-left) / right click: camera zoom per gun (1x–3x), shows current level (e.g. "1X") — toggles 1x ↔ the currently held gun's own `zoom` stat, re-applied live if you swap guns while zoomed

### 4. Dual wield (firing)
- [x] Dual pair: **both guns fire together**, each uses **its own ammo** → damage doubles (built in Phase 07, verified again here against the full weapon set)
- [x] Gun box shows both guns' ammo — shown separately per gun, not summed

### 5. Self-damage
- [x] Own SMAW, RG6 (and grenades in Phase 09) hurt the shooter **exactly as much** as an opponent — the shooter is a normal splash-radius target; *(bug found and fixed during testing: a projectile spawns at the shooter's own body center, so for some aim angles it could register as a same-tick **direct** hit on themselves before ever traveling anywhere — fixed by excluding the owner from direct-hit eligibility entirely; splash self-damage, which the flow does call for, still works normally)*
- [x] Self-kill → counts as a death, no kill credit (points in Phase 11) — verified via smoke test (SMAW self-kill: 0 kills, 1 death)

### 6. Random spawn pool
- [x] Switch spawn loadout to the **full random pool** of single guns — already true since Phase 06/07 (`randomSpawnLoadout` picks from all 15 `WEAPON_IDS`, not an AK47-only subset); confirmed via smoke-test observation of varied weapons across spawns

## Acceptance criteria
- [x] Every gun matches its config numbers — verified via unit tests (`combat.test.ts`, `raycast.test.ts`, `projectile.test.ts`) plus live smoke tests against a running server (no persistent in-game "damage log" UI was built; ad-hoc scripted verification, per this project's established testing precedent)
- [x] SMAW direct hit kills a standing player; crouching front direct hit = 70 — unit tested in `resolveSplashDamage`'s tests; the direct-hit tier uses `weapons.ts`'s own numbers exactly
- [x] Dual pair doubles damage and uses two ammo pools — verified via smoke test (TEC9+Uzi: exactly 14 damage per trigger pull, both magazines decremented)
- [x] Self-damage and self-kill work — verified via smoke test, including the same-tick self-hit bug found and fixed above

## Open questions (confirm with Dev4)
- ~~**Flame** "short burn": how long does the burn last, and how much per second?~~ Resolved: no lingering burn-over-time status — damage is only the per-tick flame damage while the target is actually standing in the stream.
- ~~**Phasr:** any special behaviour (e.g. passes through players) or a normal long-range precision shot?~~ Resolved: normal hitscan-precision shot (same code path as M14/M93BA/Desert Eagle) with its own stats.
- ~~**Splash radius** sizes for SMAW and RG6?~~ Resolved: medium — SMAW ~3 tiles (96px), RG6 ~2 tiles (64px).
- ~~**RG6:** explode on impact, or bounce with a fuse?~~ Resolved: explodes on first impact (wall or player), no bounce/fuse.
- ~~**Dual pair reload:** reload both together, or one at a time?~~ Resolved: reload together on one shared timer (matches Phase 07's shared dual-slot cooldown/reload clock).

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 09**
