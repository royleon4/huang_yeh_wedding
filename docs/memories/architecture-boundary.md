# Memories isolation boundary

## Public routes

- Web: `/Memories/`
- API: `/Memories/api/*`

## Ownership

Memories owns its frontend, backend, database schema, Google Drive configuration, tests, jobs, face-engine adapter, admin boundary, and deployment lifecycle.

## Forbidden dependencies

Memories must not import legacy wedding code, call legacy `/api/photos*` endpoints, read or migrate legacy Object Storage photos, or alter the invitation page.

## Root configuration

Root Replit/workspace configuration may receive additive entries required to register the standalone artifact. Route tests must prove that `/` and legacy `/api/photos*` remain owned by their previous services.

## Decision gates

Owner approval is required before changing the canonical path, moving to another repository/domain, sharing storage or tables with the legacy app, selecting face-provider hosting, or selecting administrator authentication.
