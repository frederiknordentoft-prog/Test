/**
 * Scenario for tools/shot.cjs: boots the real game, presses SPIL and plays
 * rigged spins, saving frames at chosen times.
 *   node tools/shot.cjs http://127.0.0.1:5190/ --script=tools/play.cjs --size=1280x800 --tag=desk --plan=chain
 */
module.exports = async (page, { shot, advance, opt }) => {
  const tag = opt.tag || 'desk';
  const plan = String(opt.plan || 'boot').split(',');
  const dir = `shots/play/${tag}`;
  const at = async (ms, name) => {
    await advance(ms);
    await shot(`${dir}/${name}.png`);
  };
  const state = () => page.evaluate(() => window.__SN.game.state());
  /** Step until the director is idle again (or give up). */
  const finish = async (maxMs = 120000) => {
    for (let t = 0; t < maxMs; t += 500) {
      if ((await state()) === 'ready') return true;
      if ((await state()) === 'nudge') await page.evaluate(() => window.__SN.game.nudge(window.__SN.director && null));
      await advance(500);
    }
    return false;
  };

  await page.evaluate(() => window.__SN.pause());
  if (plan.includes('boot')) await at(600, '00-splash');
  await page.evaluate(() => {
    window.__SN.game.start();
  });
  await advance(2600);
  if (opt.autonudge) await page.evaluate(() => window.__SN.game.setAutoNudge(true));
  if (plan.includes('boot')) await shot(`${dir}/01-idle.png`);

  for (const kind of plan) {
    if (kind === 'boot') continue;
    const [rig, ...times] = kind.split('@');
    await page.evaluate((k) => {
      if (k === 'spin') window.__SN.game.spin();
      else window.__SN.game.rig(k);
    }, rig);
    let prev = 0;
    for (const t of (times[0] || '700/2700/3600/4600/5800').split('/').map(Number)) {
      await at(t - prev, `${rig}-${String(t).padStart(5, '0')}`);
      prev = t;
      if ((await state()) === 'nudge' && opt.autonudge) await page.evaluate(() => window.__SN.game.setAutoNudge(true));
    }
    const ok = await finish();
    console.log(rig, 'finished:', ok, 'balance', await page.evaluate(() => window.__SN.game.balance()));
  }
};
