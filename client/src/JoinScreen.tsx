import { useState } from 'react';
import { validateName } from '@game/shared';

/**
 * Temporary pre-game screen — the real lobby (room codes, player list,
 * host settings) is Phase 05. For now this is just enough to get a name and
 * join the one test room so Phase 04's networking can be exercised.
 */
export function JoinScreen({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!validateName(trimmed)) {
      setError('Name must be 3-12 letters.');
      return;
    }
    setError(null);
    onJoin(trimmed);
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
        style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '220px' }}
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
        {error && <span style={{ color: '#f87171', fontSize: '12px' }}>{error}</span>}
        <button
          type="submit"
          style={{
            padding: '8px',
            fontSize: '14px',
            borderRadius: '4px',
            border: 'none',
            background: '#4363d8',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Join Test Room
        </button>
      </form>
    </div>
  );
}
