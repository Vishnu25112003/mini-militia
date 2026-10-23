import { useEffect, useRef, useState } from 'react';
import ArtPreview from './components/ArtPreview';
import GameView from './components/GameView';
import Lobby from './components/Lobby';
import MainMenu from './components/MainMenu';
import type { MatchConfig } from './game/types';
import { NetClient } from './net/client';

function roomFromUrl(): string | null {
  const c = new URLSearchParams(window.location.search).get('room');
  return c && /^[A-Za-z]{4}$/.test(c) ? c.toUpperCase() : null;
}

const ART_SECTIONS = ['terrain', 'soldier', 'weapons', 'sky'] as const;

export default function App() {
  const art = new URLSearchParams(window.location.search).get('art');
  if (art && (ART_SECTIONS as readonly string[]).includes(art)) return <ArtPreview section={art as (typeof ART_SECTIONS)[number]} />;
  return <Game_ />;
}

function Game_() {
  const [config, setConfig] = useState<MatchConfig | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const [online, setOnline] = useState<{ name: string; code: string | null } | null>(() => {
    const code = roomFromUrl();
    if (!code) return null;
    let name = 'Player';
    try { name = localStorage.getItem('cm-name') ?? 'Player'; } catch { /* storage unavailable */ }
    return { name, code };
  });
  const client = useRef(new NetClient()).current;
  const [, rerender] = useState(0);

  useEffect(() => client.subscribe(() => rerender((n) => n + 1)), [client]);

  const leaveOnline = () => {
    client.close();
    setOnline(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  if (client.session) {
    return (
      <GameView
        key={client.session.uid}
        config={client.session.config}
        net={client.session}
        client={client}
        onRematch={() => client.rematch()}
        onExit={() => client.leave()}
      />
    );
  }

  if (online) return <Lobby client={client} name={online.name} joinCode={online.code} onBack={leaveOnline} />;

  if (!config) {
    return <MainMenu onStart={(c) => { setConfig(c); setMatchKey((k) => k + 1); }} onOnline={(name) => setOnline({ name, code: null })} />;
  }
  return (
    <GameView
      key={matchKey}
      config={config}
      onRematch={() => { setConfig({ ...config, seed: (Math.random() * 1e9) | 0 }); setMatchKey((k) => k + 1); }}
      onExit={() => setConfig(null)}
    />
  );
}
