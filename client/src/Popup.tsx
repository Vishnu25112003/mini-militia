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

/** A placeholder — real rebinding UI is built in Phase 13. Reused by the lobby's Gear button and the in-match Controls button. */
export function ControlsPopupBody() {
  return (
    <p style={{ fontSize: '13px', width: '220px' }}>
      Control customization is coming in a later phase. For now, see the README for the default
      keyboard/touch layout.
    </p>
  );
}
