import { useCallback, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { GameCanvas } from './game/GameCanvas';
import { DevDebugPanel } from './game/DevDebugPanel';
import { JoinScreen } from './JoinScreen';
import { LobbyScreen } from './LobbyScreen';
import { OrientationGate } from './OrientationGate';
import './App.css';

type Screen = 'join' | 'lobby' | 'match';

function App() {
  const [screen, setScreen] = useState<Screen>('join');
  const [room, setRoom] = useState<Room | null>(null);
  const [leaveNotice, setLeaveNotice] = useState<string | null>(null);

  const handleJoined = useCallback((joinedRoom: Room) => {
    setRoom(joinedRoom);
    setScreen('lobby');
  }, []);

  const handleLeftRoom = useCallback((message?: string) => {
    setRoom(null);
    setLeaveNotice(message ?? null);
    setScreen('join');
  }, []);

  const handleMatchStart = useCallback(() => setScreen('match'), []);

  return (
    <OrientationGate>
      <div className="app">
        {screen === 'join' && (
          <JoinScreen
            onJoined={handleJoined}
            notice={leaveNotice}
            onNoticeShown={() => setLeaveNotice(null)}
          />
        )}
        {screen === 'lobby' && room && (
          <LobbyScreen room={room} onMatchStart={handleMatchStart} onLeftRoom={handleLeftRoom} />
        )}
        {screen === 'match' && room && <GameCanvas sceneData={{ room }} />}
        {import.meta.env.DEV && <DevDebugPanel />}
      </div>
    </OrientationGate>
  );
}

export default App;
