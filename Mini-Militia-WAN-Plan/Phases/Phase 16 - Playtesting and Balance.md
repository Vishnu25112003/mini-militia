---
phase: 16
title: Playtesting & Balance
status: not-started
depends_on: [15]
tags: [phase, testing, balance]
---

# Phase 16 — Playtesting & Balance

← [[Phase 15 - Real Art and Sound]] | Next → [[Phase 17 - Production Deployment]]

## Goal
Play real matches with friends on real networks, check every rule in the game flow, fix bugs, and tune the numbers.

## Flow references
- [[Game Flow]] — every section

## Tasks

### 1. Rule checklist (one real match per group)
- [ ] Lobby: code share, duplicate names, auto-start 2:00, host remove, host cancel
- [ ] Host settings: all 6, including default loadout and gravity/boost extremes
- [ ] Spawning: random place, 2 different guns, 2+2 grenades, 5 s wait, 3 s shield
- [ ] Every gun, every grenade, crouch front/back, SMAW direct/splash
- [ ] Melee + clash cases
- [ ] Pickups cycle, pair button cases, breaking pairs, drops, scatter, disappear countdown
- [ ] Points and ranking ties
- [ ] Reconnect, late join, host leaves mid-match
- [ ] Controls customization, rebinding, chat

### 2. Network tests
- [ ] 8 players, mixed Wi-Fi and 4G, different cities if possible
- [ ] Record ping and any rubber-banding complaints
- [ ] **Load test:** several rooms at once on the server (bots/scripts) → check CPU and memory

### 3. Balance
- [ ] Track which guns get the most kills; adjust stats in `weapons.ts` (**with Dev4 approval**)
- [ ] Tune movement, range distances, splash radii, map spacing if needed

### 4. Bug tracking
- [ ] One list (GitHub Issues or an Obsidian note): bug, steps, severity, fixed?

## Acceptance criteria
- [ ] Every checklist item passes
- [ ] No known critical bugs
- [ ] Friends agree matches feel fair and smooth

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 17**
