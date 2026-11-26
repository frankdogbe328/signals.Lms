import pg from 'pg';
const { Pool } = pg;

let pool;

export function getDb() {
    if (!pool) {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
        const ssl = process.env.PGSSLMODE === 'disable'
            ? false
            : (process.env.PGSSL_REJECT_UNAUTHORIZED === 'false'
                ? { rejectUnauthorized: false }
                : { rejectUnauthorized: true });
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
        });
    }
    return pool;
}
