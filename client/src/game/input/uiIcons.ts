import Phaser from 'phaser';

export type IconId = 'melee' | 'reload' | 'pickup' | 'grenade' | 'switchGrenade' | 'zoom' | 'chat';

/**
 * Small original vector glyphs for the touch buttons (Phase 15) — drawn
 * centered at local (0,0) so the same `Graphics` object can be positioned
 * and scaled exactly like the text label it replaces.
 */
export function drawIcon(g: Phaser.GameObjects.Graphics, icon: IconId, radius: number) {
  g.clear();
  const r = radius * 0.55;

  switch (icon) {
    case 'melee': {
      g.lineStyle(3, 0xe5e7eb, 0.95);
      g.lineBetween(-r, r, r, -r);
      g.fillStyle(0xe5e7eb, 0.95);
      g.fillTriangle(r, -r, r - 7, -r + 1, r - 1, -r + 7);
      break;
    }
    case 'reload': {
      g.lineStyle(3, 0xe5e7eb, 0.95);
      g.beginPath();
      g.arc(0, 0, r, Phaser.Math.DegToRad(-200), Phaser.Math.DegToRad(160), false);
      g.strokePath();
      g.fillStyle(0xe5e7eb, 0.95);
      g.fillTriangle(r * 0.75, -r * 0.85, r, -r * 0.4, r * 0.5, -r * 0.35);
      break;
    }
    case 'pickup': {
      g.lineStyle(3, 0xe5e7eb, 0.95);
      g.lineBetween(0, r, 0, -r * 0.2);
      g.fillStyle(0xe5e7eb, 0.95);
      g.fillTriangle(0, -r, -r * 0.55, -r * 0.2, r * 0.55, -r * 0.2);
      break;
    }
    case 'grenade': {
      g.fillStyle(0x88cc44, 0.95);
      g.fillCircle(0, r * 0.15, r * 0.65);
      g.lineStyle(2, 0xe5e7eb, 0.95);
      g.lineBetween(0, -r * 0.45, r * 0.35, -r);
      break;
    }
    case 'switchGrenade': {
      g.lineStyle(3, 0xe5e7eb, 0.95);
      g.strokeCircle(0, 0, r * 0.55);
      g.beginPath();
      g.arc(0, 0, r, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false);
      g.strokePath();
      g.fillTriangle(r * 0.9, -r * 0.5, r * 0.5, -r * 0.5, r * 0.75, -r * 0.1);
      break;
    }
    case 'zoom': {
      g.lineStyle(3, 0xe5e7eb, 0.95);
      g.strokeCircle(-r * 0.15, -r * 0.15, r * 0.5);
      g.lineBetween(r * 0.2, r * 0.2, r * 0.65, r * 0.65);
      break;
    }
    case 'chat': {
      g.fillStyle(0xe5e7eb, 0.15);
      g.fillRoundedRect(-r, -r * 0.65, r * 2, r * 1.1, 4);
      g.lineStyle(2, 0xe5e7eb, 0.95);
      g.strokeRoundedRect(-r, -r * 0.65, r * 2, r * 1.1, 4);
      g.fillStyle(0xe5e7eb, 0.95);
      g.fillTriangle(-r * 0.35, r * 0.45, -r * 0.1, r * 0.45, -r * 0.35, r * 0.85);
      break;
    }
  }
}
