import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { reconnectRoom } from './connectToRoom';
import { DevDebugPanel } from './game/DevDebugPanel';
import { JoinScreen } from './JoinScreen';
import { LobbyScreen } from './LobbyScreen';
import { MatchScreen } from './MatchScreen';
import { OrientationGate } from './OrientationGate';
import { clearReconnectToken, loadReconnectToken, saveReconnectToken } from './reconnectToken';
import './App.css';

type Screen = 'join' | 'lobby' | 'match';

function App() {
  const [screen, setScreen] = useState<Screen>('join');
  const [room, setRoom] = useState<Room | null>(null);
  const [leaveNotice, setLeaveNotice] = useState<string | null>(null);
  // Starts true: try resuming a previous session (reopened tab/link) before showing name entry.
  const [reconnecting, setReconnecting] = useState(true);

  const enterRoom = useCallback((joinedRoom: Room) => {
    saveReconnectToken(joinedRoom.reconnectionToken);
    setRoom(joinedRoom);
    setScreen('lobby'); // LobbyScreen redirects itself to 'match' if the room's already past the lobby phase.
  }, []);

  const attemptReconnect = useCallback(async () => {
    const token = loadReconnectToken();
    if (!token) {
      setReconnecting(false);
      return;
    }
    try {
      const resumedRoom = await reconnectRoom(token);
      enterRoom(resumedRoom);
    } catch {
      clearReconnectToken(); // expired, or the match/room is gone — fall back to normal name entry
    } finally {
      setReconnecting(false);
    }
  }, [enterRoom]);

  // Once on mount — the "reopen the link, rejoin automatically" path (Phase 12).
  useEffect(() => {
    attemptReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoined = useCallback(
    (joinedRoom: Room) => {
      enterRoom(joinedRoom);
    },
    [enterRoom],
  );

  const handleLeftRoom = useCallback(
    (message?: string) => {
      setRoom(null);
      setScreen('join');
      if (message) {
        // A terminal leave (cancelled/kicked) — show the notice, don't auto-retry.
        setLeaveNotice(message);
      } else {
        // An unexplained drop — the server may still be holding the seat open, so
        // try to resume automatically before asking the player to re-enter anything.
        setReconnecting(true);
        attemptReconnect();
      }
    },
    [attemptReconnect],
  );

  const handleMatchStart = useCallback(() => setScreen('match'), []);
  const handleReturnToLobby = useCallback(() => setScreen('lobby'), []);

  return (
    <OrientationGate>
      <div className="app">
        {screen === 'join' && reconnecting && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b0c10',
              color: '#9aa0ac',
              fontFamily: 'sans-serif',
              fontSize: '14px',
            }}
          >
            Reconnecting…
          </div>
        )}
        {screen === 'join' && !reconnecting && (
          <JoinScreen
            onJoined={handleJoined}
            notice={leaveNotice}
            onNoticeShown={() => setLeaveNotice(null)}
          />
        )}
        {screen === 'lobby' && room && (
          <LobbyScreen room={room} onMatchStart={handleMatchStart} onLeftRoom={handleLeftRoom} />
        )}
        {screen === 'match' && room && (
          <MatchScreen room={room} onReturnToLobby={handleReturnToLobby} onLeftRoom={handleLeftRoom} />
        )}
        {import.meta.env.DEV && <DevDebugPanel />}
      </div>
    </OrientationGate>
  );
}

export default App;
