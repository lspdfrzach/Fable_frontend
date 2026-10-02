import { getAffiliateProfiles } from '$lib/server/affiliates';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	affiliates: await getAffiliateProfiles()
});
