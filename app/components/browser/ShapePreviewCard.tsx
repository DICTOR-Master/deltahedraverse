'use client';

import { getAnySpec } from '../../lib/polyhedra/lookup';
import { FAMILY_META, familiesFor, catalogByFamily, type FamilyKey } from '../../lib/polyhedra/families';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreview from './ShapePreview';

const CARD_PREVIEW_SIZE = 88;

/** Family to show as the card's badge when a shape has more than one --
 * prefer whichever family the user is currently browsing by, otherwise
 * the shape's first (canonical FAMILY_ORDER) family. Star polyhedra
 * belong to no FamilyKey at all (deliberately, see starPolyhedra.ts's own
 * header) -- undefined here means "show no family badge," not a bug. */
function primaryFamilyFor(specId: string, activeFamilies: FamilyKey[]): FamilyKey | undefined {
  const families = familiesFor(specId);
  const hit = families.find((f) => activeFamilies.includes(f));
  return hit ?? families[0];
}

export interface ShapePreviewCardProps {
  specId: string;
  lang: LangCode;
  activeFamilies?: FamilyKey[];
  isFavorite: boolean;
  inCompare: boolean;
  onOpen: (specId: string) => void;
  onToggleFavorite: (specId: string) => void;
  onToggleCompare: (specId: string) => void;
}

export default function ShapePreviewCard({
  specId,
  lang,
  activeFamilies = [],
  isFavorite,
  inCompare,
  onOpen,
  onToggleFavorite,
  onToggleCompare,
}: ShapePreviewCardProps) {
  const spec = getAnySpec(specId);
  if (!spec) return null;
  const families = familiesFor(specId);
  const fam = primaryFamilyFor(specId, activeFamilies);
  const catalogNumber = fam ? catalogByFamily(fam)[specId] : undefined;
  const displayName = spec.name.replaceAll('_', ' ');

  return (
    <div
      style={{
        background: 'var(--ph-surface, #080a06)',
        border: '1px solid var(--ph-line, rgba(71,204,36,.16))',
        borderRadius: 10,
        padding: 10,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}
      onClick={() => onOpen(specId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(specId);
      }}
    >
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 11, color: '#47cc24' }}>
        <span title={families.length > 1 ? t('alsoIn', lang, { list: families.filter((f) => f !== fam).map((f) => FAMILY_META[f].label).join(', ') }) : undefined}>
          {fam ? FAMILY_META[fam].symbol : '★'}
        </span>
        {catalogNumber !== undefined && <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>[{catalogNumber}]</span>}
      </div>
      <ShapePreview specId={specId} size={CARD_PREVIEW_SIZE} />
      <div style={{ fontSize: 11, textAlign: 'center', color: '#a9f795', lineHeight: 1.25 }}>{displayName}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          type="button"
          aria-label={t('action.favorite', lang)}
          aria-pressed={isFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(specId);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: isFavorite ? '#47cc24' : '#3a9e1f',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {isFavorite ? '★' : '☆'}
        </button>
        <button
          type="button"
          aria-label={t('action.compare', lang)}
          aria-pressed={inCompare}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare(specId);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: inCompare ? '#47cc24' : '#3a9e1f',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {inCompare ? '✓' : '+'}
        </button>
      </div>
    </div>
  );
}
