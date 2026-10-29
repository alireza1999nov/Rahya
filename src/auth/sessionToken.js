import { createHash, randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const generateSessionToken = () => randomBytes(32).toString('base64url');

const hashSessionToken = (token) =>
    createHash('sha256').update(token).digest('hex');

export { SESSION_TTL_MS, generateSessionToken, hashSessionToken };
