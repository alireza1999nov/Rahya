import express  from 'express';
import userRoutes from "./routes/userRoutes.js";
const app = express();

app.use(express.json());

app.use(userRoutes);

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});

export default app;
