'use client';

import { POLYHEDRA } from '../../lib/polyhedra';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreview from './ShapePreview';
import ShapeStatsBlock from './ShapeStatsBlock';

export interface CompareScreenProps {
  lang: LangCode;
  ids: string[];
  onRemove: (specId: string) => void;
  onClose: () => void;
}

export default function CompareScreen({ lang, ids, onRemove, onClose }: CompareScreenProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 25, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
        <span style={{ color: '#a9f795', fontSize: 14, fontWeight: 700 }}>
          {t('compare.title', lang)} ({ids.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          {t('action.close', lang)}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: `repeat(${Math.max(ids.length, 1)}, minmax(200px, 1fr))`, gap: 12, padding: 16 }}>
        {ids.map((id) => {
          const spec = POLYHEDRA[id];
          if (!spec) return null;
          return (
            <div key={id} style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.16)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <ShapePreview specId={id} size={140} spin />
              <h3 style={{ margin: 0, color: '#a9f795', fontSize: 13, textAlign: 'center' }}>{spec.name.replaceAll('_', ' ')}</h3>
              <ShapeStatsBlock specId={id} lang={lang} />
              <button
                type="button"
                onClick={() => onRemove(id)}
                style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}
              >
                {t('action.remove', lang)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
