import { useState } from 'react';
import { MODES } from '../game/modes';
import type { GameMode, MatchConfig } from '../game/types';

const KEYS: [string, string][] = [
  ['A / D', 'Run'],
  ['W / Space', 'Jetpack'],
  ['Mouse', 'Aim'],
  ['Left click', 'Fire'],
  ['R', 'Reload'],
  ['Q / Right click', 'Swap weapon'],
  ['G', 'Throw grenade (1-3 pick type)'],
  ['E', 'Pick up item'],
  ['F', 'Melee'],
  ['Esc', 'Pause'],
];

export default function MainMenu({ onStart, onOnline }: { onStart: (c: MatchConfig) => void; onOnline: (name: string) => void }) {
  const [mode, setMode] = useState<GameMode>('dm');
  const [bots, setBots] = useState(5);
  const [minutes, setMinutes] = useState(5);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('cm-name') ?? 'Player'; } catch { return 'Player'; }
  });

  const start = () => {
    try { localStorage.setItem('cm-name', name); } catch { /* storage unavailable */ }
    const m = MODES.find((x) => x.id === mode)!;
    onStart({ mode, bots, scoreLimit: m.limit, timeLimit: minutes * 60, playerName: name.trim() || 'Player', seed: (Math.random() * 1e9) | 0 });
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1d3a_0%,#0b0810_65%)] text-stone-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-300/80">Doodle-army style arena shooter</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-7xl">
            CATA<span className="text-amber-400">COMBS</span> MILITIA
          </h1>
          <p className="mt-3 text-stone-400">Jetpacks, rockets and a maze of tunnels. Play solo against bots, or host a room and share the link with friends.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">Match</h2>
            <div className="grid gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${mode === m.id ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                >
                  <div className="font-bold">{m.name}</div>
                  <div className="text-sm text-stone-400">{m.blurb}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-stone-400">Your name</span>
                <input
                  value={name}
                  maxLength={14}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-amber-400"
                />
              </label>
              <label className="block text-sm">
                <span className="text-stone-400">Time limit: {minutes} min</span>
                <input type="range" min={2} max={10} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="mt-3 w-full accent-amber-400" />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-stone-400">Bots: {bots}</span>
                <input type="range" min={0} max={9} value={bots} onChange={(e) => setBots(+e.target.value)} className="mt-2 w-full accent-amber-400" />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={start} className="rounded-xl bg-amber-400 px-8 py-3 text-lg font-black text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-95">
                Play
              </button>
              <button
                onClick={() => {
                  try { localStorage.setItem('cm-name', name); } catch { /* storage unavailable */ }
                  onOnline(name.trim() || 'Player');
                }}
                className="rounded-xl border border-amber-400/60 px-6 py-3 font-bold text-amber-200 transition hover:bg-amber-400/10 active:scale-95"
              >
                Play with friends
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">Controls</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {KEYS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt><kbd className="rounded bg-black/50 px-2 py-0.5 font-mono text-xs text-amber-200">{k}</kbd></dt>
                  <dd className="text-stone-300">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-stone-500">Touch devices get dual sticks: left to run and fly, right to aim and fire.</p>
          </section>
        </div>

        <footer className="text-center text-xs text-stone-600">
          Fan-made clone. Original art and sound, level layout and mechanics modelled on observations of the Android game.
        </footer>
      </div>
    </div>
  );
}
