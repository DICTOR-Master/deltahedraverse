# Polyhedraverse — Project Structure & Vercel Deployment Plan

Decisions made 2026-09-07, recorded here so future sessions don't
re-litigate them. Updated 2026-09-09 to reflect actual repo layout
(see "Repo & Vercel layout" below — the original monorepo plan was
never executed).

## Relationship to Rhombiverse

**Independent for now.** The Deltahedra Construction Kit's "dual / face-snap
mode" notes (see construction-kit-spec.md) describe a possible future
rhombiverse-style extension, and the Rhombiverse project description
mentions "two systems" eventually writing to one world-state — but that
integration is speculative, not committed. Build and ship Polyhedraverse as a
standalone app. Revisit coupling only if/when both apps are stable and an
actual shared-world-state need shows up.

## claude.ai Project organization

One Project ("Rhombiverse") holds both apps' docs. Polyhedraverse docs live
under the `polyhedraverse/` path prefix:
- `polyhedraverse/construction-kit-spec.md`
- `polyhedraverse/build-plan.md`
- `polyhedraverse/geometry-core.md` (source for `app/lib/deltahedra.ts`)
- `polyhedraverse/vercel-deployment-plan.md` (this doc)

Everything else in the Project (the ~55 other docs) is Rhombiverse's own
material and untouched.

## Repo & Vercel layout: two separate repos, two separate Vercel projects

**Reality check (2026-09-09):** the monorepo layout this doc originally
proposed (`repo-root/rhombiverse/` + `repo-root/polyhedraverse/` under one
GitHub repo) was never built. `gh repo view` confirms both projects are
already standalone GitHub repos:
- `DICTOR-Master/polyhedraverse` (local: `/home/dicto/polyhedraverse`)
- `DICTOR-Master/rhombiverse`

This is actually simpler than the original plan, not a regression from
it — the original monorepo's whole point was giving each app independent
Vercel builds/deploys/env vars via per-app Root Directory settings, and two
separate repos get that same independence for free, with no
repo-restructuring step required first.

Confirmed local state for Polyhedraverse as of 2026-09-09: no
`vercel.json`, no `.vercel/` directory, and the GitHub repo's `homepage`
field is `null` — it has never been deployed to Vercel. Deployment is a
clean first-time setup, not a migration.

**Vercel setup (per repo):**
1. In Vercel, "Add New Project" → import `DICTOR-Master/polyhedraverse`.
   Repeat separately for `DICTOR-Master/rhombiverse` if/when it needs
   (re-)deploying.
2. Leave **Root Directory** at the repo root (`.`) — each repo *is* one
   app now, unlike the old monorepo plan where it would have pointed at a
   subdirectory.
3. Each gets its own subdomain by default (e.g. `polyhedraverse.vercel.app`,
   `rhombiverse.vercel.app`, or custom naming) and its own env vars, build
   logs, and deploy history — fully independent, same as the monorepo plan
   promised, just without the monorepo.
4. Every push to `main` triggers a build for that repo's project only —
   there's no shared-repo path-based build detection to configure, since
   there's no shared repo.
5. Shared lint/TS config across the two apps (if ever wanted) would need
   a separate shared package/repo now, since there's no common monorepo
   root to hang it off — not needed today, note only for if it comes up.

## Known pre-deploy consideration: `/api/assemblies` storage

`app/api/assemblies/route.ts` currently persists to a local JSON file
under `.data/` (see the comment in that file) as a deliberate placeholder
for local dev — Vercel's serverless functions have an ephemeral/read-only
filesystem in production, so this route's writes would silently not
persist across requests once deployed as-is. The route's own comment
already flags the intended fix (swap in Vercel KV or Postgres) as a
same-shape migration for whenever deployment actually happens — not
addressed in this doc, since this pass is deployment planning only, not
deployment itself.

## Why not the other options

- **Single Vercel project, two routes**: would force one build/deploy
  pipeline and one Next.js app for both, which only makes sense once they
  actually share the world-state backend. Premature given the "independent
  for now" call above, and now additionally awkward since the two apps
  aren't even in the same repo.
- **A monorepo merging the two existing repos**: was the original plan
  here, but was never executed and isn't needed — two separate repos
  already deliver the same per-app deploy independence the monorepo was
  chosen to provide, with less setup work, not more. Revisit only if a
  concrete shared-tooling need (not just shared docs, which the claude.ai
  Project already handles) shows up later.
