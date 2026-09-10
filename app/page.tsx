'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { POLYHEDRON_IDS } from './lib/polyhedra';
import type { NodeSelection, ShapeSelection, ShapeViewerHandle, ViewMode } from './components/ShapeViewer';
import PolyhedralWheel from './components/PolyhedralWheel';
import CornerHudWheel from './components/CornerHudWheel';
import ShapeBrowser from './components/browser/ShapeBrowser';
import WelcomeOverlay from './components/WelcomeOverlay';
import ChangelogOverlay from './components/ChangelogOverlay';
import { usePrefs } from './lib/prefs';
import type { FamilyKey } from './lib/polyhedra/families';

const ShapeViewer = dynamic(() => import('./components/ShapeViewer'), {
  ssr: false,
});

interface Pending {
  specId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const VIEW_MODES: ViewMode[] = ['normal', 'translucent', 'skeleton'];
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  normal: 'Solid',
  translucent: 'Translucent',
  skeleton: 'Inside view',
};

export default function Home() {
  const handleRef = useRef<ShapeViewerHandle | null>(null);
  const [selection, setSelection] = useState<ShapeSelection | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [nodeSelection, setNodeSelection] = useState<NodeSelection | null>(null);
  const [rewriteNote, setRewriteNote] = useState<string | null>(null);
  const [cageClosed, setCageClosed] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  // Bumped whenever the DIRECT wheel (below, opened via CornerHudWheel's
  // medallion) picks "Full Catalog" -- see ShapeBrowser's own
  // fullCatalogRequestId doc comment for why a plain boolean/counter
  // seed wouldn't fire on a second request once ShapeBrowser is already
  // mounted. The embedded wheel INSIDE ShapeBrowser needs no such
  // round-trip, it flips its own local state directly.
  const [fullCatalogRequestId, setFullCatalogRequestId] = useState(0);
  // Paired with fullCatalogRequestId -- which section (if any) the
  // direct wheel's Full Catalog/Star Polyhedra/family "View all" face
  // should land scrolled to. See ShapeBrowser's own
  // fullCatalogFocusSection doc comment.
  const [fullCatalogFocusSection, setFullCatalogFocusSection] = useState<FamilyKey | 'STAR' | undefined>(undefined);
  // Bumped whenever the DIRECT wheel picks "Search" -- same pattern as
  // fullCatalogRequestId, see ShapeBrowser's own searchRequestId doc
  // comment.
  const [searchRequestId, setSearchRequestId] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [viewMode, setViewModeState] = useState<ViewMode>('normal');
  // wheelOpen now drives ONLY the literal 3D PolyhedralWheel, opened
  // directly via CornerHudWheel's medallion -- a fast, unchanged shortcut
  // for anyone who wants the wheel itself rather than the browser.
  const [wheelOpen, setWheelOpen] = useState(false);
  // browserOpen drives the karaoke-style ShapeBrowser, which is now the
  // DEFAULT entry point for picking a shape (Tab/Space, "Start over
  // with…", "Attach via face…"). The browser has its own internal "Spin
  // the Wheel" affordance that renders this same PolyhedralWheel in
  // place, sharing the identical onSelect contract below.
  const [browserOpen, setBrowserOpen] = useState(false);
  // 'reset': picking a shape to start over with (no filter). 'faceAttach':
  // picking a shape to attach via the currently-selected free face (only
  // shapes with a matching face size are real options). 'vertexAttach':
  // picking a shape to attach via the currently-selected free vertex --
  // unlike face-attach, ANY shape is a valid vertex-attach target (a
  // vertex ball-joint has no congruence requirement the way a flush face
  // does), so this is unfiltered, same as 'reset' -- it only needs its
  // own mode so onSelect below knows to call beginAttach() instead of
  // reset(). Each is set only when opened via that specific trigger, so
  // it's naturally gone the next time the picker opens from anywhere
  // else. Shared by both the wheel and the browser.
  const [wheelMode, setWheelMode] = useState<'reset' | 'faceAttach' | 'vertexAttach'>('reset');
  const [changelogOpen, setChangelogOpen] = useState(false);
  // Real user request: "a little x in the corner so you can clear the
  // space" -- the default-state instruction pill has no way to dismiss
  // itself otherwise. Plain session-lived state (not persisted) -- a
  // page reload brings it back, same as every other transient UI state
  // here; the request was "clear the space" for the current session,
  // not "never show me this again."
  const [instructionsDismissed, setInstructionsDismissed] = useState(false);

  // First-visit welcome overlay -- shown once (persisted via usePrefs'
  // welcomeSeen, only if the "don't show again" checkbox was checked),
  // reopenable anytime via the "ℹ" button next to the corner HUD.
  // Plain derived state, no effect needed: welcomeOpen is true if either
  // explicitly force-reopened (the ℹ button) OR it's a fresh visit that
  // hasn't been dismissed yet THIS session -- dismissedThisSession is
  // separate from the persisted welcomeSeen so closing it without
  // checking the box still hides it for the rest of the current visit,
  // without permanently marking it seen.
  const { welcomeSeen } = usePrefs();
  const [welcomeForceOpen, setWelcomeForceOpen] = useState(false);
  const [welcomeDismissedThisSession, setWelcomeDismissedThisSession] = useState(false);
  const welcomeOpen = welcomeForceOpen || (!welcomeDismissedThisSession && !welcomeSeen);
  const closeWelcome = () => {
    setWelcomeForceOpen(false);
    setWelcomeDismissedThisSession(true);
  };

  const openPicker = (mode: 'reset' | 'faceAttach' | 'vertexAttach') => {
    setWheelMode(mode);
    setBrowserOpen(true);
  };
  const openWheelDirectly = () => {
    setWheelMode('reset');
    setWheelOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (wheelOpen || browserOpen || welcomeOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'Tab' || e.key === ' ') {
        e.preventDefault();
        openPicker('reset');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wheelOpen, browserOpen, welcomeOpen]);

  const handleSave = async () => {
    setSaveStatus('saving');
    const ok = (await handleRef.current?.save()) ?? false;
    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleRewrite = () => {
    const result = handleRef.current?.rewriteSelectedNode();
    if (!result) return;
    const note =
      result.orphaned > 0
        ? `${result.fromSpecId} → ${result.toSpecId}: ${result.reattached} reattached, ${result.orphaned} orphaned (no compatible vertex found)`
        : `${result.fromSpecId} → ${result.toSpecId}: ${result.reattached} connection(s) reattached`;
    setRewriteNote(note);
    setTimeout(() => setRewriteNote(null), 4000);
  };

  const handleDelete = () => {
    const result = handleRef.current?.deleteSelectedNode();
    if (!result) return;
    setRewriteNote(
      result.deletedCount > 1
        ? `Deleted node and ${result.deletedCount - 1} attached descendant(s)`
        : 'Deleted node',
    );
    setTimeout(() => setRewriteNote(null), 4000);
  };

  const handleUndo = () => {
    const result = handleRef.current?.undo();
    if (!result) return;
    setRewriteNote(
      result.deletedCount > 1
        ? `Undid last attach (and ${result.deletedCount - 1} piece(s) built on top of it)`
        : 'Undid last attach',
    );
    setTimeout(() => setRewriteNote(null), 4000);
  };

  const handleExport = () => {
    const assembly = handleRef.current?.getAssembly();
    if (!assembly) return;
    // Client-side only -- no server round-trip, unlike Save (which
    // persists to /api/assemblies for reload-on-return). Same Assembly
    // JSON shape either way, just handed to the browser's own download
    // flow instead of POSTed.
    const blob = new Blob([JSON.stringify(assembly, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polyhedraverse-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cycleViewMode = () => {
    const next = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
    setViewModeState(next);
    handleRef.current?.setViewMode(next);
  };

  return (
    <div
      className="flex h-screen w-full flex-col"
      // Real user request: "can i have a starry background." A pure-CSS
      // tiled dot field (no image asset, no extra render cost) rather than
      // a DOM/canvas starfield here -- ShapeViewer's own 3D scene (which
      // fills most of the screen most of the time) gets a REAL 3D
      // starfield of its own (see its own scene setup) since this CSS
      // layer only shows through in the header strip and anywhere the
      // 3D canvas or an opaque modal backdrop doesn't cover it.
      style={{
        backgroundColor: '#000',
        backgroundImage: [
          'radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.9), transparent)',
          'radial-gradient(1px 1px at 90px 60px, rgba(255,255,255,0.7), transparent)',
          'radial-gradient(1.5px 1.5px at 140px 20px, rgba(255,255,255,0.8), transparent)',
          'radial-gradient(1px 1px at 170px 90px, rgba(255,255,255,0.6), transparent)',
          'radial-gradient(1px 1px at 40px 110px, rgba(255,255,255,0.5), transparent)',
          'radial-gradient(1.5px 1.5px at 110px 140px, rgba(255,255,255,0.7), transparent)',
          'radial-gradient(1px 1px at 180px 150px, rgba(71,204,36,0.45), transparent)',
          'radial-gradient(1px 1px at 60px 170px, rgba(255,255,255,0.55), transparent)',
        ].join(', '),
        backgroundSize: '200px 200px',
        backgroundRepeat: 'repeat',
      }}
    >
      <header className="flex items-start justify-between px-6 py-4">
        <div>
          {/* Same green-split treatment as WelcomeOverlay's <h1> --
              "Polyhedra" pale, "verse" the brand green -- rather than
              plain zinc-50, matching the identity established there and
              in the wheel/browser instead of a leftover generic default. */}
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: '#a9f795' }}>
            Polyhedra<span style={{ color: '#47cc24' }}>verse</span>
          </h1>
          <p className="text-sm" style={{ color: '#5ee233', opacity: 0.8 }}>
            137 shapes across 7 families — vertex ball-joints and face-to-face connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cageClosed && (
            <span className="rounded-full bg-fuchsia-900 px-3 py-1 text-xs font-medium text-fuchsia-200">
              Closed cage!
            </span>
          )}
          {saveStatus === 'saved' && <span className="text-xs text-emerald-400">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-400">Save failed</span>}
          <button
            type="button"
            onClick={() => setChangelogOpen(true)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
          >
            What&apos;s New
          </button>
          <button
            type="button"
            onClick={cycleViewMode}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
          >
            View: {VIEW_MODE_LABELS[viewMode]}
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo || pending !== null}
            title="Undo the last confirmed attach (single-level -- undoing again does nothing until you attach something new)"
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving' || pending !== null}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            title="Download the current assembly as a JSON file"
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
          >
            Export JSON
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-2 px-6 pb-2">
        <button
          type="button"
          onClick={() => openPicker('reset')}
          className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
        >
          Start over with… <span className="ml-1 text-xs opacity-70">(Tab / Space)</span>
        </button>
      </nav>

      <nav className="flex min-h-11 flex-wrap items-center gap-2 px-6 pb-2">
        {pending ? (
          <>
            <span className="text-xs uppercase tracking-wide text-pink-400">
              Placing {pending.specId} — drag to rotate it, then:
            </span>
            <button
              type="button"
              onClick={() => handleRef.current?.confirmAttach()}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-400"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => handleRef.current?.cancelAttach()}
              className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Cancel (Esc)
            </button>
          </>
        ) : nodeSelection ? (
          <>
            <span className="text-xs uppercase tracking-wide text-amber-400">
              Selected {nodeSelection.specId} node
              {nodeSelection.faceIndex !== null ? ` (face ${nodeSelection.faceIndex}, ${nodeSelection.faceSize}-gon${nodeSelection.faceOccupied ? ', occupied' : ''})` : ''}:
            </span>
            {nodeSelection.rewriteTarget && (
              <button
                type="button"
                onClick={handleRewrite}
                className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-amber-400"
              >
                Transform to {nodeSelection.rewriteTarget}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Delete
            </button>
            {nodeSelection.faceAttachOptions.length > 0 && (
              <button
                type="button"
                onClick={() => openPicker('faceAttach')}
                // Yellow/amber, not blue -- matches COLOR_FREE (the same
                // "you can interact here" color already used for free
                // vertices and the new per-face hover highlight in
                // ShapeViewer.tsx), so this button reads as part of the
                // same visual language instead of an unrelated blue.
                className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-amber-300"
              >
                Attach via face…
              </button>
            )}
          </>
        ) : selection ? (
          <>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Attach to {selection.specId} vertex {selection.vertexId} (capacity{' '}
              {selection.degree}):
            </span>
            {/* Real leftover found live: this used to render a flat button
                for all 137 POLYHEDRON_IDS directly (predating the wheel/
                browser system entirely) -- "the huge amorphous list
                format," in the user's own words, never migrated to the
                same family-grouped picker face-attach already uses below.
                Vertex-attach has no compatibility constraint (a ball-joint
                vertex, unlike a flush face, accepts any shape), so this
                opens the SAME picker unfiltered ('vertexAttach' mode,
                distinct from 'reset' only so onSelect knows to call
                beginAttach() instead of starting over). */}
            <button
              type="button"
              onClick={() => openPicker('vertexAttach')}
              className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-amber-300"
            >
              Attach via vertex…
            </button>
          </>
        ) : null}
      </nav>

      {rewriteNote && (
        <div className="px-6 pb-2">
          <span className="text-xs text-amber-300">{rewriteNote}</span>
        </div>
      )}

      <main className="flex-1">
        <ShapeViewer
          initialShapeId={POLYHEDRON_IDS[0]}
          onSelectionChange={setSelection}
          onPendingChange={setPending}
          onNodeSelectionChange={setNodeSelection}
          onCageClosedChange={setCageClosed}
          onCanUndoChange={setCanUndo}
          onReady={(handle) => {
            handleRef.current = handle;
          }}
        />
      </main>

      <PolyhedralWheel
        open={wheelOpen}
        onClose={() => setWheelOpen(false)}
        filterIds={wheelMode === 'faceAttach' ? nodeSelection?.faceAttachOptions : undefined}
        onSelect={(id) => {
          if (wheelMode === 'faceAttach') handleRef.current?.beginFaceAttach(id);
          else if (wheelMode === 'vertexAttach') handleRef.current?.beginAttach(id);
          else handleRef.current?.reset(id);
        }}
        onSelectAll={() => {
          setWheelOpen(false);
          setFullCatalogFocusSection(undefined);
          setFullCatalogRequestId((n) => n + 1);
          setBrowserOpen(true);
        }}
        onSelectStarPolyhedra={() => {
          setWheelOpen(false);
          setFullCatalogFocusSection('STAR');
          setFullCatalogRequestId((n) => n + 1);
          setBrowserOpen(true);
        }}
        onSelectFamilyGrid={(familyKey) => {
          setWheelOpen(false);
          setFullCatalogFocusSection(familyKey);
          setFullCatalogRequestId((n) => n + 1);
          setBrowserOpen(true);
        }}
        onSelectSearch={() => {
          setWheelOpen(false);
          setSearchRequestId((n) => n + 1);
          setBrowserOpen(true);
        }}
      />
      <ShapeBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        filterIds={wheelMode === 'faceAttach' ? nodeSelection?.faceAttachOptions : undefined}
        fullCatalogRequestId={fullCatalogRequestId}
        fullCatalogFocusSection={fullCatalogFocusSection}
        searchRequestId={searchRequestId}
        onSelect={(id) => {
          setBrowserOpen(false);
          if (wheelMode === 'faceAttach') handleRef.current?.beginFaceAttach(id);
          else if (wheelMode === 'vertexAttach') handleRef.current?.beginAttach(id);
          else handleRef.current?.reset(id);
        }}
      />
      {/* Default instructional text, moved off the top nav to a fixed
          bottom-center pill sitting below/over the shape itself --
          matches Rhombiverse's own RHOMBIS puzzle's #rhombis-hud exactly
          (position: fixed, centered, pill-shaped, translucent dark
          background), which shows this same kind of "what to do right
          now" status text in the same spot regardless of game state.
          Only shown in the true default state -- an active
          pending/nodeSelection/selection already has its own action
          buttons in the top nav, so this would be redundant there. */}
      {!pending && !nodeSelection && !selection && !instructionsDismissed && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            zIndex: 10,
            background: 'rgba(5,5,10,.6)',
            border: '1px solid rgba(71,204,36,.2)',
            borderRadius: 999,
            padding: '0.5rem 2.25rem 0.5rem 1rem',
            // Leaves clearance for CornerHudWheel, now also bottom-right
            // (160px + margin) -- the pill body itself still has
            // pointerEvents:'none' so it can never block a click either
            // way, but a narrower cap avoids a purely visual overlap in
            // the common case where both are showing at once.
            maxWidth: 'calc(100vw - 220px)',
            textAlign: 'center',
            color: '#5ee233',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          Click a highlighted, free vertex to attach a shape, or click a node&apos;s body to
          select it — a free face offers face-to-face attach for shapes with a matching face
          size (glowing nodes still have room to build from).
          <button
            type="button"
            onClick={() => setInstructionsDismissed(true)}
            aria-label="Dismiss instructions"
            title="Dismiss instructions"
            style={{
              position: 'absolute',
              top: '50%',
              right: 8,
              transform: 'translateY(-50%)',
              // The pill itself is pointerEvents:'none' so it never
              // blocks a click through to whatever's underneath -- this
              // button opts back in on its own, the only truly
              // interactive part of the pill.
              pointerEvents: 'auto',
              background: 'none',
              border: 'none',
              color: '#5ee233',
              opacity: 0.7,
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      )}
      <WelcomeOverlay open={welcomeOpen} onClose={closeWelcome} />
      <ChangelogOverlay open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      {!welcomeOpen && (
        <CornerHudWheel
          wheelOpen={wheelOpen}
          browserOpen={browserOpen}
          onToggleWheel={() => (wheelOpen ? setWheelOpen(false) : openWheelDirectly())}
          onToggleBrowser={() => (browserOpen ? setBrowserOpen(false) : openPicker('reset'))}
          viewMode={viewMode}
          onCycleView={cycleViewMode}
          onSave={handleSave}
          onAbout={() => setWelcomeForceOpen(true)}
        />
      )}
      {/* Real user request: "a little bottom left hand 'menu' button that
          summons wheel from anywhere" -- a second, always-visible trigger
          for the direct wheel, deliberately alongside (not replacing)
          CornerHudWheel's own medallion (bottom-right, see its own
          right:16/bottom:16) rather than unifying them into one -- this
          project has already decided against collapsing the wheel and
          browser's separate entry points into a single toggle, and the
          same reasoning applies here: more doors in, not fewer.
          bottom:72 (not 16) -- real bug caught by e2e: Next.js's own dev-
          mode indicator badge lives in the literal bottom-left corner and
          its portal intercepts clicks there, so a plain bottom:16 button
          was unclickable under `next dev` (this doesn't exist in a
          production build, but local dev/test needs to work too). */}
      {!welcomeOpen && (
        <button
          type="button"
          onClick={() => (wheelOpen ? setWheelOpen(false) : openWheelDirectly())}
          aria-label="Open shape wheel"
          title="Open shape wheel"
          style={{
            position: 'fixed',
            left: 16,
            bottom: 72,
            zIndex: 60,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(5,5,10,.75)',
            border: '1px solid rgba(71,204,36,.4)',
            color: '#5ee233',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          ☰
        </button>
      )}
    </div>
  );
}
