import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { Popup, smallButtonStyle } from './Popup';
import { useChatMessages } from './useChatMessages';

const FADE_MS = 4000;

/**
 * In-match chat (Phase 13): a fading toast for the latest incoming message
 * (shown even while the popup is closed, so players notice without opening
 * it), plus the full history + send form when open. The match keeps running
 * underneath — `MatchScene.setChatOpen` only suppresses this player's own
 * game input while the popup has focus.
 */
export function MatchChat({
  room,
  open,
  onClose,
}: {
  room: Room;
  open: boolean;
  onClose: () => void;
}) {
  const messages = useChatMessages(room);
  const [chatInput, setChatInput] = useState('');
  const [toastIndex, setToastIndex] = useState(-1);

  const latest = messages[messages.length - 1];

  useEffect(() => {
    if (messages.length === 0) return;
    setToastIndex(messages.length - 1);
    const timeout = setTimeout(() => setToastIndex(-1), FADE_MS);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim().slice(0, 100);
    if (!text) return;
    room.send('chat', { text });
    setChatInput('');
  };

  const showToast = !open && toastIndex === messages.length - 1 && toastIndex >= 0 && !!latest;

  return (
    <>
      {showToast && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '13px',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            maxWidth: '80vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ color: latest.color, fontWeight: 'bold' }}>{latest.name}: </span>
          <span style={{ color: '#e5e7eb' }}>{latest.text}</span>
        </div>
      )}

      {open && (
        <div style={{ pointerEvents: 'auto' }}>
          <Popup onClose={onClose} title="Chat">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '260px' }}>
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {messages.map((m, i) => (
                  <div key={i} style={{ fontSize: '12px' }}>
                    <span style={{ color: m.color, fontWeight: 'bold' }}>{m.name}: </span>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={sendChat} style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={100}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                  }}
                  autoFocus
                />
                <button type="submit" style={smallButtonStyle}>
                  Send
                </button>
              </form>
            </div>
          </Popup>
        </div>
      )}
    </>
  );
}
