# Security Policy

Polyhedraverse is a small, single-developer project. There is no bug
bounty and no dedicated security team — reports are handled directly
by the maintainer.

## Reporting a vulnerability

Please report security issues privately, not as a public GitHub issue:

- **Email:** jamesbaker08@gmail.com
- **Or:** open a [GitHub private security advisory](https://github.com/DICTOR-Master/polyhedraverse/security/advisories/new) on this repo.

Include what you found, how to reproduce it, and its impact if you can.
You should get an acknowledgment within a few days.

## Scope

Polyhedraverse has no accounts, no analytics, and (currently) no real
production backend. The one API route, `app/api/assemblies/`, reads and
writes a local JSON file (`.data/assembly.json`, gitignored) as an
interim stand-in for the Vercel KV/Postgres named in
`docs/vercel-deployment-plan.md` — it's an explicit placeholder, not
yet hardened for a public multi-user deployment. Reports touching that
route's input validation (`app/lib/assembly.ts`'s `isValidAssembly`) or
the persistence layer are in scope, as is anything client-side — this
is a WebGL/Three.js app rendering user-driven state, so raycasting or
scene-construction bugs matter even without an obvious "security" label.

## Supported versions

Only the latest commit on `main` is supported. There are no maintained
release branches yet.
