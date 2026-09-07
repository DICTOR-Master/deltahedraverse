import * as THREE from 'three';
import { DELTAHEDRA, DELTAHEDRON_IDS, type DeltahedronSpec } from '../app/lib/deltahedra';

// Mirrors ShapeViewer.tsx's attach() math (root parent, identity transform)
// so the exact placement formula gets checked outside the browser.
function computeAttach(rootSpec: DeltahedronSpec, targetVertexIndex: number, incomingSpec: DeltahedronSpec) {
  const targetLocal = new THREE.Vector3(...rootSpec.vertices[targetVertexIndex]);
  const targetWorldNormal = targetLocal.clone().normalize(); // root is untransformed, so local == world

  const attachVertex = incomingSpec.vertices[0];
  const attachLocalDir = new THREE.Vector3(...attachVertex).normalize();

  const desiredWorldDir = targetWorldNormal.clone().negate();
  const quat = new THREE.Quaternion().setFromUnitVectors(attachLocalDir, desiredWorldDir);

  const rotatedAttachVertex = new THREE.Vector3(...attachVertex).applyQuaternion(quat);
  const position = targetLocal.clone().sub(rotatedAttachVertex);

  return { position, quat, targetWorldPos: targetLocal, targetWorldNormal };
}

let failures = 0;
let checks = 0;

for (const rootId of DELTAHEDRON_IDS) {
  const rootSpec = DELTAHEDRA[rootId];
  for (const incomingId of DELTAHEDRON_IDS) {
    const incomingSpec = DELTAHEDRA[incomingId];
    for (let v = 0; v < rootSpec.vertices.length; v++) {
      checks++;
      const { position, quat, targetWorldPos } = computeAttach(rootSpec, v, incomingSpec);

      // 1. The incoming shape's own attach vertex, once placed, must land
      //    exactly on the target vertex's world position.
      const attachVertexWorld = new THREE.Vector3(...incomingSpec.vertices[0])
        .applyQuaternion(quat)
        .add(position);
      const coincidence = attachVertexWorld.distanceTo(targetWorldPos);
      if (coincidence > 1e-9) {
        failures++;
        console.log(
          `${rootId}[v${v}] + ${incomingId}: coincidence error ${coincidence.toExponential(3)}`,
        );
      }

      // 2. The incoming shape's centroid must sit farther from the root's
      //    centroid than the shared point, along the connection axis — i.e.
      //    it grows outward, not back into the root.
      const axis = targetWorldPos.clone().normalize();
      const rootDepth = targetWorldPos.dot(axis); // == |targetWorldPos|
      const incomingCentroidDepth = position.dot(axis);
      if (incomingCentroidDepth <= rootDepth + 1e-9) {
        failures++;
        console.log(
          `${rootId}[v${v}] + ${incomingId}: incoming centroid (${incomingCentroidDepth.toFixed(4)}) ` +
            `not beyond shared point (${rootDepth.toFixed(4)}) along connection axis`,
        );
      }
    }
  }
}

console.log(`${checks} attach placements checked, ${failures} failed.`);
if (failures > 0) process.exit(1);
