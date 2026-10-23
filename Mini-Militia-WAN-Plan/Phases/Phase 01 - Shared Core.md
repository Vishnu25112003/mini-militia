---
phase: 1
title: Shared Core (Rules, Config, Physics)
status: done
depends_on: [0]
tags: [phase, shared, physics, config]
---

# Phase 01 — Shared Core (Rules, Config, Physics)

← [[Phase 00 - Project Setup]] | Next → [[Phase 02 - Map]]

## Goal
Build the **single source of truth** for the game inside `shared/`: every number from the game flow as config, all core data types, the movement/collision rules, and the pure scoring/ranking functions — all tested **before** any graphics or networking exist.

## Why this phase matters
The server runs the real game and the browser predicts your own movement. Both must calculate **exactly the same way**. Writing these rules once, in `shared/`, and testing them with the flow's own examples prevents the most painful class of multiplayer bugs.

## Flow references
- [[Game Flow#7. Weapons]] (gun + grenade stats, slots, dual pairs)
- [[Game Flow#8. Crouch Shield]]
- [[Game Flow#9. Melee]]
- [[Game Flow#11. Points System]]
- [[Game Flow#12. Leaderboard]] (ranking order)
- [[Game Flow#2. Room & Lobby]] (host settings table, room code format)
- [[Game Flow#17. Player Identity]] (name rules, 8 colors)

## Scope
**In scope:** config files, types, physics module, scoring/ranking functions, unit tests
**Out of scope:** drawing, input, networking, map file (Phase 02)

## Tasks

### 1. Config files (`shared/config/`)
- [x] `weapons.ts` — all **15 guns** exactly as in the flow table: damage, crouch damage, fire rate, magazine, reserve, reload, range, zoom, plus a **behaviour type** field
- [x] SMAW special values: direct hit **100** (crouch front **70**), splash **50** (crouch front **40**)
- [x] `grenades.ts` — Frag, Gas, Proxy: damage, crouch damage (72 / 6 per sec / 72), radius, trigger
- [x] `dualPairs.ts` — exactly the **6 pairs**: TEC9+TEC9, Uzi+Uzi, Desert Eagle+Desert Eagle, TEC9+Uzi, Desert Eagle+TEC9, Desert Eagle+Uzi
- [x] `matchRules.ts`:
  - Health 100
  - Respawn wait **5 s**, spawn shield **3 s**
  - Spawn grenades **2 frag + 2 gas**, grenade carry limit **5**
  - Pickup cycle: visible **60 s**, gap **5 s**
  - Medkit = **full heal**, boost tank = **full refill**
  - Melee clash: first hitter loses **fixed 50**
  - Explosion/gas/flame crouch multiplier **0.8** (front only)
  - Auto-start lobby timer **120 s**
- [x] `hostSettings.ts` — ranges, steps, defaults:

  | Setting | Range | Step | Default |
  |---|---|---|---|
  | Player count | 2–8 | 1 | 8 |
  | Game time | 60–900 s | 30 s | 300 s |
  | Map drops countdown | 5–60 s | 5 s | 15 s |
  | Gravity | 0–100 | 10 | 100 |
  | Boost | 0–100 | 10 | 100 |
  | Default loadout | on/off | — | off |

- [x] `identity.ts` — name rule (letters only, 3–12), 8 player colors, room code rule (6 chars, letters + numbers, excluding 0/O/1/I)
- [x] `movement.ts` — speed, jump, jetpack thrust, fuel capacity, drain/refill rates → **placeholder values, marked "tune during build"**

### 2. Types (`shared/types/`)
- [x] `PlayerInput` (move x, fly, crouch, aim angle, fire, melee, throw, reload, swap, pickup/pair, sequence number)
- [x] `PlayerState` (position, velocity, facing, health, fuel, crouching, slots, grenades, kills, deaths, points, color, name, shield timer, alive)
- [x] `Slot` (single gun **or** dual pair) and `GrenadeInventory`
- [x] `HostSettings`, `PickupItem`, `MatchPhase` (lobby / playing / ended)

### 3. Physics module (`shared/physics/`)
- [x] Fixed timestep **1/30 s** (matches server tick)
- [x] Walking left/right, gravity, landing on tiles
- [x] **Gravity setting:** 100 = normal, 0 = no gravity (floating), linear in between
- [x] **Jetpack** with fuel; **boost setting** 100 = no drain, lower = faster drain, 0 = very fast drain; refill when not flying
- [x] **Crouch:** only when on the ground and pulling down
- [x] Collision: player box vs. tile grid (axis-separated, no tunnelling at high speed)
- [x] Function signature is **pure**: `step(state, input, map, settings) → newState` (no randomness, no clocks)

### 4. Pure game-logic functions (`shared/logic/`)
- [x] `applyDamage(target, amount, source)` with crouch rules: bullets use per-gun crouch value (front only); explosion/gas/flame × 0.8 (front only); back = full
- [x] `isFrontHit(target facing, hit direction)` helper
- [x] `pointsOnKill`, `pointsOnDeath(lifeHadKill)` — +1 per kill, −1 for a death in a zero-kill life, no penalty otherwise, self-kill = death
- [x] `rankPlayers(players)` — kills ↓, points ↓, deaths ↑, full tie = shared rank, next player gets next rank (dense ranking)
- [x] `canPair(slotGun, newGun)`, slot validation (never empty, no same gun across slots)
- [x] `validateName`, `generateRoomCode`

### 5. Unit tests (Vitest)
- [x] Points example from the flow: 3 kills → +3; dies (had kills) → +3; four zero-kill deaths → +2, +1, 0, −1
- [x] Ranking: equal kills → points decide → deaths decide → shared rank, next = 2nd
- [x] Melee clash cases: A(100) first → A at 50; B(30) first → B also dies; scoring Option A
- [x] SMAW: direct 100 / crouch front 70; splash 50 / crouch front 40; back = full
- [x] Physics: falls and lands, can't pass through walls, fuel drains/refills per boost setting, gravity 0 floats
- [x] Slot rules: no same gun in both slots; only the 6 pairs allowed
- [x] Name validation, room code charset

## Deliverables
- `shared/` package with config, types, physics, logic
- Passing test suite

## Acceptance criteria
- [x] Every number in the game flow exists in exactly **one** config file
- [x] All tests pass, including every worked example from the flow
- [x] Physics `step` gives identical results when run twice with the same inputs (deterministic)

## Risks & notes
- Floating-point differences between machines are small in JS (same engine family), but keep physics simple and avoid randomness inside `step`.
- Movement numbers will change a lot in Phase 03 — that's expected.

## Notes / decisions log

**Completed 2026-10-23.** `shared/` now holds `config/`, `types/`, `physics/`, `logic/` and `tests/`. Run the tests with `npm test -w @game/shared` — **107 tests in 8 files, all passing**; typecheck, ESLint and Prettier are clean.

**Where the flow gave no number — placeholders for Dev4 to confirm** (all are single constants, easy to change):
- Explosion falloff ("90 at center, less toward the edge"): linear from 100 % at the centre to **40 %** at the blast radius, 0 beyond (`EDGE_DAMAGE_FACTOR`, to confirm in Phase 09).
- Range words and blast radii converted to pixels (`RANGE_PX`, `RADIUS_PX`, SMAW / RG6 splash radius) — tune in Phases 08 / 16. SMAW and RG6 splash radii are also open questions for Phase 08.
- Movement and jetpack numbers (`config/movement.ts`) — tuned by feel in Phase 03.
- Boost formula: fuel drain per second = capacity × ((100 − boost) / 100). Boost 100 = none, 90 = 10 s of flight, 50 = 2 s, 0 = 1 s ("very fast").

**Flow tables vs. the 0.8 rule.** The crouch values listed in the flow are used exactly: SMAW direct hit **70** (not 0.8 × 100), gas **6** per second and flame **3** per tick (not 6.4 / 3.2). Explosions with no listed value use × 0.8 (SMAW splash 40, frag / proxy 72).

**Added beyond the phase's bullet list** (additive, no rule change): `PlayerInput.switchGrenade` (Q / grenade icon, needed by Phase 09); `PlayerState.onGround`, `flying`, `activeSlot`, `selectedGrenade`, `killsThisLife`, `lastInputSeq`; `emptyInput()` / `createPlayer()` helpers; `clampSetting()` for Phase 06's server validation.

**Physics model.** Position is the **feet** (bottom-centre) so crouching does not move the player. Crouch only on the ground, and a crouched player cannot stand up under a low ceiling. Fall speed is capped at 900 px/s. Gravity 0 adds a little vertical drag so a player *settles* in place instead of drifting forever. Collision sweeps one axis at a time in ≤ 8 px steps, so even absurd velocities cannot tunnel through walls (tested with 3000 random-velocity steps in a closed room).

**Bug found by the tests and fixed:** holding the fly button with an empty tank made the thrust flicker on every other tick, because the tiny air-refill put fuel back above 0. Now the tank only refills once the fly button is released.

**Left to the right phase:** the spawn shield is *not* applied inside `applyDamage` — whether it blocks explosions / gas / flame is an open question for Phase 07. Melee already ignores the crouch shield and always kills.

## Approval gate
- [x] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 02**
