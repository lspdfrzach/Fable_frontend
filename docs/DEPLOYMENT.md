# Deploy Fable's website

## What works now

The public website can be hosted immediately. The included backend supports Discord login and core settings shared with the bot. Full operational modules require the integrations listed in [BACKEND.md](BACKEND.md). Missing configuration never sends users to ERM's bot or services.

## Railway from GitHub

1. Import this frontend repository as a new Railway service, separate from the Python bot. Use the repository root. The checked-in Dockerfile and `railway.json` supply the build, start command, and health check.
2. Set `ORIGIN` to the exact public HTTPS origin, with no path. While testing, use the Railway-generated domain. After adding the custom domain, use `https://fablebot.xyz`.
3. Set `DISCORD_CLIENT_ID` to the application ID of **Fable**, copied from Discord's Developer Portal. This is public identification, not a bot token. The invite requests bot and slash-command scopes. `DISCORD_BOT_PERMISSIONS` defaults to the upstream administrator bitfield, `8`; change it to the permissions your deployment requires.
4. Deploy. Verify `/`, `/features`, `/login`, `/invite`, and `/api/health`. With no backend, the dashboard correctly stays unavailable.
5. Add `fablebot.xyz` in the service's domain settings and apply the DNS records Railway supplies. Do not invent an IP address. Keep `ORIGIN` aligned with the hostname users visit so form origin checks work.
6. For the included backend, set `FABLE_BACKEND_MODE=builtin`, `MONGO_URL` and `DB_NAME` to the bot's MongoDB deployment, plus `DISCORD_CLIENT_SECRET` and `DISCORD_BOT_TOKEN` from Fable's Discord application. Keep every credential private in Railway variables. MongoDB must allow connections from the website service. The bot remains running as a separate service.
7. Register the exact OAuth redirect in Discord: `https://fablebot.xyz/api/fable/Auth/Callback` (replace the origin while testing). Leave the optional Turnstile pair either both empty or both configured. Redeploy, sign in, select a server where Fable is configured and you have management permission, then change and restore a harmless setting to verify the bot reads the change.
8. For a full external backend instead, set `FABLE_BACKEND_MODE=external` and both backend URLs. Use that backend's own Discord callback URL.

For any other Node or Docker host, run `npm ci`, `npm run build`, then `npm start`. The container runs as a non-root user. `.cache` is writable session-cache storage; the backend remains the authentication authority.

## Configuration

| Variable                                            | Purpose                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN`                                            | Exact public frontend origin; local dev uses `http://localhost:5173`.                                               |
| `HOST`, `PORT`                                      | Listening address and host-supplied port.                                                                           |
| `FABLE_BACKEND_URL`                                 | Server-to-server backend base URL, without a trailing slash. Can use private networking.                            |
| `FABLE_BACKEND_PUBLIC_URL`                          | Public HTTPS backend base URL used for `/Auth/Discord`. Set this explicitly when the internal URL is private.       |
| `DISCORD_CLIENT_ID`                                 | Fable's Discord application ID for invites.                                                                         |
| `DISCORD_BOT_PERMISSIONS`                           | Discord invite permission bitfield, defaults to `8`.                                                                |
| `FABLE_OFFICIAL_GUILD_IDS`                          | Optional comma-separated Fable support/community server IDs, for the Official badge.                                |
| `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional CAPTCHA pair. Set both or leave both empty. A partial pair disables login.                                 |
| `ROBLOX_VERIFICATION_URL`                           | Optional full verification login URL, ending in the backend's expected path. Receives the legacy state/panel flags. |
| `SERVICE_STATUS_URL`                                | Optional external Fable status page; otherwise `/status` is used.                                                   |
| `DESKTOP_DOWNLOAD_URL`                              | Optional Fable desktop release URL.                                                                                 |
| `WEATHER_PROXY_URL`                                 | Optional compatible weather proxy base ending in `/api`. No ERM proxy is used by default.                           |
| `ENVIRONMENT`                                       | `production` normally; `staging` isolates session cookies; `affiliates` explicitly restricts guilds to affiliates.  |
| `BODY_SIZE_LIMIT`                                   | Maximum request body size, `5M` in the sample.                                                                      |
| `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID`              | Optional analytics pair; leave empty when not using analytics.                                                      |

Existing `VITE_INTERNAL_URL` and `BACKEND_PUBLIC_URL` names still work, but the Fable variables take precedence. Do not expose internal service keys using `PUBLIC_` or `VITE_` names. External mode does not need bot/MongoDB credentials in this service. Built-in mode requires them as private server variables.

## Built-in backend variables

| Variable                | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| `FABLE_BACKEND_MODE`    | `builtin` for the included backend, `external` for an existing full backend. |
| `MONGO_URL`             | Same private MongoDB connection string used by the bot.                      |
| `DB_NAME`               | Same bot database name; defaults to `erm`.                                   |
| `DISCORD_CLIENT_SECRET` | Fable application's OAuth secret.                                            |
| `DISCORD_BOT_TOKEN`     | Same Fable bot token used by the Python bot.                                 |

In built-in mode, the external backend URL variables are ignored. `ORIGIN` must be HTTPS except for localhost development. Rotating the Discord client secret invalidates encrypted OAuth credentials and users should sign in again. MongoDB TTL indexes remove expired OAuth/session and audit records. The public health route reports configuration, not database or bot availability.

The production image installs MongoDB's runtime driver. A manual deployment needs `build/`, `package.json`, `package-lock.json`, and `npm ci --omit=dev --ignore-scripts`. `npm start` expects the host to inject environment variables; for a local production test use `node --env-file=.env build` and set `ORIGIN` to that server's port.

## Before enabling real accounts

Configure Fable's own policies at `/terms` and `/privacy`: those pages retain upstream policy text with updated branding and are not a description verified against your eventual deployment. Update optional team/affiliate content with confirmed Fable members and communities.

In external mode, the OAuth redirect URL belongs to the external backend's Discord callback route, not the frontend `/auth` route. The backend completes Discord OAuth and then redirects to `https://fablebot.xyz/auth?token=...` using the agreed session protocol. The invitation route uses Discord's bot-install flow without an unused authorization-code callback.

## Verification

`npm run check` checks Svelte and TypeScript. `npm run build` builds the production server. `npm test` exercises that build against a local backend fixture, including missing configuration, invitation identity, sign-in failure, session validation, and authorized server responses. The backend tests cover OAuth state, session expiry/revocation, permission removal, cross-guild denial, safe settings writes, int64 IDs, and documentation. Fixtures do not replace a live Discord/MongoDB smoke test.

`GET /api/health` reports frontend liveness and whether dashboard configuration is present. It does not claim the bot or backend is healthy. `/status` reports backend-provided service data when available.

## References

- [Railway config as code](https://docs.railway.com/config-as-code/reference)
- [SvelteKit Node adapter](https://svelte.dev/docs/kit/adapter-node)
- [Discord bot authorization](https://docs.discord.com/developers/topics/oauth2#bot-authorization-flow)
