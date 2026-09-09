/**
 * ShapeBrowser preferences: favorites, recently-viewed shapes, chosen
 * language, and (Phase 2) the chosen color theme. First localStorage
 * usage in this codebase -- kept defensive, following the same
 * structural safe-parse convention as app/lib/assembly.ts's
 * isAssembly/isValidAssembly (untrusted input in, never trust it blindly).
 *
 * One storage key / one hook for all four concerns rather than three
 * separate ones, since they're always read and written together from the
 * same ShapeBrowser surface.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LangCode } from './i18n';

const STORAGE_KEY = 'polyhedraverse:prefs:v1';
const RECENTS_CAP = 25;

// Theme is a Phase 2 concern (app/lib/theme.ts doesn't exist yet), but the
// storage shape is settled now so Phase 1 users don't need a migration
// later. A minimal local type stands in until then.
export interface ThemeColors {
  bg: string;
  text: string;
  accent: string;
}
export interface ThemeState {
  presetId: string;
  colors: ThemeColors;
}
export const DEFAULT_THEME: ThemeState = {
  presetId: 'classicGreen',
  colors: { bg: '#000000', text: '#5ee233', accent: '#47cc24' },
};

export interface Prefs {
  favorites: string[];
  recents: string[];
  language: LangCode;
  theme: ThemeState;
}

const DEFAULT_PREFS: Prefs = { favorites: [], recents: [], language: 'en', theme: DEFAULT_THEME };

function isThemeColors(v: unknown): v is ThemeColors {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return typeof c.bg === 'string' && typeof c.text === 'string' && typeof c.accent === 'string';
}

function isThemeState(v: unknown): v is ThemeState {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return typeof t.presetId === 'string' && isThemeColors(t.colors);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

const VALID_LANGS: LangCode[] = ['en', 'ja', 'es', 'fr'];

/** Structural validation for untrusted input (localStorage can hold anything, or be tampered with). */
function isPrefs(v: unknown): v is Prefs {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isStringArray(p.favorites) &&
    isStringArray(p.recents) &&
    typeof p.language === 'string' &&
    VALID_LANGS.includes(p.language as LangCode) &&
    isThemeState(p.theme)
  );
}

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS; // SSR/build-time guard
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    return isPrefs(parsed) ? parsed : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS; // corrupt JSON, storage disabled, private-mode quota, etc.
  }
}

function savePrefs(prefs: Prefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort; a full/blocked store shouldn't break the app
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  // Load post-mount only -- reading localStorage during the initial render
  // would produce a server/client markup mismatch under Next.js SSR.
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setPrefs((p) => {
      const favorites = p.favorites.includes(id) ? p.favorites.filter((x) => x !== id) : [...p.favorites, id];
      const next = { ...p, favorites };
      savePrefs(next);
      return next;
    });
  }, []);

  const recordViewed = useCallback((id: string) => {
    setPrefs((p) => {
      const recents = [id, ...p.recents.filter((x) => x !== id)].slice(0, RECENTS_CAP);
      const next = { ...p, recents };
      savePrefs(next);
      return next;
    });
  }, []);

  const setLanguage = useCallback((language: LangCode) => {
    setPrefs((p) => {
      const next = { ...p, language };
      savePrefs(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: ThemeState) => {
    setPrefs((p) => {
      const next = { ...p, theme };
      savePrefs(next);
      return next;
    });
  }, []);

  return {
    favorites: prefs.favorites,
    recents: prefs.recents,
    language: prefs.language,
    theme: prefs.theme,
    toggleFavorite,
    recordViewed,
    setLanguage,
    setTheme,
  };
}
