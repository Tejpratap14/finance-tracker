import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// Disable prepare to prevent issues with connection poolers like PgBouncer/Supabase pooled connections
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
export * from './schema';
