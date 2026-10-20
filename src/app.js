import express from 'express';
import mongoose from 'mongoose';

import userRoutes from './routes/userRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`${req.method} ${res.statusCode}`);
    });

    next();
});

app.use(userRoutes);
app.use(accountRoutes);
app.use(transactionRoutes);

app.get('/health/live', (req, res) => {
    return res.status(200).json({
        message: 'Server is healthy',
    });
});

app.get('/health/ready', (req, res) => {
    const isDatabaseReady = mongoose.connection.readyState === 1;

    if (!isDatabaseReady) {
        return res.status(503).json({
            error: 'SERVICE_NOT_READY',
            message: 'Service is not ready to handle requests',
        });
    }

    return res.status(200).json({
        message: 'Service is ready',
    });
});

app.use((req, res) => {
    return res.status(404).json({
        error: 'ROUTE_NOT_FOUND',
        message: 'Requested route was not found',
    });
});

app.use(errorHandler);

export default app;
