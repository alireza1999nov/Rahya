const requireJsonBody = (req, res, next) => {
    const contentType = req.get('content-type');
    const hasBody =
        req.headers['transfer-encoding'] !== undefined ||
        (
            req.headers['content-length'] !== undefined &&
            Number(req.headers['content-length']) > 0
        );

    // No body and no Content-Type: the required input is missing.
    if (!hasBody && !contentType) {
        return res.status(400).json({
            error: 'REQUEST_BODY_REQUIRED',
            message: 'A JSON request body is required',
        });
    }

    const mediaType = contentType
        ?.split(';', 1)[0]
        .trim()
        .toLowerCase();

    const isJson =
        mediaType === 'application/json' ||
        (
            mediaType?.startsWith('application/') &&
            mediaType.endsWith('+json')
        );

    if (!isJson) {
        return res.status(415).json({
            error: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json',
        });
    }

    if (!hasBody || req.body === undefined) {
        return res.status(400).json({
            error: 'REQUEST_BODY_REQUIRED',
            message: 'A JSON request body is required',
        });
    }

    return next();
};

export default requireJsonBody;
