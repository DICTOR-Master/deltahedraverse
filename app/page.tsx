'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { POLYHEDRON_IDS } from './lib/polyhedra';
import type { NodeSelection, ShapeSelection, ShapeViewerHandle, ViewMode } from './components/ShapeViewer';
import PolyhedralWheel from './components/PolyhedralWheel';
import CornerHudWheel from './components/CornerHudWheel';
import ShapeBrowser from './components/browser/ShapeBrowser';
import WelcomeOverlay from './components/WelcomeOverlay';
import { usePrefs } from './lib/prefs';

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
  // shapes with a matching face size are real options) -- set only when
  // opened via that specific trigger, so it's naturally gone the next
  // time the picker opens from anywhere else ("unless returning back to
  // [the general app state]"). Shared by both the wheel and the browser.
  const [wheelMode, setWheelMode] = useState<'reset' | 'faceAttach'>('reset');

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

  const openPicker = (mode: 'reset' | 'faceAttach') => {
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

  const cycleViewMode = () => {
    const next = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
    setViewModeState(next);
    handleRef.current?.setViewMode(next);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-black">
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
            onClick={cycleViewMode}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ background: '#0e1209', border: '1px solid rgba(71,204,36,.3)', color: '#5ee233' }}
          >
            View: {VIEW_MODE_LABELS[viewMode]}
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
                className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400"
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
            {POLYHEDRON_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleRef.current?.beginAttach(id)}
                className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-400"
              >
                {id}
              </button>
            ))}
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
          else handleRef.current?.reset(id);
        }}
      />
      <ShapeBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        filterIds={wheelMode === 'faceAttach' ? nodeSelection?.faceAttachOptions : undefined}
        onSelect={(id) => {
          setBrowserOpen(false);
          if (wheelMode === 'faceAttach') handleRef.current?.beginFaceAttach(id);
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
      {!pending && !nodeSelection && !selection && (
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
            padding: '0.5rem 1rem',
            maxWidth: 'calc(100vw - 2rem)',
            textAlign: 'center',
            color: '#5ee233',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          Click a highlighted, free vertex to attach a shape, or click a node&apos;s body to
          select it — a free face offers face-to-face attach for shapes with a matching face
          size (glowing nodes still have room to build from).
        </div>
      )}
      <WelcomeOverlay open={welcomeOpen} onClose={closeWelcome} />
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
    </div>
  );
}
