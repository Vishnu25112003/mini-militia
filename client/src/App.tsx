import { useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { DevDebugPanel } from './game/DevDebugPanel';
import { JoinScreen } from './JoinScreen';
import { OrientationGate } from './OrientationGate';
import './App.css';

function App() {
  const [playerName, setPlayerName] = useState<string | null>(null);

  return (
    <OrientationGate>
      <div className="app">
        {playerName ? (
          <GameCanvas sceneData={{ name: playerName }} />
        ) : (
          <JoinScreen onJoin={setPlayerName} />
        )}
        {import.meta.env.DEV && <DevDebugPanel />}
      </div>
    </OrientationGate>
  );
}

export default App;
