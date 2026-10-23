import { useEffect, useRef } from 'react';
import { OUT, Sky, bakeTerrain, drawGun } from '../game/art';
import { MAP } from '../game/map';
import { drawSoldierArt, lookFor } from '../game/soldierArt';
import { WEAPONS } from '../game/weapons';
import type { WeaponId } from '../game/types';

// Dev-only: `?art=terrain|soldier|weapons|sky` renders one piece of the art large and on its own.
type Section = 'terrain' | 'soldier' | 'weapons' | 'sky';

const SHIRTS: [string, string][] = [['#3b82f6', '#1e40af'], ['#f97316', '#9a3412'], ['#ef4444', '#7f1d1d'], ['#10b981', '#065f46'], ['#a855f7', '#581c87'], ['#eab308', '#854d0e'], ['#14b8a6', '#115e59'], ['#ec4899', '#831843']];

export default function ArtPreview({ section }: { section: Section }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext('2d')!;
    const sky = new Sky();
    const terrain = section === 'terrain' ? bakeTerrain() : null;
    let raf = 0, t = 0, last = performance.now();

    const frame = (now: number) => {
      t += Math.min(0.1, (now - last) / 1000); last = now;
      g.setTransform(1, 0, 0, 1, 0, 0);
      const W = canvas.width, H = canvas.height;

      if (section === 'sky') {
        sky.draw(g, W, H, 1200, 1100, 1.15, t);
      } else if (section === 'terrain' && terrain) {
        sky.draw(g, W, H, 1300, 1400, 1.1, t);
        const z = 1.6, cx = 1250, cy = 1400;
        g.save(); g.scale(z, z); g.translate(-(cx - W / z / 2), -(cy - H / z / 2));
        g.drawImage(terrain, 0, 0);
        g.restore();
      } else if (section === 'soldier') {
        g.fillStyle = '#e9d9a6'; g.fillRect(0, 0, W, H);
        const scale = 3.1;
        const poses: { aim: number; thrusting?: boolean; onGround: boolean; run: number; vx: number; weapon: WeaponId; firing?: boolean; carrying?: string; facing: 1 | -1 }[] = [
          { aim: 0, onGround: true, run: 0, vx: 0, weapon: 'ak47', facing: 1 },
          { aim: 0.2, onGround: true, run: t * 5, vx: 200, weapon: 'm16', facing: 1 },
          { aim: -0.5, onGround: false, thrusting: true, run: 0, vx: 60, weapon: 'smaw', facing: 1 },
          { aim: Math.PI + 0.3, onGround: true, run: t * 5, vx: -200, weapon: 'shotgun', facing: -1 },
          { aim: 0.1, onGround: true, run: 0, vx: 0, weapon: 'uzi', firing: true, facing: 1 },
          { aim: 0, onGround: true, run: 0, vx: 0, weapon: 'magnum', facing: 1 },
          { aim: -0.1, onGround: false, thrusting: true, run: 0, vx: 0, weapon: 'm93ba', carrying: '#f97316', facing: 1 },
          { aim: 0.4, onGround: true, run: 0, vx: 0, weapon: 'riot', facing: 1 },
        ];
        poses.forEach((p, i) => {
          const col = i % 4, row = Math.floor(i / 4);
          const [shirt, dark] = SHIRTS[i];
          g.save();
          g.translate(W / 8 + col * (W / 4), H / 4 + row * (H / 2) + 20);
          g.scale(scale, scale);
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(0, 36, 22, 4, 0, 0, Math.PI * 2); g.fill();
          drawSoldierArt(g, lookFor(i, shirt, dark), { facing: p.facing, aim: p.aim, thrusting: !!p.thrusting, onGround: p.onGround, runPhase: p.run, vx: p.vx, weapon: p.weapon, firing: p.firing, carrying: p.carrying, t });
          g.restore();
        });
      } else {
        g.fillStyle = '#e9d9a6'; g.fillRect(0, 0, W, H);
        const ids = Object.keys(WEAPONS) as WeaponId[];
        const cols = 4, cw = W / cols, ch = H / Math.ceil(ids.length / cols);
        ids.forEach((id, i) => {
          const d = WEAPONS[id];
          const col = i % cols, row = Math.floor(i / cols);
          g.save();
          g.translate(col * cw + cw * 0.3, row * ch + ch * 0.52);
          g.scale(2.1, 2.1);
          drawGun(g, id, d.length, d.color);
          g.restore();
          g.fillStyle = OUT; g.font = '700 15px system-ui'; g.fillText(`${d.name}`, col * cw + 16, row * ch + ch - 14);
        });
      }
      void MAP;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [section]);

  return <canvas ref={ref} width={1280} height={section === 'weapons' ? 900 : section === 'soldier' ? 760 : 720} style={{ width: 1280, height: section === 'weapons' ? 900 : section === 'soldier' ? 760 : 720, cursor: 'default' }} />;
}
