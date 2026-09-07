'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DELTAHEDRA, DELTAHEDRON_IDS } from './lib/deltahedra';
import type { ShapeSelection, ShapeViewerHandle } from './components/ShapeViewer';

const ShapeViewer = dynamic(() => import('./components/ShapeViewer'), {
  ssr: false,
});

export default function Home() {
  const handleRef = useRef<ShapeViewerHandle | null>(null);
  const [selection, setSelection] = useState<ShapeSelection | null>(null);

  return (
    <div className="flex h-screen w-full flex-col bg-black">
      <header className="px-6 py-4 text-zinc-50">
        <h1 className="text-lg font-semibold tracking-tight">Deltahedraverse</h1>
        <p className="text-sm text-zinc-400">
          Stage 4 — attach (click a free vertex, then pick a shape to attach)
        </p>
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
        {selection ? (
          <>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Attach to {selection.specId} vertex {selection.vertexId} (capacity{' '}
              {selection.degree}):
            </span>
            {DELTAHEDRON_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleRef.current?.attach(id)}
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
          onReady={(handle) => {
            handleRef.current = handle;
          }}
        />
      </main>
    </div>
  );
}
