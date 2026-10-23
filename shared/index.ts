// @game/shared — rules, config, physics and map shared by the server and the browser.
// Every number from the Game Flow lives in exactly one file under config/.

/** Imported by both client and server to prove the shared package is wired up (Phase 00). */
export const GAME_NAME = 'Mini Militia WAN';

export * from './types';
export * from './config';
export * from './physics';
export * from './logic';
export * from './maps';
