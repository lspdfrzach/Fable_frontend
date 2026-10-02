import { builtinBackend, loginAvailable, publicBackendUrl } from '$lib/server/config';
import { getBuiltinBackend } from '$lib/server/builtin';
import { throttle, throttleMessage } from '$lib/server/ratelimit';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { returnCookie, safeReturnTo } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verify(token: string, ip: string): Promise<boolean> {
	if (!env.TURNSTILE_SECRET_KEY) return true;
	if (!token) return false;

	let response: Response;
	try {
		response = await fetch(verifyUrl, {
			method: 'POST',
			body: new URLSearchParams({
				secret: env.TURNSTILE_SECRET_KEY,
				response: token,
				remoteip: ip
			}),
			signal: AbortSignal.timeout(5000)
		});
	} catch {
		return false;
	}

	if (!response.ok) return false;

	const body = (await response.json().catch(() => null)) as {
		success?: boolean;
		'error-codes'?: string[];
	} | null;

	if (body?.success !== true) console.error('turnstile rejected:', body?.['error-codes'] ?? body);

	return body?.success === true;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
	if (await locals.session) redirect(303, returnTo);

	return {
		returnTo,
		available: loginAvailable,
		siteKey: loginAvailable ? (publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? '') : ''
	};
};

export const actions: Actions = {
	default: async ({ cookies, getClientAddress, request }) => {
		const wait = throttle(`login:${getClientAddress()}`);
		if (wait) return fail(429, { message: throttleMessage(wait) });
		if (!loginAvailable)
			return fail(503, {
				message: 'The Fable dashboard is not available yet. Join our Discord for updates.'
			});
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('returnTo')?.toString());

		if (!(await verify(data.get('cf-turnstile-response')?.toString() ?? '', getClientAddress())))
			return fail(400, { message: 'Verification failed, please try again.' });

		cookies.set(returnCookie, returnTo, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600
		});

		if (builtinBackend) {
			let login: { state: string; url: string };
			try {
				login = await getBuiltinBackend().beginLogin();
			} catch {
				return fail(503, { message: 'Sign-in is unavailable right now. Try again shortly.' });
			}
			cookies.set('fableOAuthState', login.state, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 600
			});
			redirect(303, login.url);
		}
		redirect(303, `${publicBackendUrl}/Auth/Discord`);
	}
};
