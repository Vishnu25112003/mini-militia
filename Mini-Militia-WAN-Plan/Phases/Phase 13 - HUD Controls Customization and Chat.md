---
phase: 13
title: HUD, Controls Customization & Chat
status: not-started
depends_on: [12]
tags: [phase, hud, controls, chat, ui]
---

# Phase 13 — HUD, Controls Customization & Chat

← [[Phase 12 - Disconnect Reconnect and Late Join]] | Next → [[Phase 14 - Mobile Browser Hardening]]

## Goal
The finished match screen: the full HUD, every control customizable per player, PC key rebinding, and in-match chat.

## Flow references
- [[Game Flow#13. Player Controls]]
- [[Game Flow#12. Leaderboard]] (Controls button)

## Tasks

### 1. Final HUD (default layout)
| Position | Element |
|---|---|
| Top-left | Zoom button (shows level, e.g. 1X) |
| Top center-left | Health bar + boost bar (boost bar **full** when boost = 100) |
| Top center | Match timer |
| Near top center | Chat icon |
| Top-right | Gun box (gun + bullets) — tap = **weapon swap**; grenade icon — tap = **grenade switch** |
| Bottom-left | Movement joystick + grenade throw button |
| Bottom-right | Aim/fire joystick, melee, reload, pickup/pair (when near a gun) |

- [ ] **No pause button**

### 2. Touch customization
- [ ] Edit mode: **drag** to move and **resize** every control (including chat icon and pickup/pair button)
- [ ] **Reset to default layout**
- [ ] Layout saved in browser local storage

### 3. PC key rebinding
- [ ] Rebind any action from the default mapping
- [ ] Prevent two actions on one key
- [ ] Reset to default keys; saved in local storage

### 4. Controls popup access — anytime
- [ ] Lobby: **Gear** button
- [ ] During match: **Controls** button on the live leaderboard; popup persists after the leaderboard hides; match keeps running
- [ ] After match: from the final leaderboard screen

### 5. In-match chat
- [ ] Chat icon opens a small chat popup; match keeps running (player can be killed while typing)
- [ ] Incoming messages appear as a short line at the top and **fade after ~4 s**
- [ ] PC: **Enter** opens chat, Enter sends
- [ ] Names in player colors

## Acceptance criteria
- [ ] Every control movable + resizable; reset works; layout survives page reload
- [ ] PC rebinding works and persists
- [ ] Controls reachable in lobby, during match, after match
- [ ] Chat works in lobby and match; messages fade

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 14**
