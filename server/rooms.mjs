// Rooms: CREATE ROOM gives a 6-character code, JOIN ROOM enters one. Each room is its own Game.
// Messages are the whole protocol, so a WAN relay can later carry them unchanged.
import { Game } from './game.mjs';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const CODE_LEN = 6;

const send = (ws, msg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };

export class RoomManager {
  constructor(map, { maxRooms = 50, info = () => ({}) } = {}) {
    this.map = map;
    this.rooms = new Map();
    this.maxRooms = maxRooms;
    this.info = info; // extra fields for the "joined" message (LAN address etc.)
  }

  newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < CODE_LEN; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  static normalize(code) { return String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN); }

  // First message on a socket: create / join / resume. Returns true when the socket is now in a room.
  enter(ws, msg) {
    if (msg.t === 'create') {
      if (this.rooms.size >= this.maxRooms) { send(ws, { t: 'error', reason: 'busy' }); return false; }
      const code = this.newCode();
      const game = new Game(this.map, null, { code });
      this.rooms.set(code, game);
      return this.attach(ws, game, game.addPlayer(ws, msg));
    }
    if (msg.t === 'join' || msg.t === 'resume') {
      const game = this.rooms.get(RoomManager.normalize(msg.code));
      if (!game || game.closed) { send(ws, { t: 'error', reason: 'not_found' }); return false; }
      if (msg.token) {
        const back = game.resume(msg.token, ws);
        if (back) return this.attach(ws, game, back, true);
        if (game.kicked.has(msg.token)) { send(ws, { t: 'error', reason: 'kicked' }); return false; }
      }
      if (msg.t === 'resume') { send(ws, { t: 'error', reason: 'expired' }); return false; }
      if (game.players.size >= game.config.maxPlayers) { send(ws, { t: 'error', reason: 'full', max: game.config.maxPlayers }); return false; }
      return this.attach(ws, game, game.addPlayer(ws, msg));
    }
    return false;
  }

  attach(ws, game, player, resumed = false) {
    ws.game = game;
    ws.player = player;
    send(ws, { t: 'joined', code: game.code, id: player.id, token: player.token, resumed, ...this.info() });
    game.sendLobby();
    if (game.phase === 'playing') send(ws, { t: 'start', config: game.config });
    return true;
  }

  message(ws, msg) {
    if (!ws.game) return this.enter(ws, msg);
    if (msg.t === 'leave') return this.leave(ws);
    ws.game.handle(ws.player, msg);
  }

  leave(ws) {
    const { game, player } = ws;
    ws.game = ws.player = null;
    if (game && player) game.removePlayer(player);
    this.sweep();
  }

  // Socket closed without "leave": hold the seat for a reconnect.
  dropped(ws) {
    const { game, player } = ws;
    if (game && player && game.players.get(player.id)?.ws === ws) game.disconnect(player);
  }

  sweep() {
    for (const [code, g] of this.rooms) if (g.closed) this.rooms.delete(code);
  }

  update(dt) {
    for (const g of this.rooms.values()) g.update(dt);
    this.sweep();
  }

  snapshot() {
    for (const g of this.rooms.values()) g.snapshot();
  }
}
