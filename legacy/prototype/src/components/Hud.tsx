import type { HudState } from '../game/Game';
import { GRENADES } from '../game/weapons';
import type { GrenadeKind } from '../game/types';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Hud({ h, online = false, onResume, onRematch, onExit }: { h: HudState; online?: boolean; onResume: () => void; onRematch: () => void; onExit: () => void }) {
  const teamMode = h.mode !== 'dm';
  const leader = h.board[0];
  return (
    <div className="pointer-events-none absolute inset-0 text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
      {/* top bar */}
      <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/45 px-4 py-1.5 text-sm font-bold backdrop-blur">
        {teamMode ? (
          <>
            <span className="text-blue-400">{h.teamScore[1] ?? 0}</span>
            <span className="font-mono text-base">{fmt(h.time)}</span>
            <span className="text-orange-400">{h.teamScore[2] ?? 0}</span>
          </>
        ) : (
          <>
            <span>{h.kills} / {h.scoreLimit}</span>
            <span className="font-mono text-base">{fmt(h.time)}</span>
            <span className="text-stone-300">Lead: {leader?.name} {leader?.kills}</span>
          </>
        )}
      </div>

      {/* kill feed */}
      <div className="absolute left-3 top-3 flex flex-col gap-1 text-sm font-semibold">
        {h.feed.map((f) => (
          <div key={f.id} style={{ color: f.color }} className="rounded bg-black/40 px-2 py-0.5">{f.text}</div>
        ))}
      </div>

      {/* bottom-left: health + fuel */}
      <div className="absolute bottom-3 left-3 w-44 space-y-1.5 sm:w-56">
        <Bar label="HP" value={h.hp / 100} color={h.hp > 50 ? '#4ade80' : h.hp > 25 ? '#facc15' : '#ef4444'} />
        <Bar label={h.emp ? 'EMP!' : h.boost ? 'BOOST' : 'FUEL'} value={h.fuel} color={h.emp ? '#94a3b8' : h.boost ? '#22d3ee' : '#fb923c'} />
        {h.carrying && <div className="text-xs font-bold text-amber-300">You have the flag — return to base!</div>}
      </div>

      {/* bottom-right: weapon */}
      <div className="absolute bottom-3 right-3 rounded-xl bg-black/45 px-4 py-2 text-right backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-stone-300">{h.weapon}{h.alt ? ` · alt ${h.alt}` : ''}</div>
        <div className="font-mono text-3xl font-black leading-none">
          {h.reloading ? <span className="text-amber-300">RELOAD</span> : <>{h.mag}<span className="text-lg text-stone-300"> / {h.reserve}</span></>}
        </div>
        <div className="mt-1 flex justify-end gap-2 text-xs">
          {(Object.keys(GRENADES) as GrenadeKind[]).map((k, i) => (
            <span key={k} className={`rounded px-1.5 py-0.5 ${h.gSel === k ? 'bg-amber-400 text-black' : 'bg-white/10'} ${h.grenades[k] ? '' : 'opacity-40'}`}>
              {i + 1}·{GRENADES[k].name} {h.grenades[k]}
            </span>
          ))}
        </div>
      </div>

      {h.prompt && h.alive && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-lg bg-black/55 px-3 py-1 text-sm font-semibold">{h.prompt}</div>}

      {!h.alive && !h.over && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/30">
          <div className="text-center">
            <div className="text-4xl font-black text-red-400">YOU DIED</div>
            <div className="mt-1 text-lg">Respawn in {Math.ceil(h.respawnT)}</div>
          </div>
        </div>
      )}

      {h.over && (
        <Overlay title={`${h.winner} wins!`}>
          <Board h={h} />
          <div className="pointer-events-auto mt-5 flex justify-center gap-3">
            <button onClick={onRematch} className="rounded-lg bg-amber-400 px-5 py-2 font-bold text-black hover:bg-amber-300">Rematch</button>
            <button onClick={onExit} className="rounded-lg border border-white/20 px-5 py-2 font-semibold hover:bg-white/10">Menu</button>
          </div>
        </Overlay>
      )}

      {h.paused && !h.over && (
        <Overlay title={online ? 'Menu' : 'Paused'}>
          {online && <p className="mb-4 text-center text-sm text-stone-400">The match keeps running while you are in this menu.</p>}
          <div className="pointer-events-auto flex justify-center gap-3">
            <button onClick={onResume} className="rounded-lg bg-amber-400 px-5 py-2 font-bold text-black hover:bg-amber-300">Resume</button>
            <button onClick={onExit} className="rounded-lg border border-white/20 px-5 py-2 font-semibold hover:bg-white/10">{online ? 'Leave room' : 'Quit to menu'}</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-xs font-bold text-stone-200">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/55 ring-1 ring-white/10">
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-stone-950/90 p-6 shadow-2xl">
        <h2 className="mb-4 text-center text-3xl font-black">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Board({ h }: { h: HudState }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase text-stone-400">
        <tr><th className="text-left">Player</th><th>K</th><th>D</th></tr>
      </thead>
      <tbody>
        {h.board.map((r) => (
          <tr key={r.id} className={r.me ? 'font-bold text-amber-300' : ''}>
            <td className="py-0.5"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.name}</td>
            <td className="text-center">{r.kills}</td>
            <td className="text-center">{r.deaths}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
