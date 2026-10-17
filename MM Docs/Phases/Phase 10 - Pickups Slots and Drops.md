---
phase: 10
title: Pickups, Slots & Drops
status: in-progress
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
- [x] 14 spots from the map file
- [x] Each refresh: every spot gets a random item — gun, medkit, grenade pair (2 frag / 2 gas / 2 proxy), or boost tank — *(the flow doesn't specify weighting; implemented as uniform-random over the available categories, then uniform within it — tune during build)*
- [x] **Boost = 100** → boost tanks excluded
- [x] Cycle: visible **60 s** → **all disappear** → **5 s** gap → fresh random set at **all** spots
- [x] A taken spot **stays empty** until the next cycle

### 2. Non-gun pickups
- [x] **Medkit:** instant **full heal to 100** — a no-op (not consumed) at full health, per Dev4
- [x] **Boost tank:** **full boost refill** — same no-op-at-full rule, symmetric with the medkit
- [x] **Grenade pair:** adds 2; at 4 grenades → takes 1, the other stays; at 5 → can't pick up

### 3. Gun pickup button logic (from the flow)
| Situation | Button shown | Result |
|---|---|---|
| Pairing possible with active slot | **Pair** | Forms dual pair in that slot |
| Pairing not possible | **Gun icon** | New gun replaces the current gun; old gun **drops** |
| Already own that gun — dual gun | **Pair** only | Pair |
| Already own that gun — non-dual | Nothing | Can't pick up |

- [x] Changing a dual-pair slot to another pairable gun → player chooses **which of the 2 guns** to replace — server fully supports this (`replaceSlotChoice`); client only has a minimal affordance for it so far (see Implementation notes)
- [x] **Breaking a pair:** non-pairable gun into a pair slot → new gun takes the slot, **both pair guns drop**
- [x] Slot invariants always hold (never empty, no same gun across slots, only the 6 pairs) — enforced structurally by `applyGunPickup`, unit tested

### 4. Drops & death scatter
- [x] Replaced guns **drop** at the player's position
- [x] On death: all guns **and** grenades **scatter slowly through the air** onto the map — *(simplified: dropped at the death position with a small random offset, no actual arc/throw animation — consistent with this build's other "no arc" simplifications, e.g. RG6/SMAW projectiles)*
- [x] Any player can pick up dropped/scattered items — same unified ground-item system as map pickups, no special-casing
- [x] Items **disappear** after the host's **map drops** countdown

### 5. Conflicts
- [x] Two players grabbing the same item → server gives it to whoever reached it first; the other client corrects itself — guaranteed by construction: all pickups are resolved server-side against one shared, single-threaded-per-tick map of ground items, so whichever player's turn removes the item first wins; the loser's own schema sync reflects the item's removal on the very next patch

## Implementation notes
- **Pickup/Pair "which gun to replace" choice:** the server fully supports choosing which of a dual pair's two guns to swap out (`replaceSlotChoice: 0 | 1` on the input). The desktop client exposes it minimally — hold Shift while pressing E to choose the 2nd gun instead of the 1st — rather than a proper two-button chooser popup; touch has no equivalent yet (always swaps the 1st). Worth a follow-up pass before this feels finished on touch.
- **Auto-pickup radius (32px)** and **gun pickup/pair range (40px)** aren't given exact numbers by the flow — chosen to feel like "walk over it" vs. "stand near it," tune during playtesting.

## Acceptance criteria
- [x] Refresh cycle timing exact (60 s + 5 s), taken spots stay empty — verified live (14 items spawn immediately; a taken spot's item doesn't return until the next full cycle, by construction)
- [x] All button cases in the table behave correctly, including the Uzi+Uzi → AK47 example (both Uzis drop) — unit tested (`pickups.test.ts`) and verified live (replace, pair, and chooseReplace all confirmed against a running server)
- [x] Grenade pair at 4 → takes 1, leaves 1 — unit tested
- [x] Scatter on death; disappear after host countdown — wired into every death path (hitscan/explosion/gas/melee/clash kills all route through the same scatter call)
- [x] No duplicated items when two players grab at once — guaranteed by the single-threaded per-tick resolution described above (not separately load-tested with real concurrent clients, but the mechanism admits no race)

## Open questions (confirm with Dev4)
- ~~**Pickup distance:** how close must a player be for the button to appear?~~ Resolved: short range, ~40px (same ballpark as melee range).
- ~~Are **medkits, grenades, and boost tanks** picked up **automatically** by walking over them, or with the pickup button?~~ Resolved: automatic on walk-over — only guns use the Pickup/Pair button, since only guns involve a replace/pair decision.
- ~~Does a picked-up / dropped gun keep its **remaining ammo**, or come with full ammo?~~ Resolved: full ammo on pickup, always — map spawns and dropped guns alike.
- ~~Is a medkit picked up when the player is **already at 100** health?~~ Resolved: no — it has no effect and isn't consumed; it stays on the map for someone who needs it.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 11**
