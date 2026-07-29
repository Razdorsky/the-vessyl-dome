import * as THREE from "three";

type ParamPoint = {
  u: number;
  s: number;
};

type SurfaceFrame = {
  position: THREE.Vector3;
  normal: THREE.Vector3;
};

type TileCell = {
  points: ParamPoint[];
  seed: number;
};

export type DomeCladdingTopology = {
  tiles: number;
  triangles: number;
  vertices: number;
  interiorEdges: number;
  boundaryEdges: number;
  invalidEdges: number;
  maxEdgeOwners: number;
  unexpectedBoundaryEdges: number;
  zeroAreaTriangles: number;
};

type DomeCladdingOptions = {
  radius: number;
  drumHeight: number;
  springY: number;
  compact: boolean;
};

const TAU = Math.PI * 2;
const PARAM_EPSILON = 1e-8;
const EDGE_KEY_PRECISION = 1e7;
const TILE_ANGLE = Math.PI / 4;
const TILE_AXIS_U = Math.cos(TILE_ANGLE);
const TILE_AXIS_S = Math.sin(TILE_ANGLE);
const SHINGLE_GRAPHITE = new THREE.Color("#30363a");
const SHINGLE_PATINA = new THREE.Color("#76513f");
const SHINGLE_WARMTH = new THREE.Color("#d57e3d");
const SHINGLE_HIGHLIGHT = new THREE.Color("#f5c6a3");
const SHINGLE_JOINT = new THREE.Color("#17191a");

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function seededNoise(value: number) {
  return Math.sin(value * 12.9898) * 43758.5453 % 1;
}

function toSurfaceCoordinates(p: number, q: number): ParamPoint {
  return {
    u: p * TILE_AXIS_U - q * TILE_AXIS_S,
    s: p * TILE_AXIS_S + q * TILE_AXIS_U,
  };
}

function toTileCoordinates(point: ParamPoint) {
  return {
    p: point.u * TILE_AXIS_U + point.s * TILE_AXIS_S,
    q: -point.u * TILE_AXIS_S + point.s * TILE_AXIS_U,
  };
}

function removeAdjacentDuplicates(points: ParamPoint[]) {
  const result: ParamPoint[] = [];

  points.forEach((point) => {
    const previous = result[result.length - 1];
    if (
      previous &&
      Math.abs(previous.u - point.u) <= PARAM_EPSILON &&
      Math.abs(previous.s - point.s) <= PARAM_EPSILON
    ) {
      return;
    }
    result.push(point);
  });

  if (result.length > 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if (
      Math.abs(first.u - last.u) <= PARAM_EPSILON &&
      Math.abs(first.s - last.s) <= PARAM_EPSILON
    ) {
      result.pop();
    }
  }

  return result;
}

function collapseApexBoundary(points: ParamPoint[]) {
  const collapsed: ParamPoint[] = [];

  points.forEach((point) => {
    const previous = collapsed[collapsed.length - 1];
    if (
      previous &&
      previous.s <= PARAM_EPSILON &&
      point.s <= PARAM_EPSILON
    ) {
      return;
    }
    collapsed.push(point);
  });

  if (
    collapsed.length > 2 &&
    collapsed[0].s <= PARAM_EPSILON &&
    collapsed[collapsed.length - 1].s <= PARAM_EPSILON
  ) {
    collapsed.pop();
  }

  return collapsed;
}

function clipAtSurfaceDistance(
  points: ParamPoint[],
  boundary: number,
  keepGreater: boolean,
) {
  if (points.length === 0) return points;

  const clipped: ParamPoint[] = [];
  let previous = points[points.length - 1];
  let previousInside = keepGreater
    ? previous.s >= boundary - PARAM_EPSILON
    : previous.s <= boundary + PARAM_EPSILON;

  points.forEach((current) => {
    const currentInside = keepGreater
      ? current.s >= boundary - PARAM_EPSILON
      : current.s <= boundary + PARAM_EPSILON;

    if (currentInside !== previousInside) {
      const denominator = current.s - previous.s;
      const amount =
        Math.abs(denominator) <= PARAM_EPSILON
          ? 0
          : (boundary - previous.s) / denominator;
      clipped.push({
        u: THREE.MathUtils.lerp(previous.u, current.u, amount),
        s: boundary,
      });
    }

    if (currentInside) {
      clipped.push({
        u: current.u,
        s:
          Math.abs(current.s - boundary) <= PARAM_EPSILON
            ? boundary
            : current.s,
      });
    }

    previous = current;
    previousInside = currentInside;
  });

  return removeAdjacentDuplicates(clipped);
}

function clipToDomeSurface(
  points: ParamPoint[],
  minimumSurfaceDistance: number,
  surfaceLength: number,
) {
  return clipAtSurfaceDistance(
    clipAtSurfaceDistance(points, minimumSurfaceDistance, true),
    surfaceLength,
    false,
  );
}

function signedArea(points: ParamPoint[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.u * next.s - next.u * current.s;
  }
  return area * 0.5;
}

function polygonCentroid(points: ParamPoint[]) {
  let areaFactor = 0;
  let centroidU = 0;
  let centroidS = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.u * next.s - next.u * current.s;
    areaFactor += cross;
    centroidU += (current.u + next.u) * cross;
    centroidS += (current.s + next.s) * cross;
  }

  if (Math.abs(areaFactor) <= PARAM_EPSILON) {
    const average = points.reduce(
      (sum, point) => {
        sum.u += point.u;
        sum.s += point.s;
        return sum;
      },
      { u: 0, s: 0 },
    );
    return {
      u: average.u / points.length,
      s: average.s / points.length,
    };
  }

  const divisor = areaFactor * 3;
  return {
    u: centroidU / divisor,
    s: centroidS / divisor,
  };
}

function sampleDomeSurface(
  point: ParamPoint,
  radius: number,
  springY: number,
  capArc: number,
  target: SurfaceFrame,
) {
  const phi = point.u / radius;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  if (point.s <= capArc + PARAM_EPSILON) {
    const theta = Math.min(Math.PI / 2, Math.max(0, point.s / radius));
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    target.position.set(
      radius * sinTheta * cosPhi,
      springY + radius * cosTheta,
      radius * sinTheta * sinPhi,
    );
    target.normal.set(
      sinTheta * cosPhi,
      cosTheta,
      sinTheta * sinPhi,
    );
    return target;
  }

  target.position.set(
    radius * cosPhi,
    springY - (point.s - capArc),
    radius * sinPhi,
  );
  target.normal.set(cosPhi, 0, sinPhi);
  return target;
}

function canonicalPointKey(
  point: ParamPoint,
  circumference: number,
  surfaceLength: number,
) {
  if (point.s <= PARAM_EPSILON) return "apex";

  let normalizedU = modulo(point.u, circumference);
  if (
    normalizedU <= PARAM_EPSILON ||
    circumference - normalizedU <= PARAM_EPSILON
  ) {
    normalizedU = 0;
  }

  const normalizedS =
    Math.abs(point.s - surfaceLength) <= PARAM_EPSILON
      ? surfaceLength
      : point.s;
  return `${Math.round(normalizedU * EDGE_KEY_PRECISION)}:${Math.round(
    normalizedS * EDGE_KEY_PRECISION,
  )}`;
}

function makeEdgeKey(from: string, to: string) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function createRunningBondCells(
  radius: number,
  surfaceLength: number,
  compact: boolean,
) {
  const circumference = TAU * radius;
  const crownDepth = compact ? 0.16 : 0.115;

  // The two integer periods make the 45° running-bond lattice close
  // perfectly after one trip around the dome. Their ratio gives the
  // 1.25–1.28:1 plate proportion visible in the real cladding.
  const circumferentialPeriod = compact ? 32 : 44;
  const coursePeriod = compact ? 40 : 56;
  const tileWidth =
    circumference / (Math.SQRT2 * circumferentialPeriod);
  const tileHeight = circumference / (Math.SQRT2 * coursePeriod);
  const tileExtent = Math.hypot(tileWidth, tileHeight);
  const expandedCorners = [
    { u: 0, s: crownDepth - tileExtent },
    { u: circumference, s: crownDepth - tileExtent },
    { u: circumference, s: surfaceLength + tileExtent },
    { u: 0, s: surfaceLength + tileExtent },
  ].map(toTileCoordinates);
  const pValues = expandedCorners.map(({ p }) => p);
  const qValues = expandedCorners.map(({ q }) => q);
  const pMin = Math.min(...pValues);
  const pMax = Math.max(...pValues);
  const qMin = Math.min(...qValues);
  const qMax = Math.max(...qValues);
  const rowStart = Math.floor(qMin / tileHeight) - 2;
  const rowEnd = Math.ceil(qMax / tileHeight) + 2;
  const cells: TileCell[] = [];

  for (let row = rowStart; row <= rowEnd; row += 1) {
    const rowOffset = modulo(row, 2) === 0 ? 0 : 0.5;
    const columnStart = Math.floor(pMin / tileWidth - rowOffset) - 2;
    const columnEnd = Math.ceil(pMax / tileWidth - rowOffset) + 2;
    const q0 = row * tileHeight;
    const q1 = q0 + tileHeight;

    for (
      let column = columnStart;
      column <= columnEnd;
      column += 1
    ) {
      const p0 = (column + rowOffset) * tileWidth;
      const p1 = p0 + tileWidth;
      const pMid = (p0 + p1) * 0.5;
      const center = toSurfaceCoordinates(pMid, (q0 + q1) * 0.5);

      // One canonical cell from each periodic equivalence class. Cells that
      // cross u=0 remain whole and wrap analytically around the back seam.
      if (
        center.u < -PARAM_EPSILON ||
        center.u >= circumference - PARAM_EPSILON
      ) {
        continue;
      }

      const uncut = [
        toSurfaceCoordinates(p0, q0),
        toSurfaceCoordinates(pMid, q0),
        toSurfaceCoordinates(p1, q0),
        toSurfaceCoordinates(p1, q1),
        toSurfaceCoordinates(pMid, q1),
        toSurfaceCoordinates(p0, q1),
      ];
      const minS = Math.min(...uncut.map(({ s }) => s));
      const maxS = Math.max(...uncut.map(({ s }) => s));
      if (
        maxS < crownDepth - PARAM_EPSILON ||
        minS > surfaceLength + PARAM_EPSILON
      ) {
        continue;
      }

      const points = clipToDomeSurface(
        uncut,
        crownDepth,
        surfaceLength,
      );
      if (
        points.length < 3 ||
        Math.abs(signedArea(points)) <= PARAM_EPSILON
      ) {
        continue;
      }

      cells.push({
        points,
        seed: column * 0.713 + row * 2.117,
      });
    }
  }

  const crownPointMap = new Map<number, ParamPoint>();
  cells.forEach(({ points }) => {
    points.forEach((point) => {
      if (Math.abs(point.s - crownDepth) > PARAM_EPSILON) return;
      let normalizedU = modulo(point.u, circumference);
      if (
        normalizedU <= PARAM_EPSILON ||
        circumference - normalizedU <= PARAM_EPSILON
      ) {
        normalizedU = 0;
      }
      const key = Math.round(normalizedU * EDGE_KEY_PRECISION);
      crownPointMap.set(key, { u: normalizedU, s: crownDepth });
    });
  });

  const crownRing = [...crownPointMap.values()].sort(
    (left, right) => left.u - right.u,
  );
  const crownCells: TileCell[] = [];

  for (let index = 0; index < crownRing.length; index += 1) {
    const from = crownRing[index];
    const rawTo = crownRing[(index + 1) % crownRing.length];
    const to = {
      u: index === crownRing.length - 1
        ? rawTo.u + circumference
        : rawTo.u,
      s: crownDepth,
    };
    crownCells.push({
      points: [
        { u: (from.u + to.u) * 0.5, s: 0 },
        to,
        from,
      ],
      seed: 9000 + index * 0.917,
    });
  }

  return {
    cells: [...crownCells, ...cells],
    circumference,
  };
}

export function createDomeCladdingGeometry({
  radius,
  drumHeight,
  springY,
  compact,
}: DomeCladdingOptions) {
  const capArc = radius * (Math.PI / 2);
  const surfaceLength = capArc + drumHeight;
  const { cells, circumference } = createRunningBondCells(
    radius,
    surfaceLength,
    compact,
  );
  const baseOffset = compact ? 0.019 : 0.017;
  const reliefHeight = compact ? 0.014 : 0.012;
  const innerScale = 0.92;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const outerVertices = new Map<string, number>();
  const edgeOwners = new Map<
    string,
    { count: number; from: ParamPoint; to: ParamPoint }
  >();
  const surfaceFrame: SurfaceFrame = {
    position: new THREE.Vector3(),
    normal: new THREE.Vector3(),
  };
  const centerFrame: SurfaceFrame = {
    position: new THREE.Vector3(),
    normal: new THREE.Vector3(),
  };
  const centerBase = new THREE.Vector3();
  const centerTop = new THREE.Vector3();
  const delta = new THREE.Vector3();

  const addVertex = (position: THREE.Vector3, color: THREE.Color) => {
    const index = positions.length / 3;
    positions.push(position.x, position.y, position.z);
    colors.push(color.r, color.g, color.b);
    return index;
  };

  const getOuterVertex = (point: ParamPoint) => {
    const key = canonicalPointKey(point, circumference, surfaceLength);
    const existing = outerVertices.get(key);
    if (existing !== undefined) return existing;

    sampleDomeSurface(
      point,
      radius,
      springY,
      capArc,
      surfaceFrame,
    );
    surfaceFrame.position.addScaledVector(
      surfaceFrame.normal,
      baseOffset,
    );
    const index = addVertex(surfaceFrame.position, SHINGLE_JOINT);
    outerVertices.set(key, index);
    return index;
  };

  cells.forEach(({ points: unclapsedPoints, seed }) => {
    const points = collapseApexBoundary(unclapsedPoints);
    const pointKeys = points.map((point) =>
      canonicalPointKey(point, circumference, surfaceLength),
    );

    for (let index = 0; index < points.length; index += 1) {
      const next = (index + 1) % points.length;
      if (pointKeys[index] === pointKeys[next]) continue;
      const edgeKey = makeEdgeKey(pointKeys[index], pointKeys[next]);
      const edge = edgeOwners.get(edgeKey);
      if (edge) {
        edge.count += 1;
      } else {
        edgeOwners.set(edgeKey, {
          count: 1,
          from: points[index],
          to: points[next],
        });
      }
    }

    const noise = Math.abs(seededNoise(seed));
    const centroid = polygonCentroid(unclapsedPoints);
    const height = THREE.MathUtils.clamp(
      centroid.s / surfaceLength,
      0,
      1,
    );
    const tileColor = SHINGLE_GRAPHITE.clone()
      .lerp(SHINGLE_PATINA, 0.25 + noise * 0.28)
      .lerp(SHINGLE_WARMTH, height * 0.08 + noise * 0.04)
      .lerp(SHINGLE_HIGHLIGHT, noise > 0.88 ? 0.05 : 0);

    sampleDomeSurface(
      centroid,
      radius,
      springY,
      capArc,
      centerFrame,
    );
    centerBase
      .copy(centerFrame.position)
      .addScaledVector(centerFrame.normal, baseOffset);
    centerTop
      .copy(centerFrame.position)
      .addScaledVector(
        centerFrame.normal,
        baseOffset + reliefHeight,
      );

    const outerIndices = points.map(getOuterVertex);
    const innerIndices = outerIndices.map((outerIndex) => {
      const offset = outerIndex * 3;
      delta.set(
        positions[offset] - centerBase.x,
        positions[offset + 1] - centerBase.y,
        positions[offset + 2] - centerBase.z,
      );
      delta.addScaledVector(
        centerFrame.normal,
        -delta.dot(centerFrame.normal),
      );
      delta.multiplyScalar(innerScale);
      return addVertex(
        delta.add(centerTop),
        tileColor,
      );
    });
    const centerIndex = addVertex(centerTop, tileColor);

    for (let index = 0; index < points.length; index += 1) {
      const next = (index + 1) % points.length;
      indices.push(
        outerIndices[index],
        outerIndices[next],
        innerIndices[next],
        outerIndices[index],
        innerIndices[next],
        innerIndices[index],
        innerIndices[index],
        innerIndices[next],
        centerIndex,
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  let interiorEdges = 0;
  let boundaryEdges = 0;
  let invalidEdges = 0;
  let maxEdgeOwners = 0;
  let unexpectedBoundaryEdges = 0;

  edgeOwners.forEach(({ count, from, to }) => {
    maxEdgeOwners = Math.max(maxEdgeOwners, count);
    if (count === 2) {
      interiorEdges += 1;
      return;
    }

    if (count === 1) {
      boundaryEdges += 1;
      const onBase =
        Math.abs(from.s - surfaceLength) <= PARAM_EPSILON &&
        Math.abs(to.s - surfaceLength) <= PARAM_EPSILON;
      if (!onBase) unexpectedBoundaryEdges += 1;
      return;
    }

    invalidEdges += 1;
  });

  let zeroAreaTriangles = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index] * 3;
    const b = indices[index + 1] * 3;
    const c = indices[index + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    if (
      crossX * crossX + crossY * crossY + crossZ * crossZ <= 1e-16
    ) {
      zeroAreaTriangles += 1;
    }
  }

  const topology: DomeCladdingTopology = {
    tiles: cells.length,
    triangles: indices.length / 3,
    vertices: positions.length / 3,
    interiorEdges,
    boundaryEdges,
    invalidEdges,
    maxEdgeOwners,
    unexpectedBoundaryEdges,
    zeroAreaTriangles,
  };

  return { geometry, topology };
}
