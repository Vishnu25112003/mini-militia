---
phase: 12
title: Disconnect, Reconnect & Late Join
status: not-started
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
- [ ] On disconnect: character **disappears** from the map
- [ ] Server keeps the player's seat and scores **until the match ends**
- [ ] **Reconnect token** saved in browser local storage
- [ ] Reopening the link / reconnect option → rejoins automatically
- [ ] Rejoin = **normal respawn**: random place, random gun loadout, 3 s spawn shield
- [ ] Kills, deaths, points **unchanged**

### 2. Late join
- [ ] If players < room size → anyone with the code can join **anytime until the match ends**
- [ ] Late joiner: **fresh scores** (0/0/0), normal spawn
- [ ] Players removed from the lobby can join mid-match as fresh joiners
- [ ] Late joiner gets a free color and a name check (duplicate → choose another)

### 3. Host disconnect during match
- [ ] Match **continues** for everyone; host is just a player

### 4. Real-network tests
- [ ] Switch Wi-Fi → mobile data mid-match
- [ ] Lock phone / switch to WhatsApp for 30 s, come back
- [ ] Close the tab, reopen the link

## Acceptance criteria
- [ ] All three real-network tests end with a successful rejoin, scores intact
- [ ] Late joiner enters with 0/0/0 while others keep their scores
- [ ] Host leaving mid-match changes nothing for others

## Open questions (confirm with Dev4)
- Does a **disconnected** player's seat count toward the room size? (i.e. can a late joiner take a disconnected player's seat, blocking their return?)
- If a disconnected player's **name** is used by a late joiner, what happens when the original player returns?

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 13**
