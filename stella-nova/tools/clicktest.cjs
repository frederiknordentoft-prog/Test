/** Scenario: drive the built page with real clicks (SPIL, SPIN, menu), stepping time by hand. */
module.exports = async (page, { shot, advance }) => {
  await page.evaluate(() => window.__SN.pause());
  await advance(300);
  await page.getByRole('button', { name: /spil/i }).first().click();
  await advance(2800);
  const s1 = await page.evaluate(() => ({ state: window.__SN.game.state(), bal: window.__SN.game.balance() }));
  console.log('after SPIL', JSON.stringify(s1));
  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /spin/i.test(x.getAttribute('aria-label') || x.textContent || '') && x.offsetParent);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute('aria-label') };
  });
  console.log('spin button', JSON.stringify(box));
  if (box) await page.mouse.click(box.x, box.y);
  await advance(900);
  console.log('after SPIN click', await page.evaluate(() => window.__SN.game.state()), await page.evaluate(() => window.__SN.game.balance()));
  for (let i = 0; i < 80 && (await page.evaluate(() => window.__SN.game.state())) !== 'ready'; i++) {
    if ((await page.evaluate(() => window.__SN.game.state())) === 'nudge') await page.evaluate(() => window.__SN.game.nudge(null));
    await advance(400);
  }
  console.log('end', await page.evaluate(() => ({ state: window.__SN.game.state(), bal: window.__SN.game.balance() })));
  const menu = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /menu/i.test(x.getAttribute('aria-label') || ''));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (menu) await page.mouse.click(menu.x, menu.y);
  await advance(600);
  await shot('shots/play/built-menu.png');
};
