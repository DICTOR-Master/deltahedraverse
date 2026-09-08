# Polyhedraverse — Project Structure & Vercel Deployment Plan

Decisions made 2026-09-07, recorded here so future sessions don't re-litigate them.

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

## Repo & Vercel layout: monorepo, two Vercel projects

One GitHub repo, two independently deployed Vercel projects:

```
repo-root/
├── rhombiverse/        (existing app, moves here if not already isolated)
│   ├── app/
│   ├── package.json
│   └── ...
├── polyhedraverse/         (new Next.js app, per the build plan)
│   ├── app/
│   │   └── lib/deltahedra.ts
│   ├── package.json
│   └── ...
├── package.json        (optional root — workspaces, shared lint/format config)
└── README.md
```

Each app keeps its own `package.json`, `next.config`, and dependencies —
they are not meant to share a build, just a repo.

**Vercel setup (per app):**
1. In Vercel, "Add New Project" → import the same GitHub repo twice (once
   per app) — Vercel allows multiple projects from one repo.
2. For each, set **Root Directory** to `rhombiverse` or `polyhedraverse`
   respectively (Project Settings → General → Root Directory).
3. Each gets its own subdomain by default (e.g.
   `rhombiverse.vercel.app`, `polyhedraverse.vercel.app`, or your own naming) and
   its own env vars, build logs, and deploy history — fully independent.
4. A push that only touches files under `polyhedraverse/` triggers only the
   Polyhedraverse project's build (Vercel's monorepo path-based build detection
   handles this automatically when Root Directory is set) — Rhombiverse
   deploys aren't touched by Polyhedraverse changes and vice versa.
5. If you want shared lint/TS config, put it at repo root and have each
   app's config extend it — but don't share runtime code/dependencies unless
   the "independent for now" decision above changes.

## Why not the other options

- **Two separate repos**: no real benefit here since both apps live under
  one account/workflow and a monorepo already gets full deploy independence
  via Root Directory — extra repo-management overhead for no isolation gain.
- **Single Vercel project, two routes**: would force one build/deploy
  pipeline and one Next.js app for both, which only makes sense once they
  actually share the world-state backend. Premature given the "independent
  for now" call above.
