// Verifies the number <-> angle math in src/lib/wheel.ts:
// for every pocket and many reference angles, rotorAngleForNumber followed by
// pocketAtWorldAngle must return the original number.
// Run: node --experimental-strip-types scripts/check-mapping.mjs
import {
  POCKET_SEQUENCE,
  pocketAngleDeg,
  pocketAtWorldAngle,
  rotorAngleForNumber,
} from '../src/lib/wheel.ts'

let failures = 0

for (const n of POCKET_SEQUENCE) {
  for (let k = 0; k < 12; k++) {
    const theta = (k / 12) * Math.PI * 2 + 0.123
    const phi = rotorAngleForNumber(n, theta)
    const got = pocketAtWorldAngle(theta, phi)
    if (got !== n) {
      failures++
      console.error(`FAIL n=${n} theta=${theta.toFixed(3)} -> got ${got}`)
    }
  }
}

// spot-check the spec helper
const expectations = [
  [0, 0],
  [32, 360 / 37],
  [26, 36 * (360 / 37)],
]
for (const [n, deg] of expectations) {
  const got = pocketAngleDeg(n)
  if (Math.abs(got - deg) > 1e-9) {
    failures++
    console.error(`FAIL pocketAngleDeg(${n}) = ${got}, expected ${deg}`)
  }
}

if (failures === 0) {
  console.log(`OK: ${POCKET_SEQUENCE.length * 12} round-trips + pocketAngleDeg spot checks passed`)
} else {
  console.error(`${failures} failures`)
  process.exit(1)
}
