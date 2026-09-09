'use client';

/**
 * First-run welcome overlay -- rotating dodecahedron logo (reuses
 * ShapePreview, the SAME 2D-canvas wireframe renderer the ShapeBrowser's
 * own detail drawer/Compare use, rather than a second hand-rolled
 * projection -- both less code and automatic visual parity with the
 * browser, not a coincidence), a static always-clickable ENTER label
 * overlaid on top, a cross-link to Rhombiverse (this project's twin --
 * see docs/vercel-deployment-plan.md and both repos' own descriptions),
 * and the same legal-doc links every page in this family of projects
 * carries. Modeled directly on Rhombiverse's src/app/welcome.js (rotating
 * RD logo, static ENTER, "don't show again", persistent "About" reopen),
 * adapted to this project's green/black identity and React conventions
 * instead of ported wholesale -- see [[polyhedraverse-wheel]] memory for
 * why a straight port isn't always the right call, and this component for
 * where it genuinely is (the mechanic, not the RD-specific visuals).
 */

import { useCallback, useEffect, useState } from 'react';
import ShapePreview from './browser/ShapePreview';
import { usePrefs } from '../lib/prefs';

export interface WelcomeOverlayProps {
  open: boolean;
  /** Hides the overlay for the current session -- always fired on ENTER,
   *  regardless of the "don't show again" checkbox below (that checkbox
   *  only controls whether it comes back on a FUTURE visit, handled
   *  internally here via usePrefs(), not by the caller). */
  onClose: () => void;
}

const GREEN = '#47cc24';
const GREEN_BRIGHT = '#5ee233';
const GREEN_PALE = '#a9f795';
const PANEL_BG = '#0e1209';
const PANEL_BORDER = 'rgba(71,204,36,.3)';

export default function WelcomeOverlay({ open, onClose }: WelcomeOverlayProps) {
  const { setWelcomeSeen } = usePrefs();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const enter = useCallback(() => {
    if (dontShowAgain) setWelcomeSeen(true);
    onClose();
  }, [dontShowAgain, setWelcomeSeen, onClose]);

  useEffect(() => {
    if (!open) return;
    // Re-registers whenever `enter` changes identity (i.e. whenever
    // dontShowAgain changes -- cheap, a checkbox toggle is rare) so a
    // subsequent Enter keypress sees the CURRENT checkbox value, not
    // whatever it was when the overlay first opened -- a stale closure
    // here would silently ignore a just-checked box.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, enter]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 995,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="dialog"
      aria-label="Welcome to Polyhedraverse"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: '32px 36px',
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 14,
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: GREEN_PALE, letterSpacing: 0.5 }}>
          Polyhedra<span style={{ color: GREEN }}>verse</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8, fontStyle: 'italic', color: GREEN_BRIGHT }}>
          137 shapes, one registry — connect them face to face, vertex to vertex.
        </p>

        <div style={{ position: 'relative', width: 180, height: 180 }}>
          <ShapePreview specId="DODECAHEDRON" size={180} spin />
          {/* Static ENTER label, fixed at center regardless of the logo's
              rotation phase -- same mechanic as Rhombiverse's own welcome
              screen (see its module header for why: a swinging/rotating
              hit target read as unreliable, a fixed one doesn't). */}
          <button
            type="button"
            onClick={enter}
            style={{
              position: 'absolute',
              inset: 0,
              margin: 'auto',
              width: 76,
              height: 32,
              background: 'none',
              border: 'none',
              color: GREEN_PALE,
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: 2,
              cursor: 'pointer',
              textShadow: '0 0 6px #04140c, 0 0 6px #04140c',
            }}
          >
            ENTER
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: GREEN_BRIGHT, cursor: 'pointer' }}>
          <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
          Don&apos;t show this again on this device
        </label>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
          {/* Rhombiverse's own real favicon (copied from its repo root
              favicon.svg, not the separate RHOMBIS sub-puzzle's icon --
              this links to Rhombiverse itself), same small-square-icon-
              next-to-cross-link pattern as its own welcome screen's
              "Try RHOMBIS" row. alignItems:flex-start (not center) on
              the row -- real bug found live: on a narrow screen this
              link text wraps to multiple lines, and center-aligning
              against the WHOLE wrapped block visually drops the icon
              down to the paragraph's middle instead of anchoring it to
              the first line, reading as misaligned. flexShrink:0 stops
              a narrow flex container from squeezing the icon down from
              its real 28x28. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              small static public/ SVG, not a candidate for next/image's
              optimization pipeline. */}
          <img
            src="/brand/rhombiverse-icon.svg"
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: 6, flexShrink: 0 }}
          />
          <a href="https://rhombiverse.vercel.app" target="_blank" rel="noopener" style={{ color: GREEN_BRIGHT }}>
            New here? Explore Rhombiverse, our twin lattice-based spatial editor &rarr;
          </a>
        </div>

        <div style={{ display: 'flex', gap: 8, fontSize: 11, opacity: 0.7, color: GREEN_BRIGHT }}>
          {/* These .md files live at the repo root, not in public/, so
              Next.js doesn't serve them at a same-origin path (only
              public/ and real routes are servable) -- linking to GitHub's
              own rendered copies instead of a route that would 404. */}
          <a
            href="https://github.com/DICTOR-Master/polyhedraverse/blob/main/TERMS.md"
            target="_blank"
            rel="noopener"
            style={{ color: 'inherit' }}
          >
            Terms
          </a>
          ·
          <a
            href="https://github.com/DICTOR-Master/polyhedraverse/blob/main/PRIVACY.md"
            target="_blank"
            rel="noopener"
            style={{ color: 'inherit' }}
          >
            Privacy
          </a>
          ·
          <a
            href="https://github.com/DICTOR-Master/polyhedraverse/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener"
            style={{ color: 'inherit' }}
          >
            Security
          </a>
          ·
          <a href="https://github.com/DICTOR-Master/polyhedraverse" target="_blank" rel="noopener" style={{ color: 'inherit' }}>
            Source
          </a>
        </div>
      </div>
    </div>
  );
}
