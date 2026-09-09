'use client';

/**
 * Full Catalog -- a single scrollable page showing every shape in the
 * registry, grouped into real family SECTIONS (not the wheel's one-
 * face-at-a-time pagination). Real user feedback: selecting "Full
 * Catalog" from the wheel used to just page through all 137 shapes one
 * wheel-face at a time ("not just go round the wheel itself almost
 * anonymously") -- this is the actual "full page of all images in
 * sections" that was expected instead. The wheel's Full Catalog face
 * now triggers this screen directly (see PolyhedralWheel's onSelectAll)
 * rather than drilling into its own pagination.
 *
 * A shape belonging to more than one family (e.g. D4: Deltahedra AND
 * Platonic) legitimately appears in more than one section here -- same
 * "intended, not a bug to dedupe" convention every other family view in
 * this app already follows.
 */

import { FAMILY_ORDER, FAMILY_META, familyIds } from '../../lib/polyhedra/families';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreviewCard from './ShapePreviewCard';

export interface FullCatalogScreenProps {
  lang: LangCode;
  /** Mirrors every other screen's filterIds -- incompatible shapes are
   *  left out of each section entirely, same convention SearchScreen
   *  already uses (rather than the wheel's own newer "show but dim"
   *  convention), so a family with zero compatible members here just
   *  shows an empty section rather than a jarring dimmed grid. */
  filterIds?: string[];
  isFavorite: (specId: string) => boolean;
  isInCompare: (specId: string) => boolean;
  onOpenShape: (specId: string) => void;
  onToggleFavorite: (specId: string) => void;
  onToggleCompare: (specId: string) => void;
}

export default function FullCatalogScreen({
  lang,
  filterIds,
  isFavorite,
  isInCompare,
  onOpenShape,
  onToggleFavorite,
  onToggleCompare,
}: FullCatalogScreenProps) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {FAMILY_ORDER.map((fam) => {
        const meta = FAMILY_META[fam];
        const ids = filterIds ? familyIds(fam).filter((id) => filterIds.includes(id)) : familyIds(fam);
        if (ids.length === 0) return null;
        return (
          <div key={fam}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18, color: '#47cc24' }}>{meta.symbol}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#a9f795', letterSpacing: '.02em' }}>{meta.label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#3a9e1f' }}>{ids.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {ids.map((id) => (
                <ShapePreviewCard
                  key={`${fam}:${id}`}
                  specId={id}
                  lang={lang}
                  activeFamilies={[fam]}
                  isFavorite={isFavorite(id)}
                  inCompare={isInCompare(id)}
                  onOpen={onOpenShape}
                  onToggleFavorite={onToggleFavorite}
                  onToggleCompare={onToggleCompare}
                />
              ))}
            </div>
          </div>
        );
      })}
      {filterIds && FAMILY_ORDER.every((fam) => familyIds(fam).filter((id) => filterIds.includes(id)).length === 0) && (
        <div style={{ color: '#3a9e1f', fontSize: 12, textAlign: 'center', padding: '48px 0' }}>
          {t('search.noResults', lang)}
        </div>
      )}
    </div>
  );
}
