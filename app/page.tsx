'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { POLYHEDRA, POLYHEDRON_IDS } from './lib/polyhedra';
import type { NodeSelection, ShapeSelection, ShapeViewerHandle, ViewMode } from './components/ShapeViewer';

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
      <header className="flex items-start justify-between px-6 py-4 text-zinc-50">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Polyhedraverse</h1>
          <p className="text-sm text-zinc-400">
            Deltahedra, Platonic & Archimedean solids — vertex ball-joints and face-to-face connections
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
            className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            View: {VIEW_MODE_LABELS[viewMode]}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving' || pending !== null}
            className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-2 px-6 pb-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Start over with</span>
        {POLYHEDRON_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => handleRef.current?.reset(id)}
            className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {id}
            <span className="ml-1 text-xs opacity-70">
              ({POLYHEDRA[id].faceCount})
            </span>
          </button>
        ))}
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
            {nodeSelection.faceAttachOptions.length > 0 &&
              nodeSelection.faceAttachOptions.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleRef.current?.beginFaceAttach(id)}
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400"
                >
                  Attach {id} via face
                </button>
              ))}
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
        ) : (
          <span className="text-xs text-zinc-600">
            Click a highlighted, free vertex to attach a shape, or click a node&apos;s body to
            select it — a free face offers face-to-face attach for shapes with a matching face
            size (glowing nodes still have room to build from).
          </span>
        )}
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
    </div>
  );
}
