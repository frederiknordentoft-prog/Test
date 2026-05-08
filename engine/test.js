import { Engine, Body, Vec2, Tweens, Particles, easings } from './index.js';

let pass = 0, fail = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`  ok  ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL ${name}\n       ${e.message}`);
    fail++;
  }
};

const near = (actual, expected, tol, label = '') => {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${label} expected ${expected}, got ${actual} (tol ${tol})`);
  }
};

console.log('free fall:');
test('y(t) ≈ ½gt² after 1s with no drag', () => {
  const eng = new Engine({ airDensity: 0, gravity: new Vec2(0, 9.82) });
  const ball = eng.add(new Body({ position: new Vec2(0, 0), dragCoefficient: 0 }));
  const dt = 1 / 240;
  for (let t = 0; t < 1; t += dt) eng.step(dt);
  near(ball.position.y, 0.5 * 9.82 * 1 * 1, 0.05, 'y');
});

console.log('initial velocity:');
test('horizontal throw lands where projectile motion predicts', () => {
  const eng = new Engine({ airDensity: 0, gravity: new Vec2(0, 9.82) });
  const dt = 1 / 240;
  const ball = eng.add(new Body({ position: new Vec2(0, 0), dragCoefficient: 0 }));
  ball.setVelocity(new Vec2(10, 0), dt / eng.subSteps);
  const T = 1.0;
  for (let t = 0; t < T; t += dt) eng.step(dt);
  near(ball.position.x, 10 * T, 0.05, 'x');
  near(ball.position.y, 0.5 * 9.82 * T * T, 0.05, 'y');
});

console.log('floor + restitution + friction:');
test('ball settles on floor with low restitution', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 0 },
  });
  const ball = eng.add(new Body({
    position: new Vec2(0, -5),
    radius: 0.5,
    restitution: 0.3,
    friction: 0.5,
    dragCoefficient: 0,
  }));
  const dt = 1 / 120;
  for (let t = 0; t < 6; t += dt) eng.step(dt);
  near(ball.position.y, -0.5, 0.05, 'resting y');
});

console.log('elastic head-on collision (equal mass):');
test('velocities swap', () => {
  const eng = new Engine({ airDensity: 0, gravity: new Vec2(0, 0) });
  const dt = 1 / 240;
  const h = dt / eng.subSteps;
  const a = eng.add(new Body({
    position: new Vec2(-5, 0), radius: 0.5, mass: 1,
    restitution: 1.0, friction: 0, dragCoefficient: 0,
  }));
  const b = eng.add(new Body({
    position: new Vec2(5, 0), radius: 0.5, mass: 1,
    restitution: 1.0, friction: 0, dragCoefficient: 0,
  }));
  a.setVelocity(new Vec2(2, 0), h);
  b.setVelocity(new Vec2(-2, 0), h);
  for (let t = 0; t < 5; t += dt) eng.step(dt);
  const va = a.velocity(h);
  const vb = b.velocity(h);
  near(va.x, -2, 0.05, 'a.vx');
  near(vb.x, 2, 0.05, 'b.vx');
});

console.log('air drag → terminal velocity:');
test('ping-pong ball reaches expected terminal velocity', () => {
  const radius = 0.02;
  const mass = 0.0027;
  const Cd = 0.47;
  const rho = 1.225;
  const g = 9.82;

  const eng = new Engine({ airDensity: rho, gravity: new Vec2(0, g) });
  const ball = eng.add(new Body({
    position: new Vec2(0, 0),
    radius,
    mass,
    dragCoefficient: Cd,
  }));
  const dt = 1 / 240;
  for (let t = 0; t < 20; t += dt) eng.step(dt);

  const A = Math.PI * radius * radius;
  const vTerminal = Math.sqrt(2 * mass * g / (rho * Cd * A));
  const v = ball.velocity(dt / eng.subSteps);
  near(v.y, vTerminal, vTerminal * 0.05, `terminal (~${vTerminal.toFixed(2)} m/s)`);
});

console.log('rotation from friction:');
test('sliding ball gains spin from floor friction', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 0 },
  });
  const ball = eng.add(new Body({
    position: new Vec2(0, -0.5),
    radius: 0.5,
    restitution: 0,
    friction: 0.5,
    dragCoefficient: 0,
  }));
  const dt = 1 / 240;
  const h = dt / eng.subSteps;
  ball.setVelocity(new Vec2(5, 0), h);
  for (let t = 0; t < 1; t += dt) eng.step(dt);
  const omega = ball.angularVelocity(h);
  if (omega <= 0.5) throw new Error(`expected ω > 0.5 (clockwise spin), got ${omega.toFixed(3)}`);
});

console.log('rolling without slipping:');
test('rolling ball converges toward v = ω·r', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 0 },
  });
  const ball = eng.add(new Body({
    position: new Vec2(0, -0.5),
    radius: 0.5,
    restitution: 0,
    friction: 0.8,
    dragCoefficient: 0,
  }));
  const dt = 1 / 240;
  const h = dt / eng.subSteps;
  ball.setVelocity(new Vec2(8, 0), h);
  for (let t = 0; t < 3; t += dt) eng.step(dt);
  const v = ball.velocity(h).x;
  const omega = ball.angularVelocity(h);
  const slip = Math.abs(v - omega * ball.radius);
  if (slip > 0.5) throw new Error(`slip too large: v=${v.toFixed(2)}, ω·r=${(omega * ball.radius).toFixed(2)}`);
});

console.log('polygon bounds:');
test('box settles on floor', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 0 },
  });
  const box = eng.add(Body.box(1, 1, {
    position: new Vec2(0, -5),
    restitution: 0.1,
    friction: 0.5,
    dragCoefficient: 0,
  }));
  const dt = 1 / 240;
  for (let t = 0; t < 6; t += dt) eng.step(dt);
  near(box.position.y, -0.5, 0.05, 'resting y');
});

console.log('circle vs box:');
test('falling ball lands on top of static box', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
  });
  const platform = eng.add(Body.box(4, 0.5, {
    position: new Vec2(0, 0),
    isStatic: true,
    friction: 0.5,
  }));
  const ball = eng.add(new Body({
    position: new Vec2(0, -5),
    radius: 0.3,
    restitution: 0.0,
    friction: 0.5,
    dragCoefficient: 0,
  }));
  const dt = 1 / 240;
  for (let t = 0; t < 4; t += dt) eng.step(dt);
  near(ball.position.y, -0.55, 0.1, 'ball resting on top of box');
  near(ball.position.x, 0, 0.5, 'ball centered');
});

console.log('box vs box:');
test('two boxes separate after overlap', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 0),
  });
  const a = eng.add(Body.box(1, 1, {
    position: new Vec2(-0.4, 0),
    restitution: 1,
    friction: 0,
    dragCoefficient: 0,
  }));
  const b = eng.add(Body.box(1, 1, {
    position: new Vec2(0.4, 0),
    restitution: 1,
    friction: 0,
    dragCoefficient: 0,
  }));
  const dt = 1 / 240;
  for (let t = 0; t < 1; t += dt) eng.step(dt);
  const dist = b.position.sub(a.position).length();
  if (dist < 0.95) throw new Error(`boxes still overlap: distance ${dist.toFixed(3)}`);
});

console.log('stacking — 4 boxes stable column:');
test('boxes settle at expected heights with low jitter', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -10, minY: -100, maxX: 10, maxY: 0 },
  });
  const boxes = [];
  for (let i = 0; i < 4; i++) {
    boxes.push(eng.add(Body.box(1, 1, {
      position: new Vec2(0, -2 - i * 1.2),
      restitution: 0.1,
      friction: 0.6,
      dragCoefficient: 0,
    })));
  }
  const dt = 1 / 120;
  for (let t = 0; t < 5; t += dt) eng.step(dt);

  const h = dt / eng.subSteps;
  boxes.forEach((box, i) => {
    const expectedY = -0.5 - i;
    near(box.position.y, expectedY, 0.1, `box ${i} resting y`);
    const vy = Math.abs(box.velocity(h).y);
    if (vy > 0.05) throw new Error(`box ${i} still jittering: |vy|=${vy.toFixed(4)}`);
    if (Math.abs(box.angle) > 0.1) throw new Error(`box ${i} tipped: angle=${box.angle.toFixed(3)}`);
  });
});

console.log('stacking — bodies sleep when settled:');
test('settled stack puts bodies to sleep', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -10, minY: -100, maxX: 10, maxY: 0 },
    sleepFrames: 20,
  });
  const boxes = [];
  for (let i = 0; i < 3; i++) {
    boxes.push(eng.add(Body.box(1, 1, {
      position: new Vec2(0, -2 - i * 1.2),
      restitution: 0.1,
      friction: 0.6,
      dragCoefficient: 0,
    })));
  }
  const dt = 1 / 120;
  for (let t = 0; t < 5; t += dt) eng.step(dt);
  const sleeping = boxes.filter(b => b.sleeping).length;
  if (sleeping < 3) throw new Error(`expected 3 sleeping, got ${sleeping}`);
});

console.log('stacking — wake on impact:');
test('falling ball wakes top of stack', () => {
  const eng = new Engine({
    airDensity: 0,
    gravity: new Vec2(0, 9.82),
    bounds: { minX: -10, minY: -100, maxX: 10, maxY: 0 },
  });
  const top = eng.add(Body.box(1, 1, {
    position: new Vec2(0, -2),
    restitution: 0.1,
    friction: 0.6,
    dragCoefficient: 0,
  }));
  const dt = 1 / 120;
  for (let t = 0; t < 3; t += dt) eng.step(dt);
  if (!top.sleeping) throw new Error('expected top box to be sleeping before impact');

  eng.add(new Body({
    position: new Vec2(0, -3),
    radius: 0.3,
    restitution: 0.2,
    friction: 0.4,
    dragCoefficient: 0,
  }));
  let woke = false;
  for (let t = 0; t < 1.5; t += dt) {
    const wasSleeping = top.sleeping;
    eng.step(dt);
    if (wasSleeping && !top.sleeping) woke = true;
  }
  if (!woke) throw new Error('top box never woke after impact');
});

console.log('tween basics:');
test('linear tween reaches target', () => {
  const tw = new Tweens();
  let v = 0;
  tw.to(0, 100, 1, x => v = x, { easing: easings.linear });
  for (let i = 0; i < 10; i++) tw.step(0.1);
  near(v, 100, 0.01);
});

console.log('tween delay:');
test('tween waits for delay before running', () => {
  const tw = new Tweens();
  let v = 0;
  tw.to(0, 100, 1, x => v = x, { easing: easings.linear, delay: 0.5 });
  tw.step(0.4);
  if (v !== 0) throw new Error(`expected 0 during delay, got ${v}`);
  tw.step(0.5);
  if (v <= 0) throw new Error(`expected progress after delay, got ${v}`);
});

console.log('tween repeat + yoyo:');
test('yoyo returns to start, repeat runs the right number of times', () => {
  const tw = new Tweens();
  const samples = [];
  tw.to(0, 1, 0.5, x => samples.push(x), {
    easing: easings.linear,
    repeat: 1,
    yoyo: true,
  });
  for (let i = 0; i < 12; i++) tw.step(0.1);
  near(samples[samples.length - 1], 0, 0.05, 'final');
});

console.log('particles emitter:');
test('emitter produces ~rate*duration particles', () => {
  const p = new Particles();
  p.emit(new Vec2(0, 0), { rate: 60, duration: 0.5, particle: { count: 1, lifetime: 10 } });
  for (let i = 0; i < 50; i++) p.step(0.01);
  if (p.list.length < 25 || p.list.length > 35) {
    throw new Error(`expected ~30 particles, got ${p.list.length}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
