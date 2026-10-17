import { useState } from 'react';
import { IS_TOUCH_DEVICE } from './isTouchDevice';
import {
  ACTION_IDS,
  ACTION_LABELS,
  getKeyBindings,
  keyCodeLabel,
  resetKeyBindings,
  setKeyBinding,
  type ActionId,
} from './game/input/keyBindings';
import {
  hasRegisteredTouchControls,
  resetTouchLayoutToDefault,
  saveCurrentTouchLayout,
  setAllControlsEditable,
} from './game/input/touchControlRegistry';

/** Shared modal chrome — lobby popups (Chat, Gear, Settings) and the in-match ones (Controls, leaderboards) all use this. */
export function Popup({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#16171d', padding: '16px', borderRadius: '8px', color: '#e5e7eb' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <strong style={{ fontSize: '14px' }}>{title}</strong>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9aa0ac', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const smallButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid #374151',
  background: 'transparent',
  color: '#e5e7eb',
  cursor: 'pointer',
};

function KeyBindingRow({ action }: { action: ActionId }) {
  const [listening, setListening] = useState(false);
  const bindings = getKeyBindings();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
      }}
    >
      <span>{ACTION_LABELS[action]}</span>
      <button
        onClick={() => setListening(true)}
        onBlur={() => setListening(false)}
        onKeyDown={(e) => {
          e.preventDefault();
          setKeyBinding(action, e.keyCode);
          setListening(false);
        }}
        style={{ ...smallButtonStyle, minWidth: '72px' }}
      >
        {listening ? 'Press a key…' : keyCodeLabel(bindings[action])}
      </button>
    </div>
  );
}

function KeyBindingsSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '220px' }}>
      <strong style={{ fontSize: '13px' }}>Key bindings</strong>
      {ACTION_IDS.map((action) => (
        <KeyBindingRow key={action} action={action} />
      ))}
      <button onClick={resetKeyBindings} style={smallButtonStyle}>
        Reset to default
      </button>
    </div>
  );
}

function TouchControlsSection() {
  const [editing, setEditing] = useState(false);

  const toggleEdit = () => {
    const next = !editing;
    setEditing(next);
    setAllControlsEditable(next);
    if (!next) saveCurrentTouchLayout();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '220px' }}>
      <strong style={{ fontSize: '13px' }}>Touch controls</strong>
      <p style={{ fontSize: '11px', color: '#9aa0ac', margin: 0 }}>
        Drag any control to move it, or drag its yellow handle to resize it.
      </p>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={toggleEdit} style={smallButtonStyle}>
          {editing ? 'Done editing' : 'Edit layout'}
        </button>
        <button
          onClick={() => {
            resetTouchLayoutToDefault();
            setEditing(false);
          }}
          style={smallButtonStyle}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

/** Reused by the lobby's Gear button, the in-match Controls button, and the final leaderboard. */
export function ControlsPopupBody() {
  const showTouchEditor = IS_TOUCH_DEVICE && hasRegisteredTouchControls();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!IS_TOUCH_DEVICE && <KeyBindingsSection />}
      {showTouchEditor && <TouchControlsSection />}
      {IS_TOUCH_DEVICE && !showTouchEditor && (
        <p style={{ fontSize: '12px', color: '#9aa0ac', width: '220px', margin: 0 }}>
          Join a match to edit your touch control layout.
        </p>
      )}
    </div>
  );
}
