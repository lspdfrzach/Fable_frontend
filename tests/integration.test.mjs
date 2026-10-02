import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const processes = [];
const folders = [];
const requests = [];
let backend;
let publicSite;
let connectedSite;
let partialCaptchaSite;
let affiliateSite;
const guildId = '123456789012345678';
const applicationId = '123456789012345679';

async function listen(server) {
	await new Promise((done) => server.listen(0, '127.0.0.1', done));
	return server.address().port;
}

async function start(extra = {}) {
	const reservation = createServer();
	const port = await listen(reservation);
	await new Promise((done) => reservation.close(done));
	const origin = `http://127.0.0.1:${port}`;
	const cwd = await mkdtemp(join(tmpdir(), 'fable-test-'));
	folders.push(cwd);
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (
			/^(FABLE_|VITE_|PUBLIC_|TURNSTILE_|BACKEND_|DISCORD_|UMAMI_|ROBLOX_|SERVICE_STATUS_|DESKTOP_DOWNLOAD_|WEATHER_PROXY_|ENVIRONMENT$)/.test(
				key
			)
		)
			delete env[key];
	}
	const child = spawn(process.execPath, [resolve('build/index.js')], {
		cwd,
		env: { ...env, HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin, ...extra },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	processes.push(child);
	let output = '';
	child.stdout.on('data', (data) => {
		output += data;
	});
	child.stderr.on('data', (data) => {
		output += data;
	});
	for (let tries = 0; tries < 100; tries++) {
		if (child.exitCode !== null) throw new Error(output);
		try {
			const response = await fetch(`${origin}/api/health`);
			if (response.ok) return origin;
		} catch {}
		await delay(100);
	}
	throw new Error(`Frontend did not start: ${output}`);
}

before(async () => {
	backend = createServer((request, response) => {
		requests.push({ path: request.url, token: request.headers.authorization });
		response.setHeader('Content-Type', 'application/json');
		if (request.url === '/Users/Session') {
			const token = request.headers.authorization;
			if (token === 'invalid') {
				response.writeHead(401);
				return response.end('{}');
			}
			if (token === 'terminated') {
				response.writeHead(403);
				return response.end('{"Terminated":true}');
			}
			if (token === 'outage') {
				response.writeHead(503);
				return response.end('{}');
			}
			if (token === 'empty') return response.end('{}');
			return response.end(
				JSON.stringify({
					User: { ID: 'user', DiscordID: guildId, Username: 'Fable tester', Avatar: '' }
				})
			);
		}
		if (request.url === '/Users/Guilds')
			return response.end(
				JSON.stringify({
					Guilds: [{ ID: guildId, Name: 'Fable Test Community', PermissionLevel: 4 }]
				})
			);
		if (request.url === '/Users/Affiliates') return response.end('{"Affiliates":[]}');
		if (request.url === '/Users/Notifications') return response.end('{"notifications":[]}');
		if (request.url === '/Status/GetShards')
			return response.end('{"ShardPings":{"0":40},"TotalGuilds":1,"TotalUsers":1}');
		if (request.url === '/Status/GetUptimeSummary')
			return response.end('{"statusReport":{"api":{"main":{"serviceId":"api","health":"up"}}}}');
		response.writeHead(404);
		response.end('{}');
	});
	const backendPort = await listen(backend);
	publicSite = await start();
	const config = {
		FABLE_BACKEND_URL: `http://127.0.0.1:${backendPort}/`,
		FABLE_BACKEND_PUBLIC_URL: 'https://api.fable.example/',
		DISCORD_CLIENT_ID: applicationId
	};
	connectedSite = await start(config);
	partialCaptchaSite = await start({ ...config, TURNSTILE_SECRET_KEY: 'fixture-secret' });
	affiliateSite = await start({ ...config, ENVIRONMENT: 'affiliates' });
});

after(async () => {
	await Promise.all(
		processes.map(
			(child) =>
				new Promise((done) => {
					if (child.exitCode !== null) return done();
					child.once('exit', done);
					child.kill();
				})
		)
	);
	if (backend) await new Promise((done) => backend.close(done));
	await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })));
});

test('public homepage is accessible without a backend or login redirect', async () => {
	const response = await fetch(publicSite, { redirect: 'manual' });
	assert.equal(response.status, 200);
	const html = await response.text();
	assert.match(html, /Its next chapter/);
	assert.match(html, /Interface preview/);
	assert.doesNotMatch(html, /28,000\+|ermbot\.xyz|Thanks to the help of ERM/);
});

test('public feature, help, and team pages render', async () => {
	for (const path of ['/features', '/features/moderator-panel', '/docs', '/team', '/status']) {
		const response = await fetch(`${publicSite}${path}`);
		assert.equal(response.status, 200, path);
	}
});

test('missing configuration disables login and never targets the ERM bot', async () => {
	const login = await fetch(`${publicSite}/login`);
	assert.match(await login.text(), /dashboard is coming soon/);
	const response = await fetch(`${publicSite}/login`, {
		method: 'POST',
		headers: { Origin: publicSite, Accept: 'text/html' },
		body: new URLSearchParams(),
		redirect: 'manual'
	});
	assert.equal(response.headers.get('location'), null);
	assert.match(await response.text(), /The Fable dashboard is not available yet/);
	assert.doesNotMatch(response.headers.get('set-cookie') ?? '', /fableAuthToken=/);
	for (const [path, target] of [
		['/invite', '/connect?service=invite'],
		['/verify', '/connect?service=verification'],
		['/download', '/connect?service=download']
	]) {
		const result = await fetch(`${publicSite}${path}`, { redirect: 'manual' });
		assert.equal(result.headers.get('location'), target);
	}
});

test('Discord invite identifies Fable and requests slash command scope', async () => {
	const response = await fetch(`${connectedSite}/invite?guild_id=${guildId}`, {
		redirect: 'manual'
	});
	const url = new URL(response.headers.get('location'));
	assert.equal(url.origin, 'https://discord.com');
	assert.equal(url.searchParams.get('client_id'), applicationId);
	assert.equal(url.searchParams.get('guild_id'), guildId);
	assert.equal(url.searchParams.get('scope'), 'bot applications.commands');
	assert.equal(url.searchParams.has('response_type'), false);
});

test('login uses public OAuth URL and rejects external return targets', async () => {
	const response = await fetch(`${connectedSite}/login`, {
		method: 'POST',
		headers: { Origin: connectedSite, Accept: 'text/html' },
		body: new URLSearchParams({ returnTo: '//evil.example' }),
		redirect: 'manual'
	});
	assert.equal(response.status, 303);
	assert.equal(response.headers.get('location'), 'https://api.fable.example/Auth/Discord');
	assert.match(response.headers.get('set-cookie'), /fableAuthReturn=%2Fguilds/);
});

test('half-configured CAPTCHA fails closed', async () => {
	const response = await fetch(`${partialCaptchaSite}/login`, {
		method: 'POST',
		headers: { Origin: partialCaptchaSite, Accept: 'text/html' },
		body: new URLSearchParams(),
		redirect: 'manual'
	});
	assert.equal(response.headers.get('location'), null);
	assert.match(await response.text(), /The Fable dashboard is not available yet/);
	assert.doesNotMatch(response.headers.get('set-cookie') ?? '', /fableAuthToken=/);
	assert.equal(response.headers.get('location'), null);
});

test('invalid, terminated, empty, and unreachable sessions cannot set a login cookie', async () => {
	for (const token of ['invalid', 'terminated', 'empty', 'outage']) {
		const response = await fetch(`${connectedSite}/auth?token=${token}`, { redirect: 'manual' });
		assert.equal(response.headers.get('location'), '/login?error=login', token);
		assert.doesNotMatch(response.headers.get('set-cookie') ?? '', /fableAuthToken=/, token);
	}
	const unconfigured = await fetch(`${publicSite}/auth?token=anything`, { redirect: 'manual' });
	assert.doesNotMatch(unconfigured.headers.get('set-cookie') ?? '', /fableAuthToken=/);
});

test('validated sessions are stored in a private Fable cookie and forwarded to the backend', async () => {
	const response = await fetch(`${connectedSite}/auth?token=valid`, { redirect: 'manual' });
	const cookies = response.headers.getSetCookie();
	const sessionCookie = cookies.find((cookie) => cookie.startsWith('fableAuthToken=valid;'));
	assert.ok(sessionCookie);
	assert.match(sessionCookie, /HttpOnly/);
	assert.match(sessionCookie, /SameSite=Lax/i);
	assert.equal(response.headers.get('location'), '/guilds?login=success');
	const list = await fetch(`${connectedSite}/api/guilds`, {
		headers: { Cookie: 'fableAuthToken=valid' }
	});
	assert.equal(list.status, 200);
	assert.equal((await list.json())[0].name, 'Fable Test Community');
	assert.ok(
		requests.some((request) => request.path === '/Users/Guilds' && request.token === 'valid')
	);
});

test('explicit affiliates mode still restricts server discovery', async () => {
	const response = await fetch(`${affiliateSite}/api/guilds`, {
		headers: { Cookie: 'fableAuthToken=affiliate-fixture' }
	});
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), []);
});

test('protected server discovery requires a session', async () => {
	const response = await fetch(`${connectedSite}/api/guilds`);
	assert.equal(response.status, 401);
});

test('one healthy shard is operational for a small Fable deployment', async () => {
	const response = await fetch(`${connectedSite}/status`);
	assert.match(await response.text(), /"operational"/);
});

test('frontend health distinguishes missing dashboard configuration', async () => {
	assert.equal((await (await fetch(`${publicSite}/api/health`)).json()).dashboardConfigured, false);
	assert.equal(
		(await (await fetch(`${connectedSite}/api/health`)).json()).dashboardConfigured,
		true
	);
});

test('built-in mode fails closed when its credentials are missing', async () => {
	const site = await start({ FABLE_BACKEND_MODE: 'builtin' });
	const health = await (await fetch(`${site}/api/health`)).json();
	assert.equal(health.dashboardConfigured, false);
	assert.equal((await fetch(`${site}/api/fable/Users/Session`)).status, 503);
	const callback = await fetch(`${site}/auth?token=valid`, { redirect: 'manual' });
	assert.equal(callback.status, 303);
	assert.equal(callback.headers.get('location'), '/login?error=login');
	assert.equal(callback.headers.get('set-cookie'), null);
});

test('built-in mode gates unsupported operations in the dashboard', async () => {
	const site = await start({ FABLE_BACKEND_MODE: 'builtin' });
	const response = await fetch(`${site}/${guildId}/dashboard/applications`, { redirect: 'manual' });
	assert.equal(response.status, 501);
	assert.match(await response.text(), /supports basic settings/);
});
