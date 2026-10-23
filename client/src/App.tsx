import { useEffect, useState } from 'react';
import { GAME_NAME } from '@game/shared';
import DebugPanel from './components/DebugPanel';
import OrientationGuard from './components/OrientationGuard';
import { currentSceneName, SCENES, type SceneName } from './dev/scenes';
import GameCanvas from './game/GameCanvas';
import { hasCoarsePointer } from './lib/orientation';
import { joinHelloRoom } from './net/helloConnection';
import { SERVER_URL } from './net/serverUrl';

export default function App() {
  return (
    // landscape-only on phones: covers every screen (name entry, lobby, match, popups) with a rotate message
    <OrientationGuard>
      <Shell />
    </OrientationGuard>
  );
}

function Shell() {
  const scene = currentSceneName();
  const [status, setStatus] = useState('Connecting to the server…');

  // Phase 00 connection test only runs for the hello scene
  useEffect(() => {
    if (scene !== 'hello') return;
    let leave: (() => void) | undefined;
    let cancelled = false;
    joinHelloRoom()
      .then((r) => {
        if (cancelled) return r.leave();
        leave = r.leave;
        setStatus(r.welcome.message);
      })
      .catch((e: unknown) =>
        setStatus(`Could not reach ${SERVER_URL}: ${e instanceof Error ? e.message : String(e)}`),
      );
    return () => {
      cancelled = true;
      leave?.();
    };
  }, [scene]);

  // The debug panel is a dev tool. On touch devices it would sit on top of the controls, so there it only
  // appears when asked for explicitly with ?debug=1.
  const q = new URLSearchParams(window.location.search);
  const touchy = hasCoarsePointer() || q.get('touch') === '1';
  const showDebug =
    scene === 'sandbox' && (touchy ? q.get('debug') === '1' : import.meta.env.DEV || q.has('debug'));

  return (
    <div className="relative h-full w-full">
      <GameCanvas key={scene} scene={scene} status={status} />
      {showDebug && <DebugPanel />}
      {/* DOM copy of the status so it is easy to verify in tests and on devices */}
      <div
        data-testid="status"
        className="pointer-events-none absolute right-3 bottom-3 text-xs text-stone-500"
      >
        {GAME_NAME} · {scene === 'hello' ? status : SCENES[scene].label}
      </div>
      <DevSceneLinks active={scene} />
    </div>
  );
}

/** Small development switcher in the corner; later phases make the real game the default. */
function DevSceneLinks({ active }: { active: SceneName }) {
  return (
    <nav className="absolute top-2 right-3 z-10 flex gap-2 text-xs">
      {(Object.keys(SCENES) as SceneName[]).map((name) => (
        <a
          key={name}
          href={`?scene=${name}`}
          className={`rounded px-2 py-1 backdrop-blur ${
            name === active ? 'bg-amber-400 text-black' : 'bg-black/50 text-stone-300 hover:bg-black/70'
          }`}
        >
          {name}
        </a>
      ))}
    </nav>
  );
}
