import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/Game';

interface StickProps {
  side: 'left' | 'right';
  onChange: (x: number, y: number, active: boolean) => void;
}

function Stick({ side, onChange }: StickProps) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const R = 52;

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
    setKnob({ x: dx, y: dy });
    onChange(dx / R, dy / R, true);
  };

  return (
    <div
      ref={base}
      className={`pointer-events-auto absolute bottom-6 ${side === 'left' ? 'left-6' : 'right-6'} h-32 w-32 rounded-full border-2 border-white/25 bg-white/10`}
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (id.current === e.pointerId) update(e); }}
      onPointerUp={(e) => { if (id.current === e.pointerId) { id.current = null; setKnob({ x: 0, y: 0 }); onChange(0, 0, false); } }}
      onPointerCancel={() => { id.current = null; setKnob({ x: 0, y: 0 }); onChange(0, 0, false); }}
    >
      <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

export default function TouchControls({ game }: { game: Game }) {
  useEffect(() => {
    game.touch = { moveX: 0, jet: false, aimX: 1, aimY: 0, fire: false };
    return () => { game.touch = null; };
  }, [game]);

  const btn = 'pointer-events-auto rounded-full border border-white/25 bg-white/15 px-3 py-2 text-xs font-bold text-white active:bg-white/40';
  return (
    <div className="absolute inset-0">
      <Stick side="left" onChange={(x, y) => { if (game.touch) { game.touch.moveX = x; game.touch.jet = y < -0.45; } }} />
      <Stick side="right" onChange={(x, y, active) => { if (game.touch) { game.touch.aimX = x; game.touch.aimY = y; game.touch.fire = active && Math.hypot(x, y) > 0.35; } }} />
      <div className="absolute bottom-40 right-4 flex flex-col gap-2">
        <button className={btn} onPointerDown={() => game.pressAction('grenade')}>GREN</button>
        <button className={btn} onPointerDown={() => game.pressAction('swap')}>SWAP</button>
        <button className={btn} onPointerDown={() => game.pressAction('reload')}>RELOAD</button>
      </div>
      <div className="absolute bottom-40 left-4 flex flex-col gap-2">
        <button className={btn} onPointerDown={() => game.pressAction('pickup')}>PICK UP</button>
        <button className={btn} onPointerDown={() => game.pressAction('melee')}>MELEE</button>
      </div>
    </div>
  );
}
