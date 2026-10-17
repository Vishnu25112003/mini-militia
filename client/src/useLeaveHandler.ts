import { useEffect } from 'react';
import type { Room } from '@colyseus/sdk';
import { clearReconnectToken } from './reconnectToken';

/**
 * Shared `room.onLeave` handling for both the lobby and the in-match overlay
 * (Phase 12) — a terminal leave (cancelled/kicked) clears the saved reconnect
 * token and shows a notice; an unexplained drop keeps the token so the app
 * can try to resume automatically.
 */
export function useLeaveHandler(room: Room, onLeftRoom: (message?: string) => void) {
  useEffect(() => {
    const handleLeave = (_code: number, reason?: string) => {
      if (reason === 'room_cancelled') {
        clearReconnectToken();
        onLeftRoom('The host cancelled the room.');
      } else if (reason === 'removed_by_host') {
        clearReconnectToken();
        onLeftRoom('You were removed from the room.');
      } else {
        onLeftRoom();
      }
    };
    room.onLeave(handleLeave);
    return () => room.onLeave.remove(handleLeave);
  }, [room, onLeftRoom]);
}
