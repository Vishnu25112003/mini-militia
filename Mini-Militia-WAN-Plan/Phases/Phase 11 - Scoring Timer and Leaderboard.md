---
phase: 11
title: Scoring, Timer & Leaderboard
status: not-started
depends_on: [10]
tags: [phase, scoring, leaderboard]
---

# Phase 11 — Scoring, Timer & Leaderboard

← [[Phase 10 - Pickups Slots and Drops]] | Next → [[Phase 12 - Disconnect Reconnect and Late Join]]

## Goal
Points, the match timer, the live leaderboard during the respawn wait, and the final leaderboard with the exact ranking rules.

## Flow references
- [[Game Flow#11. Points System]]
- [[Game Flow#12. Leaderboard]]
- [[Game Flow#9. Melee]] (clash scoring)

## Tasks

### 1. Points (server, using shared logic)
- [ ] +1 per kill
- [ ] −1 for a death in a life with **zero kills**; no penalty if the life had a kill
- [ ] Self-kill → death (−1 if zero kills that life), no kill credit
- [ ] Melee clash scoring (Option A) wired in
- [ ] Track kills, deaths, points, and "kills this life" per player

### 2. Match timer
- [ ] Starts at the host's game time; shown top center
- [ ] At 0 → match ends for everyone at the same moment

### 3. Live leaderboard
- [ ] Shown while a player waits **5 s** to respawn
- [ ] Updates live: kills, deaths, points, player colors
- [ ] **Controls** button on it → opens controls popup (Phase 13); popup **stays open** after the leaderboard hides
- [ ] Match does not stop — the player respawns normally behind the popup

### 4. Final leaderboard
- [ ] Shown to all when time ends
- [ ] Ranking: **kills ↓ → points ↓ → deaths ↑ → full tie = shared rank**; next player gets the next rank (two at 1st → next is 2nd)

## Acceptance criteria
- [ ] Flow's points example reproduces exactly in a real match
- [ ] Ranking ties resolve exactly as the flow says
- [ ] Live leaderboard updates while dead; Controls popup persists after it hides

## Open questions (confirm with Dev4)
- **After the final leaderboard**, what happens? Back to the same lobby (play again with the same room code), back to the home screen, or a rematch button?
- Can players check the leaderboard **while alive** (e.g. a button or key), or only while waiting to respawn?

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 12**
