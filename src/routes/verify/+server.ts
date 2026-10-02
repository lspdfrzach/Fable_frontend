import { redirect } from '@sveltejs/kit';
import { verificationUrl } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	if (!verificationUrl) redirect(303, '/connect?service=verification');
	const target = new URL(verificationUrl);
	for (const key of ['state', 'discord_id', 'guild_id']) {
		const value = url.searchParams.get(key) ?? '';
		if (/^\d{17,20}$/.test(value)) target.searchParams.set(key, value);
	}
	for (const key of ['panel', 'staging', 'affiliates']) {
		if (url.searchParams.get(key) === 'true') target.searchParams.set(key, 'true');
	}
	redirect(302, target);
};
