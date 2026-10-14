import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';

test('request logging must not expose query string values', async () => {
    const originalLog = console.log;
    const logs = [];

    console.log = (...args) => {
        logs.push(args.join(' '));
    };

    const server = http.createServer(app);

    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });

        const { port } = server.address();

        const response = await fetch(
            `http://127.0.0.1:${port}/health?token=secret-test-value`
        );

        await response.arrayBuffer();

        assert.equal(response.status, 200);

        assert.equal(logs.length, 1);
        assert.equal(logs[0], 'GET 200');
        assert.equal(logs[0].includes('secret-test-value'), false);
    } finally {
        console.log = originalLog;

        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
});
