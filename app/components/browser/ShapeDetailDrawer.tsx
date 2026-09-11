'use client';

import { useState } from 'react';
import { getAnySpec, isStarPolyhedron } from '../../lib/polyhedra/lookup';
import { FOURD_CAPABLE_IDS } from '../../lib/polyhedra/fourD';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreview from './ShapePreview';
import ShapeStatsBlock from './ShapeStatsBlock';
import StarShapeViewer from './StarShapeViewer';
import DuoprismShapeViewer from './DuoprismShapeViewer';
import RadialProjectionViewer from './RadialProjectionViewer';

export interface ShapeDetailDrawerProps {
  specId: string;
  lang: LangCode;
  isFavorite: boolean;
  inCompare: boolean;
  onClose: () => void;
  onSelectShape: (specId: string) => void;
  onToggleFavorite: (specId: string) => void;
  onToggleCompare: (specId: string) => void;
}

export default function ShapeDetailDrawer({
  specId,
  lang,
  isFavorite,
  inCompare,
  onClose,
  onSelectShape,
  onToggleFavorite,
  onToggleCompare,
}: ShapeDetailDrawerProps) {
  const spec = getAnySpec(specId);
  // One "View 4D" toggle, not two competing buttons -- simplest possible
  // UX regardless of the underlying math being two genuinely different
  // constructions (radial cell-tiling vs. a duoprism product). Which one
  // renders is decided automatically by the shape, never exposed as a
  // user choice: the 4 FOURD_CAPABLE shapes (D4, CUBE, D8, DODECAHEDRON)
  // get radial projection, since that builds the actual named regular
  // 4-polytope (tesseract/16-cell/24-cell/120-cell) -- duoprism for
  // those same 4 shapes would show a DIFFERENT, less iconic 4-polytope
  // (tetrahedron x interval is not the 16-cell). Every other shape,
  // which has no verified theta and so no radial-projection closure at
  // all, gets duoprism -- the only 4D construction defined for it.
  const [showFourD, setShowFourD] = useState(false);
  if (!spec) return null;
  const displayName = spec.name.replaceAll('_', ' ');
  const isStar = isStarPolyhedron(specId);
  const isFourDCapable = FOURD_CAPABLE_IDS.includes(specId);

  // Real user complaint (2026-09-10): the shared stacked-column layout
  // below crowded the star viewer into a fixed 300px card next to the
  // description/stats/buttons, with no starry background -- nothing like
  // "the same environment Scene creates." Star polyhedra get their own
  // full-screen layout instead: the 3D view fills essentially the whole
  // dialog (matching ShapeViewer's own h-screen real Scene), with stats/
  // the reference-only pill/actions as small corner overlays rather than
  // stacked beneath it. Non-star shapes keep the original layout
  // unchanged below.
  if (isStar) {
    return (
      <div
        style={{ position: 'absolute', inset: 0, background: '#0a0a10', zIndex: 20, display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-label={displayName}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flex: '0 0 auto' }}>
          <h2 style={{ color: '#a9f795', fontSize: 16, margin: 0 }}>{displayName}</h2>
          {/* Favorite/Compare live here, not as a bottom-right canvas
              overlay -- that corner is permanently claimed by the
              always-on CornerHudWheel medallion (renders above this
              dialog), so anything placed there would sit underneath it. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onToggleFavorite(specId)}
              style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: isFavorite ? '#47cc24' : '#5ee233', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
            >
              {isFavorite ? '★' : '☆'} {t('action.favorite', lang)}
            </button>
            <button
              type="button"
              onClick={() => onToggleCompare(specId)}
              style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: inCompare ? '#47cc24' : '#5ee233', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
            >
              {inCompare ? '✓' : '+'} {t('action.compare', lang)}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
            >
              {t('action.close', lang)}
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
          <StarShapeViewer specId={specId} height="100%" />

          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              maxWidth: 300,
              background: 'rgba(10,14,8,.78)',
              border: '1px solid rgba(71,204,36,.25)',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <ShapeStatsBlock specId={specId} lang={lang} />
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              fontSize: 12,
              color: '#5ee233',
              opacity: 0.85,
              background: 'rgba(10,14,8,.78)',
              border: '1px dashed rgba(71,204,36,.3)',
              borderRadius: 999,
              padding: '8px 18px',
            }}
          >
            {t('star.referenceOnly', lang)}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
      role="dialog"
      aria-label={displayName}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          {t('action.close', lang)}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 20px', gap: 14 }}>
        {showFourD ? (
          <div style={{ width: '100%', maxWidth: 380 }}>
            {isFourDCapable ? <RadialProjectionViewer specId={specId} height={260} /> : <DuoprismShapeViewer specId={specId} height={260} />}
          </div>
        ) : (
          <ShapePreview specId={specId} size={220} spin />
        )}
        <h2 style={{ color: '#a9f795', fontSize: 18, textAlign: 'center', margin: 0 }}>{displayName}</h2>

        {showFourD && (
          <div
            style={{
              fontSize: 11,
              color: isFourDCapable ? '#ffd54a' : '#2ad6c9',
              opacity: 0.9,
              background: 'rgba(10,14,8,.78)',
              border: `1px dashed ${isFourDCapable ? 'rgba(255,213,74,.4)' : 'rgba(42,214,201,.4)'}`,
              borderRadius: 999,
              padding: '6px 16px',
              maxWidth: 380,
              textAlign: 'center',
            }}
          >
            {isFourDCapable ? t('radialProjection.referenceOnly', lang) : t('duoprism.referenceOnly', lang)}
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 380 }}>
          <ShapeStatsBlock specId={specId} lang={lang} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => onSelectShape(specId)}
            style={{ background: '#2e8a17', border: 'none', color: '#04140a', borderRadius: 999, padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('action.addToScene', lang)}
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(specId)}
            style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: isFavorite ? '#47cc24' : '#5ee233', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}
          >
            {isFavorite ? '★' : '☆'} {t('action.favorite', lang)}
          </button>
          <button
            type="button"
            onClick={() => onToggleCompare(specId)}
            style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: inCompare ? '#47cc24' : '#5ee233', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}
          >
            {inCompare ? '✓' : '+'} {t('action.compare', lang)}
          </button>
          <button
            type="button"
            onClick={() => setShowFourD((v) => !v)}
            aria-pressed={showFourD}
            style={{
              background: 'none',
              border: `1px solid ${isFourDCapable ? 'rgba(255,213,74,.4)' : 'rgba(42,214,201,.4)'}`,
              color: isFourDCapable ? '#ffd54a' : '#2ad6c9',
              borderRadius: 999,
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            {showFourD ? t('fourD.hideButton', lang) : t('fourD.viewButton', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
