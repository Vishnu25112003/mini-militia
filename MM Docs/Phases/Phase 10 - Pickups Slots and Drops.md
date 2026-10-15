---
phase: 10
title: Pickups, Slots & Drops
status: not-started
depends_on: [9]
tags: [phase, pickups, slots, drops]
---

# Phase 10 — Pickups, Slots & Drops

← [[Phase 09 - Grenades and Melee]] | Next → [[Phase 11 - Scoring Timer and Leaderboard]]

## Goal
The full item economy: the 14 pickup spots and their refresh cycle, the Pickup/Pair button logic, slot and pair rules, dropped guns, and death scatter — with the server resolving every conflict.

## Flow references
- [[Game Flow#6. Map Pickups (Guns & Medkits)]]
- [[Game Flow#7. Weapons]] (slots, dual pairs, picking up guns, dropped items & death scatter)
- [[Game Flow#10. Health & Medkits]]

## Tasks

### 1. Pickup spots & refresh cycle (server)
- [ ] 14 spots from the map file
- [ ] Each refresh: every spot gets a random item — gun, medkit, grenade pair (2 frag / 2 gas / 2 proxy), or boost tank
- [ ] **Boost = 100** → boost tanks excluded
- [ ] Cycle: visible **60 s** → **all disappear** → **5 s** gap → fresh random set at **all** spots
- [ ] A taken spot **stays empty** until the next cycle

### 2. Non-gun pickups
- [ ] **Medkit:** instant **full heal to 100**
- [ ] **Boost tank:** **full boost refill**
- [ ] **Grenade pair:** adds 2; at 4 grenades → takes 1, the other stays; at 5 → can't pick up

### 3. Gun pickup button logic (from the flow)
| Situation | Button shown | Result |
|---|---|---|
| Pairing possible with active slot | **Pair** | Forms dual pair in that slot |
| Pairing not possible | **Gun icon** | New gun replaces the current gun; old gun **drops** |
| Already own that gun — dual gun | **Pair** only | Pair |
| Already own that gun — non-dual | Nothing | Can't pick up |

- [ ] Changing a dual-pair slot to another pairable gun → player chooses **which of the 2 guns** to replace
- [ ] **Breaking a pair:** non-pairable gun into a pair slot → new gun takes the slot, **both pair guns drop**
- [ ] Slot invariants always hold (never empty, no same gun across slots, only the 6 pairs)

### 4. Drops & death scatter
- [ ] Replaced guns **drop** at the player's position
- [ ] On death: all guns **and** grenades **scatter slowly through the air** onto the map
- [ ] Any player can pick up dropped/scattered items
- [ ] Items **disappear** after the host's **map drops** countdown

### 5. Conflicts
- [ ] Two players grabbing the same item → server gives it to whoever reached it first; the other client corrects itself

## Acceptance criteria
- [ ] Refresh cycle timing exact (60 s + 5 s), taken spots stay empty
- [ ] All button cases in the table behave correctly, including the Uzi+Uzi → AK47 example (both Uzis drop)
- [ ] Grenade pair at 4 → takes 1, leaves 1
- [ ] Scatter on death; disappear after host countdown
- [ ] No duplicated items when two players grab at once

## Open questions (confirm with Dev4)
- **Pickup distance:** how close must a player be for the button to appear?
- Are **medkits, grenades, and boost tanks** picked up **automatically** by walking over them, or with the pickup button?
- Does a picked-up / dropped gun keep its **remaining ammo**, or come with full ammo?
- Is a medkit picked up when the player is **already at 100** health?

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 11**
