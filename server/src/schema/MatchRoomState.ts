import { schema, t } from '@colyseus/schema';
import { PlayerSchema } from './PlayerSchema.js';
import { HostSettingsSchema } from './HostSettingsSchema.js';
import { GroundItemSchema } from './GroundItemSchema.js';

export const MatchRoomState = schema(
  {
    players: t.map(PlayerSchema),
    /** 'lobby' | 'playing' | 'ended' — see @game/shared's MatchPhase. */
    phase: t.string().default('lobby'),
    roomCode: t.string().default(''),
    hostSessionId: t.string().default(''),
    /** Counts down from the flow's 2-minute auto-start timer; 0 once it fires or the match starts early. */
    autoStartRemainingSeconds: t.number().default(0),
    /** Phase 06: host-editable match settings, host-only to change, locked once `phase !== 'lobby'`. */
    settings: HostSettingsSchema,
    /** Fixed pickup-spot items and dropped/scattered items alike, keyed by item id. */
    groundItems: t.map(GroundItemSchema),
    /** Counts down from the host's game-time setting once `phase === 'playing'`; 0 once the match ends. */
    matchTimeRemainingSeconds: t.number().default(0),
  },
  'MatchRoomState',
);

export type MatchRoomState = InstanceType<typeof MatchRoomState>;
