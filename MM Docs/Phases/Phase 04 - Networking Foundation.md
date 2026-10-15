---
phase: 4
title: Networking Foundation
status: in-progress
depends_on: [3]
tags: [phase, networking, colyseus, server]
---

# Phase 04 — Networking Foundation

← [[Phase 03 - Local Movement Sandbox]] | Next → [[Phase 05 - Room and Lobby]]

## Goal
Move the game onto the **authoritative server**: up to 8 browsers on different networks move around the same map, the server decides every position, and lag is hidden with prediction and interpolation. This is the hardest technical phase — everything after it builds on it.

## Flow references
- [[Game Flow#15. Server & Networking]]
- [[Game Flow#1. Scope (v1)]] (dedicated server, up to 8 players)

## Fixed decisions
- Colyseus over **WebSocket**
- Server game tick **30 / sec**, snapshots to players **20 / sec**
- Browsers send **inputs only**; server runs the game
- Client prediction + interpolation + lag compensation

## Tasks

### 1. Match room (server)
- [x] `MatchRoom` in Colyseus with a fixed **30 Hz** game loop — `this.setFixedTimestep(…, 30)`
- [x] Patch/snapshot rate **20 Hz** — `this.patchRate = 50`
- [x] Room state schema: players (position, velocity, facing, crouching, fuel, color, name) — plus `aimAngle`, added so every player's aim line can render, not just the locally-controlled one
- [x] Load `catacombs.json` on the server for collision — reuses Phase 02's `loadCatacombsMap()`
- [x] On join: place player at a random spawn point (purely random)

### 2. Input pipeline
- [x] Client sends input every tick — via `@colyseus/sdk`'s `room.input()` / server's `this.defineInput()`, which handles ordering/delivery itself over a **reliable** channel (see decisions log: no app-level sequence field needed — that's for unreliable channels)
- [x] Server queues inputs per player and applies them in its tick with shared `physics.step` — `for (const input of this.inputs.get(sessionId))`, one shared `step()` call per buffered input
- [x] Server ignores impossible inputs — `sanitize: { moveX: [-1, 1] }` clamps server-side regardless of what a modified client sends

### 3. Client prediction & reconciliation (your own player)
- [x] Apply your own inputs locally right away (instant feel) — `predict.reconciler(...)`
- [x] Keep a list of inputs not yet confirmed by the server — handled internally by the SDK's input handle (`lastProcessed`/`sentCount`/replay ring), not hand-rolled
- [x] When a snapshot arrives: reset to the server's position, then re-apply unconfirmed inputs — the Reconciler's rewind-and-replay loop, using the exact shared `step()` via an adapter (`client/src/game/net/predictStep.ts`)
- [x] Smooth small corrections so the player doesn't visibly "snap" — built into the Reconciler (decaying per-field offset)

### 4. Interpolation (other players)
- [x] Buffer snapshots and draw other players about **100 ms in the past**, gliding between snapshots — `predict.attachAll('players', { mode: 'lerp', delay: 100 })`
- [x] Handle missing/late snapshots gracefully — built into `Predict`'s lerp mode (holds at the newest sample on underrun, never extrapolates)

### 5. Lag compensation groundwork
- [x] Server keeps a short **position history** (~1 second) for every player — `this.allowRewindState({ maxRewindMs: 1000 })` + `rewind.attachAll(this.state.players, { fields: ['x','y'] })`
- [x] Helper: "where was player X at time T?" — `rewind.lastSeenBy(sessionId)` / `rewind.valueAt(...)`, ready for Phase 07's hit tests

### 6. Debug & testing tools
- [x] On-screen debug: ping, server tick, snapshots/sec, prediction corrections — `room.clock.smoothedRtt()`, advertised tick/patch rate, and a simple predicted-vs-authoritative distance readout
- [x] **Artificial lag/packet-loss** option (dev only) to test bad mobile networks locally — sliders in the dev panel, applied by delaying/dropping the client's own `input.send()` calls
- [x] Temporary "join test room" button (real lobby comes in Phase 05) — `JoinScreen.tsx`: name entry + "Join Test Room"

## Deliverables
- Multiplayer movement working over the internet via the testing VPS

## Acceptance criteria
- [ ] 2 players on different networks (one Wi-Fi, one 4G) see each other move smoothly — **needs Dev4's real devices + the VPS deployment from Phase 00**; this agent verified the underlying mechanism with 2 concurrent programmatic clients (see decisions log), not real devices over a real WAN
- [x] 8 browser tabs/devices in one room stay in sync — verified with 8 concurrent clients: all 8 converge on the exact same authoritative position for every player; **still needs a real multi-device visual check**
- [ ] Your own movement feels instant even with 150 ms simulated lag — the mechanism is correct (verified by code review + the architecture, see decisions log) but **feel** needs an actual browser; this agent has no browser access
- [ ] Other players move smoothly with 5% simulated packet loss — same as above: `Predict`'s lerp mode is designed to hold at the latest sample rather than jump/extrapolate through a gap, but needs an eyeball check
- [x] A modified client can't move faster than the rules allow (server decides) — verified directly: a client sending `moveX: 99` for 1 real second still only travels ~192px (the normal walk-speed distance), because the server sanitizes `moveX` to `[-1, 1]` before ever handing it to `step()`

## Risks & notes
- Prediction bugs usually come from client and server physics differing → always use the **shared** `step`, never a copy. (Enforced here via one adapter, `client/src/game/net/predictStep.ts`, that both the client's Reconciler and — indirectly, by using the same shared `step()` — the server call into.)
- TCP (WebSocket) can show small stalls on poor mobile data. Accepted for v1; code the transport behind one interface so WebRTC could be added later. (Colyseus's transport is already behind `WebSocketTransport`; swapping it later doesn't touch `MatchRoom` or `MatchScene`.)

## Notes / decisions log
- 2026-10-15: Built on `@colyseus/sdk`'s own prediction/rollback framework (`Predict`, `Reconciler`, `room.input()`/`defineInput()`, `allowRewindState()`) rather than hand-rolling sequence buffers and reconciliation — it covers this phase's hardest requirements almost exactly (client prediction + reconciliation, buffered interpolation, lag-comp position history) and is far more likely to be correct than something hand-rolled and never interactively tested. Verified it's a real, current package from the npm registry before committing to it, the same way every other "surprisingly advanced" dependency in this project turned out to be (see Phase 00's notes).
- Three real bugs found and fixed via Node-based integration tests connecting actual Colyseus clients to a real running server (since this agent can't test in a browser, this was the next-best thing — far better than trusting type-checks alone):
  1. **A map bug, not a networking bug:** a player could spawn with their hitbox legitimately overlapping a solid tile — Phase 02's validation only checked the single tile under a spawn point's center, not the player's full 48px-tall hitbox (which spans more than one tile). Fixed at the root: exported `isPositionClearForPlayer()` from physics and used it in both the map generator and the validator, plus a regression test pinning the exact scenario. This would have intermittently soft-locked a freshly spawned player.
  2. **A tick with no fresh input skipped physics entirely** for that player (no gravity, nothing), since `this.inputs.get(sessionId)` yields nothing on an idle tick and nothing declared what to do about it. Fixed with `defineInput({ idle: ({ latest }) => latest ?? true })`, so a network hiccup holds the last input instead of freezing the simulation.
  3. **The initial "artificial lag" dev tool was broken by design:** delaying the SDK's own `input.send()` call also delays the Reconciler's prediction step, since prediction is triggered by `onSend` — defeating the entire point of testing "does my own movement stay instant despite lag." Fixed by moving the lag/packet-loss simulation to the WebSocket transport itself (`client/src/game/net/simulatedNetwork.ts`), below the SDK's prediction trigger: `input.send()` still fires immediately (instant local prediction, exactly like a real network call), only the actual bytes leave late or not at all.
- Dropped the input schema's `seqField`/dedup option after hitting it directly: WebSocket is used over a **reliable** channel (per the flow's own fixed decision and the SDK's explicit guidance — `seqField` dedup is for *unreliable* channels, where packets can arrive out of order or duplicated). A reliable channel already guarantees in-order, exactly-once delivery, and the Reconciler's ack tracking (`input.lastProcessed`/`sentCount`) uses the handle's own internal wire sequence regardless of any app-level field. Keeping `seqField` added a footgun (a forgotten increment silently drops every input as a duplicate) for no benefit on this transport.
- Verified end-to-end against a real running server via Node scripts (no browser needed for this part): 2-client and 8-client state sync, own-player prediction converging exactly to server truth, remote-player interpolation advancing smoothly with no backward jumps, and the anti-cheat moveX clamp.
- Host-configurable gravity/boost (Phase 06) isn't wired into the match room yet — `MatchRoom`/`MatchScene` both use the default `HOST_SETTING_RANGES` values (gravity 100, boost 100) as a fixed placeholder.

## Approval gate
- [ ] All acceptance criteria met — 2 of 5 verified directly; the remaining 3 need Dev4's real devices/browser (and, for the cross-network one, the Phase 00 VPS deployment)
- [ ] **Dev4 approval to move to Phase 05**
