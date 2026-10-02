<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';

	const { data } = $props();

	const description = 'The people who build, run and support Fable.';
	const fallbackAvatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
</script>

<Meta title="Team - Fable" {description} />

<section class="relative">
	<div
		class="pointer-events-none absolute -top-50 left-1/2 -z-10 h-150 w-250 -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
		style="background: radial-gradient(closest-side, rgba(237,24,37,0.30), transparent)"
	></div>

	<div class="relative mx-auto max-w-275 px-6 pt-20 pb-16 text-center">
		<p class="text-sm font-semibold">Team</p>
		<h1 class="mt-2 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
			The people behind Fable.
		</h1>
		<p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">
			{description}
		</p>
	</div>
</section>

<section class="mx-auto flex max-w-275 flex-col gap-14 px-6 pb-28">
	{#if !data.groups.length}
		<div class="rounded-xl border border-line bg-surface p-8 text-center">
			<h2 class="text-xl font-semibold">Meet us in Discord.</h2>
			<p class="mt-3 text-muted">
				Talk with the Fable team, get support, and help shape what comes next.
			</p>
			<a
				href="https://discord.gg/fablebot"
				class="mt-6 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-white hover:bg-brand/85"
				>Join the community</a
			>
		</div>
	{/if}
	{#each data.groups as group (group.role)}
		<div>
			<h2 class="text-center text-sm font-semibold tracking-wider text-muted uppercase">
				{group.role}
			</h2>

			<div class="mt-6 flex flex-wrap justify-center gap-4">
				{#each group.members as member (member.id)}
					<div class="w-48 rounded-xl border border-line bg-surface p-5 text-center">
						<img
							src={member.avatarUrl}
							alt=""
							loading="lazy"
							class="mx-auto h-16 w-16 rounded-full bg-white/5"
							onerror={(event) => {
								const image = event.currentTarget as HTMLImageElement;
								if (image.src !== fallbackAvatar) image.src = fallbackAvatar;
							}}
						/>
						<p class="mt-3 truncate text-sm font-semibold">{member.username}</p>
						<p class="mt-1 text-xs text-muted">{group.role}</p>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</section>

<Footer />
