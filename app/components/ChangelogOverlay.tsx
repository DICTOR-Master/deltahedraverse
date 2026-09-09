'use client';

/**
 * "What's new" panel -- a plain, scrollable, dated list rendering
 * app/lib/changelog.ts directly (see that file's own header for why it's
 * hand-curated rather than generated from git log). Same visual language
 * as WelcomeOverlay (PANEL_BG/PANEL_BORDER, green identity, Esc-to-close)
 * so it reads as part of the same family of overlays rather than a
 * bolted-on new UI pattern.
 */

import { useEffect } from 'react';
import { CHANGELOG } from '../lib/changelog';

export interface ChangelogOverlayProps {
  open: boolean;
  onClose: () => void;
}

const GREEN = '#47cc24';
const GREEN_BRIGHT = '#5ee233';
const GREEN_PALE = '#a9f795';
const PANEL_BG = 'rgba(10, 12, 20, 0.97)';
const PANEL_BORDER = 'rgba(71,204,36,.3)';

function formatDate(iso: string): string {
  // en-US "September 9, 2026" -- avoids a raw ISO string reading like a
  // filename/log timestamp in what's meant to be user-facing copy.
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default function ChangelogOverlay({ open, onClose }: ChangelogOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 996,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="dialog"
      aria-label="Changelog"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '28px 32px',
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 14,
          width: 'min(560px, 100%)',
          maxHeight: 'min(80vh, 640px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: GREEN_PALE }}>
            What&apos;s <span style={{ color: GREEN }}>New</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: `1px solid ${PANEL_BORDER}`,
              color: GREEN_BRIGHT,
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close (Esc)
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {CHANGELOG.map((day) => (
            <div key={day.date}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: GREEN,
                  marginBottom: 8,
                }}
              >
                {formatDate(day.date)}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {day.entries.map((entry, i) => (
                  <li key={i} style={{ fontSize: 13, lineHeight: 1.5, color: GREEN_BRIGHT }}>
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
