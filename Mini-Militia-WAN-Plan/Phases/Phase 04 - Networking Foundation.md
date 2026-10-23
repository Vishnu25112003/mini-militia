---
phase: 4
title: Networking Foundation
status: not-started
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
- [ ] `MatchRoom` in Colyseus with a fixed **30 Hz** game loop
- [ ] Patch/snapshot rate **20 Hz**
- [ ] Room state schema: players (position, velocity, facing, crouching, fuel, color, name)
- [ ] Load `catacombs.json` on the server for collision
- [ ] On join: place player at a random spawn point (purely random)

### 2. Input pipeline
- [ ] Client sends `PlayerInput` with an increasing **sequence number** each tick
- [ ] Server queues inputs per player and applies them in its tick with shared `physics.step`
- [ ] Server ignores impossible inputs (e.g. aim angle outside range, too many inputs per tick) — basic anti-cheat

### 3. Client prediction & reconciliation (your own player)
- [ ] Apply your own inputs locally right away (instant feel)
- [ ] Keep a list of inputs not yet confirmed by the server
- [ ] When a snapshot arrives: reset to the server's position, then re-apply unconfirmed inputs
- [ ] Smooth small corrections so the player doesn't visibly "snap"

### 4. Interpolation (other players)
- [ ] Buffer snapshots and draw other players about **100 ms in the past**, gliding between snapshots
- [ ] Handle missing/late snapshots gracefully

### 5. Lag compensation groundwork
- [ ] Server keeps a short **position history** (~1 second) for every player
- [ ] Helper: "where was player X at time T?" — used for hit checks in Phase 07

### 6. Debug & testing tools
- [ ] On-screen debug: ping, server tick, snapshots/sec, prediction corrections
- [ ] **Artificial lag/packet-loss** option (dev only) to test bad mobile networks locally
- [ ] Temporary "join test room" button (real lobby comes in Phase 05)

## Deliverables
- Multiplayer movement working over the internet via the testing VPS

## Acceptance criteria
- [ ] 2 players on different networks (one Wi-Fi, one 4G) see each other move smoothly
- [ ] 8 browser tabs/devices in one room stay in sync
- [ ] Your own movement feels instant even with 150 ms simulated lag
- [ ] Other players move smoothly with 5% simulated packet loss
- [ ] A modified client can't move faster than the rules allow (server decides)

## Risks & notes
- Prediction bugs usually come from client and server physics differing → always use the **shared** `step`, never a copy.
- TCP (WebSocket) can show small stalls on poor mobile data. Accepted for v1; code the transport behind one interface so WebRTC could be added later.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 05**
