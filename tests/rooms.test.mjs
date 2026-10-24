import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameMap } from '../shared/map.js';
import { PHYS } from '../shared/physics.js';
import { RoomManager } from '../server/rooms.mjs';
import { points } from '../server/game.mjs';

const map = new GameMap(JSON.parse(fs.readFileSync(new URL('../public/assets/map/catacombs.json', import.meta.url))));
let clock = 2_000_000;
Date.now = () => clock;
beforeEach(() => { clock = 2_000_000; });

// A fake socket that records what the server sent it.
const sock = () => ({
  readyState: 1, sent: [], closed: false,
  send(m) { this.sent.push(JSON.parse(m)); }, close() { this.closed = true; this.readyState = 3; },
  last(t) { return [...this.sent].reverse().find((m) => m.t === t); },
});
const tick = (rooms, n = 1) => { for (let i = 0; i < n; i++) { clock += 1000 / 60; rooms.update(PHYS.TICK); } };

function room() {
  const rooms = new RoomManager(map);
  const host = sock();
  rooms.message(host, { t: 'create', name: 'Vishnu' });
  const code = host.last('joined').code;
  return { rooms, host, code, game: rooms.rooms.get(code) };
}
const join = (rooms, code, name, extra = {}) => { const s = sock(); rooms.message(s, { t: 'join', code, name, ...extra }); return s; };

test('create gives a 6-character code; join by code (any case) puts you in the same lobby', () => {
  const { rooms, host, code, game } = room();
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  const guest = join(rooms, code.toLowerCase(), 'Alex');
  assert.equal(guest.last('joined').code, code);
  const lobby = guest.last('lobby');
  assert.deepEqual(lobby.players.map((p) => p.name), ['Vishnu', 'Alex']);
  assert.equal(lobby.players[0].host, true);
  assert.notEqual(lobby.players[0].color, lobby.players[1].color, 'every soldier gets a colour');
  assert.equal(game.players.size, 2);
  assert.ok(host.last('lobby').players.length === 2);
});

test('wrong code: "Room not found"; full room: refused', () => {
  const { rooms, code, game } = room();
  const lost = join(rooms, 'ZZZZZZ', 'Lost');
  assert.equal(lost.last('error').reason, 'not_found');
  game.config.maxPlayers = 2;
  join(rooms, code, 'Alex');
  const third = join(rooms, code, 'Rohan');
  assert.equal(third.last('error').reason, 'full');
});

test('rooms are isolated: two rooms, two lobbies', () => {
  const a = room();
  const b = new RoomManager(map);
  const r1 = a.rooms;
  const s2 = sock();
  r1.message(s2, { t: 'create', name: 'Other' });
  assert.equal(r1.rooms.size, 2);
  assert.notEqual(s2.last('joined').code, a.code);
  assert.equal(s2.last('lobby').players.length, 1);
  assert.ok(b);
});

test('ready flags drive the auto-start countdown; all ready cuts it to 10 s', () => {
  const { rooms, code, game } = room();
  const guest = join(rooms, code, 'Alex');
  assert.equal(guest.last('lobby').startsIn, 120, 'two soldiers: two-minute countdown');
  rooms.message(guest, { t: 'ready', v: true });
  assert.equal(guest.last('lobby').startsIn, 10, 'everyone ready: ten seconds');
  tick(rooms, 60 * 9);
  assert.equal(game.phase, 'lobby');
  tick(rooms, 60 * 2);
  assert.equal(game.phase, 'playing', 'starts by itself');
});

test('host can kick; kicked player cannot come back with the same token', () => {
  const { rooms, host, code, game } = room();
  const guest = join(rooms, code, 'Alex', { token: 'token-of-alex-123' });
  const id = guest.last('joined').id;
  rooms.message(host, { t: 'kick', id });
  assert.ok(guest.sent.some((m) => m.t === 'kicked'));
  assert.equal(game.players.size, 1);
  const again = join(rooms, code, 'Alex', { token: 'token-of-alex-123' });
  assert.equal(again.last('error').reason, 'kicked');
  // a guest cannot kick
  const other = join(rooms, code, 'Rohan');
  rooms.message(other, { t: 'kick', id: host.last('joined').id });
  assert.equal(game.players.size, 2);
});

test('host leaving cancels the room for everyone', () => {
  const { rooms, host, code } = room();
  const guest = join(rooms, code, 'Alex');
  rooms.message(host, { t: 'leave' });
  assert.ok(guest.sent.some((m) => m.t === 'cancelled'));
  assert.equal(rooms.rooms.has(code), false);
});

test('a dropped player can resume within 30 s with their token, then the seat is freed', () => {
  const { rooms, code, game } = room();
  const guest = join(rooms, code, 'Alex');
  const { token, id } = guest.last('joined');
  rooms.dropped(guest);
  assert.equal(game.players.get(id).connected, false);
  tick(rooms, 60 * 20);
  const back = sock();
  rooms.message(back, { t: 'resume', code, token });
  assert.equal(back.last('joined').resumed, true);
  assert.equal(back.last('joined').id, id, 'same soldier');
  rooms.dropped(back);
  tick(rooms, 60 * 31);
  assert.equal(game.players.has(id), false, 'seat released after the grace period');
  const late = sock();
  rooms.message(late, { t: 'resume', code, token });
  assert.equal(late.last('error').reason, 'expired');
});

test('chat is relayed to the room, trimmed, capped and rate limited', () => {
  const { rooms, host, code } = room();
  const guest = join(rooms, code, 'Alex');
  rooms.message(host, { t: 'chat', text: '  Ready   guys?\u0007 ' });
  const m = guest.last('chat');
  assert.equal(m.text, 'Ready guys?');
  assert.equal(m.name, 'Vishnu');
  rooms.message(host, { t: 'chat', text: 'x'.repeat(500) });
  assert.equal(guest.last('chat').text.length, 100);
  for (let i = 0; i < 20; i++) rooms.message(host, { t: 'chat', text: `spam ${i}` });
  assert.ok(guest.sent.filter((x) => x.t === 'chat').length < 10, 'flood is cut off');
  const late = join(rooms, code, 'Rohan');
  assert.ok(late.last('chatHistory').messages.length >= 2, 'late joiners get recent chat');
});

test('points are kills x 100 plus captures x 300; final board is sorted by points', () => {
  assert.equal(points({ kills: 5, caps: 0 }), 500);
  assert.equal(points({ kills: 2, caps: 1 }), 500);
  const { rooms, host, code, game } = room();
  const guest = join(rooms, code, 'Alex');
  rooms.message(host, { t: 'start' });
  const [a, b] = [...game.players.values()];
  b.kills = 3; a.kills = 1;
  game.finish('limit');
  const end = guest.last('end');
  assert.deepEqual(end.players.map((p) => [p.name, p.points]), [['Alex', 300], ['Vishnu', 100]]);
  rooms.message(host, { t: 'playAgain' });
  assert.equal(game.phase, 'playing', 'host plays again with the same rules');
});

test('names are cleaned and must be 2-14 characters', () => {
  const { rooms, code } = room();
  const s = join(rooms, code, '<b>X</b>');
  const me = s.last('lobby').players.find((p) => p.id === s.last('joined').id);
  assert.equal(me.name, 'bXb');
  const t = join(rooms, code, '!');
  assert.equal(t.last('lobby').players.find((p) => p.id === t.last('joined').id).name, 'Soldier');
});
