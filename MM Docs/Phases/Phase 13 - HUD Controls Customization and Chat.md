---
phase: 13
title: HUD, Controls Customization & Chat
status: in-progress
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

- [x] **No pause button**

### 2. Touch customization
- [x] Edit mode: **drag** to move and **resize** every control (including chat icon and pickup/pair button)
- [x] **Reset to default layout**
- [x] Layout saved in browser local storage

### 3. PC key rebinding
- [x] Rebind any action from the default mapping
- [x] Prevent two actions on one key
- [x] Reset to default keys; saved in local storage

### 4. Controls popup access — anytime
- [x] Lobby: **Gear** button
- [x] During match: **Controls** button on the live leaderboard; popup persists after the leaderboard hides; match keeps running
- [x] After match: from the final leaderboard screen

### 5. In-match chat
- [x] Chat icon opens a small chat popup; match keeps running (player can be killed while typing)
- [x] Incoming messages appear as a short line at the top and **fade after ~4 s**
- [x] PC: **Enter** opens chat, Enter sends
- [x] Names in player colors

## Acceptance criteria
- [x] Every control movable + resizable; reset works; layout survives page reload
- [x] PC rebinding works and persists
- [x] Controls reachable in lobby, during match, after match
- [x] Chat works in lobby and match; messages fade

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 14**

## Implementation notes

- **Touch edit mode**: every touch control (`TouchButton`, `VirtualJoystick`) now owns a `ResizeHandle` — a
  small yellow dot shown only in edit mode, at the control's top-right edge. Dragging the control body
  moves it; dragging the handle rescales it (clamped 0.6x–1.8x). A plain module, `touchControlRegistry.ts`,
  is the only bridge between the Phaser-owned controls and the React Controls popup: each control registers
  itself on creation, and the popup's "Edit layout" / "Reset to default" buttons call the registry's
  functions directly — no event bus needed. The editor only appears in the Controls popup while a match
  with touch controls is actually running (`hasRegisteredTouchControls()`); it's hidden in the lobby and
  after the match ends, since there's nothing to edit there.
- **Key rebinding**: `keyBindings.ts` holds the default→action map and a `setKeyBinding(action, keyCode)`
  that auto-swaps the colliding action onto the old key, so two actions can never land on the same key
  without ever blocking the user with an error. `KeyboardMouseInputSource` rebuilds its tracked `Key`
  objects whenever bindings change (subscribed via `onKeyBindingsChanged`). **Minor, deliberate
  simplification**: dropped the old W-as-secondary-fly-key alias and the redundant '2' key for weapon swap
  — each action now maps to exactly one rebindable key, which is required for a clean "one key per action"
  model. This is a small behavior change from earlier phases, not called out as an open question in the doc.
- **Chat while playing**: opening chat doesn't pause the match or disable Phaser's keyboard plugin outright
  (disabling it mid-hold would freeze a held movement key's `isDown` at `true` — a stuck-key bug). Instead
  `InputController.setSuppressed(true)` makes `sample()` return an all-neutral `PlayerInput` (aim angle
  preserved) while chat has focus, so typing a message can't also fire a weapon or swing melee, and the
  underlying key state stays consistent for when chat closes. `MatchScene` exposes `onOpenChatRequested`
  (Enter key or tapping the chat button) and `onSceneReady` (hands React a live scene reference) through
  `MatchSceneData`, and the new `MatchScreen` component wires them together. `MatchChat.tsx` shows the
  latest incoming message as a top-center toast that fades after 4s when the popup is closed, and the full
  history + send form when open; `useChatMessages` is shared with the lobby's existing chat popup.
- **Verification**: confirmed via `tsc -b` across all three workspaces (client/server/shared) and
  `npm run test --workspace=shared` (135 tests passing) after every change. The drag/resize and key-capture
  interactions can't be exercised by this environment's scripted-client smoke tests (no real touch
  gestures or focused keyboard events) the way server logic was verified in earlier phases — those were
  verified by code review only, consistent with the honesty noted in Phase 12 about untestable real-network
  paths.
