import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import { GameCanvas } from './game/GameCanvas';
import type { MatchScene } from './game/MatchScene';
import { MatchOverlay } from './MatchOverlay';
import { MatchChat } from './MatchChat';

/**
 * Owns the chat popup's open/closed state and the live `MatchScene` instance
 * reference, so it can tell the scene to suppress this player's own input
 * while chat has focus (Phase 13).
 */
export function MatchScreen({
  room,
  onReturnToLobby,
  onLeftRoom,
}: {
  room: Room;
  onReturnToLobby: () => void;
  onLeftRoom: (message?: string) => void;
}) {
  const [showChat, setShowChat] = useState(false);
  const sceneRef = useRef<MatchScene | null>(null);

  const handleSceneReady = useCallback((scene: MatchScene) => {
    sceneRef.current = scene;
  }, []);

  const handleOpenChatRequested = useCallback(() => setShowChat(true), []);

  useEffect(() => {
    sceneRef.current?.setChatOpen(showChat);
  }, [showChat]);

  return (
    <div style={{ position: 'relative' }}>
      <GameCanvas
        sceneData={{
          room,
          onOpenChatRequested: handleOpenChatRequested,
          onSceneReady: handleSceneReady,
        }}
      />
      <MatchOverlay room={room} onReturnToLobby={onReturnToLobby} onLeftRoom={onLeftRoom} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <MatchChat room={room} open={showChat} onClose={() => setShowChat(false)} />
      </div>
    </div>
  );
}
