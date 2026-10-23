import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import type { HudState } from '../game/Game';
import { AudioEngine } from '../game/audio';
import type { MatchConfig } from '../game/types';
import type { NetClient, NetSession } from '../net/client';
import Hud from './Hud';
import TouchControls from './TouchControls';

const isTouch = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

interface Props {
  config: MatchConfig;
  net?: NetSession;
  client?: NetClient;
  onRematch: () => void;
  onExit: () => void;
}

export default function GameView({ config, net, client, onRematch, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [muted, setMuted] = useState(false);
  const [ping, setPing] = useState(0);
  const audio = useRef(new AudioEngine());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = new Game(canvas, config, audio.current, net ?? null);
    g.onHud = setHud;
    const onResize = () => g.resize();
    window.addEventListener('resize', onResize);
    g.start();
    setGame(g);
    return () => { window.removeEventListener('resize', onResize); g.stop(); setGame(null); };
  }, [config, net]);

  useEffect(() => { audio.current.setMuted(muted); }, [muted]);

  useEffect(() => {
    if (!client) return;
    const t = window.setInterval(() => setPing(client.rtt), 1000);
    return () => window.clearInterval(t);
  }, [client]);

  const btn = 'rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white backdrop-blur hover:bg-black/70';
  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
      {game && hud && (
        <>
          <Hud h={hud} online={!!net} onResume={() => game.togglePause()} onRematch={onRematch} onExit={onExit} />
          {isTouch() && !hud.over && <TouchControls game={game} />}
          <div className="absolute right-3 top-2 flex items-center gap-2">
            {client?.room && <span className="rounded-full bg-black/45 px-3 py-1 font-mono text-xs font-bold text-amber-200 backdrop-blur">{client.room.code} · {ping}ms</span>}
            <button className={btn} onClick={() => setMuted((m) => !m)}>{muted ? '🔇' : '🔊'}</button>
            <button className={btn} onClick={() => game.togglePause()}>{net ? '☰' : '❚❚'}</button>
          </div>
          {net && client?.status === 'closed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="rounded-2xl border border-white/10 bg-stone-950 p-6 text-center">
                <div className="text-xl font-black">Disconnected</div>
                <button onClick={onExit} className="mt-4 rounded-lg bg-amber-400 px-5 py-2 font-bold text-black">Back to menu</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
