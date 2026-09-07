'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DELTAHEDRA, DELTAHEDRON_IDS } from './lib/deltahedra';
import type { ShapeSelection, ShapeViewerHandle } from './components/ShapeViewer';

const ShapeViewer = dynamic(() => import('./components/ShapeViewer'), {
  ssr: false,
});

interface Pending {
  specId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function Home() {
  const handleRef = useRef<ShapeViewerHandle | null>(null);
  const [selection, setSelection] = useState<ShapeSelection | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const handleSave = async () => {
    setSaveStatus('saving');
    const ok = (await handleRef.current?.save()) ?? false;
    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-black">
      <header className="flex items-start justify-between px-6 py-4 text-zinc-50">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Deltahedraverse</h1>
          <p className="text-sm text-zinc-400">
            Stage 6 — assembly graph (Save persists it; reload restores it)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && <span className="text-xs text-emerald-400">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-400">Save failed</span>}
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
        {DELTAHEDRON_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => handleRef.current?.reset(id)}
            className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {id}
            <span className="ml-1 text-xs opacity-70">
              ({DELTAHEDRA[id].faceCount})
            </span>
          </button>
        ))}
      </nav>

      <nav className="flex min-h-11 flex-wrap items-center gap-2 px-6 pb-4">
        {pending ? (
          <>
            <span className="text-xs uppercase tracking-wide text-pink-400">
              Placing {pending.specId} — drag the view to twist it, then:
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
        ) : selection ? (
          <>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Attach to {selection.specId} vertex {selection.vertexId} (capacity{' '}
              {selection.degree}):
            </span>
            {DELTAHEDRON_IDS.map((id) => (
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
            Click a highlighted, free vertex to pick an attachment point.
          </span>
        )}
      </nav>

      <main className="flex-1">
        <ShapeViewer
          initialShapeId={DELTAHEDRON_IDS[0]}
          onSelectionChange={setSelection}
          onPendingChange={setPending}
          onReady={(handle) => {
            handleRef.current = handle;
          }}
        />
      </main>
    </div>
  );
}
