'use client';

import { t, type LangCode } from '../../lib/i18n';
import ShapePreviewCard from './ShapePreviewCard';

export interface FavoritesScreenProps {
  lang: LangCode;
  favorites: string[];
  isInCompare: (specId: string) => boolean;
  onOpenShape: (specId: string) => void;
  onToggleFavorite: (specId: string) => void;
  onToggleCompare: (specId: string) => void;
}

export default function FavoritesScreen({
  lang,
  favorites,
  isInCompare,
  onOpenShape,
  onToggleFavorite,
  onToggleCompare,
}: FavoritesScreenProps) {
  if (favorites.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#3a9e1f', fontSize: 12, textAlign: 'center', padding: '0 24px' }}>
          {t('home.emptyHint', lang)}
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {favorites.map((id) => (
          <ShapePreviewCard
            key={id}
            specId={id}
            lang={lang}
            isFavorite
            inCompare={isInCompare(id)}
            onOpen={onOpenShape}
            onToggleFavorite={onToggleFavorite}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
    </div>
  );
}
