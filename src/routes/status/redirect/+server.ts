import { redirect } from '@sveltejs/kit';
import { serviceStatusUrl } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	redirect(302, serviceStatusUrl || '/status');
};
