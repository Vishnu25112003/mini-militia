import { useState } from 'react';
import { HOST_SETTING_RANGES } from '@game/shared';
import { sandboxSettings } from './sandboxSettings';

/** Dev-only: live gravity/boost sliders, to check both settings behave as the flow describes. */
export function DevDebugPanel() {
  const [gravity, setGravity] = useState(sandboxSettings.gravity);
  const [boost, setBoost] = useState(sandboxSettings.boost);

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 500,
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#e5e7eb',
        fontFamily: 'sans-serif',
        fontSize: '12px',
        padding: '8px 10px',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '160px',
      }}
    >
      <label>
        Gravity: {gravity} {gravity === 0 && '(floating)'}
        <input
          type="range"
          min={HOST_SETTING_RANGES.gravity.min}
          max={HOST_SETTING_RANGES.gravity.max}
          step={HOST_SETTING_RANGES.gravity.step}
          value={gravity}
          onChange={(e) => {
            const value = Number(e.target.value);
            setGravity(value);
            sandboxSettings.gravity = value;
          }}
          style={{ width: '100%' }}
        />
      </label>
      <label>
        Boost: {boost} {boost === 100 && '(no drain)'}
        <input
          type="range"
          min={HOST_SETTING_RANGES.boost.min}
          max={HOST_SETTING_RANGES.boost.max}
          step={HOST_SETTING_RANGES.boost.step}
          value={boost}
          onChange={(e) => {
            const value = Number(e.target.value);
            setBoost(value);
            sandboxSettings.boost = value;
          }}
          style={{ width: '100%' }}
        />
      </label>
    </div>
  );
}
