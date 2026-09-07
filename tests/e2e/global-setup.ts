import { rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * Tests share one persisted assembly (the same .data/assembly.json the app
 * itself reads/writes via app/api/assemblies/route.ts) — clear it before the
 * whole suite runs so no state leaks in from a previous run. Individual
 * tests still call resetTo() before their own scenario so they're not
 * order-dependent on each other within a run.
 */
export default async function globalSetup(): Promise<void> {
  await rm(path.join(process.cwd(), '.data'), { recursive: true, force: true });
}
