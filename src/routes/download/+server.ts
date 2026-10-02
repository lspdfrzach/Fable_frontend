import { redirect } from '@sveltejs/kit';
import { desktopDownloadUrl } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	redirect(302, desktopDownloadUrl || '/connect?service=download');
};
