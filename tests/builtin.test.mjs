import assert from 'node:assert/strict';
import test from 'node:test';
import { Long } from 'mongodb';
import {
	BuiltinBackend,
	hashToken,
	permissionLevel,
	settingsPatch,
	wire
} from '../src/lib/server/builtin-core.ts';

const guildId = '123456789012345678';
const userId = '223456789012345678';
const roleId = '323456789012345678';
const channelId = '423456789012345678';
const clientId = '523456789012345678';
const token = 'a'.repeat(64);
const config = {
	origin: 'https://fable.example',
	clientId,
	clientSecret: 'test-client-secret',
	botToken: 'test-bot-token',
	sessionCookie: 'fableAuthToken'
};

function matches(document, query) {
	return Object.entries(query).every(([key, expected]) => {
		const value = document[key];
		if (expected && typeof expected === 'object' && !Long.isLong(expected)) {
			if ('$gt' in expected) return value > expected.$gt;
			if ('$in' in expected) return expected.$in.some((item) => String(item) === String(value));
		}
		return String(value) === String(expected);
	});
}

function fakeDatabase() {
	const collections = new Map();
	const db = {
		databaseName: 'erm',
		client: { db: () => db },
		collection(name) {
			if (collections.has(name)) return collections.get(name);
			const data = [];
			const collection = {
				data,
				async insertOne(document) {
					data.push(document);
					return { insertedId: document._id };
				},
				async findOne(query) {
					return data.find((entry) => matches(entry, query)) ?? null;
				},
				async findOneAndDelete(query) {
					const index = data.findIndex((entry) => matches(entry, query));
					return index < 0 ? null : data.splice(index, 1)[0];
				},
				async deleteOne(query) {
					const index = data.findIndex((entry) => matches(entry, query));
					if (index >= 0) data.splice(index, 1);
					return { deletedCount: index >= 0 ? 1 : 0 };
				},
				find(query) {
					const cursor = {
						project: () => cursor,
						toArray: async () => data.filter((entry) => matches(entry, query))
					};
					return cursor;
				},
				async updateOne(query, update, options = {}) {
					let document = data.find((entry) => matches(entry, query));
					const found = Boolean(document);
					if (!document && options.upsert) {
						document = { ...query };
						data.push(document);
					}
					if (!document) return { matchedCount: 0 };
					for (const [path, value] of Object.entries(update.$set ?? {})) {
						const parts = path.split('.');
						let parent = document;
						for (const part of parts.slice(0, -1)) parent = parent[part] ??= {};
						parent[parts.at(-1)] = value;
					}
					for (const [key, value] of Object.entries(update.$addToSet ?? {}))
						document[key] = [...new Set([...(document[key] ?? []), value])];
					for (const [key, value] of Object.entries(update.$pull ?? {}))
						document[key] = (document[key] ?? []).filter((item) => item !== value);
					return { matchedCount: found ? 1 : 0 };
				}
			};
			collections.set(name, collection);
			return collection;
		}
	};
	return db;
}

async function fixture() {
	const db = fakeDatabase();
	const state = { member: true, roles: [roleId], discordCalls: 0, oauthCalls: 0 };
	const roles = [
		{ id: guildId, name: '@everyone', permissions: '0', color: 0, position: 0, managed: false },
		{ id: roleId, name: 'Management', permissions: '0', color: 0, position: 1, managed: false }
	];
	const request = async (url, options) => {
		state.discordCalls++;
		const path = new URL(url).pathname.replace('/api/v10', '');
		if (path === '/oauth2/token') {
			state.oauthCalls++;
			return Response.json({
				access_token: 'test-user-access',
				refresh_token: 'test-user-refresh',
				expires_in: 604800
			});
		}
		if (path === '/users/@me')
			return Response.json(
				options.headers.Authorization.startsWith('Bot')
					? { id: clientId, username: 'Fable' }
					: { id: userId, username: 'Tester', avatar: '' }
			);
		if (path === '/users/@me/guilds') return Response.json([{ id: guildId, name: 'Test Guild' }]);
		if (path === `/guilds/${guildId}`)
			return Response.json({ id: guildId, name: 'Test Guild', owner_id: '623456789012345678' });
		if (path === `/guilds/${guildId}/members/${userId}`)
			return state.member
				? Response.json({ user: { id: userId }, roles: state.roles })
				: Response.json({}, { status: 404 });
		if (path === `/guilds/${guildId}/roles`) return Response.json(roles);
		if (path === `/guilds/${guildId}/channels`)
			return Response.json([{ id: channelId, name: 'logs', type: 0, position: 1 }]);
		return Response.json({}, { status: 404 });
	};
	const backend = new BuiltinBackend(config, async () => db, request);
	await db.collection('settings').insertOne({
		_id: Long.fromString(guildId),
		staff_management: { management_role: [Long.fromString(roleId)], role: [] },
		customisation: { prefix: '>' },
		shift_management: { enabled: true, quota: 60 },
		server_secret: 'must-not-be-returned'
	});
	await db.collection('website_sessions').insertOne({
		_id: hashToken(token),
		user: { ID: userId, DiscordID: userId, Username: 'Tester', Avatar: '' },
		oauth: backend.seal({
			access_token: 'test-user-access',
			refresh_token: 'test-user-refresh',
			expires_in: 604800,
			expiresAt: Date.now() + 604800000
		}),
		expiresAt: new Date(Date.now() + 86400000)
	});
	const call = (path, method = 'GET', body, headers = {}) =>
		backend.handle(
			new Request(`${config.origin}/api/fable${path}`, {
				method,
				headers: { Authorization: token, ...headers },
				...(body === undefined ? {} : { body: JSON.stringify(body) })
			})
		);
	return { backend, db, state, call, roles };
}

test('sessions require an opaque Authorization token, never cookies or a bot token', async () => {
	const { call } = await fixture();
	assert.equal((await call('/Users/Session')).status, 200);
	assert.equal(
		(
			await call('/Users/Session', 'GET', undefined, {
				Authorization: '',
				Cookie: `fableAuthToken=${token}`
			})
		).status,
		401
	);
	assert.equal(
		(await call('/Users/Session', 'GET', undefined, { Authorization: config.botToken })).status,
		401
	);
});

test('expired and terminated sessions fail closed; logout revokes immediately', async () => {
	const { call, db } = await fixture();
	db.collection('website_sessions').data[0].expiresAt = new Date(0);
	assert.equal((await call('/Users/Session')).status, 401);
	db.collection('website_sessions').data[0].expiresAt = new Date(Date.now() + 100000);
	await db.collection('BlacklistedUsers').insertOne({ discordID: userId, from: 'account' });
	const denied = await call('/Users/Session');
	assert.equal(denied.status, 403);
	assert.equal((await denied.json()).Terminated, true);
	db.collection('BlacklistedUsers').data.length = 0;
	assert.equal((await call('/Auth/Logout', 'POST')).status, 200);
	assert.equal((await call('/Users/Session')).status, 401);
});

test('OAuth binds state to the browser, expires it, and rejects replay', async () => {
	const { backend, db, state } = await fixture();
	const login = await backend.beginLogin();
	assert.equal(new URL(login.url).searchParams.get('scope'), 'identify guilds');
	const callback = (cookie, value = login.state) =>
		new Request(`${config.origin}/api/fable/Auth/Callback?code=code&state=${value}`, {
			headers: { Cookie: cookie }
		});
	assert.equal((await backend.handle(callback(''))).status, 400);
	assert.equal(state.oauthCalls, 0);
	const response = await backend.handle(
		callback(`fableOAuthState=${login.state}; fableAuthReturn=%2F%2Fevil.example`)
	);
	assert.equal(response.status, 303);
	assert.equal(response.headers.get('location'), '/guilds');
	assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
	assert.match(response.headers.get('set-cookie'), /Secure/);
	const issued = response.headers.get('set-cookie').match(/fableAuthToken=([a-f0-9]+)/)[1];
	assert.equal(db.collection('website_sessions').data.at(-1)._id, hashToken(issued));
	assert.doesNotMatch(
		JSON.stringify(db.collection('website_sessions').data),
		/test-user-access|test-user-refresh/
	);
	assert.equal((await backend.handle(callback(`fableOAuthState=${login.state}`))).status, 400);
	const expired = await backend.beginLogin();
	db.collection('website_oauth_states').data.at(-1).expiresAt = new Date(0);
	assert.equal(
		(await backend.handle(callback(`fableOAuthState=${expired.state}`, expired.state))).status,
		400
	);
	assert.equal(state.oauthCalls, 1);
});

test('guild authorization is checked again after membership or role removal', async () => {
	const { call, state } = await fixture();
	assert.equal((await call(`/${guildId}/GetServerSettings`)).status, 200);
	state.roles = [];
	assert.equal(
		(await call(`/${guildId}/SaveServerSettings`, 'PATCH', { customisation: { prefix: '?' } }))
			.status,
		403
	);
	state.roles = [roleId];
	state.member = false;
	assert.equal((await call(`/${guildId}/GetServerSettings`)).status, 403);
	assert.equal((await call('/723456789012345678/GetServerSettings')).status, 403);
});

test('settings merge atomically and preserve int64 snowflakes and unrelated bot fields', async () => {
	const { call, db } = await fixture();
	const saved = await call(`/${guildId}/SaveServerSettings`, 'PATCH', {
		erm_log_channel: channelId,
		customisation: { prefix: '!' },
		staff_management: { role: [roleId] }
	});
	assert.equal(saved.status, 200);
	const raw = db.collection('settings').data[0];
	assert.equal(raw.staff_management.role[0].toString(), roleId);
	assert.equal(raw.staff_management.management_role[0].toString(), roleId);
	assert.equal(raw.shift_management.quota, 60);
	assert.equal(raw.server_secret, 'must-not-be-returned');
	const result = await (await call(`/${guildId}/GetServerSettings`)).json();
	assert.equal(result.erm_log_channel, channelId);
	assert.equal(result.server_secret, undefined);
	assert.deepEqual(db.collection('website_audit').data[0].fields, [
		'erm_log_channel',
		'customisation.prefix',
		'staff_management.role'
	]);
});

test('settings reject foreign Discord IDs, operator injection, unknown keys, and unsafe numbers', async () => {
	const { call } = await fixture();
	for (const body of [
		{ erm_log_channel: '999999999999999999' },
		{ staff_management: { role: [Number(roleId)] } },
		{ 'staff_management.management_role': [roleId] },
		{ $set: { customisation: { prefix: '!' } } },
		{ _id: '999999999999999999' },
		{ shift_management: { quota: -1 } },
		{ shift_management: { enabled: 'false' } },
		JSON.parse('{"customisation":{"__proto__":{"polluted":true}}}')
	])
		assert.equal((await call(`/${guildId}/SaveServerSettings`, 'PATCH', body)).status, 400);
	assert.equal({}.polluted, undefined);
});

test('owner and Discord management permissions match the bot roles', () => {
	const guild = { id: guildId, owner_id: userId, name: 'Test' };
	const member = { user: { id: userId }, roles: [roleId] };
	assert.equal(permissionLevel(userId, guild, member, [], {}), 3);
	guild.owner_id = 'other';
	assert.equal(permissionLevel(userId, guild, member, [{ id: roleId, permissions: '32' }], {}), 3);
	assert.equal(
		permissionLevel(userId, guild, member, [], {
			staff_management: { management_role: Long.fromString(roleId) }
		}),
		3
	);
	assert.equal(
		permissionLevel(userId, guild, member, [], {
			staff_management: { admin_role: [Long.fromString(roleId)] }
		}),
		2
	);
	assert.equal(permissionLevel(userId, guild, member, [], {}), 0);
	assert.equal(permissionLevel('other', guild, member, [], {}), 0);
});

test('guild discovery includes only configured, authorized servers and records pins', async () => {
	const { call, state } = await fixture();
	assert.equal((await (await call('/Users/Guilds')).json()).Guilds[0].ID, guildId);
	assert.equal((await (await call(`/Users/PinGuild/${guildId}`, 'POST')).json()).pinned, true);
	assert.equal((await (await call('/Users/ForceGuilds')).json()).Guilds[0].Pinned, true);
	state.roles = [];
	assert.deepEqual((await (await call('/Users/Guilds')).json()).Guilds, []);
});

test('documentation CRUD uses the frontend response contract and is guild scoped', async () => {
	const { call } = await fixture();
	const response = await call(`/${guildId}/CreateDocumentationType`, 'POST', {
		name: 'Handbook',
		url: 'https://docs.google.com/document/d/example',
		punishmentLevel: 1
	});
	assert.equal(response.status, 200);
	const { documentation_type: item } = await response.json();
	assert.match(item.id, /^[a-f0-9]{24}$/);
	assert.equal(
		(await (await call(`/${guildId}/GetDocumentationTypes`)).json()).documentation_types.length,
		1
	);
	assert.equal(
		(await call(`/${guildId}/${item.id}/DeleteDocumentationType`, 'DELETE')).status,
		200
	);
	assert.equal(
		(
			await call(`/${guildId}/CreateDocumentationType`, 'POST', {
				name: 'Handbook',
				url: 'http://127.0.0.1',
				punishmentLevel: 1
			})
		).status,
		400
	);
});

test('unsupported operational endpoints fail explicitly', async () => {
	const { call } = await fixture();
	assert.equal((await call(`/${guildId}/ForceStartShift/${userId}`, 'POST', {})).status, 501);
	assert.equal((await call('/Status/GetShards')).status, 501);
	assert.equal((await call('/Auth/Discord')).status, 501);
});

test('BSON conversion preserves exact IDs and validates nested shift role references', () => {
	const patch = settingsPatch(
		{ shift_types: { types: [{ id: 1, name: 'Patrol', role: [roleId], channel: channelId }] } },
		new Set([roleId]),
		new Set([channelId])
	);
	assert.equal(patch['shift_types.types'][0].role[0].toString(), roleId);
	assert.equal(wire(patch)['shift_types.types'][0].role[0], roleId);
});
