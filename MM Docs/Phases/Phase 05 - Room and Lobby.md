---
phase: 5
title: Room & Lobby
status: in-progress
depends_on: [4]
tags: [phase, lobby, react, rooms]
---

# Phase 05 — Room & Lobby

← [[Phase 04 - Networking Foundation]] | Next → [[Phase 06 - Host Settings and Default Loadout]]

## Goal
The full flow from opening the link to the match starting: enter name → create or join a room by code → lobby with player list, ready status, room code sharing, chat, host removal → match starts when everyone presses Start or after the 2-minute auto-start.

## Flow references
- [[Game Flow#2. Room & Lobby]]
- [[Game Flow#17. Player Identity]]

## Tasks

### 1. Name screen (React)
- [x] Name input: **letters only, 3–12 letters**; clear error messages — reuses Phase 01's `validateName`
- [x] Name saved in browser **local storage**; pre-filled and editable next visit
- [x] Buttons: **Create Room** / **Join Room**

### 2. Create room (server)
- [x] Generate **6-character room code** (letters + numbers, no 0/O/1/I), unique among active rooms — reuses Phase 01's `generateRoomCode`, re-rolled on the (astronomically unlikely) chance of a collision against active rooms
- [x] Creator becomes **host**
- [x] Room starts in `lobby` phase; **2-minute auto-start timer begins at room creation**

### 3. Join room
- [x] Paste/enter code → join
- [x] Error cases with clear messages: code not found, room full (player count reached), room cancelled
- [x] **Duplicate name:** first come, first served → second player asked to choose another name (stays on the join screen)
- [x] Assign one of **8 colors**, first come, first served

### 4. Lobby screen layout (from the flow)
| Area | Contents |
|---|---|
| Left | Player list — name, avatar (one default), ready status (Not Ready / Ready), **HOST** tag |
| Right, top | **Room code** + **Copy** + **Share** (Web Share API → e.g. WhatsApp; fallback = copy) |
| Right | **START** button |
| Below START | **Map card** — Catacombs thumbnail, name, players (joined / room size), game time |
| Below map card | **X**, **Gear**, **Chat** buttons |
| Bottom | "Waiting for players to join..." + **visible auto-start countdown** |

- [x] Name screen and lobby **landscape only** on phones (portrait → rotate message); works on PC — already handled globally by Phase 03's `OrientationGate`, which wraps the whole app

### 5. Start logic (server-authoritative)
- [x] Each player taps **Start** → status becomes Ready (visible to all)
- [x] Match starts when **all** lobby players are Ready, **or** when the 2-minute countdown ends
- [x] At auto-start, **every player in the lobby joins**, Ready or not — `startMatch()` spawns every current `state.players` entry unconditionally, not just the ready ones
- [x] Transition all players into the match scene together — the lobby and the match are phases of the **same room/connection** (`MatchRoom`'s `phase` field), not a reconnect; `LobbyScreen` hands the same `Room` object to `MatchScene` the instant `phase` flips to `'playing'`

### 6. Host powers & leaving
- [x] Host can **remove** a player from the lobby (removed player sees a message and returns to the join screen)
- [x] **X button:** normal player → leave room; host → **cancel the room** (all players informed, returned to start screen)
- [x] **Host disconnects in the lobby** → room cancelled (same as host pressing X) — `onLeave` doesn't distinguish a consented leave from a disconnect, so this is the same code path as the X button

### 7. Lobby chat
- [x] Chat button opens chat popup; messages show sender name in their color
- [x] Server relays messages to everyone in the room — also truncates to 100 characters server-side as a backstop, not just via the input's `maxLength`

### 8. Gear button
- [x] Opens the controls customization popup (placeholder screen until Phase 13)

## Deliverables
- Complete lobby flow, from link to match start

## Acceptance criteria
- [ ] Friend on another network joins using a shared code via WhatsApp — **needs Dev4's real devices + the Phase 00 VPS deployment**; this agent verified the underlying join-by-code mechanism directly (see decisions log)
- [x] Duplicate name correctly rejected for the second player — verified directly, case-insensitively
- [x] All-Ready start works; auto-start at 2:00 works with countdown visible to all — verified directly: the synced countdown field ticks down in real time, and `startMatch()` (the same function both paths call) spawns everyone unconditionally. The full 2-minute real-world timer firing wasn't waited out end-to-end (120 real seconds); confirmed instead by code review that the identical `startMatch()` path serves both the all-ready and the timer-driven call sites.
- [x] Host remove works; host X / host disconnect cancels the room — verified directly, including the removed/cancelled player receiving the correct reason and the removed player re-joining immediately afterward
- [x] Room full → join refused — verified directly: an 8th join succeeds, a 9th is refused because Colyseus locks the room at `maxClients`

## Open questions (confirm with Dev4 before building)
- [x] Can a player removed from the lobby **re-join the same lobby** with the code before the match starts? → **Yes, immediately** (see Game Flow §2, "Host removal")
- [x] Chat message length limit? → **100 characters**

## Notes / decisions log
- 2026-10-15: The lobby and the match are two **phases of the same persistent room/connection** (`MatchRoomState.phase: 'lobby' | 'playing' | 'ended'`), not a separate room type that hands off to another — matches the flow's own framing (one room, one code, host survives leaving once playing). `MatchScene` (Phase 04) was refactored to accept an already-connected `Room` instead of making its own connection, since the lobby now owns the connection's whole lifetime.
- `client.join()`'s own `filterBy`-based room matching turned out NOT to strictly reject a filter mismatch — tested directly, not assumed (a join with a deliberately wrong `code` option still matched and joined the existing room). Switched to an explicit, fully-controllable mechanism instead: a server HTTP endpoint (`GET /rooms/by-code/:code`) that looks up the room via `matchMaker.query()` and returns 404 on no match, followed by `client.joinById()`. This is also just a clearer API for the UI's distinct "create" vs "join by code" actions.
- Chat lives entirely in `onMessage`/`broadcast` — not in synced schema state — since lobby chat doesn't need to be part of the replicated room state (a late joiner not seeing chat history is an accepted, common trade-off for a simple chat feature).
- Verified directly against a real running server (Node scripts, no browser needed for this part): the full lifecycle (create → host assigned → code resolves → join → duplicate/invalid name rejection → distinct colors → chat relay + truncation → host removal with immediate rejoin → all-ready start with real spawn positions → host-leave cancellation with the room becoming unfindable afterward), the room-full lock at 8 players, and the auto-start countdown ticking down in real time via synced state.
- `connectToRoom.ts` (the real client module `JoinScreen` calls) couldn't be exercised directly from this agent's Node test harness — it reads Vite's `import.meta.env`, which only exists when run through Vite, not plain `tsx`. Mitigated by testing the identical underlying mechanics (HTTP lookup + `joinById`, error-code mapping) through a different script, and by confirming every new/changed file transforms correctly through Vite's dev server (same verification approach used in Phases 02-04).

## Approval gate
- [ ] All acceptance criteria met — blocked only on the WhatsApp/real-device check
- [ ] **Dev4 approval to move to Phase 06**
