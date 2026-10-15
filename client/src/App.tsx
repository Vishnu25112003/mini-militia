import { GameCanvas } from './game/GameCanvas';
import { DevDebugPanel } from './game/DevDebugPanel';
import { OrientationGate } from './OrientationGate';
import './App.css';

function App() {
  return (
    <OrientationGate>
      <div className="app">
        <GameCanvas />
        {import.meta.env.DEV && <DevDebugPanel />}
      </div>
    </OrientationGate>
  );
}

export default App;
