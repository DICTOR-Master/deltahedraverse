# Privacy Policy

## Short version

Polyhedraverse does not collect, transmit, or store any personal data
on a server. There are no accounts, no analytics, and no cookies.

## What data exists, and where

- **Your assembly** (the shapes and connections you've built) is sent
  to this app's own `/api/assemblies` route so a page reload can
  restore it. Today that route stores it in a local file on whatever
  machine is running the app — there is no multi-user database, no
  identity attached to it, and no way for the app to distinguish one
  visitor's assembly from another's beyond "whatever was last saved."
  This is an interim development setup (see
  `docs/vercel-deployment-plan.md`), not a finished multi-user product
  — this policy will be revisited before that changes.
- **Standard web server logs.** Once deployed, the hosting provider
  (Vercel) may log ordinary access data (IP address, timestamp,
  requested file) as part of normal web hosting operation. The app
  itself has no access to or control over the provider's own
  infrastructure-level logs.

## Third parties

Once deployed, the app is served as static files/serverless functions
from a hosting provider (Vercel). This project does not add any
tracking, analytics, or third-party scripts beyond what that provider
needs to serve the page.

## Children's privacy

This app does not knowingly collect personal information from anyone,
including children — it has no accounts or identity system at all
today.

## Changes

If a future version adds real accounts, analytics, or a genuine
multi-user backend for saved assemblies, this policy will be updated to
disclose exactly what's collected and why, before that ships.

## Contact

jamesbaker08@gmail.com
