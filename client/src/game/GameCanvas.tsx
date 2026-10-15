import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { SandboxScene } from './SandboxScene';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 450,
      parent: containerRef.current,
      scene: [SandboxScene],
      disableContextMenu: true,
      // Phaser only tracks 2 pointers by default (mouse + 1 touch) — the
      // touch layout needs both joysticks plus a button at once.
      input: { activePointers: 4 },
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} />;
}
