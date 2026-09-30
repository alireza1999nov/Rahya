import express  from 'express';
const app = express();

app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});

export default app;
