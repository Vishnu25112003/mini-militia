---
phase: 9
title: Grenades & Melee
status: not-started
depends_on: [8]
tags: [phase, grenades, melee, combat]
---

# Phase 09 — Grenades & Melee

← [[Phase 08 - Full Weapon Set]] | Next → [[Phase 10 - Pickups Slots and Drops]]

## Goal
All three grenades and the melee system, including the melee clash rule decided by the server.

## Flow references
- [[Game Flow#7. Weapons]] (grenades, grenade stats, self-damage)
- [[Game Flow#8. Crouch Shield]]
- [[Game Flow#9. Melee]]
- [[Game Flow#11. Points System]] (clash scoring)

## Tasks

### 1. Grenade inventory
- [ ] Max **5** grenades total, any mix
- [ ] Spawn with **2 frag + 2 gas**; proxies only from pickups
- [ ] **Grenade switch:** tap grenade icon in the gun box / Q → frag → gas → proxy (skip types with 0)
- [ ] Grenade button shows count of the selected type

### 2. Throwing
- [ ] Grenade button / G → throw toward the aim direction
- [ ] Grenades simulated on the server (arc, bounce on walls)

### 3. Grenade effects
| Grenade | Behaviour | Damage | Crouch front |
|---|---|---|---|
| Frag | 3 s fuse, explosion | 90 at center, less toward edge | 72 at center |
| Gas | Cloud on landing, 5 s | 8 / sec | 6 / sec |
| Proxy | Arms after 1 s; explodes when an enemy comes close | 90 at center, less toward edge | 72 at center |

- [ ] **Self-damage** applies (same as opponent)
- [ ] Self-kill → death, no kill credit

### 4. Melee
- [ ] Melee button / V
- [ ] **One hit always kills** — ignores health, **crouch shield**, and **spawn shield**

### 5. Melee clash (server decides)
- [ ] Clash = both players meleeing each other
- [ ] **First hitter** (by server time) gets the kill and loses a **fixed 50 health**
- [ ] If the first hitter has **≤ 50 health**, they **also die**
- [ ] Scoring (Option A): first hitter +1 kill +1 death; other player +1 death
- [ ] Points: first hitter's death has **no −1** (had a kill that life); other player −1 only if zero kills that life

## Acceptance criteria
- [ ] Carry limit 5 enforced; spawn gives 2+2
- [ ] Each grenade matches its table values, including crouch front values
- [ ] Melee kills through crouch and spawn shields
- [ ] Clash examples from the flow pass: A(100) first → A at 50; B(30) first → B gets kill and dies

## Open questions (confirm with Dev4)
- **Melee range** (how close) and **cooldown** between punches?
- **Clash window:** how close in time must two melees be to count as a clash? (e.g. within 0.3 s)
- **Throw strength:** fixed, or depends on how far the aim joystick is pushed?
- Can a player's **own proxy** trigger on themselves, or only on enemies?
- Does **gas** from two grenades stack?

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 10**
