import { schema, t } from '@colyseus/schema';
import { PlayerSchema } from './PlayerSchema.js';

export const MatchRoomState = schema(
  {
    players: t.map(PlayerSchema),
  },
  'MatchRoomState',
);

export type MatchRoomState = InstanceType<typeof MatchRoomState>;
