import { Vec2 } from './vec2.js';

function projectPolygon(vertices, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of vertices) {
    const p = v.dot(axis);
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}

export function polygonPolygon(vertsA, centerA, vertsB, centerB) {
  let minOverlap = Infinity;
  let normal = null;

  const test = (axis) => {
    const projA = projectPolygon(vertsA, axis);
    const projB = projectPolygon(vertsB, axis);
    if (projA.max < projB.min || projB.max < projA.min) return false;
    const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      normal = axis;
    }
    return true;
  };

  for (let i = 0; i < vertsA.length; i++) {
    const e = vertsA[(i + 1) % vertsA.length].sub(vertsA[i]);
    const len = Math.hypot(e.x, e.y);
    if (len < 1e-9) continue;
    const axis = new Vec2(-e.y / len, e.x / len);
    if (!test(axis)) return null;
  }
  for (let i = 0; i < vertsB.length; i++) {
    const e = vertsB[(i + 1) % vertsB.length].sub(vertsB[i]);
    const len = Math.hypot(e.x, e.y);
    if (len < 1e-9) continue;
    const axis = new Vec2(-e.y / len, e.x / len);
    if (!test(axis)) return null;
  }

  if (!normal) return null;

  if (centerB.sub(centerA).dot(normal) < 0) {
    normal = normal.scale(-1);
  }

  let contact = vertsB[0];
  let minProj = vertsB[0].dot(normal);
  for (let i = 1; i < vertsB.length; i++) {
    const p = vertsB[i].dot(normal);
    if (p < minProj) {
      minProj = p;
      contact = vertsB[i];
    }
  }

  return { normal, depth: minOverlap, contact: contact.clone() };
}

export function circlePolygon(circleCenter, radius, polyVerts, polyCenter) {
  let minOverlap = Infinity;
  let normal = null;

  const test = (axis) => {
    const projP = projectPolygon(polyVerts, axis);
    const c = circleCenter.dot(axis);
    const projCmin = c - radius;
    const projCmax = c + radius;
    if (projP.max < projCmin || projCmax < projP.min) return false;
    const overlap = Math.min(projP.max, projCmax) - Math.max(projP.min, projCmin);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      normal = axis;
    }
    return true;
  };

  for (let i = 0; i < polyVerts.length; i++) {
    const e = polyVerts[(i + 1) % polyVerts.length].sub(polyVerts[i]);
    const len = Math.hypot(e.x, e.y);
    if (len < 1e-9) continue;
    const axis = new Vec2(-e.y / len, e.x / len);
    if (!test(axis)) return null;
  }

  let closest = polyVerts[0];
  let minDistSq = circleCenter.sub(closest).lengthSq();
  for (let i = 1; i < polyVerts.length; i++) {
    const d = circleCenter.sub(polyVerts[i]).lengthSq();
    if (d < minDistSq) {
      minDistSq = d;
      closest = polyVerts[i];
    }
  }
  const dir = circleCenter.sub(closest);
  const dirLen = dir.length();
  if (dirLen > 1e-9) {
    if (!test(dir.scale(1 / dirLen))) return null;
  }

  if (!normal) return null;

  if (polyCenter.sub(circleCenter).dot(normal) < 0) {
    normal = normal.scale(-1);
  }

  const contact = circleCenter.add(normal.scale(radius));
  return { normal, depth: minOverlap, contact };
}
