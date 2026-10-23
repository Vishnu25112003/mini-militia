---
phase: 17
title: Production Deployment
status: not-started
depends_on: [16]
tags: [phase, deployment, vps]
---

# Phase 17 — Production Deployment

← [[Phase 16 - Playtesting and Balance]] | Back to → [[00 Index]]

## Goal
Move the finished game from the testing setup (Vercel + testing VPS) onto the **final VPS**: website and game server together, secure, monitored, and easy to update.

## Flow references
- [[Game Flow#19. Hosting]]
- [[Game Flow#15. Server & Networking]]

## Tasks

### 1. Server setup
- [ ] Final VPS (India region recommended for low lag)
- [ ] Node.js LTS, pm2 (auto-restart on crash/reboot), firewall (only 80/443 + SSH)
- [ ] **nginx:** serves the built website files **and** proxies `wss://` to Colyseus
- [ ] **Let's Encrypt SSL**, auto-renewal checked
- [ ] Optional domain pointed at the VPS

### 2. Release process
- [ ] Production build of client and server
- [ ] Simple deploy script: pull → install → build → restart pm2
- [ ] Environment variables for production URLs

### 3. Monitoring
- [ ] Server logs (pm2 logs, rotated)
- [ ] Basic alerts or a daily check: server up, rooms count, CPU/memory

### 4. Final checks
- [ ] Full match with friends on the production link
- [ ] SSL valid; works on phones on 4G
- [ ] Reboot test → game comes back by itself

## Acceptance criteria
- [ ] Game fully playable from the production link
- [ ] Update can be deployed with one script
- [ ] Server recovers from crash and reboot automatically

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 sign-off: v1 complete** 🎉
