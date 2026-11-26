import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret) {
        if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
        return secret;
    }
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        throw new Error('JWT_SECRET is required in production');
    }
    // Development only: use a process-ephemeral secret when one is not configured.
    return crypto.randomBytes(48).toString('base64');
}

const JWT_SECRET = getJwtSecret();

export function createToken(user) {
    return jwt.sign(
        { id: user.id, type: user.type, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export function verifyToken(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(auth.slice(7), JWT_SECRET);
    } catch {
        return null;
    }
}

export function requireAdmin(caller) {
    return caller?.type === 'admin';
}
