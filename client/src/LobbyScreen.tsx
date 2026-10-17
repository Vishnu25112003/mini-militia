import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { useRoomState } from './useRoomState';
import { HostSettingsPopup } from './HostSettingsPopup';
import { ControlsPopupBody, Popup, smallButtonStyle } from './Popup';
import type { MatchRoomWireState, PlayerWireState } from './game/net/wireTypes';

interface ChatMessage {
  name: string;
  color: string;
  text: string;
}

function formatMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function LobbyScreen({
  room,
  onMatchStart,
  onLeftRoom,
}: {
  room: Room;
  onMatchStart: () => void;
  onLeftRoom: (message?: string) => void;
}) {
  useRoomState(room);
  const state = room.state as unknown as MatchRoomWireState & {
    players: Map<string, PlayerWireState>;
  };

  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGear, setShowGear] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const isHost = room.sessionId === state.hostSessionId;
  const me = state.players.get(room.sessionId);

  useEffect(() => {
    if (state.phase === 'playing') onMatchStart();
  }, [state.phase, onMatchStart]);

  useEffect(() => {
    const handleLeave = (_code: number, reason?: string) => {
      if (reason === 'room_cancelled') onLeftRoom('The host cancelled the room.');
      else if (reason === 'removed_by_host') onLeftRoom('You were removed from the room.');
      else onLeftRoom();
    };
    room.onLeave(handleLeave);
    return () => room.onLeave.remove(handleLeave);
  }, [room, onLeftRoom]);

  useEffect(() => {
    const handleChat = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);
    const unsubscribe = room.onMessage('chat', handleChat);
    return unsubscribe;
  }, [room]);

  const handleStart = () => room.send('ready');
  const handleRemove = (sessionId: string) => room.send('removePlayer', { sessionId });
  const handleLeave = () => {
    room.leave();
    onLeftRoom();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the code is already visible to copy by hand.
    }
  };

  const handleShare = async () => {
    const text = `Join my Mini Militia room! Code: ${state.roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled the share sheet — not an error.
      }
    } else {
      await handleCopy();
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim().slice(0, 100);
    if (!text) return;
    room.send('chat', { text });
    setChatInput('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        background: '#0b0c10',
        color: '#e5e7eb',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '14px', color: '#9aa0ac', margin: '0 0 8px' }}>Players</h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {[...state.players.entries()].map(([sessionId, player]) => (
            <li
              key={sessionId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: player.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{player.name}</span>
              {sessionId === state.hostSessionId && (
                <span
                  style={{
                    fontSize: '10px',
                    color: '#f58231',
                    border: '1px solid #f58231',
                    padding: '1px 4px',
                    borderRadius: '3px',
                  }}
                >
                  HOST
                </span>
              )}
              <span style={{ fontSize: '12px', color: player.ready ? '#3cb44b' : '#9aa0ac' }}>
                {player.ready ? 'Ready' : 'Not Ready'}
              </span>
              {isHost && sessionId !== room.sessionId && (
                <button onClick={() => handleRemove(sessionId)} style={smallButtonStyle}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          width: '220px',
          padding: '16px',
          borderLeft: '1px solid #1f2028',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#9aa0ac' }}>Room code</div>
          <div style={{ fontSize: '22px', letterSpacing: '3px', fontWeight: 'bold' }}>
            {state.roomCode}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <button onClick={handleCopy} style={smallButtonStyle}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleShare} style={smallButtonStyle}>
              Share
            </button>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={me?.ready}
          style={{
            padding: '12px',
            fontSize: '15px',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: 'none',
            background: me?.ready ? '#374151' : '#3cb44b',
            color: '#fff',
            cursor: me?.ready ? 'default' : 'pointer',
          }}
        >
          {me?.ready ? 'Waiting…' : 'START'}
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowSettings(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowSettings(true);
          }}
          style={{
            padding: '10px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Catacombs</div>
          <div>
            {state.players.size} / {state.settings.playerCount} players ·{' '}
            {formatMmSs(state.settings.gameTimeSeconds)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={handleLeave} style={smallButtonStyle} title="Leave room">
            X
          </button>
          <button onClick={() => setShowGear(true)} style={smallButtonStyle} title="Controls">
            Gear
          </button>
          <button onClick={() => setShowChat(true)} style={smallButtonStyle} title="Chat">
            Chat
          </button>
        </div>

        <div style={{ fontSize: '12px', color: '#9aa0ac' }}>
          Waiting for players to join… auto-start in {formatMmSs(state.autoStartRemainingSeconds)}
        </div>
      </div>

      {showChat && (
        <Popup onClose={() => setShowChat(false)} title="Chat">
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
      )}

      {showGear && (
        <Popup onClose={() => setShowGear(false)} title="Controls">
          <ControlsPopupBody />
        </Popup>
      )}

      {showSettings && (
        <Popup onClose={() => setShowSettings(false)} title="Match settings">
          <HostSettingsPopup
            room={room}
            settings={state.settings}
            isHost={isHost}
            playersJoined={state.players.size}
          />
        </Popup>
      )}
    </div>
  );
}
