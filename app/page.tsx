'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DELTAHEDRA, DELTAHEDRON_IDS } from './lib/deltahedra';

const ShapeViewer = dynamic(() => import('./components/ShapeViewer'), {
  ssr: false,
});

export default function Home() {
  const [shapeId, setShapeId] = useState<string>(DELTAHEDRON_IDS[0]);

  return (
    <div className="flex h-screen w-full flex-col bg-black">
      <header className="px-6 py-4 text-zinc-50">
        <h1 className="text-lg font-semibold tracking-tight">Deltahedraverse</h1>
        <p className="text-sm text-zinc-400">Stage 3 — vertex picking (hover a vertex to see capacity)</p>
      </header>
      <nav className="flex flex-wrap gap-2 px-6 pb-4">
        {DELTAHEDRON_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setShapeId(id)}
            aria-pressed={id === shapeId}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              id === shapeId
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {id}
            <span className="ml-1 text-xs opacity-70">
              ({DELTAHEDRA[id].faceCount})
            </span>
          </button>
        ))}
      </nav>
      <main className="flex-1">
        <ShapeViewer shapeId={shapeId} />
      </main>
    </div>
  );
}
