import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	timingSafeEqual
} from 'node:crypto';
import { Long, type Db, type Document } from 'mongodb';

export interface BuiltinConfig {
	origin: string;
	clientId: string;
	clientSecret: string;
	botToken: string;
	sessionCookie: string;
}

interface User {
	ID: string;
	DiscordID: string;
	Username: string;
	Avatar: string;
}

interface Session extends Document {
	_id: string;
	user: User;
	oauth: string;
	expiresAt: Date;
}

interface State extends Document {
	_id: string;
	expiresAt: Date;
}

interface Profile {
	_id: string;
	pins?: string[];
	preferences?: Record<string, boolean>;
}

interface Settings extends Document {
	_id: Long;
}

interface DiscordGuild {
	id: string;
	name: string;
	icon?: string;
	banner?: string;
	owner_id?: string;
}

interface DiscordRole {
	id: string;
	name: string;
	permissions: string;
	color: number;
	position: number;
	managed: boolean;
}

interface DiscordMember {
	user: { id: string };
	roles: string[];
}

interface OAuth {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	expiresAt: number;
}

class BackendError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const snowflake = /^\d{17,20}$/;
const nonce = /^[a-f0-9]{64}$/;
const duration = 30 * 24 * 60 * 60;
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const preferenceKeys = new Set([
	'ModView',
	'ShiftView',
	'StaffView',
	'ERLCView',
	'LogView',
	'AutomaticShifts',
	'ShiftReports',
	'Punishments',
	'AIPredictions',
	'CompactMode'
]);

export function hashToken(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function equal(a: string, b: string): boolean {
	return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new BackendError(400, 'Expected an object.');
	return value as Record<string, unknown>;
}

export function wire(value: unknown): unknown {
	if (Long.isLong(value)) return value.toString();
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(wire);
	if (value && typeof value === 'object')
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wire(item)]));
	return value;
}

export function permissionLevel(
	userId: string,
	guild: DiscordGuild,
	member: DiscordMember,
	roles: DiscordRole[],
	settings: Record<string, unknown>
): number {
	if (member.user.id !== userId) return 0;
	if (guild.owner_id === userId) return 3;
	const memberRoles = new Set([guild.id, ...member.roles]);
	const permissions = roles
		.filter((role) => memberRoles.has(role.id))
		.reduce((result, role) => result | BigInt(role.permissions), 0n);
	if (permissions & (8n | 32n)) return 3;
	const staff = (settings.staff_management ?? {}) as Record<string, unknown>;
	for (const [key, level] of [
		['management_role', 3],
		['admin_role', 2],
		['role', 1]
	] as const) {
		const configured = Array.isArray(staff[key]) ? staff[key] : [staff[key]];
		if (configured.some((id) => id != null && memberRoles.has(String(id)))) return level;
	}
	return 0;
}

type Field = 'bool' | 'number' | 'text' | 'role' | 'channel' | { [key: string]: Field } | [Field];
const escalation: Field = {
	enabled: 'bool',
	threshold: 'number',
	window: 'number',
	action: 'text',
	duration: 'number'
};
const shift: Field = { mode: 'text', grace: 'number', break_off_duty: 'bool' };
const antiPingRule: Field = {
	id: 'text',
	name: 'text',
	enabled: 'bool',
	role: ['role'],
	bypass_role: ['role'],
	ignored_channels: ['channel'],
	log_channel: 'channel',
	use_hierarchy: 'bool',
	escalation,
	shift
};
const schema: Record<string, Field> = {
	erm_log_channel: 'channel',
	support_pin: 'text',
	customisation: { prefix: 'text' },
	staff_management: { role: ['role'], management_role: ['role'], admin_role: ['role'] },
	antiping: {
		enabled: 'bool',
		role: ['role'],
		bypass_role: ['role'],
		use_hierarchy: 'bool',
		ignored_channels: ['channel'],
		log_channel: 'channel',
		escalation,
		shift,
		rules: [antiPingRule]
	},
	shift_management: {
		enabled: 'bool',
		channel: 'channel',
		role: ['role'],
		quota: 'number',
		maximum_staff: 'number',
		nickname_prefix: 'text',
		role_quotas: [{ role: 'role', quota: 'number' }]
	},
	shift_types: {
		types: [
			{
				id: 'number',
				name: 'text',
				channel: 'channel',
				nickname: 'text',
				role: ['role'],
				access_roles: ['role'],
				break_roles: ['role']
			}
		]
	}
};

export function settingsPatch(
	payload: unknown,
	roles: Set<string>,
	channels: Set<string>
): Record<string, unknown> {
	function parse(value: unknown, spec: Field, path: string): unknown {
		if (Array.isArray(spec)) {
			if (!Array.isArray(value) || value.length > 100)
				throw new BackendError(400, `Invalid ${path}.`);
			return value.map((item) => parse(item, spec[0], path));
		}
		if (typeof spec === 'object') {
			const result: Record<string, unknown> = {};
			for (const [key, item] of Object.entries(object(value))) {
				if (forbiddenKeys.has(key) || !Object.hasOwn(spec, key))
					throw new BackendError(400, `Unsupported setting: ${path}${key}.`);
				result[key] = parse(item, spec[key], `${path}${key}.`);
			}
			return result;
		}
		if (spec === 'role' || spec === 'channel') {
			if (value === '' || value === null) return null;
			if (
				typeof value !== 'string' ||
				!snowflake.test(value) ||
				BigInt(value) > 9223372036854775807n
			)
				throw new BackendError(400, `Invalid Discord ID at ${path}.`);
			if (!(spec === 'role' ? roles : channels).has(value))
				throw new BackendError(400, `Choose a ${spec} from this server.`);
			return Long.fromString(value);
		}
		if (spec === 'bool' && typeof value !== 'boolean')
			throw new BackendError(400, `Invalid ${path}.`);
		if (
			spec === 'number' &&
			(typeof value !== 'number' ||
				!Number.isSafeInteger(value) ||
				value < 0 ||
				value > 100_000_000)
		)
			throw new BackendError(400, `Invalid ${path}.`);
		if (spec === 'text' && (typeof value !== 'string' || value.length > 2000))
			throw new BackendError(400, `Invalid ${path}.`);
		return value;
	}
	const checked = parse(payload, schema, '') as Record<string, unknown>;
	const customisation = checked.customisation as Record<string, unknown> | undefined;
	if (
		customisation?.prefix !== undefined &&
		!['!', '>', '?', ':', '-'].includes(String(customisation.prefix))
	)
		throw new BackendError(400, 'That prefix is not supported.');
	if (checked.support_pin !== undefined && !/^\d{6}$/.test(String(checked.support_pin)))
		throw new BackendError(400, 'Invalid support PIN.');
	const flat: Record<string, unknown> = {};
	function flatten(value: Record<string, unknown>, prefix = '') {
		for (const [key, item] of Object.entries(value)) {
			const path = `${prefix}${key}`;
			if (item && typeof item === 'object' && !Array.isArray(item) && !Long.isLong(item))
				flatten(item as Record<string, unknown>, `${path}.`);
			else flat[path] = item;
		}
	}
	flatten(checked);
	if (!Object.keys(flat).length) throw new BackendError(400, 'No settings supplied.');
	return flat;
}

export class BuiltinBackend {
	config: BuiltinConfig;
	getDatabase: () => Promise<Db>;
	request: typeof fetch;
	refreshing = new Map<string, Promise<OAuth>>();
	key: Buffer;

	constructor(config: BuiltinConfig, database: () => Promise<Db>, request = fetch) {
		this.config = config;
		this.getDatabase = database;
		this.request = request;
		this.key = createHash('sha256').update(`fable-website-oauth:${config.clientSecret}`).digest();
	}

	seal(value: OAuth): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.key, iv);
		const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
		return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
	}

	unseal(value: string): OAuth {
		const data = Buffer.from(value, 'base64url');
		const cipher = createDecipheriv('aes-256-gcm', this.key, data.subarray(0, 12));
		cipher.setAuthTag(data.subarray(12, 28));
		return JSON.parse(
			Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8')
		) as OAuth;
	}

	async discord<T>(path: string, authorization = `Bot ${this.config.botToken}`): Promise<T> {
		const response = await this.request(`https://discord.com/api/v10${path}`, {
			headers: { Authorization: authorization },
			signal: AbortSignal.timeout(8000)
		});
		if (!response.ok) {
			if (response.status === 429)
				throw new BackendError(429, 'Discord is busy. Try again shortly.');
			if (response.status === 403 || response.status === 404)
				throw new BackendError(403, 'You or Fable no longer have access to this server.');
			throw new BackendError(502, 'Discord could not be reached. Try again shortly.');
		}
		return (await response.json()) as T;
	}

	async exchange(fields: Record<string, string>): Promise<OAuth> {
		const response = await this.request('https://discord.com/api/v10/oauth2/token', {
			method: 'POST',
			body: new URLSearchParams({
				client_id: this.config.clientId,
				client_secret: this.config.clientSecret,
				...fields
			}),
			signal: AbortSignal.timeout(8000)
		});
		if (!response.ok)
			throw new BackendError(response.status >= 500 ? 502 : 401, 'Sign in with Discord again.');
		const data = (await response.json()) as OAuth;
		if (!data.access_token || !data.refresh_token || !Number.isFinite(data.expires_in))
			throw new BackendError(502, 'Discord returned an invalid authorization.');
		return { ...data, expiresAt: Date.now() + data.expires_in * 1000 };
	}

	async beginLogin(): Promise<{ state: string; url: string }> {
		const state = randomBytes(32).toString('hex');
		const db = await this.getDatabase();
		await db.collection<State>('website_oauth_states').insertOne({
			_id: hashToken(state),
			expiresAt: new Date(Date.now() + 600_000)
		});
		const url = new URL('https://discord.com/oauth2/authorize');
		url.search = new URLSearchParams({
			client_id: this.config.clientId,
			response_type: 'code',
			scope: 'identify guilds',
			state,
			redirect_uri: `${this.config.origin}/api/fable/Auth/Callback`
		}).toString();
		return { state, url: url.toString() };
	}

	cookie(request: Request, name: string): string {
		const entry = (request.headers.get('cookie') ?? '')
			.split(';')
			.map((item) => item.trim())
			.find((item) => item.startsWith(`${name}=`));
		if (!entry) return '';
		try {
			return decodeURIComponent(entry.slice(name.length + 1));
		} catch {
			return '';
		}
	}

	async callback(request: Request, db: Db): Promise<Response> {
		const url = new URL(request.url);
		const state = url.searchParams.get('state') ?? '';
		const stored = this.cookie(request, 'fableOAuthState');
		if (!nonce.test(state) || !nonce.test(stored) || !equal(state, stored))
			throw new BackendError(400, 'The login attempt expired. Sign in again.');
		const record = await db.collection<State>('website_oauth_states').findOneAndDelete({
			_id: hashToken(state),
			expiresAt: { $gt: new Date() }
		});
		if (!record || !url.searchParams.get('code'))
			throw new BackendError(400, 'The login attempt expired. Sign in again.');
		const oauth = await this.exchange({
			grant_type: 'authorization_code',
			code: url.searchParams.get('code')!,
			redirect_uri: `${this.config.origin}/api/fable/Auth/Callback`
		});
		const user = await this.discord<{ id: string; username: string; avatar?: string }>(
			'/users/@me',
			`Bearer ${oauth.access_token}`
		);
		if (!snowflake.test(user.id))
			throw new BackendError(502, 'Discord returned an invalid profile.');
		const bot = await this.discord<{ id: string }>('/users/@me');
		if (bot.id !== this.config.clientId)
			throw new BackendError(503, 'The Fable application credentials do not match.');
		await this.checkTermination(db, user.id);
		const token = randomBytes(32).toString('hex');
		await db.collection<Session>('website_sessions').insertOne({
			_id: hashToken(token),
			user: { ID: user.id, DiscordID: user.id, Username: user.username, Avatar: user.avatar ?? '' },
			oauth: this.seal(oauth),
			expiresAt: new Date(Date.now() + duration * 1000)
		});
		let target = this.cookie(request, 'fableAuthReturn');
		if (
			!target.startsWith('/') ||
			target.startsWith('//') ||
			target.includes('\\') ||
			/[\r\n]/.test(target)
		)
			target = '/guilds';
		try {
			const destination = new URL(target, this.config.origin);
			target =
				destination.origin === this.config.origin
					? `${destination.pathname}${destination.search}`
					: '/guilds';
		} catch {
			target = '/guilds';
		}
		const secure = this.config.origin.startsWith('https:') ? '; Secure' : '';
		const headers = new Headers({
			Location: target,
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer'
		});
		headers.append(
			'Set-Cookie',
			`${this.config.sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${duration}${secure}`
		);
		for (const name of ['fableOAuthState', 'fableAuthReturn'])
			headers.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
		return new Response(null, { status: 303, headers });
	}

	async checkTermination(db: Db, userId: string) {
		const identityName =
			db.databaseName === 'erm' ? 'UserIdentity' : `${db.databaseName}_UserIdentity`;
		const terminated = await db.client
			.db(identityName)
			.collection('BlacklistedUsers')
			.findOne({ discordID: userId, from: 'account' });
		if (terminated) throw new BackendError(403, 'This Fable account is terminated.');
	}

	async session(request: Request, db: Db): Promise<Session> {
		const token = request.headers.get('authorization') ?? '';
		if (!nonce.test(token)) throw new BackendError(401, 'Sign in with Discord again.');
		const session = await db.collection<Session>('website_sessions').findOne({
			_id: hashToken(token),
			expiresAt: { $gt: new Date() }
		});
		if (!session) throw new BackendError(401, 'Sign in with Discord again.');
		await this.checkTermination(db, session.user.DiscordID);
		return session;
	}

	async oauth(session: Session, db: Db): Promise<OAuth> {
		const saved = this.unseal(session.oauth);
		if (saved.expiresAt > Date.now() + 60_000) return saved;
		let pending = this.refreshing.get(session._id);
		if (!pending) {
			pending = this.exchange({ grant_type: 'refresh_token', refresh_token: saved.refresh_token })
				.then(async (value) => {
					await db
						.collection<Session>('website_sessions')
						.updateOne({ _id: session._id }, { $set: { oauth: this.seal(value) } });
					return value;
				})
				.finally(() => this.refreshing.delete(session._id));
			this.refreshing.set(session._id, pending);
		}
		return pending;
	}

	async access(db: Db, session: Session, guildId: string) {
		if (!snowflake.test(guildId) || BigInt(guildId) > 9223372036854775807n)
			throw new BackendError(400, 'Unknown server.');
		const [guild, member, roles, settings] = await Promise.all([
			this.discord<DiscordGuild>(`/guilds/${guildId}`),
			this.discord<DiscordMember>(`/guilds/${guildId}/members/${session.user.DiscordID}`),
			this.discord<DiscordRole[]>(`/guilds/${guildId}/roles`),
			db.collection<Settings>('settings').findOne({ _id: Long.fromString(guildId) })
		]);
		const level = permissionLevel(session.user.DiscordID, guild, member, roles, settings ?? {});
		if (level < 3) throw new BackendError(403, 'Server management permission is required.');
		return { guild, member, roles, settings, level };
	}

	async body(request: Request): Promise<Record<string, unknown>> {
		const text = await request.text();
		if (text.length > 65_536) throw new BackendError(413, 'The settings are too large.');
		try {
			return object(JSON.parse(text));
		} catch (cause) {
			if (cause instanceof BackendError) throw cause;
			throw new BackendError(400, 'Invalid JSON.');
		}
	}

	async dispatch(request: Request): Promise<unknown | Response> {
		const path = new URL(request.url).pathname.replace(/^\/api\/fable/, '');
		const method = request.method;
		if (path === '/Users/Affiliates' && method === 'GET') return { Affiliates: [] };
		if (path === '/Discord/BotProfile' && method === 'GET') {
			const user = await this.discord<{
				id: string;
				username: string;
				avatar?: string;
				banner?: string;
				public_flags?: number;
			}>('/users/@me');
			if (user.id !== this.config.clientId)
				throw new BackendError(503, 'The Fable application credentials do not match.');
			return {
				username: user.username,
				avatar_url: user.avatar
					? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
					: '',
				banner_url: user.banner
					? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png`
					: '',
				verified: Boolean((user.public_flags ?? 0) & 65536)
			};
		}
		if (path.startsWith('/Status/'))
			throw new BackendError(501, 'Live bot telemetry is not configured.');
		const db = await this.getDatabase();
		if (path === '/Auth/Callback' && method === 'GET') return this.callback(request, db);
		const session = await this.session(request, db);
		const userId = session.user.DiscordID;
		if (path === '/Users/Session' && method === 'GET') return { User: session.user };
		if (path === '/Auth/Logout' && method === 'POST') {
			await db.collection<Session>('website_sessions').deleteOne({ _id: session._id });
			return { success: true };
		}
		if (path === '/Users/Notifications' && method === 'GET') return { notifications: [] };
		if (path === '/Users/Preferences') {
			if (method === 'GET')
				return (
					(await db.collection<Profile>('website_users').findOne({ _id: userId }))?.preferences ??
					{}
				);
			if (method === 'POST') {
				const data = await this.body(request);
				if (
					Object.entries(data).some(
						([key, value]) => !preferenceKeys.has(key) || typeof value !== 'boolean'
					)
				)
					throw new BackendError(400, 'Invalid preferences.');
				await db
					.collection<Profile>('website_users')
					.updateOne(
						{ _id: userId },
						{ $set: { preferences: data as Record<string, boolean> } },
						{ upsert: true }
					);
				return { success: true };
			}
		}
		if (path === '/Users/RefreshProfile' && method === 'POST') {
			const oauth = await this.oauth(session, db);
			const user = await this.discord<{ id: string; username: string; avatar?: string }>(
				'/users/@me',
				`Bearer ${oauth.access_token}`
			);
			if (user.id !== userId) throw new BackendError(401, 'Sign in again.');
			const updated = { ...session.user, Username: user.username, Avatar: user.avatar ?? '' };
			await db
				.collection<Session>('website_sessions')
				.updateOne({ _id: session._id }, { $set: { user: updated } });
			return updated;
		}
		if ((path === '/Users/Guilds' || path === '/Users/ForceGuilds') && method === 'GET') {
			const oauth = await this.oauth(session, db);
			const allGuilds = await this.discord<DiscordGuild[]>(
				'/users/@me/guilds?limit=200',
				`Bearer ${oauth.access_token}`
			);
			const configured = await db
				.collection<Settings>('settings')
				.find({
					_id: { $in: allGuilds.map((guild) => Long.fromString(guild.id)) }
				})
				.project({ _id: 1 })
				.toArray();
			const known = new Set(configured.map((item) => String(item._id)));
			const guilds = allGuilds.filter((guild) => known.has(guild.id));
			const profile = await db.collection<Profile>('website_users').findOne({ _id: userId });
			const results = [];
			for (let start = 0; start < guilds.length; start += 3) {
				const batch = await Promise.all(
					guilds.slice(start, start + 3).map(async (item) => {
						try {
							const { guild, level } = await this.access(db, session, item.id);
							return {
								ID: guild.id,
								Name: guild.name,
								Icon: guild.icon,
								Banner: guild.banner,
								PermissionLevel: level,
								ApplicationAccess: false,
								OverviewEnabled: false,
								Pinned: profile?.pins?.includes(guild.id) ?? false
							};
						} catch (cause) {
							if (cause instanceof BackendError && cause.status === 403) return null;
							throw cause;
						}
					})
				);
				results.push(...batch.filter((item) => item !== null));
			}
			return { Guilds: results };
		}
		const pin = path.match(/^\/Users\/PinGuild\/(\d+)$/);
		if (pin && method === 'POST') {
			await this.access(db, session, pin[1]);
			const users = db.collection<Profile>('website_users');
			const profile = await users.findOne({ _id: userId });
			const pinned = !profile?.pins?.includes(pin[1]);
			await users.updateOne(
				{ _id: userId },
				pinned ? { $addToSet: { pins: pin[1] } } : { $pull: { pins: pin[1] } },
				{ upsert: true }
			);
			return { pinned };
		}
		const match = path.match(/^\/(\d{17,20})\/(.+)$/);
		if (!match)
			throw new BackendError(
				501,
				'This feature is not connected in the built-in configuration dashboard.'
			);
		const [, guildId, action] = match;
		const access = await this.access(db, session, guildId);
		if (action === 'permissions/me' && method === 'GET')
			return { permissions: {}, mode: 'default', level: access.level };
		if (action === 'GetServerRoles' && method === 'GET')
			return {
				Roles: access.roles.map((role) => ({
					ID: role.id,
					Name: role.name,
					Color: role.color,
					Position: role.position,
					Managed: role.managed
				}))
			};
		if (action === 'GetServerChannels' && method === 'GET') {
			const channels = await this.discord<
				{ id: string; name: string; type: number; position: number; parent_id?: string }[]
			>(`/guilds/${guildId}/channels`);
			return {
				Channels: channels.map((channel) => ({
					ID: channel.id,
					Name: channel.name,
					Type: channel.type,
					Position: channel.position,
					ParentID: channel.parent_id
				}))
			};
		}
		if (action === 'GetServerSettings' && method === 'GET') {
			if (!access.settings)
				throw new BackendError(409, 'Run the bot setup command in this server first.');
			return Object.fromEntries(
				Object.entries(access.settings).filter(([key]) => Object.hasOwn(schema, key))
			);
		}
		if (action === 'SaveServerSettings' && method === 'PATCH') {
			if (!access.settings)
				throw new BackendError(409, 'Run the bot setup command in this server first.');
			const channels = await this.discord<{ id: string }[]>(`/guilds/${guildId}/channels`);
			const patch = settingsPatch(
				await this.body(request),
				new Set(access.roles.map((role) => role.id)),
				new Set(channels.map((channel) => channel.id))
			);
			const result = await db
				.collection<Settings>('settings')
				.updateOne({ _id: Long.fromString(guildId) }, { $set: patch });
			if (!result.matchedCount)
				throw new BackendError(409, 'Server settings changed. Refresh and try again.');
			await db.collection('website_audit').insertOne({
				guildId,
				userId,
				action: 'settings.update',
				fields: Object.keys(patch),
				createdAt: new Date()
			});
			return { success: true };
		}
		if (action === 'GetDocumentationTypes' && method === 'GET')
			return {
				documentation_types: await db
					.collection('website_documentation')
					.find({ guildId })
					.project({ _id: 0, guildId: 0 })
					.toArray()
			};
		if (action === 'CreateDocumentationType' && method === 'POST') {
			const item = this.documentation(await this.body(request));
			const id = randomBytes(12).toString('hex');
			await db.collection('website_documentation').insertOne({ guildId, id, ...item });
			return { documentation_type: { id, ...item } };
		}
		const document = action.match(
			/^([a-f0-9]{24})\/(EditDocumentationType|DeleteDocumentationType)$/
		);
		if (document && document[2] === 'EditDocumentationType' && method === 'PATCH') {
			const result = await db
				.collection('website_documentation')
				.updateOne(
					{ guildId, id: document[1] },
					{ $set: this.documentation(await this.body(request)) }
				);
			if (!result.matchedCount) throw new BackendError(404, 'Documentation not found.');
			return { success: true };
		}
		if (document && document[2] === 'DeleteDocumentationType' && method === 'DELETE') {
			await db.collection('website_documentation').deleteOne({ guildId, id: document[1] });
			return { success: true };
		}
		throw new BackendError(
			501,
			'This feature needs a compatible full backend. Use the Fable bot for this action.'
		);
	}

	documentation(data: Record<string, unknown>) {
		const name = String(data.name ?? '').trim();
		let url: URL;
		try {
			url = new URL(String(data.url ?? ''));
		} catch {
			throw new BackendError(400, 'Invalid documentation link.');
		}
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			![
				'docs.google.com',
				'sheets.google.com',
				'slides.google.com',
				'forms.google.com',
				'drawings.google.com',
				'vids.google.com',
				'drive.google.com',
				'sites.google.com',
				'gitbook.io',
				'mintlify.app'
			].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
		)
			throw new BackendError(400, 'Use a supported HTTPS documentation link.');
		if (name.length < 3 || name.length > 50 || ![1, 2, 3].includes(Number(data.punishmentLevel)))
			throw new BackendError(400, 'Invalid documentation details.');
		return {
			name,
			url: url.toString(),
			punishmentLevel: Number(data.punishmentLevel),
			faviconURL: ''
		};
	}

	async handle(request: Request): Promise<Response> {
		try {
			const value = await this.dispatch(request);
			if (value instanceof Response) return value;
			return Response.json(wire(value), { headers: { 'Cache-Control': 'no-store' } });
		} catch (cause) {
			const known = cause instanceof BackendError;
			if (!known)
				console.error(
					'Fable backend request failed:',
					cause instanceof Error ? cause.name : 'UnknownError'
				);
			return Response.json(
				{
					message: known
						? cause.message
						: 'Fable could not complete this request. Try again shortly.',
					...(known && cause.message.includes('terminated') ? { Terminated: true } : {})
				},
				{ status: known ? cause.status : 503, headers: { 'Cache-Control': 'no-store' } }
			);
		}
	}
}
