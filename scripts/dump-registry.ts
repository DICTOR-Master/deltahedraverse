import {
  POLYHEDRA,
  DELTAHEDRON_IDS,
  PLATONIC_ADDITION_IDS,
  ARCHIMEDEAN_ADDITION_IDS,
  JOHNSON_ADDITION_IDS,
  CATALAN_ADDITION_IDS,
  PRISM_ANTIPRISM_ADDITION_IDS,
} from '../app/lib/polyhedra';

const familyOf: Record<string, string> = {};
DELTAHEDRON_IDS.forEach((id) => (familyOf[id] = 'DELTAHEDRA'));
PLATONIC_ADDITION_IDS.forEach((id) => (familyOf[id] = 'PLATONIC'));
ARCHIMEDEAN_ADDITION_IDS.forEach((id) => (familyOf[id] = 'ARCHIMEDEAN'));
JOHNSON_ADDITION_IDS.forEach((id) => (familyOf[id] = 'JOHNSON'));
CATALAN_ADDITION_IDS.forEach((id) => (familyOf[id] = 'CATALAN'));
PRISM_ANTIPRISM_ADDITION_IDS.forEach((id) => (familyOf[id] = 'PRISMS'));

const out = Object.entries(POLYHEDRA).map(([id, spec]) => {
  const faceSizes = spec.faces.map((f) => f.length);
  const distinctSizes = [...new Set(faceSizes)].sort((a, b) => a - b);
  return {
    id,
    name: spec.name,
    family: familyOf[id] || 'UNKNOWN',
    faceCount: spec.faceCount,
    vertexCount: spec.vertices.length,
    edgeCount: spec.edges.length,
    faceShapes: distinctSizes, // e.g. [3] triangle-only, [3,4] tri+square, etc.
    maxDegree: Math.max(...spec.connectors.map((c) => c.degree)),
    minDegree: Math.min(...spec.connectors.map((c) => c.degree)),
  };
});

console.log(JSON.stringify(out));
