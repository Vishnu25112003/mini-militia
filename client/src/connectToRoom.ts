import { Client, type Room } from '@colyseus/sdk';
import { installSimulatedNetworkConditions } from './game/net/simulatedNetwork';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';
const MATCH_ROOM_NAME = 'match_room';

// Must run before the Client (and the WebSocket it opens) is constructed —
// the lobby connection carries through into the match (Phase 05), so this
// is the one place early enough for every connection the app makes.
installSimulatedNetworkConditions();

const client = new Client(SERVER_URL);

export type RoomJoinErrorCode =
  'code_not_found' | 'name_taken' | 'invalid_name' | 'room_full' | 'match_ended' | 'unknown';

export class RoomJoinError extends Error {
  code: RoomJoinErrorCode;

  constructor(code: RoomJoinErrorCode) {
    super(code);
    this.code = code;
  }
}

function mapJoinError(err: unknown): RoomJoinError {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('name_taken')) return new RoomJoinError('name_taken');
  if (message.includes('invalid_name')) return new RoomJoinError('invalid_name');
  if (message.includes('match_ended')) return new RoomJoinError('match_ended');
  if (message.toLowerCase().includes('full') || message.toLowerCase().includes('locked')) {
    return new RoomJoinError('room_full');
  }
  return new RoomJoinError('unknown');
}

export async function createRoom(name: string): Promise<Room> {
  try {
    return await client.create(MATCH_ROOM_NAME, { name });
  } catch (err) {
    throw mapJoinError(err);
  }
}

/** Resolves a room code to its roomId via the server's lookup endpoint, then joins it. */
export async function joinRoomByCode(name: string, code: string): Promise<Room> {
  const normalizedCode = code.trim().toUpperCase();
  const res = await fetch(`${SERVER_URL.replace(/^ws/, 'http')}/rooms/by-code/${normalizedCode}`);
  if (!res.ok) {
    throw new RoomJoinError('code_not_found');
  }
  const { roomId } = (await res.json()) as { roomId: string };

  try {
    return await client.joinById(roomId, { name });
  } catch (err) {
    throw mapJoinError(err);
  }
}
