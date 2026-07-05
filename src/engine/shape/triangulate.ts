// Triangulate a shape polygon once at commit → static vertex/index arrays for the obstacle pass.

import earcut from 'earcut';

export interface TriMesh {
  /** Vertices relative to the pivot (so pose is a pure rotation+translation). */
  vertices: Float32Array;
  indices: Uint16Array;
}

export function triangulate(points: Float32Array, pivot: [number, number]): TriMesh | null {
  const coords = Array.from(points);
  const indices = earcut(coords);
  if (indices.length < 3) return null;
  const vertices = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    vertices[i] = points[i] - pivot[0];
    vertices[i + 1] = points[i + 1] - pivot[1];
  }
  return { vertices, indices: new Uint16Array(indices) };
}
