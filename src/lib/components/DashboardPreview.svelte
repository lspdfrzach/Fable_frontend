<script lang="ts">
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Clock from '@lucide/svelte/icons/clock';
	import Users from '@lucide/svelte/icons/users';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';

	const { title = 'Community overview' }: { title?: string } = $props();
	const navigation = [
		{ icon: LayoutDashboard, label: 'Overview' },
		{ icon: ShieldCheck, label: 'Moderation' },
		{ icon: Clock, label: 'Shifts' },
		{ icon: Users, label: 'Staff' },
		{ icon: ClipboardList, label: 'Applications' }
	];
	const rows = [
		{ name: 'Alex', action: 'Started a staff shift', time: 'Just now', color: 'bg-emerald-400' },
		{ name: 'Jordan', action: 'Reviewed an application', time: '2m ago', color: 'bg-brand' },
		{ name: 'Sam', action: 'Logged a moderation', time: '5m ago', color: 'bg-blue-400' }
	];
</script>

<div
	class="overflow-hidden rounded-xl border border-white/10 bg-[#141216] text-[#fff4f5] shadow-2xl shadow-black/40"
>
	<div class="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
		<div class="flex items-center gap-2.5">
			<img src="/branding/fable-mark.svg" alt="" class="h-6 w-6" /><span class="text-base font-bold"
				>Fable</span
			><span class="ml-2 hidden border-l border-white/10 pl-3 text-xs text-[#a79ca6] sm:inline"
				>Your community</span
			>
		</div>
		<span
			class="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#a79ca6] uppercase"
			>Interface preview</span
		>
	</div>
	<div class="flex">
		<div class="hidden w-40 shrink-0 space-y-1 border-r border-white/8 p-3 sm:block">
			{#each navigation as item, i (item.label)}
				<div
					class="flex items-center gap-2 rounded-md px-3 py-2.5 text-xs {i === 0
						? 'bg-brand/12 text-[#ff6972]'
						: 'text-[#a79ca6]'}"
				>
					<item.icon class="h-3.5 w-3.5" />{item.label}
				</div>
			{/each}
		</div>
		<div class="min-w-0 flex-1 p-5 sm:p-6">
			<p class="text-[10px] font-medium tracking-widest text-[#a79ca6] uppercase">Workspace</p>
			<h2 class="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
			<p class="mt-1 text-xs text-[#a79ca6]">Everything your team needs, in one place.</p>
			<div class="mt-6 grid grid-cols-3 gap-2.5">
				{#each [{ name: 'On duty', value: '08', trend: 'Staff members' }, { name: 'Moderations', value: '24', trend: 'This week' }, { name: 'Applications', value: '06', trend: 'Awaiting review' }] as stat (stat.name)}
					<div class="rounded-lg border border-white/8 bg-white/3 p-3">
						<p class="text-[10px] text-[#a79ca6]">{stat.name}</p>
						<p class="mt-2 text-2xl font-semibold">{stat.value}</p>
						<p class="mt-2 text-[9px] text-[#a79ca6]">{stat.trend}</p>
					</div>
				{/each}
			</div>
			<div class="mt-5 rounded-lg border border-white/8">
				<p class="border-b border-white/8 px-4 py-3 text-xs font-semibold">Recent activity</p>
				{#each rows as row (row.name)}
					<div class="flex items-center gap-3 px-4 py-3">
						<span class="h-1.5 w-1.5 shrink-0 rounded-full {row.color}"></span>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium">{row.name}</p>
							<p class="mt-0.5 truncate text-[10px] text-[#a79ca6]">{row.action}</p>
						</div>
						<span class="text-[9px] text-[#a79ca6]">{row.time}</span>
					</div>
				{/each}
			</div>
			<p class="mt-4 text-[10px] text-[#a79ca6]">
				Sample data. Your server's activity appears after you connect.
			</p>
		</div>
	</div>
</div>
