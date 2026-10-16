import postgres from 'postgres';

// One pooled client per server instance. Created lazily so `next build`
// never needs a database connection.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as { __sql?: postgres.Sql<any> };

export function connectionOptions(raw: string) {
  const u = new URL(raw);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  // Neon/Supabase URLs carry libpq-only params that postgres.js would forward to the server.
  u.searchParams.delete('sslmode');
  u.searchParams.delete('channel_binding');
  return { url: u.toString(), ssl: local ? false : ('require' as const) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db(): postgres.Sql<any> {
  if (g.__sql) return g.__sql;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const { url, ssl } = connectionOptions(raw);
  g.__sql = postgres(url, {
    ssl,
    prepare: false, // required behind PgBouncer-style poolers (Neon / Supabase)
    max: 3,
    idle_timeout: 20,
    // Return DATE columns as 'YYYY-MM-DD' strings instead of JS Dates (no timezone drift).
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
  return g.__sql;
}
