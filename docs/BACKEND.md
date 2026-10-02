# Fable website backend

## Included configuration backend

Set `FABLE_BACKEND_MODE=builtin` to use the server-only backend at `/api/fable`. It connects directly to Discord's API and the bot's existing MongoDB database. It does not expose the bot's legacy internal API. The website and Python bot remain separate processes.

Supported: Discord OAuth, hashed website sessions, encrypted OAuth credentials, logout, fresh management authorization, configured guild discovery and pins, preferences/profile refresh, Discord roles/channels, basic settings/documentation, anti-ping configuration, and shift configuration. Owners, members with Manage Server/Administrator, and configured management roles can manage a server. Other staff continue using Discord. The bot must already have a settings document for the guild.

OAuth starts through the verified login form. State is bound to an HTTP-only browser cookie, expires after ten minutes, and is consumed once. The callback sets the website cookie directly; no website session credential appears in a URL. The external backend's `/auth?token=` callback is disabled in built-in mode. Sessions expire after 30 days and are checked for account termination. Every protected backend request checks the session; every guild request refreshes Discord membership and permissions.

Only whitelisted configuration fields are writable. Patches merge fields without replacing unrelated bot settings. Role/channel IDs are checked against that guild and stored as BSON int64 values to preserve compatibility with the Python bot. Configuration audit records retain field names, actor, guild, and time for 90 days. The website stores its own collections under the bot's configured database: `website_sessions`, `website_oauth_states`, `website_users`, `website_documentation`, and `website_audit`.

Operational moderation, live staff actions, applications, Roblox verification, game integration, billing/whitelabel, custom permission catalogues, live streams, and shard telemetry are not implemented in the built-in backend. They are not reported as working or given fabricated data. Use the bot for those actions, or configure a compatible full external backend. The dashboard navigation limits built-in mode to supported configuration pages.

## External backend contract

Set `FABLE_BACKEND_MODE=external` for the complete original dashboard. The Python bot's `utils/api.py` uses a different protocol and is not a drop-in external website backend. The remaining sections document the preserved upstream contract.

## Authentication

1. The browser submits `POST /login` to the frontend. Optional Turnstile verification happens server-side. The frontend stores a short-lived return path and redirects to the public backend's `/Auth/Discord`.
2. The backend initiates Discord OAuth for **Fable's** application. It must validate OAuth state, exchange the code using its server-side client secret, and create a website session. It must not expose the Discord bot token or use a static bot API token as a browser session.
3. After a successful exchange, the backend redirects to the frontend `/auth?token=<opaque-session-token>`.
4. The frontend checks that token using `GET /Users/Session`. It sets an HTTP-only, SameSite=Lax `fableAuthToken` cookie only for a valid user. Missing, rejected, terminated, and failed session lookups do not sign the user in.
5. Authenticated server-side requests use `Authorization: <session-token>` without a `Bearer` prefix, matching the original contract. The backend must check guild membership and action permissions on every protected request.

The legacy callback carries a credential in a query string. Avoid recording callback query strings in proxy/analytics logs. The backend should issue short-lived handoff tokens and reject replay. Full OAuth state/callback security must be implemented and verified in the backend before launch.

`GET /Users/Session` success:

```json
{
	"User": {
		"ID": "internal-user-id",
		"DiscordID": "123456789012345678",
		"Username": "Example",
		"Avatar": ""
	}
}
```

Invalid/expired sessions return 401. A terminated account can return `403` with `{"Terminated":true}`. Do not return a successful empty user. The frontend uses a cache and periodically revalidates sessions, so backend authorization remains mandatory for all mutations.

## Minimum dashboard responses

| Request                            | Response / responsibility                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /Users/Guilds`                | `{"Guilds":[{"ID":"...","Name":"...","PermissionLevel":0,"ApplicationAccess":false,"OverviewEnabled":true}]}`. Include only guilds this session is allowed to see. |
| `GET /Users/ForceGuilds`           | Same shape, refreshed from Discord.                                                                                                                                |
| `GET /Users/Notifications`         | `{"notifications":[]}` or the notification records consumed by `src/lib/server/notifications.ts`.                                                                  |
| `GET /Users/Affiliates`            | `{"Affiliates":[]}` or Fable's actual affiliate profiles. Normally optional; required in explicit affiliates mode.                                                 |
| `GET /Discord/BotProfile`          | Fable's `username`, `avatar_url`, `banner_url`, and `verified` fields.                                                                                             |
| `GET /Status/GetShards`            | `{"ShardPings":{"0":40},"TotalGuilds":1,"TotalUsers":1}` with real bot values.                                                                                     |
| `GET /Status/GetUptimeSummary`     | Existing `statusReport` service-health structure, as consumed by `src/lib/server/status.ts`.                                                                       |
| `GET /{guildId}/permissions/me`    | Current user's permissions, matching `src/lib/server/permissions.ts`.                                                                                              |
| `GET /{guildId}/GetServerRoles`    | `{"Roles":[{"ID":"...","Name":"...","Color":0,"Position":1}]}`.                                                                                                    |
| `GET /{guildId}/GetServerChannels` | `{"Channels":[{"ID":"...","Name":"...","Type":0,"Position":1}]}`.                                                                                                  |

IDs must remain strings in JSON: Discord snowflakes exceed JavaScript's exact integer range. `PermissionLevel` values and permission semantics must match the frontend and the Fable bot; never grant access based on an arbitrary client-supplied level.

## Full route coverage

The minimum responses above are not a complete backend. Existing server modules are the exact source for route names, HTTP methods, payloads, response mapping, and stream behavior:

| Module in `src/lib/server/`                        | Coverage                                                      |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `session.ts`, `user.ts`, `guilds.ts`, `discord.ts` | Sessions, profile, guild discovery, Discord entities.         |
| `dashboard.ts`, `permissions.ts`, `settings.ts`    | Authorization, settings, setup, permissions.                  |
| `panel.ts`, `panelStream.ts`                       | Moderation, duty, player data, commands, panel event streams. |
| `staff.ts`, `loa.ts`, `analytics.ts`               | Staff records, activity, leave, analytics.                    |
| `applications.ts`                                  | Form editing, submission, review, scoring.                    |
| `sessions.ts`, `audit.ts`, `notifications.ts`      | Community sessions, audit history, notifications.             |
| `overview.ts`, `overviewStream.ts`                 | Server overview, moderation history, event streams.           |
| `whitelabel.ts`, `status.ts`, `affiliates.ts`      | Branding services, health, affiliate content.                 |

`src/routes/**/+page.server.ts` contains form-action payload builders. `src/routes/**/+server.ts` contains uploads, stream proxies, and related endpoints. Keep upstream MongoDB fields such as `erm_log_channel` and component identifiers such as `erm_verify` compatible with the existing Python bot.

## Suggested implementation sequence

1. Implement and test OAuth, sessions, per-guild authorization, and guild listing against Fable's Discord application.
2. Implement configuration reads/writes and Discord role/channel lookups against the same MongoDB deployment used by the bot.
3. Add staff, shifts, moderation, and session operations through the bot's internal API, preserving audit and Discord side effects.
4. Add applications, game integration, live streams, verification, and optional services. Gate unavailable features until their endpoints exist.
5. Verify real sign-in, logout, access denial, a settings round trip, and a moderation action in a test server before production.
