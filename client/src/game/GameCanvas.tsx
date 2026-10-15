import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MatchScene, type MatchSceneData } from './MatchScene';

export function GameCanvas({ sceneData }: { sceneData: MatchSceneData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 450,
      parent: containerRef.current,
      // No `scene` here — added below via `scene.add(..., autoStart, data)`
      // so MatchScene's init(data) gets the already-connected room on its
      // one boot, instead of booting once with no data and restarting.
      disableContextMenu: true,
      // Phaser only tracks 2 pointers by default (mouse + 1 touch) — the
      // touch layout needs both joysticks plus a button at once.
      input: { activePointers: 4 },
    });

    gameRef.current.scene.add('MatchScene', MatchScene, true, sceneData);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // sceneData is intentionally frozen for the game's lifetime — this effect mounts the game once per join.
  }, []);

  return <div ref={containerRef} />;
}
