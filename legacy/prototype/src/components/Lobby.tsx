import { useEffect, useRef, useState } from 'react';
import { MODES, modeName } from '../game/modes';
import type { GameMode } from '../game/types';
import type { NetClient } from '../net/client';
import { MAX_PLAYERS } from '../net/protocol';

const TEAM_CSS: Record<number, string> = { 1: 'text-blue-400', 2: 'text-orange-400' };

export default function Lobby({ client, name, joinCode, onBack }: { client: NetClient; name: string; joinCode: string | null; onBack: () => void }) {
  const [mode, setMode] = useState<GameMode>('dm');
  const [bots, setBots] = useState(2);
  const [minutes, setMinutes] = useState(5);
  const [code, setCode] = useState(joinCode ?? '');
  const [copied, setCopied] = useState(false);
  const autoJoined = useRef(false);

  const connect = () => { client.connect(name).catch(() => { /* surfaced through client.error */ }); };

  useEffect(() => { connect(); return () => { /* connection is closed by onBack */ }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // opened via a shared ?room=CODE link
  useEffect(() => {
    if (client.status === 'open' && joinCode && !autoJoined.current && !client.room) {
      autoJoined.current = true;
      client.join(joinCode);
    }
  });

  const room = client.room;
  const isHost = room ? room.host === client.clientId : false;
  const link = room ? `${window.location.origin}${window.location.pathname}?room=${room.code}` : '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt('Copy this link', link); }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1d3a_0%,#0b0810_65%)] px-4 py-10 text-stone-100">
      <div className="mx-auto max-w-2xl">
        <button onClick={onBack} className="mb-6 text-sm text-stone-400 hover:text-white">← Back to menu</button>
        <h1 className="text-4xl font-black tracking-tight">Play with friends</h1>

        {client.error && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
            <span>{client.error}</span>
            <button onClick={() => { client.clearError(); if (client.status !== 'open') connect(); }} className="shrink-0 font-semibold underline">
              {client.status === 'open' ? 'Dismiss' : 'Retry'}
            </button>
          </div>
        )}

        {client.status === 'connecting' && <p className="mt-6 text-stone-400">Connecting to the game server…</p>}

        {client.status === 'open' && !room && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">Host a room</h2>
              <div className="grid gap-2">
                {MODES.map((m) => (
                  <button key={m.id} onClick={() => setMode(m.id)} className={`rounded-lg border px-3 py-2 text-left text-sm transition ${mode === m.id ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 hover:bg-white/5'}`}>
                    <div className="font-bold">{m.name}</div>
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-sm">
                <span className="text-stone-400">Bots to fill empty seats: {bots}</span>
                <input type="range" min={0} max={MAX_PLAYERS - 1} value={bots} onChange={(e) => setBots(+e.target.value)} className="mt-1 w-full accent-amber-400" />
              </label>
              <label className="mt-2 block text-sm">
                <span className="text-stone-400">Time limit: {minutes} min</span>
                <input type="range" min={2} max={15} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="mt-1 w-full accent-amber-400" />
              </label>
              <button onClick={() => client.create(mode, bots, minutes)} className="mt-5 w-full rounded-xl bg-amber-400 py-3 font-black text-black hover:bg-amber-300 active:scale-95">
                Create room
              </button>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">Join a room</h2>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                placeholder="CODE"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-center font-mono text-3xl tracking-[0.4em] outline-none focus:border-amber-400"
              />
              <button disabled={code.length !== 4} onClick={() => client.join(code)} className="mt-4 w-full rounded-xl border border-amber-400/60 py-3 font-bold text-amber-200 enabled:hover:bg-amber-400/10 disabled:opacity-40">
                Join
              </button>
              <p className="mt-4 text-xs text-stone-500">Ask the host for their 4-letter code, or open the link they shared.</p>
            </section>
          </div>
        )}

        {room && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-stone-400">Room code</div>
                <div className="font-mono text-6xl font-black tracking-[0.25em] text-amber-300">{room.code}</div>
              </div>
              <div className="text-right text-sm text-stone-300">
                <div className="font-semibold">{modeName(room.mode)}</div>
                <div className="text-stone-400">{room.minutes} min · {room.bots} bots</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-stone-300" />
              <button onClick={copy} className="rounded-lg bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">{copied ? 'Copied!' : 'Copy link'}</button>
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest text-stone-400">Players ({room.players.length}/{MAX_PLAYERS})</h2>
            <ul className="grid gap-1">
              {room.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm">
                  <span className={`font-semibold ${TEAM_CSS[p.team] ?? ''}`}>{p.name}{p.id === client.clientId ? ' (you)' : ''}</span>
                  {p.host && <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-300">HOST</span>}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex gap-3">
              {isHost ? (
                <button onClick={() => client.start()} className="rounded-xl bg-amber-400 px-8 py-3 text-lg font-black text-black hover:bg-amber-300 active:scale-95">Start match</button>
              ) : (
                <div className="py-3 text-stone-400">Waiting for the host to start…</div>
              )}
              <button onClick={() => client.leave()} className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">Leave room</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
