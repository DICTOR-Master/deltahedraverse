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

import { useCallback, useSyncExternalStore } from 'react';
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

// Module-level store, read via useSyncExternalStore -- this is React's own
// prescribed tool for "read from an external mutable source" (here,
// localStorage), and it's what actually solves the SSR/hydration problem
// the previous useState+useEffect('[]') approach was hand-rolling: React
// calls getServerSnapshot() for the first (server-matching) paint, then
// getSnapshot() once hydrated, with no manual effect or extra render needed.
// loadPrefs() itself no-ops to DEFAULT_PREFS under SSR (typeof window check),
// so calling it eagerly here is safe on both server and client -- on the
// client it's the one-time real read from localStorage this module needs.
let cached: Prefs = loadPrefs();
const listeners = new Set<() => void>();

function getSnapshot(): Prefs {
  return cached;
}
function getServerSnapshot(): Prefs {
  return DEFAULT_PREFS;
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function commit(next: Prefs): void {
  cached = next;
  savePrefs(next);
  listeners.forEach((l) => l());
}

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleFavorite = useCallback((id: string) => {
    const favorites = cached.favorites.includes(id)
      ? cached.favorites.filter((x) => x !== id)
      : [...cached.favorites, id];
    commit({ ...cached, favorites });
  }, []);

  const recordViewed = useCallback((id: string) => {
    const recents = [id, ...cached.recents.filter((x) => x !== id)].slice(0, RECENTS_CAP);
    commit({ ...cached, recents });
  }, []);

  const setLanguage = useCallback((language: LangCode) => {
    commit({ ...cached, language });
  }, []);

  const setTheme = useCallback((theme: ThemeState) => {
    commit({ ...cached, theme });
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
