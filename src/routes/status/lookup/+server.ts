import { internalUrl } from '$lib/server/config';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!/^\d{17,20}$/.test(id) || !internalUrl) return json({ shard: null });

	try {
		const response = await fetch(`${internalUrl}/Status/${id}/GetShard`, {
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) return json({ shard: null });

		const data = (await response.json()) as { ShardID?: number };
		return json({ shard: data.ShardID ?? null });
	} catch {
		return json({ shard: null });
	}
};
