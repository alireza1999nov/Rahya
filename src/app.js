import express  from 'express';
import userRoutes from "./routes/userRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use(userRoutes);
app.use(accountRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});

export default app;
