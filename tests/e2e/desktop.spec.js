import { test, expect } from '@playwright/test';

async function open(browser, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.locator('#screen-home')).toBeVisible({ timeout: 20_000 });
  return { page, context, errors };
}

async function host(browser, name = 'Vishnu', viewport) {
  const s = await open(browser, viewport);
  await s.page.fill('#name', name);
  await expect(s.page.locator('#name-hint')).toHaveText('Looks good!');
  await s.page.click('#create-room');
  await expect(s.page.locator('#screen-lobby')).toBeVisible();
  s.code = await s.page.evaluate(() => window.__catacombs.state.code);
  expect(s.code).toMatch(/^[A-Z2-9]{6}$/);
  return s;
}

async function guest(browser, code, name = 'Alex') {
  const s = await open(browser);
  await s.page.fill('#name', name);
  await s.page.click('#join-room');
  await s.page.fill('#code', code.toLowerCase());
  await s.page.click('#join-form button[type=submit]');
  await expect(s.page.locator('#screen-lobby')).toBeVisible();
  return s;
}

const me = (page) => page.evaluate(() => {
  const s = window.__catacombs.state;
  const b = s.pred.body;
  return { alive: s.me?.alive, x: b.x, y: b.y, fuel: b.fuel, serverX: s.me?.x, mag: s.me?.guns?.[s.me.slots[s.me.slot]]?.mag, players: s.lastSnap?.players.length };
});

test('create a room, join by code, chat, ready up and play', async ({ browser }, info) => {
  const a = await host(browser, 'Vishnu', { width: 1440, height: 900 });

  // a wrong code is refused with the sheet's message
  const lost = await open(browser);
  await lost.page.fill('#name', 'Lost');
  await lost.page.click('#join-room');
  await lost.page.fill('#code', 'ZZZZZZ');
  await lost.page.click('#join-form button[type=submit]');
  await expect(lost.page.locator('#join-error')).toContainText('Room not found');
  await lost.context.close();

  const b = await guest(browser, a.code);
  await expect(a.page.locator('#players .player')).toHaveCount(2);
  await expect(a.page.locator('#player-count')).toHaveText('(2/8)');
  await expect(a.page.locator('#room-code')).toHaveText(a.code);
  await expect(b.page.locator('#start-btn')).toBeHidden(); // only the host starts
  await expect(a.page.locator('#countdown')).toContainText('Match starts in');

  // chat
  await b.page.click('#lobby-chat-btn');
  await b.page.fill('#chat-input', 'Ready guys?');
  await b.page.press('#chat-input', 'Enter');
  await expect(a.page.locator('#lobby-chat-badge')).toHaveText('1');
  await a.page.click('#lobby-chat-btn');
  await expect(a.page.locator('#chat-log')).toContainText('Ready guys?');
  await a.page.locator('#pop-chat [data-close]').first().click();
  await b.page.locator('#pop-chat [data-close]').first().click();

  // ready: everyone ready cuts the countdown to 10 s
  await b.page.click('#ready-btn');
  await expect(a.page.locator('#players .player').nth(1)).toContainText('Ready');
  await expect(a.page.locator('#countdown')).toContainText('0:1');
  await a.page.screenshot({ path: info.outputPath('lobby.png') });

  await a.page.click('#start-btn');
  for (const p of [a.page, b.page]) await expect(p.locator('#hud')).toBeVisible();
  await a.page.waitForFunction(() => window.__catacombs.state.me?.alive);
  await b.page.waitForFunction(() => window.__catacombs.state.me?.alive);
  const start = await me(a.page);
  expect(start.players).toBe(2);

  // walk (the other way if spawned against a wall), then jet once standing still
  await a.page.mouse.move(1100, 450);
  await a.page.keyboard.down('KeyD'); await a.page.waitForTimeout(700); await a.page.keyboard.up('KeyD');
  await a.page.waitForTimeout(300);
  let walked = await me(a.page);
  if (Math.abs(walked.x - start.x) < 20) {
    await a.page.keyboard.down('KeyA'); await a.page.waitForTimeout(900); await a.page.keyboard.up('KeyA');
    await a.page.waitForTimeout(300);
    walked = await me(a.page);
  }
  expect(Math.abs(walked.x - start.x)).toBeGreaterThan(20);
  expect(Math.abs(walked.serverX - walked.x)).toBeLessThan(6); // prediction agrees with the server
  await a.page.waitForFunction(() => { const b = window.__catacombs.state.pred.body; return b.onGround && Math.abs(b.vy) < 1; }, null, { timeout: 5000 });
  const grounded = await me(a.page);
  await a.page.keyboard.down('KeyW'); await a.page.waitForTimeout(400);
  const jetting = await me(a.page);
  await a.page.keyboard.up('KeyW');
  expect(jetting.y).toBeLessThan(grounded.y - 5);

  await a.page.mouse.down(); await a.page.waitForTimeout(400); await a.page.mouse.up();
  await a.page.waitForTimeout(200);
  expect((await me(a.page)).mag).toBeLessThan(start.mag);
  await expect(a.page.locator('#ammo')).toHaveText(/\d{3} \/ \d{3}/);

  // live leaderboard on Tab
  await a.page.keyboard.down('Tab');
  await expect(a.page.locator('#board')).toBeVisible();
  await expect(a.page.locator('#board-rows tr')).toHaveCount(2);
  await a.page.screenshot({ path: info.outputPath('live-board.png') });
  await a.page.keyboard.up('Tab');
  await expect(a.page.locator('#board')).toBeHidden();

  expect(a.errors).toEqual([]);
  expect(b.errors).toEqual([]);
  await a.context.close();
  await b.context.close();
});

test('host settings reach every player; controls can be rebound', async ({ browser }, info) => {
  const a = await host(browser, 'Host', { width: 1440, height: 1000 });
  const b = await guest(browser, a.code, 'Guest');
  await a.page.click('#settings-btn');
  const step = async (label, dir, times = 1) => {
    for (let i = 0; i < times; i++) await a.page.locator(`#pop-settings button[aria-label="${dir} ${label}"]`).click();
  };
  await step('Gravity', 'Previous', 2); // 100 -> 50
  await step('Boost', 'Next', 3); // 100 -> 150 -> 200 -> max
  await step('Map drops (disappear time)', 'Previous', 2); // 18 s -> 10 s -> off
  await a.page.getByRole('button', { name: 'Fast Reload' }).click();
  // default loadout: Uzi + Uzi pair in slot 1
  await a.page.getByRole('button', { name: 'Edit', exact: true }).click();
  await a.page.locator('#loadout-slots .pair').first().click();
  await a.page.screenshot({ path: info.outputPath('loadout.png') });
  const cfg = () => b.page.evaluate(() => window.__catacombs.state.lobby.config);
  await expect.poll(async () => (await cfg()).loadout.primaryDual).toBe(true);
  const c = await cfg();
  expect([c.gravity, c.boost, c.drops, c.specials]).toEqual([0.5, -1, 0, ['fastReload']]);
  await b.page.click('#settings-btn');
  await expect(b.page.locator('#pop-settings button[aria-label="Next Gravity"]')).toBeDisabled(); // guests read only
  await b.page.locator('#pop-settings [data-close]').first().click();

  // guest rebinds the jetpack to Shift from the controls screen
  await b.page.keyboard.press('Escape');
  await b.page.evaluate(() => document.querySelector('.open-settings').click());
  await b.page.getByRole('tab', { name: 'Keyboard (PC)' }).click();
  await b.page.locator('.binding', { hasText: 'Jetpack' }).locator('.keycap').first().click();
  await b.page.keyboard.press('ShiftLeft');
  await expect(b.page.locator('.binding', { hasText: 'Jetpack' }).locator('.keycap').first()).toHaveText('Left Shift');
  await b.page.click('#settings-done');

  await a.page.locator('#pop-loadout [data-close]').first().click();
  await a.page.locator('#pop-settings [data-close]').first().click();
  await a.page.click('#start-btn');
  await b.page.waitForFunction(() => window.__catacombs.state.me?.alive);
  await b.page.waitForFunction(() => window.__catacombs.state.lastSnap);
  expect(await b.page.evaluate(() => window.__catacombs.state.lastSnap.items.length)).toBe(0); // map drops off
  expect(await b.page.evaluate(() => window.__catacombs.state.me.off[0]?.type)).toBe('uzi'); // spawned with the pair
  await expect(b.page.locator('#weapon-icon2')).toBeVisible();
  const y0 = await b.page.evaluate(() => window.__catacombs.state.pred.body.y);
  await b.page.keyboard.down('ShiftLeft');
  await b.page.waitForTimeout(1500);
  const after = await b.page.evaluate(() => ({ y: window.__catacombs.state.pred.body.y, fuel: window.__catacombs.state.pred.body.fuel }));
  await b.page.keyboard.up('ShiftLeft');
  expect(after.y).toBeLessThan(y0); // the rebound key flies
  expect(after.fuel).toBe(1); // unlimited boost
  await b.page.keyboard.press('Escape');
  await expect(b.page.locator('#screen-settings')).toBeVisible(); // Esc opens controls in a match
  expect(a.errors).toEqual([]);
  expect(b.errors).toEqual([]);
  await a.context.close();
  await b.context.close();
});

test('system messages: kicked, reconnecting, room cancelled by host', async ({ browser }, info) => {
  const a = await host(browser);
  const b = await guest(browser, a.code, 'Alex');
  const c = await guest(browser, a.code, 'Rohan');

  // reconnect: drop Alex's socket, the seat is kept and resumed
  const id = await b.page.evaluate(() => window.__catacombs.state.myId);
  await b.page.evaluate(() => window.__catacombs.net.ws.close());
  await expect(b.page.locator('#system')).toContainText('Reconnecting');
  await expect(b.page.locator('#system')).toBeHidden({ timeout: 10_000 });
  expect(await b.page.evaluate(() => window.__catacombs.state.myId)).toBe(id);
  await expect(a.page.locator('#players .player')).toHaveCount(3);

  // kick
  await a.page.locator('#players .player', { hasText: 'Rohan' }).locator('.kick').click();
  await expect(c.page.locator('#system')).toContainText('You were removed from the room');
  await c.page.screenshot({ path: info.outputPath('kicked.png') });
  await c.page.click('#system-btn');
  await expect(c.page.locator('#screen-home')).toBeVisible();

  // host leaves: room cancelled
  await a.page.click('#leave-btn');
  await expect(b.page.locator('#system')).toContainText('Room cancelled by host');
  await b.page.click('#system-btn');
  await expect(b.page.locator('#screen-home')).toBeVisible();
  for (const s of [a, b, c]) expect(s.errors).toEqual([]);
  for (const s of [a, b, c]) await s.context.close();
});

test('radar arrows point at enemies firing off screen; letting go of fire over an overlay is not lost', async ({ browser }) => {
  const a = await host(browser, 'Host');
  const b = await guest(browser, a.code, 'Enemy');
  await a.page.click('#start-btn');
  for (const s of [a, b]) await s.page.waitForFunction(() => window.__catacombs.state.me?.alive);
  const enemyId = await b.page.evaluate(() => window.__catacombs.state.myId);

  // the enemy shoots; on the host's screen there is an edge arrow exactly when the enemy is off screen
  let seenOff = false;
  for (let i = 0; i < 6; i++) {
    await b.page.mouse.move(640, 300);
    await b.page.mouse.down(); await b.page.waitForTimeout(250); await b.page.mouse.up();
    await a.page.waitForTimeout(150);
    const r = await a.page.evaluate((id) => {
      const { renderer, state } = window.__catacombs;
      const o = state.lastSnap.players.find((p) => p.id === id);
      const p = renderer.worldToScreen(o.x, o.y - 25);
      const off = p.x < -8 || p.x > renderer.w + 8 || p.y < -8 || p.y > renderer.h + 8;
      return { off, far: Math.hypot(p.x - renderer.w / 2, p.y - renderer.h / 2) > 200, arrow: renderer.radar.includes(id) };
    }, enemyId);
    if (r.far) expect(r.arrow).toBe(r.off); // skip frames right at the screen edge
    seenOff ||= r.off;
    if (seenOff) break;
    await b.page.keyboard.down('KeyD'); await b.page.keyboard.down('KeyW'); await b.page.waitForTimeout(800);
    await b.page.keyboard.up('KeyW'); await b.page.keyboard.up('KeyD');
  }

  // hold fire, an overlay (the board) covers the canvas, release over it: fire must not stay held
  await a.page.mouse.move(700, 400);
  await a.page.mouse.down();
  await a.page.keyboard.down('Tab');
  await expect(a.page.locator('#board')).toBeVisible();
  await a.page.mouse.up();
  await a.page.keyboard.up('Tab');
  await a.page.waitForTimeout(100);
  const mag = await a.page.evaluate(() => { const s = window.__catacombs.state; return s.me.guns[s.me.slots[s.me.slot]].mag; });
  await a.page.waitForTimeout(500);
  const after = await a.page.evaluate(() => { const s = window.__catacombs.state; return { held: window.__catacombs.input.held.has('fire'), mag: s.me.guns[s.me.slots[s.me.slot]].mag }; });
  expect(after.held).toBe(false);
  expect(after.mag).toBe(mag);
  expect(a.errors).toEqual([]);
  expect(b.errors).toEqual([]);
  await a.context.close();
  await b.context.close();
});
