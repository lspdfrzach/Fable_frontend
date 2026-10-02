import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

function httpUrl(value: string | undefined): string {
	if (!value?.trim()) return '';
	try {
		const url = new URL(value.trim());
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
		if (url.search || url.hash) return '';
		return url.toString().replace(/\/+$/, '');
	} catch {
		return '';
	}
}

export const builtinBackend = env.FABLE_BACKEND_MODE === 'builtin';
export const builtinSections = ['basic', 'anti-ping', 'shift-management'];
export const siteOrigin = httpUrl(env.ORIGIN);
export const builtinReady = Boolean(
	builtinBackend &&
	siteOrigin &&
	new URL(siteOrigin).pathname === '/' &&
	(new URL(siteOrigin).protocol === 'https:' ||
		['localhost', '127.0.0.1', '[::1]'].includes(new URL(siteOrigin).hostname)) &&
	/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID ?? '') &&
	env.DISCORD_CLIENT_SECRET &&
	env.DISCORD_BOT_TOKEN &&
	env.MONGO_URL &&
	!/[$.\s/\\]/.test(env.DB_NAME || 'erm')
);
export const internalUrl = builtinBackend
	? builtinReady
		? `${siteOrigin}/api/fable`
		: ''
	: httpUrl(env.FABLE_BACKEND_URL || env.VITE_INTERNAL_URL);
export const publicBackendUrl = httpUrl(
	builtinBackend
		? internalUrl
		: env.FABLE_BACKEND_PUBLIC_URL || env.BACKEND_PUBLIC_URL || internalUrl
);
export const discordClientId = /^\d{17,20}$/.test(env.DISCORD_CLIENT_ID ?? '')
	? env.DISCORD_CLIENT_ID!
	: '';
export const discordPermissions = /^\d+$/.test(env.DISCORD_BOT_PERMISSIONS ?? '')
	? env.DISCORD_BOT_PERMISSIONS!
	: '8';
export const verificationUrl = httpUrl(env.ROBLOX_VERIFICATION_URL);
export const serviceStatusUrl = httpUrl(env.SERVICE_STATUS_URL);
export const desktopDownloadUrl = httpUrl(env.DESKTOP_DOWNLOAD_URL);
export const weatherProxyUrl = httpUrl(env.WEATHER_PROXY_URL);
export const captchaConfigured =
	Boolean(env.TURNSTILE_SECRET_KEY) === Boolean(publicEnv.PUBLIC_TURNSTILE_SITE_KEY);
export const loginAvailable = Boolean(internalUrl && publicBackendUrl && captchaConfigured);

export const affiliatesOnly = env.ENVIRONMENT === 'affiliates';
export const officialGuildIds = (env.FABLE_OFFICIAL_GUILD_IDS ?? '')
	.split(',')
	.map((id) => id.trim())
	.filter((id) => /^\d{17,20}$/.test(id));
