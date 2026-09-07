import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emptyAssembly, isValidAssembly } from '../../lib/assembly';

// Stage 6 asks for Vercel KV or Postgres here — deliberately deferred until
// the project actually deploys (see docs/vercel-deployment-plan.md), since
// provisioning real cloud storage isn't something to do from a local dev
// session. A local JSON file satisfies the same "Done when: reload restores
// a saved assembly exactly" check for local dev; swapping the two functions
// below for a KV/Postgres client is the entire migration later.
const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'assembly.json');

async function loadStored() {
  try {
    const raw = await readFile(FILE_PATH, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function saveStored(value: unknown) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(value, null, 2), 'utf-8');
}

export async function GET() {
  const stored = await loadStored();
  if (stored === null || !isValidAssembly(stored)) {
    return NextResponse.json(emptyAssembly());
  }
  return NextResponse.json(stored);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!isValidAssembly(body)) {
    return NextResponse.json({ error: 'invalid assembly' }, { status: 400 });
  }

  await saveStored(body);
  return NextResponse.json({ ok: true });
}
