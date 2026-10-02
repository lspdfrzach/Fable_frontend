<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Bot from '@lucide/svelte/icons/bot';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Clock from '@lucide/svelte/icons/clock';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Palette from '@lucide/svelte/icons/palette';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { reveal } from '$lib/actions/reveal';
	import { utm } from '$lib/utm';
	import DashboardPreview from '$lib/components/DashboardPreview.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Meta from '$lib/components/Meta.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const affiliates = $derived(data.affiliates);

	let active = $state(0);
	let slide = $state(0);

	const current = $derived(affiliates[active]);

	function select(index: number) {
		active = index;
		slide = 0;
	}

	$effect(() => {
		const count = affiliates[active]?.images.length ?? 0;
		if (count < 2) return;
		if (prefersReducedMotion.current) return;

		const timer = setInterval(() => {
			slide = (slide + 1) % count;
		}, 10000);

		return () => clearInterval(timer);
	});

	const stats = [
		{ value: 'Staff', label: 'Keep your team organized' },
		{ value: 'Shifts', label: 'Make every hour count' },
		{ value: 'Sessions', label: 'Bring your server together' }
	];

	const features = [
		{
			title: 'Moderator Panel',
			slug: 'moderator-panel',
			body: 'Moderate efficiently with an all-in-one panel.',
			span: 'md:col-span-1',
			icon: ShieldCheck
		},
		{
			title: 'Copilot',
			slug: 'copilot',
			body: 'Moderate with your voice with our accurate voice assistant.',
			span: 'md:col-span-2',
			icon: Bot
		},
		{
			title: 'Applications',
			slug: 'applications',
			body: 'Create applications and collect responses with ease.',
			span: 'md:col-span-2',
			icon: ClipboardList
		},
		{
			title: 'Dashboard',
			slug: 'dashboard',
			body: 'Set up your server in minutes with our easy-to-use dashboard.',
			span: 'md:col-span-1',
			icon: LayoutDashboard
		},
		{
			title: 'Shift Management',
			slug: 'shift-management',
			body: 'Track staff hours, breaks, and quotas without lifting a finger.',
			span: 'md:col-span-1',
			icon: Clock
		},
		{
			title: 'Whitelabel',
			slug: 'whitelabel',
			body: 'Customize Fable to match your server branding with our whitelabel feature.',
			span: 'md:col-span-2',
			icon: Palette
		}
	];
</script>

<Meta
	title="Fable - Your community's next chapter"
	description="Fable gives roleplay communities the tools to manage staff, sessions, moderation, shifts, logs, and server activity from one clean dashboard."
/>

<section class="relative overflow-hidden">
	<div
		class="pointer-events-none absolute -top-40 right-0 h-175 w-225 rounded-full opacity-60"
		style="background: radial-gradient(closest-side, rgba(237,24,37,0.30), rgba(237,24,37,0.10) 55%, transparent)"
	></div>

	<div
		class="relative mx-auto grid max-w-350 items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-24"
	>
		<div>
			<p class="mb-6 text-xs font-semibold tracking-[0.2em] text-brand">
				FABLE · COMMUNITY MANAGEMENT
			</p>
			<h1 class="text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl xl:text-6xl">
				Your community.<br />
				<span class="bg-linear-to-r from-[#ff6972] to-brand bg-clip-text text-transparent">
					Its next chapter.
				</span>
			</h1>

			<p class="mt-7 max-w-lg text-lg leading-relaxed text-muted">
				Fable gives roleplay communities the tools to manage staff, sessions, moderations, shifts,
				logs, and server activity from one clean dashboard.
			</p>

			<div class="mt-10 flex flex-wrap justify-center gap-3 sm:justify-start">
				<a
					href={utm(resolve('/invite'), 'hero') as ResolvedPathname}
					data-sveltekit-reload
					class="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand/85"
				>
					Invite Fable
				</a>
				<a
					href={resolve('/guilds')}
					class="rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/8"
				>
					View Dashboard
				</a>
			</div>

			<dl class="mt-16 flex flex-wrap gap-x-8 gap-y-6 sm:gap-12">
				{#each stats as stat (stat.label)}
					<div>
						<dt class="text-3xl font-bold tracking-tight">{stat.value}</dt>
						<dd class="mt-1 text-sm text-muted">{stat.label}</dd>
					</div>
				{/each}
			</dl>
		</div>

		<div class="relative perspective-[2400px]">
			<div class="hero-frame max-w-160 shadow-2xl shadow-black/60 lg:ml-auto">
				<svg class="hero-beam" aria-hidden="true">
					<rect x="0" y="0" width="100%" height="100%" rx="12" pathLength="100" />
				</svg>

				<div class="hero-frame-inner">
					<DashboardPreview />
				</div>
			</div>
		</div>
	</div>
</section>

<section id="features" class="mx-auto max-w-275 overflow-x-clip px-6 pb-32">
	<div class="text-center" use:reveal>
		<p class="text-sm font-semibold">Features</p>
		<h2 class="mt-2 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
			Less busywork. More community.
		</h2>
		<p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">
			The tools behind a well-run community, brought together. Explore the dashboard, organize your
			staff, and keep your next session moving.
		</p>
	</div>

	<div class="mt-14 grid gap-4 md:grid-cols-3">
		{#each features as feature, i (feature.title)}
			<a
				id={feature.title.toLowerCase().replace(' ', '-')}
				href={resolve('/features/[slug]', { slug: feature.slug })}
				use:reveal={{ delay: (i % 2) * 120, from: i % 2 === 0 ? 'left' : 'right' }}
				class="group relative block min-h-57.5 overflow-hidden rounded-xl border border-line transition-colors hover:border-white/25 {feature.span}"
			>
				<feature.icon
					aria-hidden="true"
					strokeWidth={0.9}
					class="pointer-events-none absolute top-6 right-6 h-28 w-28 text-white/10 transition-colors duration-500 group-hover:text-white/20"
				/>
				<div class="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-transparent"></div>

				<div class="relative flex h-full flex-col justify-end p-6">
					<feature.icon class="mb-4 h-7 w-7" strokeWidth={1.6} />
					<h3 class="font-semibold">{feature.title}</h3>
					<p class="mt-1 max-w-sm text-sm text-muted">{feature.body}</p>

					<div
						class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out"
					>
						<div class="overflow-hidden">
							<span
								class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-opacity motion-safe:duration-300"
							>
								Learn more
								<ArrowRight
									class="h-4 w-4 group-hover:translate-x-0.5 motion-safe:transition-transform"
								/>
							</span>
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</section>

{#if affiliates.length}
	<section class="mx-auto max-w-275 px-6 pb-32">
		<div class="text-center" use:reveal>
			<p class="text-sm font-semibold">Affiliates</p>
			<h2 class="mt-2 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
				Built around communities like yours.
			</h2>
			<p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance text-muted">
				Meet the communities building their next chapter with Fable.
			</p>
		</div>

		<div class="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-14">
			<div use:reveal={{ from: 'left' }} class="flex flex-col gap-3">
				<div class="flex flex-col gap-3" role="tablist">
					{#each affiliates as affiliate, i (affiliate.id)}
						<button
							type="button"
							role="tab"
							aria-selected={active === i}
							aria-controls="affiliate-panel"
							onclick={() => select(i)}
							style={active === i && affiliate.color
								? `border-left-color: ${affiliate.color}`
								: null}
							class="flex items-center gap-4 rounded-xl border border-l-2 p-5 text-left transition-colors {active ===
							i
								? 'border-line border-l-white bg-surface'
								: 'border-transparent border-l-line hover:bg-white/4'}"
						>
							{#if affiliate.logo}
								<img
									src={affiliate.logo}
									alt=""
									class="h-10 w-10 shrink-0 rounded-full ring-1 ring-white/15"
									width="40"
									height="40"
								/>
							{/if}
							<span class="min-w-0">
								<span class="block font-semibold">{affiliate.name}</span>
								<span class="mt-0.5 block text-sm text-balance text-muted">{affiliate.slogan}</span>
							</span>
						</button>
					{/each}
				</div>

				<a
					href={current.invite as ResolvedPathname}
					target="_blank"
					rel="noreferrer"
					class="group mt-2 inline-flex items-center gap-2 self-start text-sm font-semibold text-muted transition-colors hover:text-white"
				>
					Visit {current.name}
					<ArrowRight
						class="h-4 w-4 group-hover:translate-x-0.5 motion-safe:transition-transform"
					/>
				</a>
			</div>

			<div
				id="affiliate-panel"
				role="tabpanel"
				use:reveal={{ from: 'right' }}
				class="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/60"
			>
				{#key active}
					<div
						class="absolute inset-1.5 overflow-hidden rounded-lg"
						in:fade={{ duration: prefersReducedMotion.current ? 0 : 450 }}
					>
						{#each current.images as image, i (image)}
							<img
								src={image}
								alt="{current.name} using Fable"
								loading="lazy"
								decoding="async"
								class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 {slide ===
								i
									? 'opacity-100'
									: 'opacity-0'}"
							/>
						{/each}

						<div
							class="absolute inset-0 bg-linear-to-t from-black/90 via-black/60 to-transparent"
						></div>

						{#if current.testimony}
							<blockquote
								class="absolute inset-x-0 bottom-0 max-w-lg p-6 text-xs leading-relaxed sm:text-sm"
							>
								&ldquo;{current.testimony}&rdquo;
							</blockquote>
						{/if}
					</div>
				{/key}
			</div>
		</div>
	</section>
{/if}

<Footer />
