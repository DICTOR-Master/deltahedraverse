'use client';

/**
 * Phase 1: placeholder only. A real Scene tab backed by the live assembly
 * graph (node list, open-vertex counts) needs a small new
 * ShapeViewerHandle callback (onAssemblyChange) -- deferred to Phase 2 per
 * the implementation plan, since none of the browser's hard requirements
 * depend on it and it touches ShapeViewer's live 3D state.
 */

import { t, type LangCode } from '../../lib/i18n';
import type { AssemblySummary } from './types';

export interface SceneScreenProps {
  lang: LangCode;
  assemblySummary?: AssemblySummary;
}

export default function SceneScreen({ lang, assemblySummary }: SceneScreenProps) {
  if (!assemblySummary || assemblySummary.nodes.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ color: '#3a9e1f', fontSize: 12, textAlign: 'center' }}>{t('scene.emptyBody', lang)}</div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 18, color: '#a9f795', fontSize: 12 }}>
      {assemblySummary.nodes.map((n) => (
        <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(71,204,36,.12)' }}>
          {n.specId} — {n.openVertexCount} open vertices
        </div>
      ))}
    </div>
  );
}
