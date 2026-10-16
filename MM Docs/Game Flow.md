# Game Flow — Mini Militia-Style WAN Friends Play (v1)

## 1. Scope (v1)

| Item | Decision |
|---|---|
| Game | Own game, looks and plays like Mini Militia Classic |
| Platform | Web-based only (browser game on phone/PC, no mobile app) — touch + keyboard/mouse |
| Mobile orientation | **Landscape only** — in portrait, the game shows a "rotate to landscape" message (Section 13) |
| Mode | Friends play over WAN (internet) only |
| Map | One map only — Catacombs-style |
| Players per room | Room size set by host, maximum 8 |
| Match type | Free-for-all deathmatch |
| Weapons | 15 guns + 3 grenade types (see Section 7) |
| Match end | Time limit (host-set, default 5:00) |
| Server | Dedicated server runs the match (host is a normal player, so the match survives the host leaving) |

---

## 2. Room & Lobby

1. Host creates a room → a **room code** is generated (6 characters, letters + numbers, no confusing characters like 0/O or 1/I — e.g. `K7P2QX`).
2. Other players paste the room code → they join the lobby.
3. Host sets the match settings through the **host settings popup** (see below).
4. Host can **remove players** from the lobby.
5. Every player has a **Start** button.

### Lobby screen layout

| Area | Contents |
|---|---|
| Left side | **Player list** — each player's name, avatar, ready status (Not Ready / Ready), and a **HOST** tag on the host |
| Right side, top | **Room code** with **Copy** and **Share** options (e.g. share to WhatsApp) |
| Right side | **START** button |
| Below START | **Map card** — Catacombs thumbnail, map name, players (joined / room size), game time |
| Below map card | **X** button, **Gear** button, **Chat** button |
| Bottom | "Waiting for players to join..." text + auto-start countdown |

| Button | Action |
|---|---|
| X | Leave the room (for the host: **cancel the room**) |
| Gear | Opens **player controls** customization (Section 13) |
| Chat | Opens lobby **chat** |

### Host settings popup
- Opened by the **host** tapping the **map card**. All settings are **popup-based**.

| Setting | Range | Step | Default | Notes |
|---|---|---|---|---|
| Player count (room size) | 2 – 8 | 1 | 8 | Can't be set **below** the number of players already joined |
| Game time limit | 1:00 – 15:00 | 30 sec (+ / − buttons) | 5:00 | |
| Map drops (disappear countdown) | 5 – 60 sec | 5 sec | 15 sec | For dropped and death-scattered guns and grenades |
| Gravity | 0 – 100 | 10 | 100 | **100 = normal gravity**, **0 = no gravity** (floating only) |
| Boost | 0 – 100 | 10 | 100 | **100 = no drain** (unlimited); lower values drain while flying and refill; **0 = very fast drain** |
| Default loadout | On / Off | — | Off | See below |

### Default loadout
- When the host turns it **on**, all gun combinations are shown and the host picks **one loadout** (slot 1 + slot 2).
- The host **can** choose a **dual pair** (e.g. Uzi + Uzi) as one of the slots.
- Every player spawns with **that same loadout at every spawn and respawn**.
- Players still get **2 fragnades + 2 gasnades** at spawn.
- **Map pickups stay normal** — random guns, not the default loadout.

### Match start
- The match starts when **all players** in the lobby have pressed Start, **or**
- **Auto-start:** a **2-minute timer** begins when the room is created, shown as a **visible countdown**. When it ends, the match starts automatically.
- At auto-start, **every player in the lobby joins the match**, whether or not they pressed Start.

### Host disconnect
| When | Result |
|---|---|
| In the lobby, before the match starts | The whole room is **cancelled** |
| After the match starts | The match **continues** for all other players — not affected |

### Host removal
- A player **removed by the host from the lobby** can **re-join immediately** with the room code — removal isn't a ban, just a one-time kick. The host can remove them again if needed.
- Once the match has started, a previously-removed player joining with the code is treated as a fresh late joiner (Section 5): 0/0/0 scores.

### Lobby chat
- Messages are limited to **100 characters**.

---

## 3. Spawning

### Spawn loadout (every spawn and respawn)
- **2 random guns** — one in each slot, always **2 different single guns** (never a dual pair).
  - **Exception:** if the host turns on **Default loadout**, every player gets the host's chosen loadout instead (Section 2).
- **2 fragnades + 2 gasnades**. Proxynades are never given at spawn.

### First spawn
- Every player spawns at a **different position**.

### Respawn
- After dying, the player waits **5 seconds**.
- Then respawns at a **random place** with a fresh spawn loadout.

### Spawn shield
- Every spawn gives a **3-second shield**.
- After 3 seconds, the shield disappears.
- **Melee ignores the spawn shield** (a melee hit kills even during the shield).

---

## 4. Disconnect & Reconnect

- A player who disconnects mid-match can **reconnect** using a reconnect option.
- While disconnected, the player's character **disappears from the map**.
- On rejoin, the player comes back like a **normal respawn** (random place, random gun, 3-second spawn shield).
- Kills, deaths, and points are **kept exactly the same** — no reduction.
- Reconnect is allowed **anytime until the match ends**.

---

## 5. Late Join

- If the match has **free slots** (fewer players than the room size), anyone with the **room code** can join mid-match.
- Late join is allowed **anytime until the match ends**.
- A late joiner spawns like a **normal respawn** (random place, random gun, 3-second spawn shield).
- A late joiner starts with **fresh scores** (0 kills, 0 deaths, 0 points). Other players' scores stay the same.
- Players **removed by the host in the lobby** can also join mid-match with the room code — as a fresh joiner with 0 scores.

| Player type | Scores on entering match |
|---|---|
| Reconnecting player | Old scores kept |
| New / late joiner | Fresh (0 / 0 / 0) |
| Removed-from-lobby player joining mid-match | Fresh (0 / 0 / 0) |

---

## 6. Map Pickups (Guns & Medkits)

- Random places on the map spawn random **guns**, **medkits**, **grenades**, and **boost tanks**.
  - Grenade pickups come in **pairs**: 2 fragnades, 2 gasnades, or 2 proxynades.
  - Proxynades are available **only** from map pickups.
  - **Boost tank:** if the host sets boost to **100% (unlimited)**, boost tanks do **not** appear in the match.
- Refresh cycle:
  1. Pickups stay on the map for **1 minute**.
  2. After 1 minute, **all pickups disappear**.
  3. After **5 seconds**, a fresh random set appears at **all** pickup places.
- If a player takes a pickup, that place **stays empty** until the next refresh cycle.

---

## 7. Weapons

### Gun list (15)

| Group | Guns |
|---|---|
| Assault rifles | AK47, M16, Tavor, XM8 |
| Marksman / sniper | M14, M93BA |
| SMGs / pistols | Uzi, MP5, TEC9, Desert Eagle |
| Shotgun | Shotgun |
| Explosive launchers | SMAW, RG6 |
| Special | Flame, Phasr |

Only these guns exist in the game.

### Grenades (3)
- **Fragnade**, **Gasnade**, **Proxynade**.
- Each player carries a **maximum of 5 grenades** total, in any mix.
- At 5 grenades, a player **can't pick up more** until they throw one.
- If a player at 4 grenades walks over a grenade pair, they take **1** (reaching 5) and **1 stays** on the map.

### Other pickups
- **Healthpack** (medkit) — heals instantly.
- **Boost tank** — **full boost refill** (not shown when host sets boost to 100%).

### Gun slots
- Every player has **2 slots**, both always filled with **2 different guns**. A slot can **never be empty**.
- The **same gun can't be in both slots** (e.g. AK47 in slot 1 and AK47 in slot 2 is not allowed).
- The same gun twice is only possible as a **dual pair inside one slot**.
- A dual pair counts as **one slot**; the other slot holds one gun.

### Dual-wield pairs (6)
Only TEC9, Uzi, and Desert Eagle can be dual-wielded.

| Pair | Type |
|---|---|
| TEC9 + TEC9 | Same gun |
| Uzi + Uzi | Same gun |
| Desert Eagle + Desert Eagle | Same gun |
| TEC9 + Uzi | Mixed |
| Desert Eagle + TEC9 | Mixed |
| Desert Eagle + Uzi | Mixed |

### Picking up guns
- Near a gun where pairing is possible → a **Pair** button shows.
- Otherwise → the **gun icon** shows; choosing it **replaces** the currently held gun, which **drops** to the map.
- If the player already has that gun in a slot:
  - Dual gun → only the **Pair** button shows.
  - Non-dual gun → nothing shows; it **can't be picked up**.
- When changing a dual-pair slot to another pairable gun, the player sees an option to choose **which of the 2 guns** to replace.
- **Breaking a pair:** picking up a non-pairable gun into a dual-pair slot → the new gun takes the slot and **both pair guns drop**.
  - Example: holding Uzi + Uzi (slot 1) and M14 (slot 2), picking up AK47 → slot 1 = AK47, both Uzis drop.

### Gun stats (approved starting values — tune in playtesting)

Health = 100. "Crouch damage" = damage to a crouching player hit on the **front** side.

| Gun | Damage / hit | Crouch damage | Fire rate (shots/sec) | Magazine | Reserve | Reload (sec) | Range | Zoom |
|---|---|---|---|---|---|---|---|---|
| AK47 | 14 | 5 | 8 | 30 | 90 | 2.0 | Medium | 1.4x |
| M16 | 12 | 4 | 9 (3-shot burst) | 30 | 90 | 1.8 | Medium | 1.4x |
| Tavor | 11 | 4 | 10 | 30 | 90 | 1.8 | Medium | 1.2x |
| XM8 | 13 | 4 | 8 | 30 | 90 | 1.8 | Medium–long | 1.6x |
| M14 | 30 | 10 | 3 | 15 | 45 | 2.2 | Long | 2x |
| M93BA (sniper) | 95 | 30 | 0.8 | 5 | 15 | 3.0 | Very long | 3x |
| Uzi | 7 | 2 | 14 | 30 | 90 | 1.5 | Short | 1x |
| MP5 | 8 | 3 | 12 | 30 | 90 | 1.6 | Short–medium | 1.2x |
| TEC9 | 7 | 2 | 12 | 20 | 80 | 1.4 | Short | 1x |
| Desert Eagle | 28 | 9 | 3 | 7 | 28 | 1.6 | Medium | 1.2x |
| Shotgun | 10 × 8 pellets | 3 per pellet | 1 | 6 | 18 | 2.5 | Short | 1x |
| SMAW (rocket) | Direct hit: 100 (instant kill) · Splash: 50 | Direct hit: 70 · Splash: 40 | 0.5 | 1 | 4 | 2.5 | Long | 1.4x |
| RG6 (grenade launcher) | 50 splash | 40 | 1.5 | 6 | 12 | 3.0 | Medium | 1.2x |
| Flame | 4 per tick + short burn | 3 | 20 ticks | 100 fuel | — | — | Very short | 1x |
| Phasr (laser) | 20 | 7 | 4 | 12 | 36 | 2.0 | Long | 1.6x |

### Grenade stats

| Grenade | Effect | Damage | Crouch damage (front) | Radius | Trigger |
|---|---|---|---|---|---|
| Fragnade | Explosion | 90 at center, less toward the edge | 72 at center | Medium | 3-second fuse |
| Gasnade | Poison cloud | 8 per second for 5 seconds | 6 per second | Medium | Releases on landing |
| Proxynade | Mine | 90 at center, less toward the edge | 72 at center | Small | Arms after 1 second; explodes when an enemy comes close |

### Dual wield firing
- Both guns of a dual pair **fire together**, each using **its own ammo** → damage **doubles**.

### Self-damage
- A player's own **SMAW, RG6, and grenades** hurt them **exactly as much** as they would hurt an opponent.
- A self-kill counts as a **death** (see Section 11 for points). Nobody gets kill credit.

### Dropped items & death scatter
- Replaced guns **drop** onto the map.
- When a player is killed, all their **guns and grenades scatter slowly through the air** onto the map.
- Dropped and scattered items can be picked up by **any player**.
- They **disappear** after the **disappear countdown** set by the host.

---

## 8. Crouch Shield

- When a player crouches, a shield is created on the **front side only**.
- Bullets hitting the front do **reduced damage**, set **per gun**.
  - Example: a gun doing 15/100 per bullet normally does 5/100 to a crouching player.
- The **back side has no shield** → full damage.
- **Melee ignores the crouch shield.**

### Explosions, gas, and flame
- A crouching player hit on the **front** side by an **explosion, gas, or flame** takes **80% damage** (a small 20% reduction).
- Back side → full damage.

| Damage source | Normal | Crouching (front) |
|---|---|---|
| SMAW direct hit | 100 (instant kill) | 70 (70% of a direct hit) |
| SMAW splash (nearby, within blast range) | 50 | 40 |
| RG6 splash | 50 | 40 |
| Flame (per tick) | 4 | 3 |
| Fragnade (center) | 90 | 72 |
| Proxynade (center) | 90 | 72 |
| Gasnade (per second) | 8 | 6 |

---

## 9. Melee

- A single melee hit **always kills**, regardless of health, crouch shield, or spawn shield.

### Melee clash (both players melee each other)
- The player who **hits first** gets the kill.
- The first hitter loses a **fixed 50 health**.
- If the first hitter has **50 health or less**, they **also die**.

| Example | Result |
|---|---|
| A (100 hp) hits B (30 hp) first | A gets the kill, A drops to 50 hp |
| B (30 hp) hits A (100 hp) first | B gets the kill, B also dies |

### Scoring when both die in a clash
- **First hitter:** +1 kill, +1 death.
- **Other player:** +1 death.

---

## 10. Health & Medkits

- Medkits are found at random pickup places on the map.
- A medkit **heals instantly** on pickup — **full heal to 100**.

---

## 11. Points System

- **+1** for each kill.
- **−1** for each death in a life where the player got **zero kills**.
- **No penalty** for a death in a life where the player got at least one kill.
- **Self-kill** (own explosive): counts as a **death** → **−1** if the player had **no kills** that life. No one gets kill credit.

### Example
| Event | Points |
|---|---|
| Kills 3 players without dying | +3 |
| Dies (had kills this life) | +3 (no penalty) |
| Respawns, dies with no kill | +2 |
| Respawns, dies with no kill | +1 |
| Respawns, dies with no kill | 0 |
| Respawns, dies with no kill | −1 |

### Melee clash where both die
- First hitter: got a kill in that life → no −1 for the death.
- Other player: −1 only if they had zero kills in that life.

---

## 12. Leaderboard

### Live leaderboard
- Shown to a player while waiting to respawn after dying.
- Updates live with each player's **kills**, **deaths**, and **points**.
- Has a **Controls** button to open control customization (see Section 13).

### Final leaderboard
- Displayed when the match time finishes.

### Ranking order
1. **Kills** — more kills ranks higher.
2. **Points** — if kills are equal, more points ranks higher.
3. **Deaths** — if points are also equal, fewer deaths ranks higher.
4. **Full tie** — if everything is equal, both players share the rank, and the next player gets the next rank.
   - Example: two players at 1st → next player is 2nd → then 3rd, etc.

---

## 13. Player Controls

Player controls are set by **each player for themselves** — separate from the host's match settings.

### Mobile orientation — landscape only
- On mobile, the game is played in **landscape only**.
- If a player opens the game (or turns the phone) in **portrait**, a full-screen message asks them to **rotate the phone to landscape**.
- This applies to **every screen**: name entry, lobby, match, leaderboard, popups.
- The game continues normally once the phone is in landscape. (During a match, the match keeps running while the message shows.)

### Default layout (recommended, touch)

| Position | Control |
|---|---|
| Bottom-left | Movement / jetpack joystick |
| Next to left joystick | Grenade throw button (shows count) |
| Bottom-right | Aim + fire joystick |
| Left of right joystick | Melee button |
| Near right joystick | Reload button |
| Near right joystick (only when near a gun) | Pickup / Pair button |
| Top-left | Zoom button |
| Top center-left | Health bar + boost bar |
| Top center | Match timer |
| Near top center (by the timer) | Chat icon |
| Top-right | Gun box (current gun + bullet count) + grenade switch icon |

- **No pause button.**

### Control behaviour
- **Weapon swap:** tap the **gun box** (top-right) to switch slot 1 ↔ slot 2.
- **Grenade switch:** tap the **grenade icon** in the gun box to change frag / gas / proxy.
- **Crouch:** pull the **movement joystick down** while on the ground.
- **Boost bar:** stays **full** when the host sets boost to 100% (unlimited).

### Touch customization
- Every control can be **moved** (position) and **resized** (size) by the player.
- **Reset to default layout** option available.

### PC controls (keyboard + mouse)

| Action | Key |
|---|---|
| Move left / right | A / D |
| Jetpack fly | W or Space |
| Crouch | S (on the ground) |
| Aim | Mouse |
| Fire | Left click |
| Zoom | Right click |
| Melee | V |
| Throw grenade | G |
| Switch grenade type | Q |
| Weapon swap | Mouse wheel or 1 / 2 |
| Reload | R |
| Pickup / Pair | E |
| Open chat / send message | Enter |

- PC players can **rebind keys**.

### In-match chat
- **Chat icon** on the HUD, near the top center by the match timer — movable and resizable like other controls.
- Tapping it opens a small **chat popup**. The match **keeps running** — the player can be killed while typing.
- **Incoming messages** appear as a short line at the top of the screen and **fade after about 4 seconds**.
- **PC:** press **Enter** to open chat, type, press **Enter** again to send.
- Chat is available in the **lobby** and **during the match**.

### When controls can be changed
- **Anytime:** in the lobby (before the match), during the match, and after the match ends.
- **During the match:** through the **Controls** button on the live leaderboard (shown during the 5-second respawn wait).
  - The leaderboard hides after 5 seconds, but an open controls popup **stays open**.
  - The match **does not stop** for that player — they respawn normally and **can be killed** while the popup is open. No game logic changes for this.

---

## 14. Tech Stack & Architecture

| Part | Choice |
|---|---|
| Match screen | **Phaser** (latest stable) — drawing + input only (no Phaser physics) |
| Menus & popups | **React** — lobby, room code, host settings, controls customization, chat, leaderboard |
| Language | **TypeScript** (client + server) |
| Build tool | **Vite** |
| Game server | **Colyseus** (Node.js) |

### Shared game code
- Movement, gravity, jetpack, and collision rules are written **once** in a **shared** module, used by both server and browser.
- Weapon stats, grenade stats, match rules, and the map file live in **shared config**, so balance changes happen in one place.
- Movement and jetpack numbers (speed, jump, fuel) are **tuned during build** in the shared config.

### Project structure
```
project/
├── client/   → React (menus) + Phaser (match)
├── server/   → Colyseus (rooms + game logic)
└── shared/   → movement/collision rules, weapon stats, match rules, map JSON
```

---

## 15. Server & Networking

- **Authoritative server:** browsers send only **inputs**; the server runs the real game (movement, bullets, damage, kills, pickups, spawns, random guns, points, timer).
- **Connection:** **WebSocket** for v1 (code structured so WebRTC can be added later if needed).
- **Tick rate:** **30** game updates/sec on the server, **20** snapshots/sec sent to players.
- **Lag handling:** **client prediction** (own movement feels instant), **interpolation** (other players move smoothly), **lag compensation** (server rewinds to check hits as the shooter saw them).
- The server decides all contested moments: melee "who hit first", two players grabbing the same pickup, random spawns and guns.

---

## 16. Map (Catacombs-style, original design)

- **Own original map** with the Catacombs structure: octagon-like outer boundary, cave tunnels along top and bottom, a grid of cross-shaped corridors, a central block, mirror symmetry.

| Item | Decision |
|---|---|
| Map editor | **Tiled** → exports one JSON file in `shared/` |
| Tile size | 32 × 32 px |
| Map size | ~100 × 60 tiles (3200 × 1920 px) |
| Spawn points | **16** fixed, spread symmetrically |
| Pickup spots | **14** fixed — each refresh, every spot gets a random item |
| Spawn rule | **Purely random** among spawn points (no enemy-distance check) |
| Spacing | Every spawn point at least **5 tiles (160 px)** from every pickup spot |

---

## 17. Player Identity

- No login, **no database**. Players **type their name** when joining.
- **Name rules:** letters only, 3–12 letters.
- **Duplicate names:** first come, first served — a second player with a taken name is asked to choose another.
- The name is **saved in the browser** (local storage), pre-filled and editable on the next visit.
- A **reconnect token** is also kept in the browser so a disconnected player can rejoin automatically.
- **Avatar:** one **default character** for v1 (more options in a future version).
- **Telling players apart:**
  - Each player gets one of **8 colors** when joining (first come, first served).
  - **Name above the head** in small, clean text in the player's color.
  - Character **outfit tinted** in that color.
  - **Leaderboard and chat** use the same color.

---

## 18. Art & Sound

- **Placeholder art and sound first** (simple shapes, basic or no sounds) — all gameplay and networking built and tested on placeholders.
- **Real art and sound in a later phase.** Source (own drawing, artist, or licensed asset packs) to be decided at that phase.
- Real art will be **original**, keeping the doodle-style feel.

---

## 19. Hosting

| Stage | Website | Game server |
|---|---|---|
| Development & testing | **Vercel** | Dev4's existing **testing VPS** |
| After game completion | Moved onto a **VPS** | **VPS** |

- **Vercel hosts the website only** — it can't run the always-on Colyseus WebSocket server, so the game server is always on a VPS.
- **HTTPS/WSS** with a free SSL certificate (Let's Encrypt) on the server.

---

## 20. Pending

- Nothing pending — all sections are defined.
