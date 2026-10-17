---
phase: 12
title: Disconnect, Reconnect & Late Join
status: in-progress
depends_on: [11]
tags: [phase, networking, reconnect]
---

# Phase 12 — Disconnect, Reconnect & Late Join

← [[Phase 11 - Scoring Timer and Leaderboard]] | Next → [[Phase 13 - HUD Controls Customization and Chat]]

## Goal
Real-world connections drop. This phase makes the game handle that exactly as the flow says: easy reconnect with scores kept, late joining into free slots, and the match surviving the host leaving.

## Flow references
- [[Game Flow#4. Disconnect & Reconnect]]
- [[Game Flow#5. Late Join]]
- [[Game Flow#2. Room & Lobby]] (host disconnect)
- [[Game Flow#17. Player Identity]] (reconnect token in browser)

## Tasks

### 1. Reconnect
- [x] On disconnect: character **disappears** from the map — the client hides anyone with `connected: false`, same mechanism as `alive`
- [x] Server keeps the player's seat and scores **until the match ends** — `onDrop` → `allowReconnection(client, matchTimeRemainingSeconds)`; their `this.players`/`this.state.players` entries are never deleted while the grace window is open
- [x] **Reconnect token** saved in browser local storage — `room.reconnectionToken` persisted after every successful join/reconnect
- [x] Reopening the link / reconnect option → rejoins automatically — attempted once on app load, and again on any unexplained drop, before falling back to name entry
- [x] Rejoin = **normal respawn**: random place, random gun loadout, 3 s spawn shield — reuses the exact same `respawnServerPlayer` path as a normal mid-match death
- [x] Kills, deaths, points **unchanged** — verified live

### 2. Late join
- [x] If players < room size → anyone with the code can join **anytime until the match ends**
- [x] Late joiner: **fresh scores** (0/0/0), normal spawn
- [x] Players removed from the lobby can join mid-match as fresh joiners — same `joinMatchInProgress` path as any other late joiner, no special-casing needed
- [x] Late joiner gets a free color and a name check (duplicate → choose another) — the name check was previously only enforced in the lobby; added to the mid-match path too (shared `isNameTaken`, which deliberately also catches a disconnected player's still-reserved name, per Dev4)

### 3. Host disconnect during match
- [x] Match **continues** for everyone; host is just a player — mid-match, `onDrop` treats every session identically regardless of `hostSessionId`; the host-cancels-room special case only exists for a lobby-phase disconnect

### 4. Real-network tests
- [ ] Switch Wi-Fi → mobile data mid-match
- [ ] Lock phone / switch to WhatsApp for 30 s, come back
- [ ] Close the tab, reopen the link

## Implementation notes
- **A disconnected player's character is untargetable**, not just invisible — excluded from every hit-detection/targeting loop (hitscan, melee, projectile splash, grenade splash, gas, Proxynade arming) via a shared `isTargetable()` check, so nobody can farm a frozen, disappeared body for a free kill. The flow doesn't say this explicitly, but "disappears from the map" reads as "gone," not "a stationary target."
- **The client SDK has its own transport-level auto-reconnect** (exponential backoff, same session) that transparently absorbs most brief network blips *before* the server's `onDrop`/`allowReconnection` path is ever reached — confirmed while building the smoke test, where a simulated drop healed itself in ~200ms unless that layer was explicitly disabled. This means `onDrop` is really the *second* line of defense (tab closed, app backgrounded past the transport retry budget, a longer outage) — the three real-network tests below exercise both layers together, which a scripted test can't fully replace.
- **The reconnection grace window is "whatever's left on the match clock"**, per the flow's "anytime until the match ends" — not a fixed short timeout.

## Acceptance criteria
- [ ] All three real-network tests end with a successful rejoin, scores intact — *needs a real two-device test; the server-side mechanics (seat held, scores kept, normal respawn, match continuing) are verified via a scripted client that forces a non-consented drop, but real network conditions can't be scripted*
- [x] Late joiner enters with 0/0/0 while others keep their scores — verified live
- [x] Host leaving mid-match changes nothing for others — verified live (match stayed in `'playing'`, the other player was unaffected)

## Open questions (confirm with Dev4)
- ~~Does a **disconnected** player's seat count toward the room size?~~ Resolved: yes — the seat (and room-size count) stays reserved until the match ends; a late joiner can only take a genuinely empty seat.
- ~~If a disconnected player's **name** is used by a late joiner~~ Resolved: moot given the above — the disconnected player's name is still reserved, so a late joiner picking it gets the normal "name taken" rejection.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 13**
