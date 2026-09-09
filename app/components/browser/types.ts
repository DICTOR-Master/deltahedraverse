/**
 * Shared types for the ShapeBrowser component tree. AssemblySummary is a
 * Phase 2 concern (real Scene-tab data via a future ShapeViewerHandle
 * .onAssemblyChange callback) -- declared now so SceneScreen's prop shape
 * is settled and doesn't need to change when Phase 2 lands.
 */

export interface AssemblySummaryNode {
  id: string;
  specId: string;
  openVertexCount: number;
  openFaceCount: number;
}

export interface AssemblySummary {
  nodes: AssemblySummaryNode[];
  connectionCount: number;
}
