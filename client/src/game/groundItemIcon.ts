import Phaser from 'phaser';
import { WEAPONS, type WeaponId } from '@game/shared';
import { drawWeaponSilhouette } from './WeaponSilhouette';
import type { GroundItemWire } from './net/wireTypes';

/** Original vector pickup icons (Phase 15), replacing the flat colored-circle placeholders. */
export function drawGroundItemIcon(g: Phaser.GameObjects.Graphics, item: GroundItemWire) {
  g.clear();
  switch (item.kind) {
    case 'gun': {
      const weaponId = item.weapon as WeaponId;
      drawWeaponSilhouette(g, weaponId, WEAPONS[weaponId].group);
      break;
    }
    case 'medkit':
      g.fillStyle(0xe6194b, 1);
      g.fillRoundedRect(-9, -9, 18, 18, 3);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-2, -6, 4, 12);
      g.fillRect(-6, -2, 12, 4);
      break;
    case 'grenadePair':
      g.fillStyle(0x3cb44b, 1);
      g.fillCircle(-5, 1, 7);
      g.fillCircle(5, 1, 7);
      g.lineStyle(2, 0xe5e7eb, 0.9);
      g.lineBetween(-5, -6, -2, -11);
      g.lineBetween(5, -6, 8, -11);
      break;
    case 'boostTank':
      g.fillStyle(0x4363d8, 1);
      g.fillRoundedRect(-6, -10, 12, 20, 4);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(-2, -14, 4, 5);
      break;
  }
}
