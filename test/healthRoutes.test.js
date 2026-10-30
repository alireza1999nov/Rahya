import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createServer } from 'node:http';

import app from '../src/app.js';

const testUri = process.env.MONGODB_TEST_URI;

test('health route integration tests', async (t) => {
    assert.ok(testUri, 'MONGODB_TEST_URI must be configured');

    const databaseName = new URL(testUri).pathname.slice(1);
    assert.equal(databaseName, 'rahya_test');

    await mongoose.connect(testUri);

    const server = createServer(app);

    try {
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

        const address = server.address();
        const baseUrl = `http://127.0.0.1:${address.port}`;

        await t.test('GET /health/live returns 200', async () => {
            const response = await fetch(`${baseUrl}/health/live`);
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(body.message, 'Server is healthy');
        });

        await t.test('GET /health/ready returns 200 when MongoDB is connected', async () => {
            const response = await fetch(`${baseUrl}/health/ready`);
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(body.message, 'Service is ready');
        });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });

        await mongoose.disconnect();
    }
});
