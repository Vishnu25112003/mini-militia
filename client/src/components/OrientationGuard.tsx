import { useEffect, useState, type ReactNode } from 'react';
import { hasCoarsePointer, isPortraitOnMobile } from '../lib/orientation';

/**
 * Wraps the whole app. Children stay mounted (so a running match is never interrupted); in portrait on a phone a
 * full-screen message covers them, and it disappears the instant the phone is rotated back.
 */
export default function OrientationGuard({ children }: { children: ReactNode }) {
  const [portrait, setPortrait] = useState(() =>
    isPortraitOnMobile(hasCoarsePointer(), window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const check = () =>
      setPortrait(isPortraitOnMobile(hasCoarsePointer(), window.innerWidth, window.innerHeight));
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return (
    <>
      {children}
      {portrait && (
        <div
          data-testid="rotate-message"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#0b0810] px-8 text-center text-stone-100"
        >
          <svg
            viewBox="0 0 64 64"
            className="h-24 w-24 animate-pulse text-amber-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <rect x="22" y="6" width="20" height="36" rx="4" />
            <path d="M8 46c6 10 18 14 30 12" strokeLinecap="round" />
            <path d="M34 50l5 8 8-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-2xl font-black">Rotate your phone to landscape</p>
          <p className="max-w-xs text-sm text-stone-400">
            This game is played sideways. The game keeps running while you turn it.
          </p>
        </div>
      )}
    </>
  );
}
