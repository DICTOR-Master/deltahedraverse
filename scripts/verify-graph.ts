import { collectSubtree, findParentConnection, hasCycle } from '../app/lib/graph';
import type { Assembly } from '../app/lib/assembly';

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}

function node(id: string) {
  return { id, shape: 'D4', transform: { position: [0, 0, 0] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number] } };
}

// --- hasCycle ---

check('empty assembly has no cycle', !hasCycle({ nodes: [], connections: [] }));

check(
  'single isolated node has no cycle',
  !hasCycle({ nodes: [node('a')], connections: [] }),
);

const tree: Assembly = {
  nodes: [node('root'), node('a'), node('b'), node('c')],
  connections: [
    { nodeA: 'root', vertexA: 0, nodeB: 'a', vertexB: 0 },
    { nodeA: 'root', vertexA: 1, nodeB: 'b', vertexB: 0 },
    { nodeA: 'a', vertexA: 1, nodeB: 'c', vertexB: 0 },
  ],
};
check('a tree (root, 2 children, 1 grandchild) has no cycle', !hasCycle(tree));

const forest: Assembly = {
  nodes: [node('t1'), node('t2'), node('u1'), node('u2')],
  connections: [
    { nodeA: 't1', vertexA: 0, nodeB: 't2', vertexB: 0 },
    { nodeA: 'u1', vertexA: 0, nodeB: 'u2', vertexB: 0 },
  ],
};
check('two disjoint trees (a forest) has no cycle', !hasCycle(forest));

const closedCage: Assembly = {
  nodes: [node('root'), node('a'), node('b')],
  connections: [
    { nodeA: 'root', vertexA: 0, nodeB: 'a', vertexB: 0 },
    { nodeA: 'root', vertexA: 1, nodeB: 'b', vertexB: 0 },
    { nodeA: 'a', vertexA: 1, nodeB: 'b', vertexB: 1 }, // closes the loop root-a-b-root
  ],
};
check('a triangle of connections is detected as a cycle', hasCycle(closedCage));

const selfLoop: Assembly = {
  nodes: [node('a')],
  connections: [{ nodeA: 'a', vertexA: 0, nodeB: 'a', vertexB: 1 }],
};
check('a self-loop is detected as a cycle', hasCycle(selfLoop));

// --- collectSubtree ---

const subtreeFromRoot = collectSubtree(tree.connections, 'root');
check(
  'subtree of root is the whole tree',
  subtreeFromRoot.size === 4 && ['root', 'a', 'b', 'c'].every((id) => subtreeFromRoot.has(id)),
);

const subtreeFromA = collectSubtree(tree.connections, 'a');
check(
  'subtree of "a" is {a, c} — not root or b',
  subtreeFromA.size === 2 && subtreeFromA.has('a') && subtreeFromA.has('c') && !subtreeFromA.has('root') && !subtreeFromA.has('b'),
);

const subtreeFromLeaf = collectSubtree(tree.connections, 'c');
check('subtree of a leaf is just itself', subtreeFromLeaf.size === 1 && subtreeFromLeaf.has('c'));

// --- findParentConnection ---

check('root has no parent connection', findParentConnection(tree.connections, 'root') === undefined);
const parentOfC = findParentConnection(tree.connections, 'c');
check('parent connection of "c" points back to "a"', parentOfC?.nodeA === 'a');

console.log(`\n${failures} failures.`);
if (failures > 0) process.exit(1);
