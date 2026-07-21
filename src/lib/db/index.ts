import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// prepare: false keeps us compatible with transaction-pooled connections
// (e.g. Supabase pooler / PgBouncer). Fine for local Docker too.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export * from './schema';
