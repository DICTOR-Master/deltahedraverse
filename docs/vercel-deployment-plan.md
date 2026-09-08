# Polyhedraverse — Project Structure & Vercel Deployment Plan

Decisions made 2026-09-07, recorded here so future sessions don't
re-litigate them. Updated 2026-09-09 to reflect actual repo layout
(see "Repo & Vercel layout" below — the original monorepo plan was
never executed). Updated again same day once the app was actually
deployed — see "Deployment status" below.

## Deployment status (2026-09-09): live

**Live at https://polyhedraverse.vercel.app** — Vercel project
`rhombiverse/polyhedraverse` (team slug `rhombiverse`, id shown as
`rhombiverse` by the CLI), deployed via `npx vercel --prod --yes` from
`/home/dicto/polyhedraverse`, not through the dashboard's "Add New
Project" GitHub import flow. Build was clean: TypeScript passed, all
routes generated (`/`, `/api/assemblies`, icons), no env vars needed.

Two things worth knowing for future sessions:
- **The Vercel MCP integration (`plugin:vercel:vercel`) could not
  create this project**: `list_teams` returned an empty list even
  though the `rhombiverse` team does exist (confirmed by `vercel teams
  ls` via the CLI, and by the project having been created under it) —
  some scope mismatch between the MCP OAuth grant and the CLI's device
  login. `create_git_project`/`list_projects` both require a `teamId`
  the MCP tools couldn't discover, so this deploy went through the
  Vercel CLI (`npx vercel`, device-code login) instead. The MCP
  project-management tools (`get_project`, `list_deployments`,
  `get_deployment_build_logs`, etc.) may still work now that the
  project exists — only project *creation* was blocked — but that's
  unconfirmed; the CLI is the proven path.
- **GitHub auto-deploy is now wired up (fixed 2026-09-09, same
  session).** The initial automatic connect during `vercel --prod` and
  a follow-up `vercel git connect` both failed with "Failed to connect
  DICTOR-Master/polyhedraverse to project" — the Vercel GitHub App
  wasn't installed/authorized for the `DICTOR-Master` account yet (the
  repo itself was already public, confirmed via `gh repo view`, so
  this wasn't a GitHub-side permissions issue). Fixed by authorizing
  the GitHub App from the Vercel dashboard (`polyhedraverse` project →
  Settings → Git → Connect Git Repository); `vercel git connect`
  afterward confirmed `DICTOR-Master/polyhedraverse is already
  connected to your project`. This paragraph itself is the test case —
  its removal is the change that should trigger the first
  push-to-deploy build; check `npx vercel ls polyhedraverse` for a new
  deployment shortly after this commit lands to confirm.

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

Local state as of 2026-09-09, post-deploy: `npx vercel` (no local
install) created `.vercel/project.json` linking this directory to
`rhombiverse/polyhedraverse`; no `vercel.json` was needed. See
"Deployment status" above for what actually happened — the dashboard
GitHub-import flow described below is the intended steady-state setup
(and is what `rhombiverse` itself should use), but Polyhedraverse's
first deploy went through the CLI instead because of the git-connect
failure noted above.

**Vercel setup (per repo):**
1. In Vercel, "Add New Project" → import `DICTOR-Master/polyhedraverse`.
   Repeat separately for `DICTOR-Master/rhombiverse` if/when it needs
   (re-)deploying. (For Polyhedraverse specifically, this step still
   needs the GitHub App authorized first — see "Deployment status".)
2. Leave **Root Directory** at the repo root (`.`) — each repo *is* one
   app now, unlike the old monorepo plan where it would have pointed at a
   subdirectory.
3. Each gets its own subdomain by default (e.g. `polyhedraverse.vercel.app`,
   `rhombiverse.vercel.app`, or custom naming) and its own env vars, build
   logs, and deploy history — fully independent, same as the monorepo plan
   promised, just without the monorepo.
4. Every push to `main` triggers a build for that repo's project only —
   there's no shared-repo path-based build detection to configure, since
   there's no shared repo. (Not yet active for Polyhedraverse — pending
   the GitHub App authorization.)
5. Shared lint/TS config across the two apps (if ever wanted) would need
   a separate shared package/repo now, since there's no common monorepo
   root to hang it off — not needed today, note only for if it comes up.

## Known live issue: `/api/assemblies` storage doesn't persist in production

`app/api/assemblies/route.ts` persists to a local JSON file under
`.data/` (see the comment in that file) as a deliberate placeholder for
local dev. That's now live at https://polyhedraverse.vercel.app, and as
expected, Vercel's serverless functions have an ephemeral/read-only
filesystem in production — writes there don't persist across requests
(each POST appears to succeed, but a subsequent GET, possibly on a
different function instance, won't see it). Not yet fixed; the route's
own comment already flags the intended fix (swap in Vercel KV or
Postgres) as a same-shape migration whenever someone picks this up.

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
