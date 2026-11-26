export function cors(req, res) {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}
