import Session from '../models/sessionModel.js';

const toSession = (document) => {
    if (!document) {
        return null;
    }

    const session =
        typeof document.toObject === 'function'
            ? document.toObject()
            : document;

    const { _id, id: existingId, ...data } = session;

    return {
        ...data,
        id: _id ?? existingId,
    };
};

const sessionRepository = {
    async create(session) {
        const createdSession = await Session.create({
            userId: session.userId,
            tokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
            revokedAt: session.revokedAt ?? null,
        });

        return toSession(createdSession);
    },

    async findActiveByTokenHash(tokenHash) {
        const session = await Session.findOne({
            tokenHash,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        }).lean();

        return toSession(session);
    },

    async revokeById(sessionId) {
        const revokedSession = await Session.findOneAndUpdate(
            {
                _id: sessionId,
                revokedAt: null,
            },
            {
                $set: {
                    revokedAt: new Date(),
                },
            },
            {
                returnDocument: 'after',
            },
        ).lean();

        return toSession(revokedSession);
    },
};

export default sessionRepository;
