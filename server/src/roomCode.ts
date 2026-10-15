import { matchMaker } from 'colyseus';
import { generateRoomCode } from '@game/shared';

/**
 * A fresh 6-character code (see shared's `generateRoomCode`), re-rolled on
 * the (astronomically unlikely, ~1-in-32^6) chance it collides with an
 * active room of the same type — "unique among active rooms" per the task.
 */
export async function generateUniqueRoomCode(roomName: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const existing = await matchMaker.query({ name: roomName });
    const collision = existing.some(
      (r) => (r.metadata as { code?: string } | undefined)?.code === code,
    );
    if (!collision) return code;
  }
  throw new Error('Could not generate a unique room code after 10 attempts');
}
