import { avatarUrl, getProfile } from '$lib/server/discord';
import type { PageServerLoad } from './$types';

const roster: { role: string; ids: string[] }[] = [];

export const load: PageServerLoad = async () => {
	const groups = await Promise.all(
		roster.map(async (group) => ({
			role: group.role,
			members: await Promise.all(
				group.ids.map(async (id) => {
					const profile = await getProfile(id);
					return {
						id,
						username: profile?.username || id,
						avatarUrl: profile?.avatarUrl || avatarUrl(id, '')
					};
				})
			)
		}))
	);

	return { groups };
};
