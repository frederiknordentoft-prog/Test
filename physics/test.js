import { Engine, Body, Vec2 } from './index.js';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
