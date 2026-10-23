import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { SCENES, type SceneName } from '../dev/scenes';
import { devicePixelScale } from '../lib/dpr';

/**
 * Mounts a Phaser game inside the page and tears it down on unmount.
 *
 * The canvas is sized in real device pixels (capped at 2x for speed on phones) and stretched to the page with CSS,
 * so it is sharp on high-density screens. Phaser's own RESIZE mode only renders at CSS-pixel size, so we resize it.
 */
export default function GameCanvas({ scene, status }: { scene: SceneName; status: string }) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || game.current) return;
    const dpr = devicePixelScale();
    const size = () => ({
      w: Math.max(1, Math.round(el.clientWidth * dpr)),
      h: Math.max(1, Math.round(el.clientHeight * dpr)),
    });
    const first = size();

    const g = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      backgroundColor: '#1b1424',
      scale: { mode: Phaser.Scale.NONE, width: first.w, height: first.h },
      render: { antialias: true, roundPixels: false },
      input: { touch: { capture: true }, mouse: { preventDefaultWheel: true } },
      scene: SCENES[scene].scenes,
    });
    game.current = g;
    g.canvas.style.width = '100%';
    g.canvas.style.height = '100%';

    const ro = new ResizeObserver(() => {
      const s = size();
      g.scale.resize(s.w, s.h);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      g.destroy(true);
      game.current = null;
    };
  }, [scene]);

  useEffect(() => {
    game.current?.registry.set('status', status);
  }, [status]);

  return <div ref={host} className="h-full w-full touch-none select-none" />;
}
