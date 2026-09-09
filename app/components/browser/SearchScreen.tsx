'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FAMILY_ORDER, FAMILY_META, type FamilyKey } from '../../lib/polyhedra/families';
import {
  EMPTY_FILTERS,
  FACE_COUNT_BANDS,
  countWith,
  filteredIds,
  hasActiveFilter,
  allFaceShapeSizes,
  type Filters,
  type FaceCountBand,
} from '../../lib/polyhedra/search';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreviewCard from './ShapePreviewCard';

export interface SearchScreenProps {
  lang: LangCode;
  /** When set, only these ids are selectable anywhere in the browser
   *  (mirrors PolyhedralWheel's filterIds) -- e.g. face-attach mode. */
  filterIds?: string[];
  /** Pre-seeded filter state, e.g. after tapping a family tile on Home. */
  initialFilters?: Partial<Filters>;
  isFavorite: (specId: string) => boolean;
  isInCompare: (specId: string) => boolean;
  onOpenShape: (specId: string) => void;
  onToggleFavorite: (specId: string) => void;
  onToggleCompare: (specId: string) => void;
}

function chipStyle(active: boolean): CSSProperties {
  return {
    background: active ? '#2e8a17' : '#0e1209',
    border: `1px solid ${active ? '#47cc24' : 'rgba(71,204,36,.3)'}`,
    color: active ? '#a9f795' : '#5ee233',
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12,
    cursor: 'pointer',
  };
}

export default function SearchScreen({
  lang,
  filterIds,
  initialFilters,
  isFavorite,
  isInCompare,
  onOpenShape,
  onToggleFavorite,
  onToggleCompare,
}: SearchScreenProps) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, ...initialFilters });
  const faceShapeSizes = useMemo(() => allFaceShapeSizes(), []);

  const results = useMemo(() => filteredIds(filters, filterIds), [filters, filterIds]);
  const active = hasActiveFilter(filters);

  const toggleFamily = (fam: FamilyKey) => {
    setFilters((f) => ({
      ...f,
      families: f.families.includes(fam) ? f.families.filter((x) => x !== fam) : [...f.families, fam],
    }));
  };
  const toggleFaceShape = (n: number) => {
    setFilters((f) => ({
      ...f,
      faceShapes: f.faceShapes.includes(n) ? f.faceShapes.filter((x) => x !== n) : [...f.faceShapes, n],
    }));
  };
  const setBand = (band: FaceCountBand) => {
    setFilters((f) => ({ ...f, faceCountBand: f.faceCountBand === band ? null : band }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '14px 18px 10px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid rgba(71,204,36,.16)' }}>
        <input
          type="text"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder={t('search.placeholder', lang)}
          style={{
            background: '#0e1209',
            border: '1px solid rgba(71,204,36,.3)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#a9f795',
            fontSize: 13,
          }}
        />

        <FacetRow label={t('facet.family', lang)}>
          {FAMILY_ORDER.map((fam) => {
            const isSelected = filters.families.includes(fam);
            const wouldZero = !isSelected && countWith(filters, { families: [...filters.families, fam] }, filterIds) === 0;
            if (wouldZero) return null;
            return (
              <button key={fam} type="button" style={chipStyle(isSelected)} onClick={() => toggleFamily(fam)}>
                {FAMILY_META[fam].symbol} {FAMILY_META[fam].label}
              </button>
            );
          })}
        </FacetRow>

        <FacetRow label={t('facet.faceShape', lang)}>
          {faceShapeSizes.map((n) => {
            const isSelected = filters.faceShapes.includes(n);
            const wouldZero = !isSelected && countWith(filters, { faceShapes: [...filters.faceShapes, n] }, filterIds) === 0;
            if (wouldZero) return null;
            return (
              <button key={n} type="button" style={chipStyle(isSelected)} onClick={() => toggleFaceShape(n)}>
                {n}-gon
              </button>
            );
          })}
        </FacetRow>

        <FacetRow label={t('facet.faceCount', lang)}>
          {FACE_COUNT_BANDS.map(({ id, label }) => {
            const isSelected = filters.faceCountBand === id;
            const wouldZero = !isSelected && countWith(filters, { faceCountBand: id }, filterIds) === 0;
            if (wouldZero) return null;
            return (
              <button key={id} type="button" style={chipStyle(isSelected)} onClick={() => setBand(id)}>
                {label}
              </button>
            );
          })}
        </FacetRow>

        {(filters.families.length > 0 || filters.faceShapes.length > 0 || filters.faceCountBand || filters.query) && (
          <div>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#3a9e1f', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              {t('action.reset', lang)}
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {!active ? (
          <EmptyPrompt text={t('search.prompt', lang)} />
        ) : results.length === 0 ? (
          <EmptyPrompt text={t('search.noResults', lang)} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {results.map((id) => (
              <ShapePreviewCard
                key={id}
                specId={id}
                lang={lang}
                activeFamilies={filters.families}
                isFavorite={isFavorite(id)}
                inCompare={isInCompare(id)}
                onOpen={onOpenShape}
                onToggleFavorite={onToggleFavorite}
                onToggleCompare={onToggleCompare}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FacetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#3a9e1f', minWidth: 70 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function EmptyPrompt({ text }: { text: string }) {
  return <div style={{ color: '#3a9e1f', fontSize: 12, textAlign: 'center', padding: '48px 0' }}>{text}</div>;
}
