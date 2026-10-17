---
phase: 11
title: Scoring, Timer & Leaderboard
status: in-progress
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
- [x] +1 per kill
- [x] −1 for a death in a life with **zero kills**; no penalty if the life had a kill
- [x] Self-kill → death (−1 if zero kills that life), no kill credit — already wired since Phase 08/09 (`handleDeathNoKillCredit`)
- [x] Melee clash scoring (Option A) wired in — already wired since Phase 09 (`applyMeleeClash`)
- [x] Track kills, deaths, points, and "kills this life" per player

### 2. Match timer
- [x] Starts at the host's game time; shown top center
- [x] At 0 → match ends for everyone at the same moment — guarded by a single `phase` flip the per-tick simulation checks first thing, so every player's clock-driven update stops in lockstep

### 3. Live leaderboard
- [x] Shown while a player waits **5 s** to respawn
- [x] Updates live: kills, deaths, points, player colors
- [x] **Controls** button on it → opens controls popup (Phase 13 stub — same placeholder copy as the lobby's Gear button, extracted into a shared `Popup`/`ControlsPopupBody` so Phase 13 only has to fill in one component); popup **stays open** after the leaderboard hides — its open/closed state is independent of `alive`
- [x] Match does not stop — the player respawns normally behind the popup

### 4. Final leaderboard
- [x] Shown to all when time ends
- [x] Ranking: **kills ↓ → points ↓ → deaths ↑ → full tie = shared rank**; next player gets the next rank (two at 1st → next is 2nd) — reuses the already-implemented, already-tested `rankPlayers` from Phase 01

## Implementation notes
- **After the final leaderboard** (resolved with Dev4): the room returns to the same lobby, same room code — `phase` goes `ended → lobby`, player stats reset to 0, ready flags clear, and the lobby's existing auto-start timer restarts. The room/session itself is never torn down, so no reconnect is needed.
- **How long the final leaderboard stays up before returning to the lobby isn't specified by the flow** — implemented as a flat 10 seconds (`FINAL_LEADERBOARD_SECONDS`), tune during playtesting.
- **Leaderboard access while alive** (resolved with Dev4): not available — only shown during the forced respawn wait or after the match ends, per the doc's literal description.

## Acceptance criteria
- [x] Flow's points example reproduces exactly in a real match — verified live (a melee kill: killer +1 kill +1 point; victim +1 death −1 point)
- [x] Ranking ties resolve exactly as the flow says — already unit tested in `scoring.test.ts` from Phase 01; this phase just wires the live data into it
- [x] Live leaderboard updates while dead; Controls popup persists after it hides — verified by construction (`showControls` state is independent of the `!me.alive` condition gating the leaderboard)

## Open questions (confirm with Dev4)
- ~~**After the final leaderboard**, what happens?~~ Resolved: back to the same lobby, same room code — players can ready up again for another round.
- ~~Can players check the leaderboard **while alive**~~ Resolved: only while waiting to respawn, per the doc's literal description.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 12**
