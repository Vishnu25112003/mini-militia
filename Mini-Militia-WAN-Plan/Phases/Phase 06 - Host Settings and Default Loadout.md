---
phase: 6
title: Host Settings & Default Loadout
status: not-started
depends_on: [5]
tags: [phase, lobby, settings]
---

# Phase 06 — Host Settings & Default Loadout

← [[Phase 05 - Room and Lobby]] | Next → [[Phase 07 - Combat Core]]

## Goal
The host taps the **map card** → a popup with all 6 match settings → values are validated by the server and actually change how the match plays.

## Flow references
- [[Game Flow#2. Room & Lobby]] (Host settings popup, Default loadout)
- [[Game Flow#3. Spawning]] (default loadout exception)
- [[Game Flow#6. Map Pickups (Guns & Medkits)]] (boost tank hidden at 100)

## Settings (from the flow)
| Setting | Range | Step | Default | Notes |
|---|---|---|---|---|
| Player count | 2–8 | 1 | 8 | Can't go below players already joined |
| Game time | 1:00–15:00 | 30 s (+/−) | 5:00 | |
| Map drops | 5–60 s | 5 s | 15 s | Disappear countdown for dropped/scattered items |
| Gravity | 0–100 | 10 | 100 | 100 = normal, 0 = no gravity (floating) |
| Boost | 0–100 | 10 | 100 | 100 = no drain; lower drains + refills; 0 = very fast drain |
| Default loadout | on/off | — | off | Same chosen guns for everyone at every spawn |

## Tasks

### 1. Popup UI (React)
- [ ] Only the **host** can open it by tapping the map card
- [ ] Each numeric setting: − / + buttons with the exact step, current value shown
- [ ] Player count − button disabled at the number of players already joined
- [ ] Map card updates live for everyone (players joined / room size, game time)

### 2. Server validation
- [ ] Server clamps every value to range and step; rejects changes from non-hosts
- [ ] Settings locked once the match starts

### 3. Apply settings in the match
- [ ] Gravity and boost passed into shared `physics.step`
- [ ] **Boost = 100:** no drain, **boost bar stays full**, boost tanks **excluded** from pickups (used in Phase 10)
- [ ] Game time used by the match timer (Phase 11)
- [ ] Map drops countdown stored for drops/scatter (Phase 10)
- [ ] Player count = room size (join limit, late join limit)

### 4. Default loadout picker
- [ ] Toggle on → shows all gun combinations for **slot 1 + slot 2**
- [ ] Host **can** pick a **dual pair** (one of the 6) as one slot
- [ ] Picker enforces slot rules: two different guns across slots; dual pair counts as one slot
- [ ] When on: every player gets that exact loadout at **every spawn and respawn**, plus **2 frag + 2 gas**
- [ ] Map pickups stay **normal and random**

## Acceptance criteria
- [ ] Every setting changes within range/step only; non-host can't change anything
- [ ] Gravity 0 and boost 0/100 behave as the flow says in a real match
- [ ] Default loadout gives everyone the same guns on every spawn; pickups still random

## Open questions (confirm with Dev4)
- Should non-host players be able to **view** (read-only) the full settings, or only what the map card shows?

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 07**
