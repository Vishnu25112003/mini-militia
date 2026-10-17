/**
 * A tiny free-list pool for short-lived visual effects (muzzle flashes,
 * tracers, explosion flashes, gas clouds). With 8 players firing automatic
 * weapons, creating and destroying a new GameObject per shot churns the GC
 * every frame — pooling reuses the same handful of objects once the pool has
 * warmed up to the match's peak concurrent effect count (Phase 14).
 */
export class EffectPool<T extends Phaser.GameObjects.GameObject> {
  private free: T[] = [];
  private factory: () => T;

  constructor(factory: () => T) {
    this.factory = factory;
  }

  acquire(): T {
    return this.free.pop() ?? this.factory();
  }

  release(obj: T) {
    (obj as unknown as { setVisible: (v: boolean) => void }).setVisible(false);
    this.free.push(obj);
  }
}
