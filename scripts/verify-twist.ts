import * as THREE from 'three';
import { DELTAHEDRA, DELTAHEDRON_IDS, type DeltahedronSpec } from '../app/lib/deltahedra';

// Mirrors ShapeViewer.tsx's beginAttach() + the twist update in onPointerMove
// (root parent, identity transform) to check that dragging the twist angle
// never moves the shared point, for a sample of shape pairs and angles.
function computeBase(rootSpec: DeltahedronSpec, targetVertexIndex: number, incomingSpec: DeltahedronSpec) {
  const targetWorldPos = new THREE.Vector3(...rootSpec.vertices[targetVertexIndex]);
  const targetWorldNormal = targetWorldPos.clone().normalize();

  const attachVertex = incomingSpec.vertices[0];
  const attachLocalDir = new THREE.Vector3(...attachVertex).normalize();

  const desiredWorldDir = targetWorldNormal.clone().negate();
  const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(attachLocalDir, desiredWorldDir);

  const rotatedAttachVertex = new THREE.Vector3(...attachVertex).applyQuaternion(baseQuaternion);
  const position = targetWorldPos.clone().sub(rotatedAttachVertex);

  return { position, baseQuaternion, attachLocalDir, attachVertex, targetWorldPos };
}

const TEST_ANGLES_DEG = [0, 30, 45, 90, 137, 180, 222, 270, 359];

let checks = 0;
let failures = 0;

for (const rootId of DELTAHEDRON_IDS) {
  const rootSpec = DELTAHEDRA[rootId];
  for (const incomingId of DELTAHEDRON_IDS) {
    const incomingSpec = DELTAHEDRA[incomingId];
    // Sample every root vertex but not exhaustively every angle x every
    // vertex (that's 8*8*20*9 ~ 11k, unnecessary) — full angle sweep on
    // vertex 0 and vertex-count-1 is enough to catch any axis-dependent bug.
    for (const v of [0, rootSpec.vertices.length - 1]) {
      const { position, baseQuaternion, attachLocalDir, attachVertex, targetWorldPos } = computeBase(
        rootSpec,
        v,
        incomingSpec,
      );

      for (const deg of TEST_ANGLES_DEG) {
        checks++;
        const twistQuat = new THREE.Quaternion().setFromAxisAngle(attachLocalDir, THREE.MathUtils.degToRad(deg));
        const finalQuat = baseQuaternion.clone().multiply(twistQuat);

        const attachVertexWorld = new THREE.Vector3(...attachVertex).applyQuaternion(finalQuat).add(position);
        const error = attachVertexWorld.distanceTo(targetWorldPos);
        if (error > 1e-9) {
          failures++;
          console.log(
            `${rootId}[v${v}] + ${incomingId} @ ${deg}°: shared point moved by ${error.toExponential(3)}`,
          );
        }
      }
    }
  }
}

console.log(`${checks} twist angles checked, ${failures} failed.`);
if (failures > 0) process.exit(1);
