import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';

/**
 * Forces a re-render whenever the room's state changes. Coarse (re-renders
 * on ANY change, not just the fields a component reads) but the lobby
 * updates infrequently enough (joins/leaves, ready toggles, a once-a-second
 * countdown) that this is simpler than fine-grained field subscriptions.
 */
export function useRoomState(room: Room): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    room.onStateChange(handler);
    return () => room.onStateChange.remove(handler);
  }, [room]);

  return tick;
}
