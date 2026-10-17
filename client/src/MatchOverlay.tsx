import { useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { rankPlayers } from '@game/shared';
import { ControlsPopupBody, Popup, smallButtonStyle } from './Popup';
import type { MatchRoomWireState, PlayerWireState } from './game/net/wireTypes';

/** The match runs physics at 20Hz patches — a React tree doesn't need to re-render that often just to show a timer/leaderboard. */
const OVERLAY_POLL_MS = 250;

function formatMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface LeaderboardRow {
  sessionId: string;
  name: string;
  color: string;
  kills: number;
  deaths: number;
  points: number;
  rank: number;
}

function buildLeaderboard(players: Map<string, PlayerWireState>): LeaderboardRow[] {
  const rows = [...players.entries()].map(([sessionId, p]) => ({
    sessionId,
    name: p.name,
    color: p.color,
    kills: p.kills,
    deaths: p.deaths,
    points: p.points,
  }));
  return rankPlayers(rows);
}

function LeaderboardTable({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: '13px', minWidth: '260px' }}>
      <thead>
        <tr style={{ color: '#9aa0ac', textAlign: 'left' }}>
          <th style={{ padding: '4px 8px' }}>#</th>
          <th style={{ padding: '4px 8px' }}>Player</th>
          <th style={{ padding: '4px 8px' }}>Kills</th>
          <th style={{ padding: '4px 8px' }}>Deaths</th>
          <th style={{ padding: '4px 8px' }}>Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.sessionId}
            style={{
              background: row.sessionId === meId ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
          >
            <td style={{ padding: '4px 8px' }}>{row.rank}</td>
            <td style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: row.color,
                  display: 'inline-block',
                }}
              />
              {row.name}
            </td>
            <td style={{ padding: '4px 8px' }}>{row.kills}</td>
            <td style={{ padding: '4px 8px' }}>{row.deaths}</td>
            <td style={{ padding: '4px 8px' }}>{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Renders on top of the Phaser canvas during a match: the timer, the live
 * leaderboard while waiting to respawn, and the final leaderboard once the
 * match ends. Polls `room.state` on a slow timer instead of subscribing to
 * every patch — this stays mounted for the whole match, and patches arrive
 * at 20Hz while nothing here needs to be that fresh.
 */
export function MatchOverlay({
  room,
  onReturnToLobby,
}: {
  room: Room;
  onReturnToLobby: () => void;
}) {
  const [, forceTick] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const announcedLobbyReturn = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), OVERLAY_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const state = room.state as unknown as MatchRoomWireState & {
    players: Map<string, PlayerWireState>;
  };

  useEffect(() => {
    if (state.phase === 'lobby' && !announcedLobbyReturn.current) {
      announcedLobbyReturn.current = true;
      onReturnToLobby();
    }
  });

  const me = state.players.get(room.sessionId);
  const showLiveLeaderboard = state.phase === 'playing' && me && !me.alive;
  const showFinalLeaderboard = state.phase === 'ended';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: 'sans-serif' }}>
      {state.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#e5e7eb',
            fontSize: '16px',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {formatMmSs(state.matchTimeRemainingSeconds)}
        </div>
      )}

      {showLiveLeaderboard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(11,12,16,0.75)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ color: '#e5e7eb', fontSize: '14px' }}>
            Respawning in {Math.ceil(me.respawnRemainingSeconds)}s…
          </div>
          <div style={{ background: '#16171d', borderRadius: '8px', padding: '12px', color: '#e5e7eb' }}>
            <LeaderboardTable rows={buildLeaderboard(state.players)} meId={room.sessionId} />
          </div>
          <button onClick={() => setShowControls(true)} style={smallButtonStyle}>
            Controls
          </button>
        </div>
      )}

      {showFinalLeaderboard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(11,12,16,0.9)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ color: '#e5e7eb', fontSize: '20px', fontWeight: 'bold' }}>Match over</div>
          <div style={{ background: '#16171d', borderRadius: '8px', padding: '16px', color: '#e5e7eb' }}>
            <LeaderboardTable rows={buildLeaderboard(state.players)} meId={room.sessionId} />
          </div>
          <div style={{ color: '#9aa0ac', fontSize: '12px' }}>Back to the lobby shortly…</div>
          <button onClick={() => setShowControls(true)} style={smallButtonStyle}>
            Controls
          </button>
        </div>
      )}

      {showControls && (
        <div style={{ pointerEvents: 'auto' }}>
          <Popup onClose={() => setShowControls(false)} title="Controls">
            <ControlsPopupBody />
          </Popup>
        </div>
      )}
    </div>
  );
}
