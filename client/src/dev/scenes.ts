import type Phaser from 'phaser';
import { BootScene } from '../game/scenes/BootScene';
import { MapScene } from '../game/scenes/MapScene';
import { SandboxHud } from '../game/scenes/SandboxHud';
import { SandboxScene } from '../game/scenes/SandboxScene';

type SceneClass = new () => Phaser.Scene;

// Development scene switch: open the page with ?scene=map (etc.). Later phases add their scenes here and the
// real game becomes the default.
export const SCENES = {
  sandbox: {
    label: 'Phase 03 – offline movement sandbox',
    scenes: [SandboxScene, SandboxHud] as SceneClass[],
  },
  map: { label: 'Phase 02 – map + debug overlay', scenes: [MapScene] as SceneClass[] },
  hello: { label: 'Phase 00 – connection test', scenes: [BootScene] as SceneClass[] },
} satisfies Record<string, { label: string; scenes: SceneClass[] }>;

export type SceneName = keyof typeof SCENES;

export function currentSceneName(): SceneName {
  const q = new URLSearchParams(window.location.search).get('scene');
  return q && q in SCENES ? (q as SceneName) : 'sandbox';
}
