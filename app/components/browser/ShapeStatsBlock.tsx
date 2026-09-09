'use client';

import { getAnySpec, isStarPolyhedron } from '../../lib/polyhedra/lookup';
import { FAMILY_META, familiesFor, catalogByFamily } from '../../lib/polyhedra/families';
import { STAR_POLYHEDRON_META } from '../../lib/polyhedra/starPolyhedra';
import { t, type LangCode } from '../../lib/i18n';

/** Stats + face-shape chips + full family-membership list, shared by the
 * detail drawer and Compare (factored out so both stay in sync). Star
 * polyhedra (see starPolyhedra.ts) belong to no FamilyKey, so the family-
 * membership line is empty for them -- they get their own Schläfli/
 * density row instead, the real star-specific fact the other 7 families
 * don't have (not decoration -- see docs/star-polyhedra-spec.md's own
 * Stage 3). */
export default function ShapeStatsBlock({ specId, lang }: { specId: string; lang: LangCode }) {
  const spec = getAnySpec(specId);
  if (!spec) return null;
  const families = familiesFor(specId);
  const degrees = spec.connectors.map((c) => c.degree);
  const minDeg = Math.min(...degrees);
  const maxDeg = Math.max(...degrees);
  const faceSizes = [...new Set(spec.faces.map((f) => f.length))].sort((a, b) => a - b);
  const star = isStarPolyhedron(specId) ? STAR_POLYHEDRON_META[specId] : undefined;

  return (
    <div>
      {families.length > 0 && (
        <div style={{ fontSize: 12, color: '#5ee233', marginBottom: 10 }}>
          {families
            .map((f) => `${FAMILY_META[f].symbol} ${FAMILY_META[f].label} [${catalogByFamily(f)[specId]}]`)
            .join('  +  ')}
        </div>
      )}
      {star && (
        <div style={{ fontSize: 12, color: '#5ee233', marginBottom: 10 }}>
          ★ Kepler-Poinsot star polyhedron — Schläfli {star.schlafli}, density {star.density}
        </div>
      )}
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
