import * as THREE from "three";
import { createDomeCladdingGeometry } from "../app/components/domeCladding";

const radius = 2.48;
const drumHeight = radius * 0.62;
const capArc = radius * (Math.PI / 2);
const surfaceLength = capArc + drumHeight;
const raySamples = 1500;

function sampleSurface(surfaceDistance: number, phi: number) {
  if (surfaceDistance <= capArc) {
    const theta = surfaceDistance / radius;
    const normal = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    );
    return {
      position: normal.clone().multiplyScalar(radius),
      normal,
    };
  }

  return {
    position: new THREE.Vector3(
      radius * Math.cos(phi),
      -(surfaceDistance - capArc),
      radius * Math.sin(phi),
    ),
    normal: new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)),
  };
}

for (const compact of [false, true]) {
  const tier = compact ? "compact" : "desktop";
  const { geometry, topology } = createDomeCladdingGeometry({
    radius,
    drumHeight,
    springY: 0,
    compact,
  });

  const failures = [
    topology.invalidEdges !== 0 &&
      `${topology.invalidEdges} non-manifold edges`,
    topology.maxEdgeOwners > 2 &&
      `an edge has ${topology.maxEdgeOwners} owners`,
    topology.unexpectedBoundaryEdges !== 0 &&
      `${topology.unexpectedBoundaryEdges} unexpected open edges`,
    topology.zeroAreaTriangles !== 0 &&
      `${topology.zeroAreaTriangles} zero-area triangles`,
  ].filter(Boolean);

  const auditMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
  });
  const auditMesh = new THREE.Mesh(geometry, auditMaterial);
  const raycaster = new THREE.Raycaster();
  let missedRays = 0;
  let overlappingRays = 0;

  for (let index = 0; index < raySamples; index += 1) {
    const surfaceDistance =
      0.06 +
      ((index * 0.61803398875) % 1) * (surfaceLength - 0.12);
    const phi = (index * 2.399963229728653) % (Math.PI * 2);
    const { position, normal } = sampleSurface(surfaceDistance, phi);
    raycaster.set(
      position.clone().addScaledVector(normal, -0.08),
      normal,
    );
    const distances: number[] = [];

    raycaster.intersectObject(auditMesh, false).forEach(({ distance }) => {
      if (
        !distances.some(
          (existingDistance) =>
            Math.abs(existingDistance - distance) < 1e-5,
        )
      ) {
        distances.push(distance);
      }
    });

    if (distances.length === 0) missedRays += 1;
    if (distances.length > 1) overlappingRays += 1;
  }

  if (missedRays > 0) failures.push(`${missedRays} raycast gaps`);
  if (overlappingRays > 0) {
    failures.push(`${overlappingRays} raycast overlaps`);
  }

  if (failures.length > 0) {
    auditMaterial.dispose();
    geometry.dispose();
    throw new Error(`${tier} cladding: ${failures.join(", ")}`);
  }

  console.log(`${tier} cladding`, {
    ...topology,
    raySamples,
    missedRays,
    overlappingRays,
  });
  auditMaterial.dispose();
  geometry.dispose();
}
