'use client';

/**
 * ShapeBrowser -- the karaoke-box-style ("Joysound"-inspired) home/picker
 * for choosing a shape, replacing the flat "Start over with…" button row
 * and becoming the default entry point (Tab/Space, "Start over with…",
 * "Attach via face…") while PolyhedralWheel and CornerHudWheel stay
 * exactly as they are: CornerHudWheel keeps opening the literal 3D wheel
 * directly (see app/page.tsx), and this component's own "Spin the Wheel"
 * affordance renders that same real PolyhedralWheel in place, sharing its
 * existing {open,onClose,filterIds,onSelect} contract unmodified.
 *
 * Progressive disclosure by construction: exactly one of four tab screens
 * (Home/Search/Scene/Favorites) is mounted at a time, plus at most one
 * overlay-within-overlay (the shape detail drawer, the wheel, or
 * Compare) -- never a single dashboard showing everything at once.
 */

import { useState } from 'react';
import PolyhedralWheel from '../PolyhedralWheel';
import { usePrefs } from '../../lib/prefs';
import { t, LANG_ORDER, LANG_META, type LangCode } from '../../lib/i18n';
import { type FamilyKey } from '../../lib/polyhedra/families';
import type { Filters } from '../../lib/polyhedra/search';
import HomeScreen from './HomeScreen';
import SearchScreen from './SearchScreen';
import FavoritesScreen from './FavoritesScreen';
import SceneScreen from './SceneScreen';
import ShapeDetailDrawer from './ShapeDetailDrawer';
import CompareScreen from './CompareScreen';
import FullCatalogScreen from './FullCatalogScreen';
import type { AssemblySummary } from './types';

export type BrowserTab = 'home' | 'search' | 'scene' | 'favorites';

export interface ShapeBrowserProps {
  open: boolean;
  onClose: () => void;
  /** Mirrors PolyhedralWheelProps.filterIds exactly -- when set, only
   *  these ids are selectable anywhere in the browser (e.g. face-attach). */
  filterIds?: string[];
  /** Fired once a shape is chosen for the current intent -- same single
   *  callback contract as PolyhedralWheel's onSelect. */
  onSelect: (shapeId: string) => void;
  /** Phase 2: live scene summary. Undefined in Phase 1 (Scene tab shows
   *  an empty-state placeholder). */
  assemblySummary?: AssemblySummary;
  /**
   * Bumped (any change in value, e.g. an incrementing counter) by a
   * PARENT-level PolyhedralWheel's own onSelectAll/onSelectStarPolyhedra/
   * onSelectFamilyGrid (page.tsx's direct corner-HUD wheel, not this
   * component's own embedded one) to request FullCatalogScreen open
   * externally. This component stays mounted with `open` toggling
   * false/true rather than unmounting, so a plain initial-state seed
   * wouldn't fire on a later request -- compared against a state-tracked
   * previous value during render instead (see this component's own
   * body). Omit when there's no such external wheel (this component's
   * own embedded wheel needs no round-trip, it just flips local state
   * directly).
   */
  fullCatalogRequestId?: number;
  /** Paired with fullCatalogRequestId -- which section (if any) the
   *  parent-level wheel's request should land scrolled to. Read at the
   *  same moment fullCatalogRequestId is detected to have changed. */
  fullCatalogFocusSection?: FamilyKey | 'STAR';
  /**
   * Bumped by a PARENT-level PolyhedralWheel's own onSelectSearch (see
   * fullCatalogRequestId's own doc comment for why a counter, not a
   * boolean) -- switches this browser to its own Search tab. This
   * component's own embedded wheel needs no such round-trip, it just
   * flips local state directly.
   */
  searchRequestId?: number;
}

const TABS: BrowserTab[] = ['home', 'search', 'scene', 'favorites'];
const TAB_LABEL_KEY: Record<BrowserTab, string> = {
  home: 'tab.home',
  search: 'tab.search',
  scene: 'tab.scene',
  favorites: 'tab.favorites',
};

export default function ShapeBrowser({
  open,
  onClose,
  filterIds,
  onSelect,
  assemblySummary,
  fullCatalogRequestId,
  fullCatalogFocusSection,
  searchRequestId,
}: ShapeBrowserProps) {
  const { favorites, recents, language, toggleFavorite, recordViewed, setLanguage } = usePrefs();
  const [tab, setTab] = useState<BrowserTab>('home');
  const [searchSeed, setSearchSeed] = useState<Partial<Filters> | undefined>(undefined);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showFullCatalog, setShowFullCatalog] = useState(false);
  const [focusSection, setFocusSection] = useState<FamilyKey | 'STAR' | undefined>(undefined);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // External request from a PARENT-level wheel (see fullCatalogRequestId's
  // own doc comment) -- this component's own embedded wheel below just
  // sets showFullCatalog directly, no round-trip needed. Adjusted during
  // RENDER against a state-tracked previous prop value (React's own
  // recommended "derive state from a prop change" pattern), not inside
  // a useEffect -- a ref read/write during render isn't safe under
  // concurrent rendering, and setState directly in an effect body
  // triggers an extra, avoidable cascading render for no benefit here
  // (same pattern PolyhedralWheel.tsx's own `prevOpen` comparison uses).
  const [prevFullCatalogRequestId, setPrevFullCatalogRequestId] = useState(fullCatalogRequestId);
  if (fullCatalogRequestId !== prevFullCatalogRequestId) {
    setPrevFullCatalogRequestId(fullCatalogRequestId);
    if (fullCatalogRequestId) {
      setShowFullCatalog(true);
      setFocusSection(fullCatalogFocusSection);
    }
  }

  // Same external-request pattern as fullCatalogRequestId, for the
  // direct wheel's own Search face.
  const [prevSearchRequestId, setPrevSearchRequestId] = useState(searchRequestId);
  if (searchRequestId !== prevSearchRequestId) {
    setPrevSearchRequestId(searchRequestId);
    if (searchRequestId) {
      setShowFullCatalog(false);
      setSearchSeed(undefined);
      setTab('search');
    }
  }

  if (!open) return null;
  const lang: LangCode = language;

  const isFavorite = (id: string) => favorites.includes(id);
  const isInCompare = (id: string) => compareIds.includes(id);

  const openShape = (id: string) => {
    setSelectedShapeId(id);
    recordViewed(id);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id]; // FIFO eviction at the cap
      return [...prev, id];
    });
  };

  const selectFamily = (family: FamilyKey) => {
    setSearchSeed({ families: [family] });
    setTab('search');
  };

  const commitSelection = (id: string) => {
    setSelectedShapeId(null);
    onSelect(id);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 985, background: '#000', display: 'flex', flexDirection: 'column' }} role="dialog" aria-label="Shape browser">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(71,204,36,.16)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ color: '#47cc24', fontSize: 18 }}>◈</span>
          <span style={{ color: '#a9f795', fontWeight: 800, fontSize: 15 }}>
            Shape<b style={{ color: '#47cc24' }}>Browser</b>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <button
            type="button"
            onClick={() => setLangMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={langMenuOpen}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0e1209', border: '1px solid rgba(71,204,36,.16)', color: '#5ee233', borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            {lang.toUpperCase()}
          </button>
          {langMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', borderRadius: 9, padding: 5, zIndex: 10, minWidth: 130 }}>
              {LANG_ORDER.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLanguage(code);
                    setLangMenuOpen(false);
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10, background: 'none', border: 'none', color: code === lang ? '#47cc24' : '#5ee233', fontSize: 12, textAlign: 'left', padding: '7px 8px', borderRadius: 6, cursor: 'pointer' }}
                >
                  <span>{LANG_META[code].native}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, opacity: 0.7 }}>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowWheel(true)}
            style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 7, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}
          >
            {t('wheel.spin', lang)}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 7, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}
          >
            {t('action.close', lang)}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {showFullCatalog ? (
          <>
            <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(71,204,36,.16)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowFullCatalog(false);
                  setFocusSection(undefined);
                }}
                style={{ background: 'none', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                {t('action.back', lang)}
              </button>
            </div>
            <FullCatalogScreen
              lang={lang}
              filterIds={filterIds}
              focusSection={focusSection}
              isFavorite={isFavorite}
              isInCompare={isInCompare}
              onOpenShape={openShape}
              onToggleFavorite={toggleFavorite}
              onToggleCompare={toggleCompare}
            />
          </>
        ) : (
          <>
            {tab === 'home' && (
              <HomeScreen
                lang={lang}
                recents={recents}
                favorites={favorites}
                onSelectFamily={selectFamily}
                onOpenShape={openShape}
                onSeeAllRecent={() => {
                  setSearchSeed(undefined);
                  setTab('search');
                }}
                onSeeAllFavorites={() => setTab('favorites')}
                isFavorite={isFavorite}
                isInCompare={isInCompare}
                onToggleFavorite={toggleFavorite}
                onToggleCompare={toggleCompare}
              />
            )}
            {tab === 'search' && (
              <SearchScreen
                key={JSON.stringify(searchSeed)}
                lang={lang}
                filterIds={filterIds}
                initialFilters={searchSeed}
                isFavorite={isFavorite}
                isInCompare={isInCompare}
                onOpenShape={openShape}
                onToggleFavorite={toggleFavorite}
                onToggleCompare={toggleCompare}
              />
            )}
            {tab === 'scene' && <SceneScreen lang={lang} assemblySummary={assemblySummary} />}
            {tab === 'favorites' && (
              <FavoritesScreen
                lang={lang}
                favorites={favorites}
                isInCompare={isInCompare}
                onOpenShape={openShape}
                onToggleFavorite={toggleFavorite}
                onToggleCompare={toggleCompare}
              />
            )}
          </>
        )}

        {selectedShapeId && (
          <ShapeDetailDrawer
            specId={selectedShapeId}
            lang={lang}
            isFavorite={isFavorite(selectedShapeId)}
            inCompare={isInCompare(selectedShapeId)}
            onClose={() => setSelectedShapeId(null)}
            onSelectShape={commitSelection}
            onToggleFavorite={toggleFavorite}
            onToggleCompare={toggleCompare}
          />
        )}

        {showCompare && (
          <CompareScreen lang={lang} ids={compareIds} onRemove={toggleCompare} onClose={() => setShowCompare(false)} />
        )}
      </div>

      {compareIds.length > 0 && !showCompare && (
        <button
          type="button"
          onClick={() => setShowCompare(true)}
          style={{
            position: 'absolute',
            bottom: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#2e8a17',
            border: 'none',
            color: '#04140a',
            borderRadius: 999,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            zIndex: 15,
          }}
        >
          {t('compare.selectedMax', lang, { n: compareIds.length })}
        </button>
      )}

      <nav style={{ display: 'flex', borderTop: '1px solid rgba(71,204,36,.16)' }}>
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => {
              setShowFullCatalog(false);
              setFocusSection(undefined);
              setTab(tb);
            }}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: tab === tb ? '#47cc24' : '#3a9e1f',
              padding: '12px 0',
              fontSize: 12,
              fontWeight: tab === tb ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {t(TAB_LABEL_KEY[tb], lang)}
          </button>
        ))}
      </nav>

      <PolyhedralWheel
        open={showWheel}
        onClose={() => setShowWheel(false)}
        filterIds={filterIds}
        onSelect={(id) => {
          setShowWheel(false);
          commitSelection(id);
        }}
        onSelectAll={() => {
          setShowWheel(false);
          setFocusSection(undefined);
          setShowFullCatalog(true);
        }}
        onSelectStarPolyhedra={() => {
          setShowWheel(false);
          setFocusSection('STAR');
          setShowFullCatalog(true);
        }}
        onSelectFamilyGrid={(familyKey) => {
          setShowWheel(false);
          setFocusSection(familyKey);
          setShowFullCatalog(true);
        }}
        onSelectSearch={() => {
          setShowWheel(false);
          setShowFullCatalog(false);
          setSearchSeed(undefined);
          setTab('search');
        }}
      />
    </div>
  );
}
