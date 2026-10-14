import express  from 'express';
import userRoutes from "./routes/userRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import transactionRoutes from './routes/transactionRoutes.js';

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`${req.method} ${res.statusCode}`);
    });
    next();
});

app.use(userRoutes);
app.use(accountRoutes);
app.use(transactionRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});

export default app;
