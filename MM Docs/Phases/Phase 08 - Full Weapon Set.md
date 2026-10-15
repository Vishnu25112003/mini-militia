---
phase: 8
title: Full Weapon Set
status: not-started
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
- [ ] Hitscan automatic (already done for AK47 — generalise)
- [ ] Burst fire (M16)
- [ ] Precision (single shot per fire rate)
- [ ] Pellet spread (Shotgun: 10 × 8, crouch 3 per pellet)
- [ ] Projectiles simulated on the server: SMAW rocket, RG6 grenade, with travel time and wall collision
- [ ] **SMAW:** direct hit **100** (crouch front **70**, back 100); splash **50** (crouch front **40**)
- [ ] **RG6:** splash 50 (crouch front 40)
- [ ] **Flame:** 4 per tick + short burn (crouch front 3), 100 fuel, very short range
- [ ] Explosions/gas/flame on a crouching player's front → **× 0.8**

### 2. Stats from config
- [ ] Every gun reads damage, crouch damage, fire rate, magazine, reserve, reload, range, zoom from `weapons.ts`
- [ ] "Range" words (Short … Very long) converted to pixel distances in config — **tune during build**

### 3. Zoom
- [ ] Zoom button (top-left) / right click: camera zoom per gun (1x–3x), shows current level (e.g. "1X")

### 4. Dual wield (firing)
- [ ] Dual pair: **both guns fire together**, each uses **its own ammo** → damage doubles
- [ ] Gun box shows both guns' ammo

### 5. Self-damage
- [ ] Own SMAW, RG6 (and grenades in Phase 09) hurt the shooter **exactly as much** as an opponent
- [ ] Self-kill → counts as a death, no kill credit (points in Phase 11)

### 6. Random spawn pool
- [ ] Switch spawn loadout to the **full random pool** of single guns

## Acceptance criteria
- [ ] Every gun matches its config numbers (check with a debug "damage log")
- [ ] SMAW direct hit kills a standing player; crouching front direct hit = 70
- [ ] Dual pair doubles damage and uses two ammo pools
- [ ] Self-damage and self-kill work

## Open questions (confirm with Dev4)
- **Flame** "short burn": how long does the burn last, and how much per second?
- **Phasr:** any special behaviour (e.g. passes through players) or a normal long-range precision shot?
- **Splash radius** sizes for SMAW and RG6?
- **RG6:** explode on impact, or bounce with a fuse?
- **Dual pair reload:** reload both together, or one at a time?

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 09**
