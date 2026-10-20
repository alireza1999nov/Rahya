const errorHandler = (error, _, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    // Malformed JSON sent by the client.
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'INVALID_JSON',
            message: 'Request body contains invalid JSON',
        });
    }

    // JSON request body exceeds the configured size limit.
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds the allowed size limit',
        });
    }

    // Mongoose document validation failure.
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Request data is invalid',
        });
    }

    // Log diagnostic details on the server, not in the HTTP response.
    console.error('Unhandled request error', error);

    return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
    });
};

export default errorHandler;
