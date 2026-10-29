const revokeSession = async (sessionId, sessionRepository) => {
    const session = await sessionRepository.revokeById(sessionId);

    if (!session) {
        return {
            valid: false,
            error: 'UNAUTHENTICATED',
            message: 'Authentication is required',
        };
    }

    return {
        valid: true,
        data: {
            id: session.id,
        },
    };
};

export default revokeSession;
