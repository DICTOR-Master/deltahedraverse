'use client';

import dynamic from 'next/dynamic';

const SpinningMesh = dynamic(() => import('./components/SpinningMesh'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col bg-black">
      <header className="px-6 py-4 text-zinc-50">
        <h1 className="text-lg font-semibold tracking-tight">Deltahedraverse</h1>
        <p className="text-sm text-zinc-400">Stage 0 — scaffold check</p>
      </header>
      <main className="flex-1">
        <SpinningMesh />
      </main>
    </div>
  );
}
