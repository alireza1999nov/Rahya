import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

import app from '../src/app.js';
import errorHandler from '../src/middleware/errorHandler.js';

const startServer = async (testApp) => {
    const server = createServer(testApp);

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
        baseUrl,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        }),
    };
};

test('returns 400 INVALID_JSON for malformed JSON', async () => {
    const server = await startServer(app);

    try {
        const response = await fetch(
            `${server.baseUrl}/transactions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: '{"type":',
            },
        );

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
            error: 'INVALID_JSON',
            message: 'Request body contains invalid JSON',
        });
    } finally {
        await server.close();
    }
});

test('returns 413 PAYLOAD_TOO_LARGE for a body exceeding 256 KB', async () => {
    const server = await startServer(app);

    try {
        const response = await fetch(
            `${server.baseUrl}/transactions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: 'x'.repeat(256 * 1024),
                }),
            },
        );

        assert.equal(response.status, 413);
        assert.deepEqual(await response.json(), {
            error: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds the allowed size limit',
        });
    } finally {
        await server.close();
    }
});

test('returns the standard error response for an unknown route', async () => {
    const server = await startServer(app);

    try {
        const response = await fetch(
            `${server.baseUrl}/route-that-does-not-exist`,
        );

        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), {
            error: 'ROUTE_NOT_FOUND',
            message: 'Requested route was not found',
        });
    } finally {
        await server.close();
    }
});


test('returns a safe 500 response for an unexpected error', async () => {
    const testApp = express();

    testApp.use(express.json({ limit: '256kb' }));

    testApp.get('/trigger-error', () => {
        throw new Error('Sensitive database connection details');
    });

    testApp.use(errorHandler);

    const originalConsoleError = console.error;
    const loggedErrors = [];

    console.error = (...args) => {
        loggedErrors.push(args);
    };

    let server;

    try {
        server = await startServer(testApp);

        const response = await fetch(
            `${server.baseUrl}/trigger-error`,
        );

        const responseBody = await response.json();

        assert.equal(response.status, 500);
        assert.deepEqual(responseBody, {
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
        });

        assert.equal(
            loggedErrors.some((args) =>
                args.some((arg) =>
                    arg instanceof Error
                        ? arg.message.includes(
                            'Sensitive database connection details',
                        )
                        : String(arg).includes(
                            'Sensitive database connection details',
                        ),
                ),
            ),
            true,
            'The original error should be logged server-side',
        );
    } finally {
        console.error = originalConsoleError;

        if (server) {
            await server.close();
        }
    }
});


test('returns 400 REQUEST_BODY_REQUIRED when body and Content-Type are missing', async () => {
    const server = await startServer(app);

    try {
        const response = await fetch(`${server.baseUrl}/users`, {
            method: 'POST',
        });

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
            error: 'REQUEST_BODY_REQUIRED',
            message: 'A JSON request body is required',
        });
    } finally {
        await server.close();
    }
});

test('returns 400 REQUEST_BODY_REQUIRED for an empty JSON body', async () => {
    const server = await startServer(app);

    try {
        const response = await fetch(`${server.baseUrl}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: '',
        });

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
            error: 'REQUEST_BODY_REQUIRED',
            message: 'A JSON request body is required',
        });
    } finally {
        await server.close();
    }
});

test('returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body', async () => {
    const server = await startServer(app);

    try {
        const response = await fetch(`${server.baseUrl}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: 'some input',
        });

        assert.equal(response.status, 415);
        assert.deepEqual(await response.json(), {
            error: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json',
        });
    } finally {
        await server.close();
    }
});
