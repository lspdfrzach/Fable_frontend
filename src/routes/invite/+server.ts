import { redirect } from '@sveltejs/kit';
import { discordClientId, discordPermissions } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	if (!discordClientId) redirect(303, '/connect?service=invite');
	const authorize = new URL('https://discord.com/oauth2/authorize');
	authorize.searchParams.set('client_id', discordClientId);
	authorize.searchParams.set('permissions', discordPermissions);
	authorize.searchParams.set('scope', 'bot applications.commands');
	authorize.searchParams.set('integration_type', '0');
	const guildId = url.searchParams.get('guild_id') ?? '';
	if (/^\d{17,20}$/.test(guildId)) authorize.searchParams.set('guild_id', guildId);
	redirect(302, authorize);
};
