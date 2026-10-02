import { json } from '@sveltejs/kit';
import { getBuiltinBackend } from '$lib/server/builtin';
import { builtinReady } from '$lib/server/config';
import type { RequestHandler } from './$types';

const handle: RequestHandler = ({ request }) => {
	if (!builtinReady)
		return json({ message: 'The Fable backend is not configured.' }, { status: 503 });
	return getBuiltinBackend().handle(request);
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
