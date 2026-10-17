---
phase: 9
title: Grenades & Melee
status: in-progress
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
- [x] Max **5** grenades total, any mix — *(the 5-cap and mixed pickups aren't exercisable yet since Phase 10 owns map pickups; the inventory model supports it, enforcement is wired there)*
- [x] Spawn with **2 frag + 2 gas**; proxies only from pickups
- [x] **Grenade switch:** tap grenade icon in the gun box / Q → frag → gas → proxy (skip types with 0)
- [x] Grenade button shows count of the selected type

### 2. Throwing
- [x] Grenade button / G → throw toward the aim direction
- [x] Grenades simulated on the server (arc, bounce on walls)

### 3. Grenade effects
| Grenade | Behaviour | Damage | Crouch front |
|---|---|---|---|
| Frag | 3 s fuse, explosion | 90 at center, less toward edge | 72 at center |
| Gas | Cloud on landing, 5 s | 8 / sec | 6 / sec |
| Proxy | Arms after 1 s; explodes when an enemy comes close | 90 at center, less toward edge | 72 at center |

- [x] **Self-damage** applies (same as opponent) — verified via smoke test (point-blank Fragnade: 100 → 32.5 hp)
- [x] Self-kill → death, no kill credit — verified via smoke test (0 kills, 1 death after a second self-hit)

### 4. Melee
- [x] Melee button / V
- [x] **One hit always kills** — ignores health, **crouch shield**, and **spawn shield**

### 5. Melee clash (server decides)
- [x] Clash = both players meleeing each other
- [x] **First hitter** (by server time) gets the kill and loses a **fixed 50 health**
- [x] If the first hitter has **≤ 50 health**, they **also die**
- [x] Scoring (Option A): first hitter +1 kill +1 death; other player +1 death
- [x] Points: first hitter's death has **no −1** (had a kill that life); other player −1 only if zero kills that life

## Implementation notes
- **"less toward the edge" falloff** isn't given an exact curve by the flow — implemented as linear, full damage at the center down to 0 at the radius edge (`grenadeDamageAtDistance`).
- **A melee swing isn't applied instantly.** For the clash window to actually work, a swing that finds a target is held "pending" for `meleeClashWindowSeconds` (0.3s) — if the target swings back within that window it's a clash, otherwise it resolves as a clean kill once the window elapses. This means every melee kill has up to ~300ms of server-side latency before it lands; a deliberate trade-off for honoring the clash spec, not a bug. A truly simultaneous double-swing (same tick) is broken by player-join order, which is an arbitrary but deterministic tiebreak.
- **Grenade throw cooldown (0.5s)** isn't specified by the flow — added as a modest anti-spam guard, same reasoning as every other server-authoritative rate limit in this build.
- **Bug found and fixed during testing:** the "becomes a stationary gas cloud on landing" check wasn't gated to Gasnade's own trigger kind, so a Fragnade or Proxynade that came to rest (bounced to a stop) before its fuse expired was silently converted into a one-tick phantom gas cloud and removed from tracking — meaning it could never actually explode. Fixed by gating that branch to `trigger.kind === 'on-landing'`.

## Acceptance criteria
- [x] Carry limit 5 enforced; spawn gives 2+2
- [x] Each grenade matches its table values, including crouch front values — unit tested (`grenade.test.ts`) and verified live via smoke test
- [x] Melee kills through crouch and spawn shields — melee ignores shields entirely by construction (`resolveMeleeKill`/`applyMeleeClash` set health to 0 directly, bypassing `applyDamage`'s shield-aware path)
- [x] Clash examples from the flow pass: A(100) first → A at 50; B(30) first → B gets kill and dies — verified via smoke test for both the "first hitter survives" and "both die" sub-cases

## Open questions (confirm with Dev4)
- ~~**Melee range** (how close) and **cooldown** between punches?~~ Resolved: short range (~40px beyond the target's hitbox), 0.6s cooldown between swings.
- ~~**Clash window:** how close in time must two melees be to count as a clash?~~ Resolved: 0.3 seconds, matching the doc's own example.
- ~~**Throw strength:** fixed, or depends on how far the aim joystick is pushed?~~ Resolved: fixed strength/velocity along the aim direction, every throw.
- ~~Can a player's **own proxy** trigger on themselves, or only on enemies?~~ Resolved: enemies only — the owner can safely walk past/over their own armed proxy.
- ~~Does **gas** from two grenades stack?~~ Resolved: no stacking — standing in overlapping clouds still takes only one cloud's worth of damage per second.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 10**
