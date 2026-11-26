import bcrypt from 'bcryptjs';
import { getDb } from '../api/_db.js';

const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const fullName = process.env.INITIAL_ADMIN_FULL_NAME?.trim() || 'System Administrator';

if (!process.env.DATABASE_URL || !username || !password) {
    throw new Error('Set DATABASE_URL, INITIAL_ADMIN_USERNAME, and INITIAL_ADMIN_PASSWORD before running this script.');
}
if (username.length < 3 || username.length > 100 || password.length < 12 || password.length > 128) {
    throw new Error('Username must be 3-100 characters and the initial password must be 12-128 characters.');
}

const db = getDb();
try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
        `INSERT INTO users (username, password_hash, full_name, type)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (username) DO NOTHING
         RETURNING id, username, full_name, type`,
        [username, hash, fullName]
    );
    if (!rows.length) throw new Error('That username already exists; no account was changed.');
    console.log(`Administrator provisioned: ${rows[0].username} (${rows[0].id})`);
} finally {
    await db.end();
}
