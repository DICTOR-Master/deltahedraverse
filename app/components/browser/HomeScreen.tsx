'use client';

import type { ReactNode } from 'react';
import { FAMILY_ORDER, FAMILY_META, familyIds, type FamilyKey } from '../../lib/polyhedra/families';
import { t, type LangCode } from '../../lib/i18n';
import ShapePreviewCard from './ShapePreviewCard';

const SHELF_CAP = 10;

export interface HomeScreenProps {
  lang: LangCode;
  recents: string[];
  favorites: string[];
  onSelectFamily: (family: FamilyKey) => void;
  onOpenShape: (specId: string) => void;
  onSeeAllRecent: () => void;
  onSeeAllFavorites: () => void;
  isFavorite: (specId: string) => boolean;
  isInCompare: (specId: string) => boolean;
  onToggleFavorite: (specId: string) => void;
  onToggleCompare: (specId: string) => void;
}

export default function HomeScreen({
  lang,
  recents,
  favorites,
  onSelectFamily,
  onOpenShape,
  onSeeAllRecent,
  onSeeAllFavorites,
  isFavorite,
  isInCompare,
  onToggleFavorite,
  onToggleCompare,
}: HomeScreenProps) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#a9f795', letterSpacing: '.02em' }}>
          {t('home.families', lang)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {FAMILY_ORDER.map((fam) => {
            const meta = FAMILY_META[fam];
            const count = familyIds(fam).length;
            return (
              <div
                key={fam}
                role="button"
                tabIndex={0}
                onClick={() => onSelectFamily(fam)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectFamily(fam);
                }}
                style={{
                  background: '#0e1209',
                  border: '1px solid rgba(71,204,36,.16)',
                  borderRadius: 10,
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  color: '#5ee233',
                }}
              >
                <span style={{ fontSize: 22 }}>{meta.symbol}</span>
                <span style={{ fontSize: 12, textAlign: 'center' }}>{meta.label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {recents.length > 0 && (
        <Shelf
          title={t('home.recent', lang)}
          showSeeAll={recents.length > SHELF_CAP}
          onSeeAll={onSeeAllRecent}
          seeAllLabel={t('action.seeAll', lang)}
        >
          {recents.slice(0, SHELF_CAP).map((id) => (
            <ShapePreviewCard
              key={id}
              specId={id}
              lang={lang}
              isFavorite={isFavorite(id)}
              inCompare={isInCompare(id)}
              onOpen={onOpenShape}
              onToggleFavorite={onToggleFavorite}
              onToggleCompare={onToggleCompare}
            />
          ))}
        </Shelf>
      )}

      {favorites.length > 0 && (
        <Shelf
          title={t('home.favorites', lang)}
          showSeeAll={favorites.length > SHELF_CAP}
          onSeeAll={onSeeAllFavorites}
          seeAllLabel={t('action.seeAll', lang)}
        >
          {favorites.slice(0, SHELF_CAP).map((id) => (
            <ShapePreviewCard
              key={id}
              specId={id}
              lang={lang}
              isFavorite={isFavorite(id)}
              inCompare={isInCompare(id)}
              onOpen={onOpenShape}
              onToggleFavorite={onToggleFavorite}
              onToggleCompare={onToggleCompare}
            />
          ))}
        </Shelf>
      )}

      {recents.length === 0 && favorites.length === 0 && (
        <div style={{ color: '#3a9e1f', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
          {t('home.emptyHint', lang)}
        </div>
      )}
    </div>
  );
}

function Shelf({
  title,
  showSeeAll,
  onSeeAll,
  seeAllLabel,
  children,
}: {
  title: string;
  showSeeAll: boolean;
  onSeeAll: () => void;
  seeAllLabel: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a9f795', letterSpacing: '.02em' }}>{title}</span>
        {showSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            style={{ background: 'none', border: 'none', color: '#3a9e1f', fontSize: 11, cursor: 'pointer' }}
          >
            {seeAllLabel}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>{children}</div>
    </div>
  );
}
