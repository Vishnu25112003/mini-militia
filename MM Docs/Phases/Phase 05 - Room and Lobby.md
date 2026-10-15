---
phase: 5
title: Room & Lobby
status: not-started
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
- [ ] Name input: **letters only, 3–12 letters**; clear error messages
- [ ] Name saved in browser **local storage**; pre-filled and editable next visit
- [ ] Buttons: **Create Room** / **Join Room**

### 2. Create room (server)
- [ ] Generate **6-character room code** (letters + numbers, no 0/O/1/I), unique among active rooms
- [ ] Creator becomes **host**
- [ ] Room starts in `lobby` phase; **2-minute auto-start timer begins at room creation**

### 3. Join room
- [ ] Paste/enter code → join
- [ ] Error cases with clear messages: code not found, room full (player count reached), room cancelled
- [ ] **Duplicate name:** first come, first served → second player asked to choose another name (stays on the join screen)
- [ ] Assign one of **8 colors**, first come, first served

### 4. Lobby screen layout (from the flow)
| Area | Contents |
|---|---|
| Left | Player list — name, avatar (one default), ready status (Not Ready / Ready), **HOST** tag |
| Right, top | **Room code** + **Copy** + **Share** (Web Share API → e.g. WhatsApp; fallback = copy) |
| Right | **START** button |
| Below START | **Map card** — Catacombs thumbnail, name, players (joined / room size), game time |
| Below map card | **X**, **Gear**, **Chat** buttons |
| Bottom | "Waiting for players to join..." + **visible auto-start countdown** |

- [ ] Name screen and lobby **landscape only** on phones (portrait → rotate message); works on PC

### 5. Start logic (server-authoritative)
- [ ] Each player taps **Start** → status becomes Ready (visible to all)
- [ ] Match starts when **all** lobby players are Ready, **or** when the 2-minute countdown ends
- [ ] At auto-start, **every player in the lobby joins**, Ready or not
- [ ] Transition all players into the match scene together

### 6. Host powers & leaving
- [ ] Host can **remove** a player from the lobby (removed player sees a message and returns to the join screen)
- [ ] **X button:** normal player → leave room; host → **cancel the room** (all players informed, returned to start screen)
- [ ] **Host disconnects in the lobby** → room cancelled (same as host pressing X)

### 7. Lobby chat
- [ ] Chat button opens chat popup; messages show sender name in their color
- [ ] Server relays messages to everyone in the room

### 8. Gear button
- [ ] Opens the controls customization popup (placeholder screen until Phase 13)

## Deliverables
- Complete lobby flow, from link to match start

## Acceptance criteria
- [ ] Friend on another network joins using a shared code via WhatsApp
- [ ] Duplicate name correctly rejected for the second player
- [ ] All-Ready start works; auto-start at 2:00 works with countdown visible to all
- [ ] Host remove works; host X / host disconnect cancels the room
- [ ] Room full → join refused

## Open questions (confirm with Dev4 before building)
- Can a player removed from the lobby **re-join the same lobby** with the code before the match starts? (Flow only says they can join mid-match.)
- Chat message length limit? (suggestion: 100 characters)

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 06**
