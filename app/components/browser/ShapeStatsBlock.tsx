'use client';

import { POLYHEDRA } from '../../lib/polyhedra';
import { FAMILY_META, familiesFor, catalogByFamily } from '../../lib/polyhedra/families';
import { t, type LangCode } from '../../lib/i18n';

/** Stats + face-shape chips + full family-membership list, shared by the
 * detail drawer and Compare (factored out so both stay in sync). */
export default function ShapeStatsBlock({ specId, lang }: { specId: string; lang: LangCode }) {
  const spec = POLYHEDRA[specId];
  if (!spec) return null;
  const families = familiesFor(specId);
  const degrees = spec.connectors.map((c) => c.degree);
  const minDeg = Math.min(...degrees);
  const maxDeg = Math.max(...degrees);
  const faceSizes = [...new Set(spec.faces.map((f) => f.length))].sort((a, b) => a - b);

  return (
    <div>
      <div style={{ fontSize: 12, color: '#5ee233', marginBottom: 10 }}>
        {families
          .map((f) => `${FAMILY_META[f].symbol} ${FAMILY_META[f].label} [${catalogByFamily(f)[specId]}]`)
          .join('  +  ')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
        <Stat label={t('stat.vertices', lang)} value={spec.vertices.length} />
        <Stat label={t('stat.edges', lang)} value={spec.edges.length} />
        <Stat label={t('stat.faces', lang)} value={spec.faceCount} />
        <Stat label={t('stat.connectors', lang)} value={minDeg === maxDeg ? String(minDeg) : `${minDeg}–${maxDeg}`} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {faceSizes.map((n) => (
          <span
            key={n}
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid rgba(71,204,36,.3)',
              color: '#5ee233',
            }}
          >
            {n}-gon
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.16)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#a9f795' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#3a9e1f', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
}
