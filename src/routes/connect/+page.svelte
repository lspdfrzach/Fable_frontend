<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Meta from '$lib/components/Meta.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const messages: Record<string, { title: string; body: string }> = {
		invite: {
			title: 'Bring Fable to your community.',
			body: 'The website invite is not available yet. Join our Discord for help adding Fable to your server.'
		},
		verification: {
			title: 'Link your Roblox account.',
			body: 'Website verification is not available yet. Our support team can help you with account linking in Discord.'
		},
		download: {
			title: 'Fable, wherever you manage.',
			body: 'A desktop download is not available yet. You can use the website from your browser.'
		}
	};
	const message = $derived(messages[page.url.searchParams.get('service') ?? ''] ?? messages.invite);
</script>

<Meta title="Connect with Fable" noindex />
<section
	class="mx-auto flex min-h-[70vh] max-w-150 flex-col items-center justify-center px-6 py-20 text-center"
>
	<img src="/branding/fable-mark.svg" alt="Fable" class="h-16 w-16" />
	<h1 class="mt-8 text-4xl font-bold tracking-tight">{message.title}</h1>
	<p class="mt-5 text-lg leading-relaxed text-muted">{message.body}</p>
	<a
		href="https://discord.gg/fablebot"
		class="mt-8 rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand/85"
		>Join the Fable community</a
	>
	<a href={resolve('/')} class="mt-5 text-sm text-muted hover:text-white">Back to home</a>
</section>
<Footer />
