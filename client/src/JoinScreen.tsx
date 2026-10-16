import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { validateName } from '@game/shared';
import { createRoom, joinRoomByCode, RoomJoinError } from './connectToRoom';

const NAME_STORAGE_KEY = 'mm_player_name';

function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Private browsing / storage disabled — name just won't be remembered next visit.
  }
}

function errorMessage(err: RoomJoinError): string {
  switch (err.code) {
    case 'code_not_found':
      return 'Room not found — check the code and try again.';
    case 'name_taken':
      return 'That name is already taken in this room — choose another.';
    case 'invalid_name':
      return 'Name must be 3-12 letters.';
    case 'room_full':
      return 'That room is full.';
    case 'match_ended':
      return 'That match has already ended.';
    default:
      return 'Something went wrong — try again.';
  }
}

export function JoinScreen({
  onJoined,
  notice,
  onNoticeShown,
}: {
  onJoined: (room: Room) => void;
  notice?: string | null;
  onNoticeShown?: () => void;
}) {
  const [name, setName] = useState(loadSavedName);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);

  // Only reacts to a fresh notice arriving, not to onNoticeShown's identity —
  // deliberately omitted from the dependency list.
  useEffect(() => {
    if (notice) {
      setError(notice);
      onNoticeShown?.();
    }
  }, [notice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!validateName(trimmedName)) {
      setError('Name must be 3-12 letters.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      saveName(trimmedName);
      const room =
        mode === 'create' ? await createRoom(trimmedName) : await joinRoomByCode(trimmedName, code);
      onJoined(room);
    } catch (err) {
      setError(
        err instanceof RoomJoinError ? errorMessage(err) : 'Something went wrong — try again.',
      );
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: '#0b0c10',
        color: '#e5e7eb',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ fontSize: '20px', margin: 0 }}>Mini Militia WAN</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '240px' }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={12}
          autoFocus
          style={{
            padding: '8px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #374151',
          }}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setMode('create')}
            style={tabStyle(mode === 'create')}
          >
            Create Room
          </button>
          <button type="button" onClick={() => setMode('join')} style={tabStyle(mode === 'join')}>
            Join Room
          </button>
        </div>

        {mode === 'join' && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={6}
            style={{
              padding: '8px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #374151',
              letterSpacing: '2px',
              textAlign: 'center',
            }}
          />
        )}

        {error && <span style={{ color: '#f87171', fontSize: '12px' }}>{error}</span>}

        <button
          type="submit"
          disabled={busy || (mode === 'join' && code.length !== 6)}
          style={{
            padding: '10px',
            fontSize: '14px',
            borderRadius: '4px',
            border: 'none',
            background: busy ? '#374151' : '#4363d8',
            color: '#fff',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Connecting…' : mode === 'create' ? 'Create Room' : 'Join Room'}
        </button>
      </form>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px',
    fontSize: '13px',
    borderRadius: '4px',
    border: active ? '1px solid #4363d8' : '1px solid #374151',
    background: active ? 'rgba(67, 99, 216, 0.2)' : 'transparent',
    color: '#e5e7eb',
    cursor: 'pointer',
  };
}
