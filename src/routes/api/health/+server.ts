import { json } from '@sveltejs/kit';
import { loginAvailable } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	json(
		{ service: 'fable-frontend', status: 'ok', dashboardConfigured: loginAvailable },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
