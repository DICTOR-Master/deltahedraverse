'use client';

import { POLYHEDRA } from '../../lib/polyhedra';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreview from './ShapePreview';
import ShapeStatsBlock from './ShapeStatsBlock';

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
  const spec = POLYHEDRA[specId];
  if (!spec) return null;
  const displayName = spec.name.replaceAll('_', ' ');

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
        <ShapePreview specId={specId} size={220} spin />
        <h2 style={{ color: '#a9f795', fontSize: 18, textAlign: 'center', margin: 0 }}>{displayName}</h2>

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
        </div>
      </div>
    </div>
  );
}
