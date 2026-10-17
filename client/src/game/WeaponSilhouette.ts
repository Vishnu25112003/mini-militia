import Phaser from 'phaser';
import type { WeaponGroup, WeaponId } from '@game/shared';

/**
 * Original vector gun silhouettes (Phase 15) — one shape per `WeaponGroup`
 * rather than 15 fully unique drawings, since the group already captures the
 * visual family (rifle/sniper/smg/shotgun/launcher) and `Flame`/`Phasr` are
 * each other's only member of 'special'. Drawn once in local space along the
 * +x axis (muzzle pointing right), then the caller positions/rotates the
 * whole `Graphics` object to the player's hand + aim angle — no per-frame
 * redraw needed unless the held weapon changes.
 */
export function drawWeaponSilhouette(g: Phaser.GameObjects.Graphics, weaponId: WeaponId, group: WeaponGroup) {
  g.clear();
  const body = 0x2b2b33;
  const metal = 0x53545e;

  switch (group) {
    case 'assault':
      g.fillStyle(body, 1);
      g.fillRect(-4, -3, 22, 6); // barrel/receiver
      g.fillRect(10, -2, 10, 3); // barrel tip
      g.fillStyle(metal, 1);
      g.fillRect(-2, 2, 5, 9); // mag
      g.fillRect(-10, -2, 7, 5); // stock
      break;

    case 'marksman':
      g.fillStyle(body, 1);
      g.fillRect(-10, -2, 32, 4); // long barrel
      g.fillStyle(metal, 1);
      g.fillRect(-2, -8, 10, 4); // scope
      g.fillRect(-1, 1, 4, 7); // mag
      break;

    case 'smg-pistol':
      g.fillStyle(body, 1);
      g.fillRect(-4, -3, 14, 5); // short barrel
      g.fillStyle(metal, 1);
      g.fillRect(0, 2, 4, 8); // grip/mag
      break;

    case 'shotgun':
      g.fillStyle(body, 1);
      g.fillRect(-6, -3, 24, 6); // wide barrel
      g.fillStyle(metal, 1);
      g.fillRect(-4, 3, 18, 3); // pump
      break;

    case 'launcher':
      g.fillStyle(metal, 1);
      g.fillRoundedRect(-8, -6, 28, 12, 4); // thick tube
      g.fillStyle(body, 1);
      g.fillRect(-10, -3, 6, 6); // grip
      break;

    case 'special':
      if (weaponId === 'Flame') {
        g.fillStyle(metal, 1);
        g.fillRoundedRect(-10, -5, 10, 10, 3); // fuel tank
        g.fillStyle(body, 1);
        g.fillRect(0, -3, 18, 6); // nozzle
      } else {
        // Phasr: a thin rod with a glowing tip.
        g.fillStyle(body, 1);
        g.fillRect(-6, -2, 20, 4);
        g.fillStyle(0x47bfff, 0.9);
        g.fillCircle(16, 0, 4);
      }
      break;
  }
}
