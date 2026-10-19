import { useState } from 'react';
import { HOST_SETTING_RANGES } from '@game/shared';
import { sandboxSettings } from './sandboxSettings';

/**
 * Dev-only panel (collapsed behind a gear icon, top-right): gravity/boost sliders (apply to the offline sandbox only —
 * the networked match's physics settings are fixed until Phase 06 wires up
 * real host settings), plus artificial lag/packet-loss for the networked
 * match, to test bad mobile networks locally.
 */
export function DevDebugPanel() {
  const [open, setOpen] = useState(false);
  const [gravity, setGravity] = useState(sandboxSettings.gravity);
  const [boost, setBoost] = useState(sandboxSettings.boost);
  const [lagMs, setLagMs] = useState(sandboxSettings.artificialLagMs);
  const [lossPercent, setLossPercent] = useState(sandboxSettings.packetLossPercent);

  const gearButton = (
    <button
      type="button"
      aria-label={open ? 'Close settings' : 'Open settings'}
      title="Settings"
      onClick={() => setOpen((o) => !o)}
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 501,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid #374151',
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#e5e7eb',
        fontSize: '20px',
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      {open ? '✕' : '⚙'}
    </button>
  );

  if (!open) return gearButton;

  return (
    <>
      {gearButton}
      <div
        style={{
          position: 'fixed',
          top: 52,
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
        <hr
          style={{ width: '100%', border: 'none', borderTop: '1px solid #374151', margin: '2px 0' }}
        />
        <label>
          Lag (match only): {lagMs}ms
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={lagMs}
            onChange={(e) => {
              const value = Number(e.target.value);
              setLagMs(value);
              sandboxSettings.artificialLagMs = value;
            }}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Packet loss (match only): {lossPercent}%
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={lossPercent}
            onChange={(e) => {
              const value = Number(e.target.value);
              setLossPercent(value);
              sandboxSettings.packetLossPercent = value;
            }}
            style={{ width: '100%' }}
          />
        </label>
      </div>
    </>
  );
}
