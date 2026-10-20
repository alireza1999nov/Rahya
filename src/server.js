import mongoose from 'mongoose';

import connectDatabase from './config/database.js';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;
const shutdownTimeout = 10_000;

let server;
let databaseConnectionPromise;
let listenPromise;
let shutdownPromise;
let disconnectPromise;
let isShuttingDown = false;

const disconnectDatabase = () => {
    if (!disconnectPromise) {
        disconnectPromise = mongoose.disconnect().catch((error) => {
            disconnectPromise = undefined;
            throw error;
        });
    }

    return disconnectPromise;
};

const closeServer = async () => {
    if (!server) {
        return;
    }

    // The listen operation must settle before we decide whether
    // the HTTP server needs to be closed.
    if (listenPromise) {
        try {
            await listenPromise;
        } catch {
            // Startup failed; there is no successfully listening server.
        }
    }

    if (!server.listening) {
        return;
    }

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

const shutdown = (reason) => {
    if (shutdownPromise) {
        console.log('Shutdown is already in progress');
        return shutdownPromise;
    }

    isShuttingDown = true;

    shutdownPromise = (async () => {
        console.log(`Shutdown started: ${reason}`);

        let shutdownFailed = false;

        const timeout = setTimeout(() => {
            console.error(
                `Graceful shutdown timed out after ${shutdownTimeout}ms`,
            );

            process.exit(1);
        }, shutdownTimeout);

        try {
            // Stop accepting requests before disconnecting the database.
            await closeServer();
        } catch (error) {
            shutdownFailed = true;
            console.error('Failed to close HTTP server', error);
        }

        try {
            if (databaseConnectionPromise) {
                await databaseConnectionPromise;
            }
        } catch (error) {
            shutdownFailed = true;
            console.error(
                'Database connection did not complete successfully',
                error,
            );
        }

        try {
            await disconnectDatabase();
            console.log('MongoDB disconnected');
        } catch (error) {
            shutdownFailed = true;
            console.error('Failed to disconnect from MongoDB', error);
        } finally {
            clearTimeout(timeout);
        }

        if (shutdownFailed) {
            process.exitCode = 1;
        } else if (process.exitCode === undefined) {
            process.exitCode = 0;
        }

        if (!shutdownFailed) {
            console.log('Graceful shutdown completed');
        }
    })();

    return shutdownPromise;
};

const startServer = async () => {
    try {
        databaseConnectionPromise = connectDatabase();
        await databaseConnectionPromise;

        // A signal may have arrived while MongoDB was connecting.
        if (isShuttingDown) {
            return;
        }

        server = app.listen(port);

        listenPromise = new Promise((resolve, reject) => {
            const cleanupStartupListeners = () => {
                server.removeListener('listening', onListening);
                server.removeListener('error', onStartupError);
            };

            const onListening = () => {
                cleanupStartupListeners();
                resolve();
            };

            const onStartupError = (error) => {
                cleanupStartupListeners();
                reject(error);
            };

            server.once('listening', onListening);
            server.once('error', onStartupError);
        });

        await listenPromise;

        if (isShuttingDown) {
            return;
        }

        // Startup listeners have been removed. This listener handles
        // errors occurring after the server has started successfully.
        server.on('error', (error) => {
            console.error('HTTP server error', error);
            process.exitCode = 1;
            void shutdown('HTTP_SERVER_ERROR');
        });

        console.log(`Rahya server is running on port ${port}`);
    } catch (error) {
        console.error('Failed to start Rahya server', error);
        process.exitCode = 1;

        // If shutdown has already started, it owns resource cleanup.
        if (!shutdownPromise) {
            try {
                await disconnectDatabase();
            } catch (disconnectError) {
                console.error(
                    'Failed to disconnect MongoDB after startup failure',
                    disconnectError,
                );
            }
        }
    }
};

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

void startServer();
