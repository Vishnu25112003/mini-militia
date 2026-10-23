// Headless sanity run: bots-only match for each mode. Bundle with esbuild, then run with node.
import { botThink, newBotState } from '../src/game/ai';
import { MAP } from '../src/game/map';
import { DT, addPlayer, createWorld, stepWorld } from '../src/game/sim';
import type { GameMode } from '../src/game/types';

for (const mode of ['dm', 'tdm', 'ctf'] as GameMode[]) {
  const w = createWorld({ mode, bots: 8, scoreLimit: mode === 'ctf' ? 3 : 15, timeLimit: 240, playerName: 'x', seed: 1234 });
  for (let i = 0; i < 8; i++) {
    const p = addPlayer(w, `b${i}`, (i % 2) + 1, true);
    p.ai = newBotState(0.4 + (i % 4) * 0.15);
  }
  const counts: Record<string, number> = {};
  let bad = 0, maxSpeed = 0, oob = 0, ticks = 0;
  while (!w.over && w.time < 240) {
    for (const p of w.players) botThink(w, p, DT);
    stepWorld(w, DT);
    ticks++;
    for (const e of w.events) counts[e.t] = (counts[e.t] ?? 0) + 1;
    w.events.length = 0;
    for (const p of w.players) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hp)) bad++;
      if (p.alive && (p.x < 0 || p.y < 0 || p.x > MAP.width || p.y > MAP.height)) oob++;
      maxSpeed = Math.max(maxSpeed, Math.hypot(p.vx, p.vy));
    }
  }
  const stuckInRock = w.players.filter((p) => p.alive && MAP.rectSolid(p.x - 10, p.y - 20, 20, 40)).length;
  console.log(mode, 'sim', w.time.toFixed(0) + 's', 'over', w.over, 'winner', w.winner, 'teamScore', JSON.stringify(w.teamScore),
    'nonFinite', bad, 'oob', oob, 'inRock', stuckInRock, 'maxSpeed', maxSpeed.toFixed(0), JSON.stringify(counts));
  console.log('  kills', w.players.map((p) => `${p.name}:${p.kills}/${p.deaths}`).join(' '));
}
