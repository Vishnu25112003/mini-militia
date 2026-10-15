import { useEffect, useState } from 'react';
import { IS_TOUCH_DEVICE } from './isTouchDevice';

function isPortrait(): boolean {
  return window.matchMedia('(orientation: portrait)').matches;
}

/**
 * Covers every screen with a "rotate your phone" message on a touch device
 * in portrait, per the flow's landscape-only rule. The app underneath never
 * unmounts — rotating back to landscape just removes the overlay instantly.
 */
export function OrientationGate({ children }: { children: React.ReactNode }) {
  const [portrait, setPortrait] = useState(isPortrait);

  useEffect(() => {
    if (!IS_TOUCH_DEVICE) return;
    const query = window.matchMedia('(orientation: portrait)');
    const onChange = () => setPortrait(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const showRotateMessage = IS_TOUCH_DEVICE && portrait;

  return (
    <>
      {children}
      {showRotateMessage && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: '#0b0c10',
            color: '#e5e7eb',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '48px' }} aria-hidden="true">
            ↻
          </div>
          <p style={{ fontSize: '18px', margin: 0 }}>Rotate your phone to landscape</p>
        </div>
      )}
    </>
  );
}
