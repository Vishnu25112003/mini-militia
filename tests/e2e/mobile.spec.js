import { test, expect, devices } from '@playwright/test';

// Touch pointer events on the game canvas (the dual-stick controls listen for pointerType "touch").
async function touch(page, type, id, x, y) {
  await page.evaluate(([type, id, x, y]) => {
    document.getElementById('game').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
  }, [type, id, x, y]);
}

test('phone: create a room and play with the dual-stick controls', async ({ browser }, info) => {
  const context = await browser.newContext({ ...info.project.use });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#screen-home')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: info.outputPath('phone-home.png') });
  await page.fill('#name', 'Thumbs');
  await page.locator('#create-room').tap();
  await expect(page.locator('#screen-lobby')).toBeVisible();
  await expect(page.locator('#leave-btn')).toBeInViewport(); // the lobby fits a landscape phone
  await page.screenshot({ path: info.outputPath('phone-lobby.png') });
  await page.locator('#start-btn').tap();
  await page.waitForFunction(() => window.__catacombs.state.me?.alive);
  await page.waitForTimeout(400);

  const pads = await page.evaluate(() => {
    const i = window.__catacombs.input;
    return { move: i.movePad, fire: i.firePad, touch: i.touchMode };
  });
  expect(pads.touch).toBe(true);
  const read = () => page.evaluate(() => { const s = window.__catacombs.state; return { x: s.pred.body.x, y: s.pred.body.y, mag: s.me.guns[s.me.slots[s.me.slot]].mag }; });
  const start = await read();

  await touch(page, 'pointerdown', 1, pads.move.x, pads.move.y);
  await touch(page, 'pointermove', 1, pads.move.x + pads.move.r, pads.move.y);
  await page.waitForTimeout(600);
  await touch(page, 'pointermove', 1, pads.move.x + pads.move.r * 0.5, pads.move.y - pads.move.r);
  await page.waitForTimeout(400);
  const moved = await read();
  await page.screenshot({ path: info.outputPath('phone-game.png') });
  await touch(page, 'pointerup', 1, pads.move.x, pads.move.y - pads.move.r);
  // spawns are random, so a wall or low ceiling may block one axis; the sticks must still move us
  expect(Math.abs(moved.x - start.x) + Math.abs(moved.y - start.y)).toBeGreaterThan(20);

  await touch(page, 'pointerdown', 2, pads.fire.x, pads.fire.y);
  await touch(page, 'pointermove', 2, pads.fire.x - pads.fire.r, pads.fire.y - 10);
  await page.waitForTimeout(400);
  await touch(page, 'pointerup', 2, pads.fire.x - pads.fire.r, pads.fire.y - 10);
  await page.waitForTimeout(200);
  expect((await read()).mag).toBeLessThan(start.mag);
  expect(errors).toEqual([]);
  await context.close();
});

test('phone held upright asks to rotate to landscape', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#rotate')).toBeVisible();
  await expect(page.locator('#rotate')).toContainText('Rotate your phone');
  await context.close();
});
