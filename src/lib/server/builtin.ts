import { env } from '$env/dynamic/private';
import { MongoClient, type Db } from 'mongodb';
import { BuiltinBackend } from './builtin-core';
import { builtinReady, discordClientId, siteOrigin } from './config';
import { sessionCookie } from './session';

let connection: Promise<Db> | undefined;
let backend: BuiltinBackend | undefined;

function database(): Promise<Db> {
	if (!connection) {
		const client = new MongoClient(env.MONGO_URL ?? '', {
			maxPoolSize: 10,
			serverSelectionTimeoutMS: 5000,
			promoteLongs: false
		});
		connection = client
			.connect()
			.then(async () => {
				const db = client.db(env.DB_NAME || 'erm');
				await Promise.all([
					db
						.collection('website_sessions')
						.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
					db
						.collection('website_oauth_states')
						.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
					db
						.collection('website_documentation')
						.createIndex({ guildId: 1, id: 1 }, { unique: true }),
					db
						.collection('website_audit')
						.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
				]);
				return db;
			})
			.catch(async (cause) => {
				connection = undefined;
				await client.close();
				throw cause;
			});
	}
	return connection;
}

export function getBuiltinBackend(): BuiltinBackend {
	if (!builtinReady) throw new Error('The built-in backend is not configured.');
	backend ??= new BuiltinBackend(
		{
			origin: siteOrigin,
			clientId: discordClientId,
			clientSecret: env.DISCORD_CLIENT_SECRET ?? '',
			botToken: env.DISCORD_BOT_TOKEN ?? '',
			sessionCookie
		},
		database
	);
	return backend;
}
