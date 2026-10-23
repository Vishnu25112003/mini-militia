---
phase: 7
title: Combat Core (first gun end-to-end)
status: not-started
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
- [ ] Every spawn: **2 random guns**, one per slot, always **2 different single guns** (never a dual pair) — or the host's default loadout if enabled
- [ ] Every spawn: **2 frag + 2 gas** in the grenade inventory (throwing comes in Phase 09)
- [ ] Slot invariants enforced on the server: never empty, no same gun in both slots
- [ ] For this phase, all random picks resolve to guns whose behaviour is implemented (AK47); the full random pool switches on in Phase 08

### 2. Shooting (AK47, hitscan)
- [ ] Fire input → server checks fire rate (8/sec), magazine (30), reserve (90)
- [ ] **Reload** via reload button / R: 2.0 s, refills magazine from reserve
- [ ] Hit detection on the server with **lag compensation**: rewind other players to where the shooter saw them, then trace the shot against the map and players
- [ ] Damage 14; crouching + front hit → 5; back → full 14
- [ ] Front/back decided from the target's facing direction vs. shot direction

### 3. Health, death, kill credit
- [ ] Health 100; at 0 → dead
- [ ] Kill credited to the shooter; death to the target (points hook ready for Phase 11)
- [ ] Dead character disappears from the map (death scatter of items comes in Phase 10)

### 4. Respawn & spawn shield
- [ ] **5-second** wait, then respawn at a **purely random** spawn point
- [ ] Fresh loadout (random or default)
- [ ] **3-second spawn shield**, visible on the character; blocks damage (melee exception added in Phase 09)

### 5. Weapon swap
- [ ] Tap **gun box** (top-right) / mouse wheel / 1–2 → swap slot 1 ↔ slot 2

### 6. Basic HUD & feedback
- [ ] Health bar (top center-left), gun box with gun name + bullets (magazine / total)
- [ ] Placeholder muzzle flash, tracer line, hit marker, damage flash

## Acceptance criteria
- [ ] Two players on different networks can kill each other with fair-feeling hits at ~100 ms ping
- [ ] Crouch front reduces AK47 damage to 5; back takes 14
- [ ] Respawn after exactly 5 s with a 3 s shield
- [ ] Spawn loadout never has the same gun twice and never a dual pair
- [ ] Modified client can't fire faster than 8/sec or skip reload

## Open questions (confirm with Dev4)
- Does the **spawn shield** block all damage (bullets, explosions, gas, flame) except melee? (Assumed yes — flow only names the melee exception.)

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 08**
