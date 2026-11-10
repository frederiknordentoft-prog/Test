/** Scenario: prove that a real pointer drag on a ring commits the nudge. */
module.exports = async (page, { shot, advance }) => {
  await page.evaluate(() => window.__SN.pause());
  await page.evaluate(() => { window.__SN.game.start(); });
  await advance(2600);
  await page.evaluate(() => window.__SN.game.rig('nudgeWin'));
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__SN.game.state())) !== 'nudge'; i++) await advance(250);
  const info = await page.evaluate(() => {
    const sn = window.__SN;
    let best = null;
    for (let ring = 0; ring < 4; ring++) for (const dir of [1, -1]) {
      const o = sn.engine.previewNudge({ ring, dir });
      if (!best || o.amount > best.amount) best = { ring, dir, amount: o.amount };
    }
    const from = sn.view.cellScreen({ ring: best.ring, spoke: 2 });
    const to = sn.view.cellScreen({ ring: best.ring, spoke: (2 + best.dir + 8) % 8 });
    const el = document.elementFromPoint(from.x, from.y);
    return { state: sn.game.state(), best, from, to, hit: el ? el.tagName + '.' + el.className : null, balance: sn.game.balance() };
  });
  console.log('before', JSON.stringify(info));
  const { from, to } = info;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
    await advance(40);
  }
  await shot('shots/play/drag-mid.png');
  await page.mouse.up();
  await advance(700);
  console.log('after release', await page.evaluate(() => window.__SN.game.state()));
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__SN.game.state())) !== 'ready'; i++) {
    if ((await page.evaluate(() => window.__SN.game.state())) === 'nudge') { console.log('STILL IN NUDGE'); break; }
    await advance(400);
  }
  console.log('end', await page.evaluate(() => ({ state: window.__SN.game.state(), balance: window.__SN.game.balance() })));
};
