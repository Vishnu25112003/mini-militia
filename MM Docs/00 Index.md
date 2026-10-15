---
title: Project Index — Mini Militia-Style WAN Friends Play (v1)
tags: [index, moc]
---

# Mini Militia-Style WAN Friends Play — v1 Plan

Own 2D jetpack shooter that plays like Mini Militia Classic, with **friends play over the internet**, in the **browser**, on one **Catacombs-style** map, for up to **8 players**.

## Key documents
- [[Game Flow]] — the **source of truth** for every rule and decision
- [[Open Questions]] — small details still to confirm, grouped by phase

## How to use this plan
1. Work on **one phase at a time**, in order.
2. Inside each phase: tick tasks → check acceptance criteria → resolve that phase's open questions **before** building them.
3. Each phase ends with an **approval gate**: no next phase without **Dev4's approval**.
4. Any change to game rules goes into [[Game Flow]] first (proposed, then approved by Dev4), then into the phase files.
5. Update the `status` in each phase file: `not-started` → `in-progress` → `done`.

## Tech stack (summary)
| Part | Choice |
|---|---|
| Match screen | Phaser (drawing + input) |
| Menus | React |
| Language / build | TypeScript + Vite |
| Server | Colyseus (Node.js), WebSocket, 30 Hz tick, 20 Hz snapshots |
| Shared | movement/collision rules, stats, rules, map JSON |
| Map | Tiled, 32 px tiles, ~100 × 60 |
| Hosting | Testing: Vercel + testing VPS → Final: VPS |
| Storage | No database — browser local storage (name, reconnect token, controls) |
| Mobile orientation | Landscape only (portrait → rotate message) |

## Phases
| # | Phase | Main outcome | Status |
|---|---|---|---|
| 00 | [[Phase 00 - Project Setup]] | Client + server + shared connected, deployed to Vercel + VPS | 🟨 (local done, deploy pending) |
| 01 | [[Phase 01 - Shared Core]] | All rules, stats, physics, scoring as tested shared code | ✅ (awaiting Dev4 approval) |
| 02 | [[Phase 02 - Map]] | Original Catacombs-style map in Tiled, validated | 🟨 (done; needs Dev4 visual check) |
| 03 | [[Phase 03 - Local Movement Sandbox]] | Movement, jetpack, crouch, touch + PC controls (offline) | ⬜ |
| 04 | [[Phase 04 - Networking Foundation]] | 8 players in sync over the internet | ⬜ |
| 05 | [[Phase 05 - Room and Lobby]] | Names, room codes, lobby, start / auto-start, lobby chat | ⬜ |
| 06 | [[Phase 06 - Host Settings and Default Loadout]] | 6 host settings working | ⬜ |
| 07 | [[Phase 07 - Combat Core]] | Shoot, damage, death, respawn with one gun | ⬜ |
| 08 | [[Phase 08 - Full Weapon Set]] | All 15 guns, zoom, dual wield, self-damage | ⬜ |
| 09 | [[Phase 09 - Grenades and Melee]] | 3 grenades, melee, melee clash | ⬜ |
| 10 | [[Phase 10 - Pickups Slots and Drops]] | Pickup cycle, pair logic, drops, death scatter | ⬜ |
| 11 | [[Phase 11 - Scoring Timer and Leaderboard]] | Points, timer, live + final leaderboard | ⬜ |
| 12 | [[Phase 12 - Disconnect Reconnect and Late Join]] | Reconnect, late join, host leaving | ⬜ |
| 13 | [[Phase 13 - HUD Controls Customization and Chat]] | Full HUD, customization, rebinding, in-match chat | ⬜ |
| 14 | [[Phase 14 - Mobile Browser Hardening]] | Landscape, PWA, gestures, sound, performance | ⬜ |
| 15 | [[Phase 15 - Real Art and Sound]] | Original art and sound replace placeholders | ⬜ |
| 16 | [[Phase 16 - Playtesting and Balance]] | Every rule verified with friends, balance tuned | ⬜ |
| 17 | [[Phase 17 - Production Deployment]] | Live on the final VPS | ⬜ |

## Build order logic
```
00 Setup → 01 Shared Core → 02 Map → 03 Movement (offline)
  → 04 Networking → 05 Lobby → 06 Host Settings
  → 07 Combat Core → 08 Weapons → 09 Grenades/Melee → 10 Pickups/Drops
  → 11 Scoring/Leaderboard → 12 Reconnect/Late Join → 13 HUD/Controls/Chat
  → 14 Mobile Hardening → 15 Art/Sound → 16 Playtesting → 17 Production
```
- **Gameplay before polish:** everything is built on placeholder art (Phase 15 swaps it).
- **One gun first** (Phase 07), then the rest as configuration (Phase 08).
- **Networking early** (Phase 04) so every gameplay feature is built multiplayer from day one.

## Folder structure
```
00 Index.md
Game Flow.md
Open Questions.md
Phases/
  Phase 00 … Phase 17
```
