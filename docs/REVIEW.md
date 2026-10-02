# Fable frontend review

Prepared from `lspdfrzach/Fable_frontend` at `8d83b004b9aac4dc81e929ae52f2e2cd3b8df3e2` on local branch `feat/fable-website`.

## Changes

- Restore the public homepage instead of redirecting every visitor to login.
- Apply Fable names, red/dark colors, SVG marks, browser icons, install icons, launch screens, support links, and metadata.
- Replace inherited ERM statistics, testimonial, team roster, and screenshots with Fable content and clearly labeled interface previews.
- Preserve the original dashboard routes, settings forms, permission checks, and bot-compatible payload fields.
- Centralize backend/service configuration, keep legacy environment names compatible, and make Discord bot invites use Fable's application ID.
- Show a clear unavailable state when login/services are not configured. Reject invalid, terminated, empty, and failed session lookups before setting a login cookie.
- Apply affiliate restrictions only in explicitly configured affiliates mode. Continue relying on authenticated backend guild and permission checks.
- Fix status reporting for deployments with fewer than 25 shards and avoid reporting missing telemetry as an outage.
- Add locked dependencies, Docker/Railway configuration, a frontend health endpoint, CI checks, and backend/deployment documentation.

## Validation

- Production build: passed.
- Svelte/TypeScript: zero errors and zero warnings.
- Prettier and ESLint: passed.
- Production HTTP integration tests: 14 passed against local fixtures.
- Built-in backend security and integration tests: 11 passed.
- Total automated tests: 25 passed, zero failures.
- The original frontend-only build passed a standalone health check. The built-in backend now requires the MongoDB runtime driver; the Dockerfile installs production dependencies.
- Whitespace/diff checks: passed.
- Browser visual review: unavailable because the cloud browser blocked access to the local preview. Desktop and mobile rendering have not been visually verified.

## Integration added after review

A built-in configuration backend now provides Discord OAuth, hashed sessions, encrypted OAuth credentials, live management authorization, guild discovery, roles/channels, basic settings/documentation, anti-ping, and shift configuration against the bot's MongoDB data. External backend compatibility remains available. Unsupported operational features are gated.

Live deployment still requires Fable's application credentials, the bot/database connection, and hosting/domain configuration. No live Discord login, MongoDB settings round trip, or public deployment has been verified. The existing terms/privacy content needs to match the eventual deployment before real accounts are enabled. No production secrets are included. The owner authorized committing and publishing the implementation on October 1, 2026.
