---
phase: 14
title: Mobile Browser Hardening
status: not-started
depends_on: [13]
tags: [phase, mobile, pwa, performance]
---

# Phase 14 — Mobile Browser Hardening

← [[Phase 13 - HUD Controls Customization and Chat]] | Next → [[Phase 15 - Real Art and Sound]]

## Goal
Make the web game behave like a real mobile game: landscape, as close to fullscreen as browsers allow, no accidental browser gestures, sound working, and smooth performance on mid-range phones.

## Flow references
- [[Game Flow#1. Scope (v1)]] (web-based, touch + keyboard/mouse)
- Platform discussion: the web-version limitations and workarounds

## Tasks

### 1. Orientation & screen
- [ ] Verify the **landscape-only rule** (built in Phase 03) on every screen and popup, every device in the matrix
- [ ] Android Chrome: when fullscreen, also **lock orientation to landscape** where the browser allows it
- [ ] Rotating mid-match: message shows, match keeps running, controls work again instantly after rotating back
- [ ] Fullscreen request on supported browsers (Android Chrome)
- [ ] **PWA manifest** + icons → "Add to Home Screen" opens without browser bars (important for iPhone)
- [ ] Safe-area handling (notches)

### 2. Block accidental gestures
- [ ] Disable pull-to-refresh, double-tap zoom, pinch zoom, long-press menus, text selection on the game screen
- [ ] Reduce accidental swipe-back where possible

### 3. Sound unlock
- [ ] Browsers block audio until a tap → unlock audio on the lobby **Start** tap

### 4. Background & focus
- [ ] Tab hidden / app switched → handled by Phase 12 reconnect; verify no stuck states

### 5. Performance
- [ ] Target **60 fps** on a mid-range Android phone with 8 players
- [ ] Object pooling for bullets/effects; texture atlas
- [ ] Measure download size; keep first load small for 4G

### 6. Device test matrix
| Device / browser | Result |
|---|---|
| Android — Chrome | |
| Android — other browser | |
| iPhone — Safari | |
| iPhone — home-screen (PWA) | |
| PC — Chrome / Edge / Firefox | |

## Acceptance criteria
- [ ] Portrait shows the rotate message on every screen; landscape plays normally
- [ ] Full match playable on every row of the matrix
- [ ] No accidental refresh/zoom during play
- [ ] Sound works after the first tap
- [ ] 60 fps (or close) on a mid-range phone

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 15**
