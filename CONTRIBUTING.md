# Contributing to Deltahedraverse

Deltahedraverse is a small hobby project, open to improvements from
anyone who wants to make one — **human or AI**. This repo has actually
been built collaboratively with an AI coding agent (Claude Code) from
the start; there's no double standard here between a human PR and a
well-tested, clearly-described AI-assisted one. Read on for what "well
tested and clearly described" means in practice.

## Start here

1. **`docs/build-plan.md`** — the staged build order, and, for each
   stage, exactly how it was verified — usually more useful than the
   stage description itself if you're trying to understand how
   something actually works.
2. **`docs/construction-kit-spec.md`** — the core design law:
   vertex-snapping with a free rotational joint, never face-gluing
   (deltahedra don't tile space and their dihedral angles are
   incompatible across types — checked, not re-litigated), and
   "derive, don't duplicate": connector/capacity data is always
   computed from vertices + edges, never hand-declared separately (an
   earlier, independently-written version of this same data disagreed
   with its own edge list for two shapes — see the spec for the story).
3. **`docs/vercel-deployment-plan.md`** — the planned repo/Vercel
   layout for when this deploys, and the "independent for now" decision
   on how this relates to Rhombiverse.

## Ground rules this project actually follows

- **Next.js + TypeScript + Three.js**, real `npm install` / `npm run
  dev` — unlike Rhombiverse's zero-build-step vanilla ES modules, this
  stack needs the normal Next.js toolchain.
- **Derive, don't duplicate.** Any fact computable from another field
  (vertex degree from the edge list, say) must be derived, not
  separately stored and asserted — see `construction-kit-spec.md`'s own
  cautionary example of what goes wrong otherwise.
- **Ball-joint connections, not face-gluing.** New shapes attach at a
  single vertex with a free rotational (twist) joint. Don't add a
  face-snap or edge-snap mode without checking
  `construction-kit-spec.md`'s notes on it first — it's planned as an
  additive extension, not a replacement mechanic.
- **Comments explain WHY, not WHAT.** A comment earns its place by
  capturing a non-obvious constraint or a reason a simpler approach
  doesn't work — not by restating the code.

## Running it locally

```
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Testing your change

`npm run lint` and `npx tsc --noEmit` should both be clean. The
`scripts/verify-*.ts` scripts (`npm run verify:attach`, `verify:twist`,
`verify:rewrite`, `verify:graph`, plus `validate:deltahedra`) check the
actual geometry math outside the browser — run whichever ones your
change could plausibly affect. `npm run test:e2e` is a permanent
Playwright suite that drives a real browser; it needs Chromium
installed (`npx playwright install --with-deps chromium`) on whatever
machine runs it. This repo's own history includes a build session where
no browser was available for several stages — verified instead by
lint/tsc/geometry-math/direct-API-call proxies, then closed the gap
later with a real browser pass once one was available (see
`docs/build-plan.md`'s "Permanent browser test suite" section for what
that found). Your PR should say **what you actually did to confirm the
change works** — which verify scripts you ran, whether you ran
`test:e2e`, or a description of a manual browser check — not just
"should work."

## Making a PR

1. Fork the repo, branch off `main`.
2. Keep the change scoped to what it says it does.
3. Describe what you tested and how in the PR description.
4. **If a PR (or parts of it) was AI-generated or AI-assisted, say so.**
   That's not a mark against it — it's just accurate attribution, same
   as crediting any other tool or collaborator, and it helps reviewers
   calibrate what to double-check.
5. Be patient — this is maintained by one person in their spare time.

## Reporting bugs or security issues

Regular bugs: open a GitHub issue. Security issues: see `SECURITY.md`
— please don't file those as public issues.

## Code of Conduct

This project follows the Contributor Covenant — see
`CODE_OF_CONDUCT.md`.
