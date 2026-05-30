import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lms_signals_secret_change_in_prod';

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
