/**
 * Must run from inside a real user-gesture handler (a click/tap) — both the
 * Fullscreen and screen-orientation-lock APIs reject otherwise. Called from
 * the lobby's Start tap (Phase 14): the last guaranteed tap before a match
 * where being out of fullscreen/portrait would actually matter.
 */
export async function requestFullscreenAndLockLandscape(): Promise<void> {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch {
    // Not supported, or the browser declined — the OrientationGate's rotate
    // message still covers portrait, just with the browser chrome visible.
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    await orientation.lock?.('landscape');
  } catch {
    // Orientation lock is only available in fullscreen on some browsers (and
    // not at all on iOS Safari) — the rotate-message overlay is the fallback.
  }
}

let sharedAudioContext: AudioContext | null | undefined;

/**
 * The one `AudioContext` the whole app shares — all of `sound.ts`'s
 * synthesized effects (Phase 15) play through this, so unlocking it once on
 * the lobby Start tap is enough for every sound after that.
 */
export function getAudioContext(): AudioContext | null {
  if (sharedAudioContext !== undefined) return sharedAudioContext;

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = Ctor ? new Ctor() : null;
  } catch {
    sharedAudioContext = null;
  }
  return sharedAudioContext;
}

let audioUnlocked = false;

/**
 * Browsers block Web Audio playback until a user gesture resumes the audio
 * context. Called from the lobby's Start tap so every sound effect just
 * works from the first shot of the match, with no separate "tap to enable
 * sound" prompt needed.
 */
export function unlockAudioContext(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    // A silent buffer play is the classic iOS unlock nudge — resume() alone
    // doesn't always stick on older iOS Safari without an actual play() call.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Web Audio unsupported — nothing to unlock.
  }
}
