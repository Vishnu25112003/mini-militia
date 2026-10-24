# Catacombs — Mini Militia Classic, LAN edition for the browser

A web rebuild of **Mini Militia Classic** (Appsomniacs, `com.appsomniacs.mmc` 0.14.4), multiplayer only, on the **Catacombs** map. One machine hosts; everyone on the same Wi‑Fi plays in a browser on desktop (keyboard + mouse) or phone (the original's dual-stick touch controls).

Modes: **Deathmatch**, **Team Deathmatch**, **Capture the Flag**. Rooms of 2–12 players (8 by default). All 23 guns from the APK, including **dual wield** for the Desert Eagle, Gold Eagle, Magnum, Uzi, Tec-9 and M1881, as in the original.

## Run it

```bash
npm install
npm run extract -- /path/to/com.appsomniacs.mmc_0.14.4.apk   # once; defaults to ~/Downloads/com.appsomniacs.mmc_0.14.4.apk
npm start                                                    # PORT=3000 by default
```

The server prints its LAN address (e.g. `http://192.168.1.44:3000`). Open it on every device on the same Wi‑Fi.

**Flow:** enter your name, then **Create Room** (you become the host and get a 6-character code) or **Join Room** with a friend's code. In the lobby everyone marks **Ready**. The match starts by itself 2 minutes after a second player arrives, or 10 seconds once everyone is ready, and the host can press **Start** any time. Share the code with **Copy** or **Share** (a QR code and LAN link).

**During and after a match:**
- Chat in the lobby or in a match (the chat button, or Enter / T).
- A dropped connection or a page refresh puts you back in your seat for 30 seconds.
- The host can remove players. If the host leaves, the room is cancelled.
- After the match, the final leaderboard offers Play again or Back to lobby.

One server can host many rooms at once. Room codes are built so internet play can be added later.

The game art, map, font and sounds are **not** in this repo. `npm run extract` pulls them out of your own copy of the APK into `public/assets/` (git-ignored). Don't redistribute them.

Already extracted with an older version? Rebuild just the map collision and the jet glow with `npm run extract -- /path/to.apk map`.

### Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | A / D | left stick |
| Jetpack | W or Space | push left stick up |
| Crouch | S | push left stick down, or the shield button |
| Aim / shoot | mouse / left click | right stick (shoots once pushed about a third of the way; adjustable) |
| Throw grenade | G or right click | grenade button |
| Cycle grenade type | C | small grenade button |
| Swap weapon | Q or mouse wheel | swap button |
| Reload | R | ammo button |
| Melee | F or middle click | fist button |
| Pick up weapon | E | weapon icon that appears |
| Scoreboard | hold Tab | tap the timer |
| Chat | Enter or T | chat button |
| Scope zoom | Z | the 1X chip |
| Voice taunts | 1–8 | — |
| Settings | Esc, or click the cog on the health meter | tap the cog |

These are the defaults. **Controls and settings** (title screen, lobby, Esc or the cog in game) lets each player:

- rebind every action to any key or mouse button, two per action;
- on touch: invert the movement or aim stick, swap the sticks to the other thumbs, set HUD opacity and **fire sensitivity** (how far the aim stick must be pushed to shoot), and open the **placement editor** to drag every button anywhere and size it 0.4×–2.3× (as in the original's PLACEMENT screen);
- set sound volume and turn blood off.

Settings are saved on each device.

### Host settings

The host opens **Settings** (or the map card) in the lobby. Guests see the same panel read-only. The host's device remembers the rules for next time.

| Setting | Options |
| --- | --- |
| Game mode, kill / capture limit, game time, player count | Deathmatch / Team / CTF, 1–99, 2–30 min, 2–12 |
| Gravity | 0–200 (percent of normal). At 0 everything floats: the jetpack pushes up, crouch pushes down, and soldiers, grenades, dropped guns and debris drift to a stop |
| Boost (jetpack tank) | 0 (no jetpack) – 200, or Max (unlimited) |
| Map drops (disappear time) | off, 10, 18, 30 or 60 sec |
| Respawn time, health regen, friendly fire (team modes) | 1–8 sec, on / off. Regen is the original's +1 HP per second (×3 with the Health Regen special) |
| Default loadout | ON: everyone spawns with the host's pick (slot 1, slot 2, Pair toggle for dual guns, grenade counts). OFF: each soldier picks their own in the same picker |
| Global specials | Health Regen, Boost Regen, Boost Increase, Shot Stabilizer, Melee Power, Hi-Cap Magazines, Fast Reload, Grenadier, Adv. Combat Equip., Deflector, Hi-Velocity Ammo, Auto Reloader |

### Dual wield

These rules come from the APK: `WeaponStructures::isValidDualType`, `Weapon::pickupAsDual` and `DUAL_SCL = 0.8`.

- Pick up a second Uzi, Tec-9, Desert Eagle, Gold Eagle, Magnum or M1881 to hold a pair.
- The pair fires alternately and reloads together, and you drop both when you die.
- A pistol can also carry a riot shield in the off hand.
- Picking up another pairable gun while holding a pair asks **Replace which gun?**

## What was reverse engineered

The APK is a **cocos2d-x 2.2.6** game (`lib/arm64-v8a/libcocos2dcpp.so`, codename `doodlearmy2client`) using **Chipmunk** physics and **RakNet** for LAN (`RakNetLAN`, `RakNetLocalServer`). The library ships with C++ symbols exported, so functions were located by name and disassembled with `llvm-objdump`. REA's Hopper engine was tried first but could not finish its initial analysis of the 20 MB binary within its startup window.

| Asset / system | Where it came from | How it's used |
| --- | --- | --- |
| Catacombs map | `assets/hd/11catacombs_new.tmx` (Tiled, 55×35 tiles of 64 pt, layers `tilebg` + `tile`, 34 objects) | drawn tile-for-tile; spawns `sp_p_*`, weapon spawners `wp_p_*` with their weapon lists, flag stations `fp_*`, CTF spawns/weapons `ctf_*` |
| Collision | `MapShapeFactory` gid→shape table (140 entries) and the polygons `createStaticBodyShape` builds for each shape type, captured by running that code in an emulator (`tools/mmc-shapes.json`) | each solid tile's polygons are rasterized into 4 pt cells, so floors and slopes sit where the original's do and decorative pebbles don't block |
| Weapon stats | the `WeaponAttributeModel` switch inlined in every weapon `init()` (e.g. `AK47::init` @ `0x554b94`) | pellets, spread, damage, range, fire interval, reload time, magazine and max ammo per gun — see `shared/weapons.js` (`[RE]` marks) |
| Movement | `SoldierLocalController::init/updateStep`, `PhysicsManager::init` | HP 100, run speed 190, thrust 320, velocity clamps; space gravity is (0,0), so gravity is applied per body and tuned to feel. Health regen +1 HP/s, ×3 with the special |
| Jetpack exhaust | `Boostie` (two per soldier) | a flickering `flame` under each of the jetpack's two nozzles, `Smoke.plist` glow (`ora_new.png`) and a short motion streak. The APK has no jetpack sprite, so the twin-tank pack on the soldier's back is drawn in code |
| Melee | `SoldierLocalController::meleeAttack/checkMeleeCollision`, `HUD::onPunch` | a swing every 0.5 s lunges along the aim by the melee charge (0 at spawn, +45/s up to 125, −35 a swing; no extra push past 320). Melee while running is a burst of speed. Hits land along the aim during the swing |
| Flamethrower | `FLAME::setFrame/updateStep/calcDamage` | `flame1`/`flame2` puffs that grow and fade, 150 pt reach, 10–30 damage by freshness, no afterburn |
| Radar | `Radar`, `ArrowAlert` | when someone fires, an `arrowAlert` at the screen edge points at them for 2 s in their colour; CTF flags get `arrow` markers |
| Sprites | `menuTexture` / `partsTexture` TexturePacker atlases | soldier parts (head/body/leg/arm sets), every weapon, HUD buttons, effects |
| Sounds | `assets/da2sound16.ckb` Cricket Audio bank: 111 clips, 16 kHz mono PCM16 | written out as WAV and played with positional audio |
| Font | `font02_new.png` bitmap font | converted to an OpenType font (`Militia`) |

Design choices where the binary wasn't decoded (marked in code): spawn loadout (Uzi + Desert Eagle + 2 frags), grenade fuses/radii, respawn delay, gas damage, riot shield blocking arc, flag return time, zero-gravity drift, how quickly a melee lunge slows down. The radar also keeps pointing at shooters beyond the original's 1296 pt sizing range, at the smallest arrow size.

## Architecture

- `server/` — Node HTTP + WebSocket server. Authoritative 60 Hz simulation, 30 Hz snapshots, hitscan/projectiles/explosions, pickups, modes.
- `shared/` — code both sides run: map collision, soldier physics, weapon table. The client predicts its own movement with the same `stepBody` and reconciles against the server.
- `server/rooms.mjs` — room codes, join/resume, many rooms per server.
- `public/` — canvas renderer, input (keyboard/mouse + touch), effects, and the DOM screens from the UI contact sheet (`screens.js`), with reconnect handling in `net.js`.
- `tools/extract.mjs` — the APK → web assets pipeline.

## Tests

```bash
npm test   # node:test server logic + Playwright on Chromium, Firefox, WebKit and a touch phone
```
