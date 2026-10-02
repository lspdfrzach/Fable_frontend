<script lang="ts">
	import { resolve } from '$app/paths';
	import Meta from '$lib/components/Meta.svelte';
	import Footer from '$lib/components/Footer.svelte';
</script>

<Meta
	title="Getting started - Fable"
	description="Get started with Fable and find help for your community."
/>
<section class="mx-auto max-w-225 px-6 py-20">
	<p class="text-sm font-semibold text-brand">GETTING STARTED</p>
	<h1 class="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Your community's next chapter.</h1>
	<p class="mt-6 max-w-160 text-lg leading-relaxed text-muted">
		Fable brings staff management, moderation, shifts, and roleplay tools together. Start with your
		Discord server.
	</p>
	<ol class="mt-12 grid gap-5">
		<li class="rounded-xl border border-line bg-surface p-6">
			<h2 class="text-xl font-semibold">1. Add Fable</h2>
			<p class="mt-3 text-muted">
				Use the invite button and choose a server you manage. Review Discord's requested permissions
				before authorizing.
			</p>
			<a
				href={resolve('/invite')}
				data-sveltekit-reload
				class="mt-4 inline-block font-semibold text-brand">Invite Fable →</a
			>
		</li>
		<li class="rounded-xl border border-line bg-surface p-6">
			<h2 class="text-xl font-semibold">2. Set up your community</h2>
			<p class="mt-3 text-muted">
				Use Fable's Discord commands to configure staff roles, logs, and the tools your team needs.
				Website management will be available when the dashboard launches.
			</p>
			<a href={resolve('/features')} class="mt-4 inline-block font-semibold text-brand"
				>Explore the tools →</a
			>
		</li>
		<li class="rounded-xl border border-line bg-surface p-6">
			<h2 class="text-xl font-semibold">3. Make it your own</h2>
			<p class="mt-3 text-muted">
				Need help getting started or moving from ERM? Join our community and speak with the Fable
				team.
			</p>
			<a href="https://discord.gg/fablebot" class="mt-4 inline-block font-semibold text-brand"
				>Get support →</a
			>
		</li>
	</ol>
</section>
<Footer />
