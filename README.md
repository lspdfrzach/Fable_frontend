# Fable Frontend

Fable's public website and community management dashboard, adapted from ERM's SvelteKit frontend. The public pages run on their own. A built-in backend connects Discord sign-in and core bot configuration to Fable's existing MongoDB database. Full dashboard operations can also use a compatible external backend.

## Run locally

Use Node 24 LTS.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The homepage, feature pages, help, and community links work with an empty backend configuration. Login shows an unavailable state until the selected backend is configured. Set `DISCORD_CLIENT_ID` to Fable's application ID to enable the Discord bot invite.

## Production

```sh
npm run check
npm run build
npm test
ORIGIN=https://fablebot.xyz HOST=0.0.0.0 PORT=3000 npm start
```

The repository includes a Dockerfile and Railway configuration. This is a Node server application; GitHub Pages cannot run its authentication, server loaders, or form actions. See [deployment instructions](docs/DEPLOYMENT.md).

## Connect the bot

The Python bot in [lspdfrzach/Fable](https://github.com/lspdfrzach/Fable) is a separate service. Its internal FastAPI API does **not** implement the website backend contract. A Discord application ID enables invites, but it does not enable dashboard login.

For the included configuration backend, set `FABLE_BACKEND_MODE=builtin`, `MONGO_URL`, `DB_NAME`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_BOT_TOKEN`. Use the same database and bot token as the Fable bot. Set the Discord OAuth redirect to `https://fablebot.xyz/api/fable/Auth/Callback` (or the exact testing origin). These are private server variables; never use `PUBLIC_` or `VITE_` prefixes for secrets.

The built-in dashboard supports management access, guild discovery and pins, Discord roles/channels, basic settings, documentation links, anti-ping, and shift configuration. Settings writes go to the bot's existing `settings` collection using exact BSON integer IDs. Run the bot's server setup first. Moderation actions, live shifts, applications, verification, billing, streams, and shard telemetry still require separate integrations. Unsupported modules are gated and their API routes fail explicitly.

For an existing full backend, set `FABLE_BACKEND_MODE=external`, `FABLE_BACKEND_URL`, and `FABLE_BACKEND_PUBLIC_URL`. Legacy URL variables remain supported. See [deployment](docs/DEPLOYMENT.md) and [backend coverage](docs/BACKEND.md). Real Discord/MongoDB integration must be verified with deployment credentials; local tests use fixtures.

## Branding

Fable uses red `#ED1825`, dark `#141216`, and light `#FFF4F5`. The Fable mark and install icons are local assets. Support links point to [discord.gg/fablebot](https://discord.gg/fablebot). Illustrative interface previews use explicitly labeled sample data.

The original dashboard forms, permission checks, and API payload names are retained. Legacy schema identifiers such as `erm_log_channel` and `erm_verify` are intentionally preserved for compatibility with the bot.

## Attribution and license

Adapted from the ERM frontend by its original contributors, including Lezetho. The original license is preserved in [LICENSE](LICENSE). This adaptation remains under the same Attribution-NonCommercial-ShareAlike terms. Fable branding and integration changes do not imply endorsement by the original ERM team.
