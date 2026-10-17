---
phase: 7
title: Combat Core (first gun end-to-end)
status: in-progress
depends_on: [6]
tags: [phase, combat, server, lag-compensation]
---

# Phase 07 — Combat Core (first gun end-to-end)

← [[Phase 06 - Host Settings and Default Loadout]] | Next → [[Phase 08 - Full Weapon Set]]

## Goal
The complete life cycle with **one gun (AK47)**: spawn with a loadout → shoot → hit (with lag compensation) → damage with crouch shield → death → kill credit → 5-second wait → respawn with spawn shield. Once this loop is solid, the other 14 guns are mostly configuration.

## Flow references
- [[Game Flow#3. Spawning]]
- [[Game Flow#7. Weapons]] (gun slots, AK47 stats)
- [[Game Flow#8. Crouch Shield]]
- [[Game Flow#10. Health & Medkits]]

## Tasks

### 1. Loadout & slots
- [x] Every spawn: **2 random guns**, one per slot, always **2 different single guns** (never a dual pair) — or the host's default loadout if enabled
- [x] Every spawn: **2 frag + 2 gas** in the grenade inventory (throwing comes in Phase 09)
- [x] Slot invariants enforced on the server: never empty, no same gun in both slots
- [x] For this phase, all random picks resolve to guns whose behaviour is implemented (AK47); the full random pool switches on in Phase 08 — *(decision: implemented a generic per-weapon hitscan engine driven by each gun's own stats (damage/fireRate/magazine/reload), rather than special-casing AK47. This fully and correctly implements every hitscan-behaviour gun today; burst/pellet/splash/flame/laser behaviours fire as a plain single hitscan shot for now and get their real behaviour in Phase 08, so a random non-AK47 pick is never broken, just not yet special-cased.)*

### 2. Shooting (AK47, hitscan)
- [x] Fire input → server checks fire rate (8/sec), magazine (30), reserve (90) — generalized per-weapon, verified for AK47 and several others via smoke test
- [x] **Reload** via reload button / R: 2.0 s, refills magazine from reserve
- [x] Hit detection on the server with **lag compensation**: rewind other players to where the shooter saw them, then trace the shot against the map and players
- [x] Damage 14; crouching + front hit → 5; back → full 14
- [x] Front/back decided from the target's facing direction vs. shot direction

### 3. Health, death, kill credit
- [x] Health 100; at 0 → dead
- [x] Kill credited to the shooter; death to the target (points hook ready for Phase 11)
- [x] Dead character disappears from the map (death scatter of items comes in Phase 10) — client hides the player view when `alive: false`; actual item scatter is Phase 10's job

### 4. Respawn & spawn shield
- [x] **5-second** wait, then respawn at a **purely random** spawn point
- [x] Fresh loadout (random or default)
- [x] **3-second spawn shield**, visible on the character; blocks damage (melee exception added in Phase 09)

### 5. Weapon swap
- [x] Tap **gun box** (top-right) / mouse wheel / 1–2 → swap slot 1 ↔ slot 2

### 6. Basic HUD & feedback
- [x] Health bar (top center-left), gun box with gun name + bullets (magazine / total)
- [x] Placeholder muzzle flash, tracer line, hit marker, damage flash

## Acceptance criteria
- [ ] Two players on different networks can kill each other with fair-feeling hits at ~100 ms ping — *needs a real two-client playtest; verified locally end-to-end (hit detection, damage, kill credit, respawn) via a scripted smoke test, but real-network feel can't be scripted*
- [x] Crouch front reduces AK47 damage to 5; back takes 14 (shared `damage.ts`, unit tested)
- [x] Respawn after exactly 5 s with a 3 s shield (verified via smoke test)
- [x] Spawn loadout never has the same gun twice and never a dual pair
- [x] Modified client can't fire faster than 8/sec or skip reload (server-side cooldown/ammo gate, verified via smoke test with exact shot-count math)

## Open questions (confirm with Dev4)
- ~~Does the **spawn shield** block all damage (bullets, explosions, gas, flame) except melee?~~ Resolved: yes, blocks everything except melee.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 08**
