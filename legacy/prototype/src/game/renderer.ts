import { MAP } from './map';
import { OUT, Sky, bakeTerrain, drawGun } from './art';
import { drawSoldierArt, lookFor } from './soldierArt';
import { ART_SCALE, PLAYER_H, activeWeapon } from './sim';
import { WEAPONS, ITEM_NAMES, GRENADES } from './weapons';
import type { GameEvent, GrenadeKind, Player, World } from './types';
import type { AudioEngine } from './audio';

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; gravity: number; drag: number; kind: 'dot' | 'ring' | 'smoke' | 'line';
}

export const TEAM_COLORS: Record<number, { body: string; dark: string; css: string }> = {
  1: { body: '#3b82f6', dark: '#1e40af', css: '#60a5fa' },
  2: { body: '#f97316', dark: '#9a3412', css: '#fb923c' },
};
const FFA_COLORS = ['#ef4444', '#a855f7', '#10b981', '#eab308', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'];
export const colorFor = (w: World, p: Player) => (w.config.mode === 'dm' ? FFA_COLORS[p.id % FFA_COLORS.length] : TEAM_COLORS[p.team].body);
const darker = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.6).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
};

const VIEW_HEIGHT = 760; // world pixels visible vertically

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private terrain = bakeTerrain();
  private sky = new Sky();
  private particles: Particle[] = [];
  private shake = 0;
  cam = { x: 0, y: 0 };
  zoom = 1;
  width = 0;
  height = 0;
  private dpr = 1;
  private t = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width; this.height = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.zoom = Math.max(0.35, this.height / VIEW_HEIGHT);
  }

  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.width / 2) / this.zoom + this.cam.x, y: (sy - this.height / 2) / this.zoom + this.cam.y };
  }

  // ---- events -> effects + sound ----
  handleEvents(w: World, local: Player | undefined, audio: AudioEngine) {
    const lx = local?.x ?? 0, ly = local?.y ?? 0;
    const vol = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - lx, y - ly) / 1500);
    for (const e of w.events) this.onEvent(e, vol(('x' in e ? e.x : lx) as number, ('y' in e ? e.y : ly) as number), audio, local);
    w.events.length = 0;
  }

  private burst(x: number, y: number, n: number, color: string, speed: number, size: number, life: number, gravity = 600, kind: Particle['kind'] = 'dot') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, gravity, drag: 1.5, kind });
    }
  }

  private onEvent(e: GameEvent, v: number, audio: AudioEngine, local?: Player) {
    switch (e.t) {
      case 'shot': {
        audio.play(e.weapon, v);
        this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.06, max: 0.06, size: 13, color: '#fff2a8', gravity: 0, drag: 0, kind: 'dot' });
        break;
      }
      case 'impact': this.burst(e.x, e.y, e.wall ? 5 : 6, e.wall ? '#ffe08a' : '#c0392b', 240, 2.5, 0.3); audio.play('impact', v); break;
      case 'hit': this.burst(e.x, e.y, 6, '#c62828', 220, 3, 0.5, 900); audio.play('hit', v); break;
      case 'explosion':
        if (e.gas) { this.burst(e.x, e.y, 20, '#9acd32', 80, 12, 1.4, -20, 'smoke'); break; }
        this.burst(e.x, e.y, 36, '#ffb347', 560, 6, 0.7, 300);
        this.burst(e.x, e.y, 20, '#3a3a3a', 170, 18, 1.3, -60, 'smoke');
        this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: e.r, color: '#fff1b0', gravity: 0, drag: 0, kind: 'ring' });
        audio.play('explosion', v);
        if (local) this.shake = Math.max(this.shake, 14 * v);
        break;
      case 'kill':
        this.burst(e.x, e.y, 30, '#a31515', 420, 4, 0.9, 900);
        if (local?.id === e.victim) audio.play('death', 1); else audio.play('death', v * 0.6);
        break;
      case 'pickup': audio.play('pickup', local?.id === e.by ? 1 : v); break;
      case 'reload': audio.play('reload', v); break;
      case 'spawn': this.burst(e.x, e.y, 14, '#9ad7ff', 200, 3.5, 0.5, -200); audio.play('spawn', v * 0.5); break;
      case 'melee': audio.play('melee', v); break;
      case 'land': this.burst(e.x, e.y, 10, '#e0cf9f', 180, 5, 0.6, 400, 'smoke'); break;
      case 'flag': audio.play('flag', 1); break;
    }
  }

  // ---- frame ----
  draw(w: World, local: Player | undefined, dt: number) {
    this.t += dt;
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (local) {
      const tx = local.x + Math.cos(local.aim) * 110, ty = local.y + Math.sin(local.aim) * 70;
      const k = Math.min(1, dt * 7);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    const vw = W / this.zoom, vh = H / this.zoom;
    this.cam.x = Math.max(vw / 2, Math.min(MAP.width - vw / 2, this.cam.x));
    this.cam.y = Math.max(vh / 2, Math.min(MAP.height - vh / 2, this.cam.y));
    this.shake *= Math.pow(0.001, dt);

    this.sky.draw(ctx, W, H, this.cam.x, this.cam.y, this.zoom, this.t);

    ctx.save();
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const x0 = Math.max(0, this.cam.x - vw / 2), y0 = Math.max(0, this.cam.y - vh / 2);
    const sw = Math.min(vw, MAP.width - x0), sh = Math.min(vh, MAP.height - y0);
    ctx.drawImage(this.terrain, x0, y0, sw, sh, x0, y0, sw, sh);

    this.drawPickups(w);
    this.drawFlags(w);
    this.drawGas(w);
    for (const p of w.players) if (p.alive) this.drawSoldier(w, p, p === local);
    this.drawProjectiles(w);
    this.updateParticles(w, dt);
    this.drawParticles();

    ctx.restore();
    this.drawMinimap(w, local);
  }

  private outlined(g: CanvasRenderingContext2D, fill: string, width = 2.4) {
    g.fillStyle = fill; g.fill();
    g.lineWidth = width; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
  }

  private drawPickups(w: World) {
    const ctx = this.ctx;
    for (const s of w.pickups) {
      if (!s.item) continue;
      const bob = Math.sin(this.t * 3 + s.x) * 3;
      ctx.save();
      ctx.translate(s.x, s.y - 26 + bob);
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
      glow.addColorStop(0, 'rgba(255,250,210,.75)'); glow.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
      const it = s.item;
      if (it === 'healthpack') {
        ctx.beginPath(); ctx.roundRect(-17, -13, 34, 26, 5); this.outlined(ctx, '#f5f5f5');
        ctx.fillStyle = '#e53935'; ctx.fillRect(-3.5, -9, 7, 18); ctx.fillRect(-9, -3.5, 18, 7);
      } else if (it === 'boosttank') {
        ctx.beginPath(); ctx.roundRect(-9, -20, 18, 40, 8); this.outlined(ctx, '#26c6da');
        ctx.fillStyle = '#e0f7fa'; ctx.fillRect(-4, -13, 3, 22);
      } else if (it in GRENADES) {
        ctx.beginPath(); ctx.arc(0, 3, 12, 0, Math.PI * 2); this.outlined(ctx, GRENADES[it as GrenadeKind].color);
        ctx.beginPath(); ctx.roundRect(-4, -13, 8, 7, 2); this.outlined(ctx, '#333', 2);
      } else {
        const d = WEAPONS[it as keyof typeof WEAPONS];
        const k = Math.min(1, 62 / d.length);
        ctx.scale(k, k);
        ctx.translate(-d.length * 0.4, 0);
        drawGun(ctx, d.id, d.length, d.color);
      }
      ctx.restore();
      ctx.save();
      ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,10,.85)';
      ctx.strokeText(ITEM_NAMES[it], s.x, s.y - 58 + bob); ctx.fillStyle = '#fff'; ctx.fillText(ITEM_NAMES[it], s.x, s.y - 58 + bob);
      ctx.restore();
    }
  }

  private drawFlags(w: World) {
    const ctx = this.ctx;
    for (const f of w.flags) {
      const c = TEAM_COLORS[f.team];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.beginPath(); ctx.roundRect(-2.5, -58, 5, 58, 2); this.outlined(ctx, '#e8e0cc');
      const wave = Math.sin(this.t * 6) * 4;
      ctx.beginPath(); ctx.moveTo(2.5, -58); ctx.quadraticCurveTo(24, -62 + wave, 44 + wave, -52); ctx.lineTo(44 + wave, -30); ctx.quadraticCurveTo(24, -36 + wave, 2.5, -30); ctx.closePath();
      this.outlined(ctx, c.body);
      ctx.restore();
      ctx.beginPath(); ctx.roundRect(f.homeX - 22, f.homeY - 2, 44, 8, 3); this.outlined(ctx, c.dark, 2);
    }
  }

  private drawGas(w: World) {
    const ctx = this.ctx;
    for (const g of w.gas) {
      const a = Math.min(1, g.t / 2) * 0.3;
      for (let i = 0; i < 6; i++) {
        const ang = this.t * 0.6 + i * 1.1;
        ctx.fillStyle = `rgba(150,205,50,${a})`;
        ctx.beginPath(); ctx.arc(g.x + Math.cos(ang) * g.r * 0.36, g.y + Math.sin(ang) * g.r * 0.3, g.r * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private drawSoldier(w: World, p: Player, isLocal: boolean) {
    const ctx = this.ctx;
    const shirt = colorFor(w, p);
    const ws = activeWeapon(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(ART_SCALE, ART_SCALE); // soldier is authored 68px tall; the hitbox is shorter
    if (p.protectT > 0 && Math.floor(this.t * 14) % 2) ctx.globalAlpha = 0.45;
    drawSoldierArt(ctx, lookFor(p.id, shirt, darker(shirt)), {
      facing: p.facing, aim: p.aim, thrusting: p.thrusting, onGround: p.onGround, runPhase: p.runPhase, vx: p.vx,
      weapon: ws.id, firing: p.fireCd > (1 / WEAPONS[ws.id].rate) * 0.55, empT: p.empT,
      carrying: p.carrying ? TEAM_COLORS[p.carrying].body : null, t: this.t,
    });
    ctx.restore();

    if (p.reloadT > 0 && isLocal) {
      const total = WEAPONS[ws.id].reload || 1;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y - 4, 40, -Math.PI / 2, -Math.PI / 2 + (1 - p.reloadT / total) * Math.PI * 2); ctx.stroke();
    }

    if (!isLocal) {
      const ty = p.y - PLAYER_H / 2 - 14;
      ctx.textAlign = 'center'; ctx.font = '700 13px system-ui';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,16,10,.85)'; ctx.strokeText(p.name, p.x, ty);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name, p.x, ty);
      ctx.fillStyle = 'rgba(20,16,10,.75)'; ctx.fillRect(p.x - 20, ty + 4, 40, 6);
      ctx.fillStyle = p.hp > 50 ? '#4ade80' : p.hp > 25 ? '#facc15' : '#ef4444';
      ctx.fillRect(p.x - 19, ty + 5, 38 * Math.max(0, p.hp / 100), 4);
    }
  }

  private drawProjectiles(w: World) {
    const ctx = this.ctx;
    for (const pr of w.projectiles) {
      switch (pr.kind) {
        case 'bullet': {
          const tx = pr.x - pr.vx * 0.026, ty = pr.y - pr.vy * 0.026;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(20,16,10,.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.strokeStyle = '#fff1a8'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(tx, ty); ctx.stroke();
          break;
        }
        case 'rocket': {
          const a = Math.atan2(pr.vy, pr.vx);
          ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
          ctx.beginPath(); ctx.roundRect(-14, -5, 28, 10, 4); this.outlined(ctx, '#6d8a55');
          ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(24, 0); ctx.lineTo(14, 5); ctx.closePath(); this.outlined(ctx, '#c0392b', 2);
          ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-26 - Math.random() * 12, 0); ctx.lineTo(-14, 3); ctx.fill();
          ctx.restore();
          this.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: -20, life: 0.5, max: 0.5, size: 8, color: '#666', gravity: -30, drag: 1, kind: 'smoke' });
          break;
        }
        case 'flame': {
          const age = 1 - pr.life / WEAPONS.flame.life;
          ctx.fillStyle = `rgba(255,${Math.round(190 - age * 140)},40,${0.85 - age * 0.6})`;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 7 + age * 20, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'emp': {
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 8, 0, Math.PI * 2); this.outlined(ctx, '#4ac3ff', 2.4);
          ctx.strokeStyle = 'rgba(160,230,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pr.x, pr.y, 14 + Math.random() * 4, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        default: {
          const def = GRENADES[pr.kind as GrenadeKind];
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 9, 0, Math.PI * 2); this.outlined(ctx, def.color);
          ctx.beginPath(); ctx.roundRect(pr.x - 3.5, pr.y - 14, 7, 6, 2); this.outlined(ctx, '#333', 2);
          const blink = pr.kind === 'proxynade' ? (pr.armT <= 0 && pr.stuck ? Math.floor(this.t * 6) % 2 : 0) : Math.floor(this.t * (4 + (1 - pr.fuse / def.fuse) * 14)) % 2;
          if (blink) { ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
  }

  private updateParticles(w: World, dt: number) {
    for (const p of w.players) {
      if (p.alive && p.thrusting && Math.random() < 0.8) {
        this.particles.push({ x: p.x - p.facing * 14, y: p.y + 18, vx: (Math.random() - 0.5) * 50, vy: 170 + Math.random() * 90, life: 0.4, max: 0.4, size: 6, color: Math.random() < 0.5 ? '#ffb347' : '#9a9a9a', gravity: 0, drag: 1, kind: 'smoke' });
      }
      if (p.alive && p.burnT > 0 && Math.random() < 0.7) {
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 22, y: p.y + (Math.random() - 0.5) * 50, vx: 0, vy: -90, life: 0.45, max: 0.45, size: 6, color: '#ff8a1f', gravity: -100, drag: 1, kind: 'dot' });
      }
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= p.drag > 0 ? d : 1;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  private drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const k = Math.max(0, p.life / p.max);
      if (p.kind === 'ring') {
        ctx.strokeStyle = `rgba(255,230,150,${k})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k) + 6, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.globalAlpha = p.kind === 'smoke' ? k * 0.6 : Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      const s = p.kind === 'smoke' ? p.size * (1.5 - k * 0.6) : p.size * (0.5 + k * 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawMinimap(w: World, local: Player | undefined) {
    const ctx = this.ctx;
    const mw = Math.min(190, this.width * 0.28), mh = mw * (MAP.height / MAP.width);
    const mx = this.width - mw - 10, my = 52;
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,10,.7)'; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.terrain, mx, my, mw, mh);
    ctx.globalAlpha = 1;
    const sx = mw / MAP.width, sy = mh / MAP.height;
    for (const s of w.pickups) if (s.item) { ctx.fillStyle = '#fff'; ctx.fillRect(mx + s.x * sx - 1, my + s.y * sy - 1, 3, 3); }
    for (const f of w.flags) { ctx.fillStyle = TEAM_COLORS[f.team].css; ctx.fillRect(mx + f.x * sx - 2, my + f.y * sy - 4, 5, 5); }
    for (const p of w.players) {
      if (!p.alive) continue;
      ctx.fillStyle = p === local ? '#ffffff' : colorFor(w, p);
      ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, p === local ? 3.5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}
