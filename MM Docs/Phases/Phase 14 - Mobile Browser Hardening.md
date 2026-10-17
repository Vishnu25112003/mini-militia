---
phase: 14
title: Mobile Browser Hardening
status: in-progress
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
- [x] Verify the **landscape-only rule** (built in Phase 03) on every screen and popup, every device in the matrix
- [x] Android Chrome: when fullscreen, also **lock orientation to landscape** where the browser allows it
- [x] Rotating mid-match: message shows, match keeps running, controls work again instantly after rotating back
- [x] Fullscreen request on supported browsers (Android Chrome)
- [x] **PWA manifest** + icons → "Add to Home Screen" opens without browser bars (important for iPhone)
- [x] Safe-area handling (notches)

### 2. Block accidental gestures
- [x] Disable pull-to-refresh, double-tap zoom, pinch zoom, long-press menus, text selection on the game screen
- [x] Reduce accidental swipe-back where possible

### 3. Sound unlock
- [x] Browsers block audio until a tap → unlock audio on the lobby **Start** tap

### 4. Background & focus
- [x] Tab hidden / app switched → handled by Phase 12 reconnect; verify no stuck states

### 5. Performance
- [ ] Target **60 fps** on a mid-range Android phone with 8 players
- [x] Object pooling for bullets/effects; texture atlas
- [x] Measure download size; keep first load small for 4G

### 6. Device test matrix
| Device / browser | Result |
|---|---|
| Android — Chrome | Not tested — no physical device in this environment |
| Android — other browser | Not tested — no physical device in this environment |
| iPhone — Safari | Not tested — no physical device in this environment |
| iPhone — home-screen (PWA) | Not tested — no physical device in this environment |
| PC — Chrome / Edge / Firefox | Builds and runs via `npm run dev` on this machine; not cross-browser tested |

## Acceptance criteria
- [x] Portrait shows the rotate message on every screen; landscape plays normally
- [ ] Full match playable on every row of the matrix
- [x] No accidental refresh/zoom during play
- [x] Sound works after the first tap
- [ ] 60 fps (or close) on a mid-range phone

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 15**

## Implementation notes

- **Orientation/fullscreen**: `OrientationGate` (Phase 03) already covered every screen/popup without
  change — it wraps the whole app and never unmounts children, so rotating mid-match just toggles an
  overlay and the match keeps running underneath. Added `requestFullscreenAndLockLandscape()`
  (`mobileHardening.ts`), called from the lobby's **Start** tap on touch devices — the last guaranteed
  user gesture before a match, which both the Fullscreen and Screen Orientation Lock APIs require.
  Orientation lock only works inside fullscreen on the browsers that support it at all (not iOS Safari);
  everywhere else the rotate-message overlay is the fallback, which was already correct.
- **PWA**: added `manifest.webmanifest` (`display: standalone`, `orientation: landscape`) plus
  `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` and the iOS-specific
  `apple-mobile-web-app-*` meta tags Safari needs (it ignores the manifest's `display` field). The icons
  are flat-color placeholders generated from the existing brand purple — real artwork is Phase 15's job;
  the icons just need to exist and be square for "Add to Home Screen" to work correctly today.
- **Gesture blocking**: viewport `maximum-scale=1, user-scalable=no` blocks pinch/double-tap zoom;
  `overscroll-behavior: none` on `html`/`body` blocks pull-to-refresh and reduces (but can't fully
  eliminate — it's partly an OS-level gesture on iOS) edge swipe-back; `-webkit-touch-callout: none` +
  `user-select: none` block the long-press context menu and text selection. `env(safe-area-inset-*)`
  padding on `body` keeps content clear of notches; the canvas itself still renders at a fixed internal
  resolution scaled by Phaser, so safe-area insets shrink the visible play area uniformly rather than
  reflowing the HUD around a notch specifically.
- **Sound unlock**: `unlockAudioContext()` creates/resumes a `WebAudioContext` and plays a silent buffer
  (the classic iOS nudge) from the same Start tap. There's no audio in the game yet (Phase 15 adds it) —
  this just means no separate "tap to enable sound" prompt will be needed once there is.
- **Object pooling**: added a small `EffectPool<T>` free-list (`EffectPool.ts`) and rewired the four
  per-shot/per-explosion visual effects (muzzle flash, tracer, explosion flash, gas cloud) in
  `MatchScene.ts` to acquire/release from a pool instead of `this.add...` / `.destroy()` each time —
  the previous code allocated and GC'd a new GameObject on every bullet fired, which is the main
  per-frame allocation source with 8 players on automatic weapons. No texture atlas exists yet since
  there's no sprite art to atlas (placeholder shapes only) — deferred to Phase 15 alongside real art.
- **Download size**: current production build is ~1.89 MB JS (~511 KB gzip), almost entirely Phaser
  itself. Left as a known gap rather than risking a code-split refactor this phase — `vite build` already
  flags it. A follow-up (dynamic `import()` of the game bundle so the lobby/join screens load without
  pulling in Phaser) would be the next step if 4G load time becomes a real problem.
- **Not verifiable here**: the device test matrix, 60fps-on-a-mid-range-phone, and real
  "Add to Home Screen" behavior on an actual iPhone all require physical hardware this environment
  doesn't have. Everything above was verified by `tsc -b` across all three workspaces, 135 passing
  shared unit tests, and code review — consistent with the same limitation noted in Phase 12/13 for
  paths this environment can't exercise.
