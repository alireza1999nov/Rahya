import connectDatabase from './config/database.js';
import app from './app.js';
const port = 3000;

const startServer = async () => {
    try {
        await connectDatabase();

        app.listen(port, () => {
            console.log(`Rahya server is running on port ${port}`);
        })
    } catch (error) {
        console.error('Failed to start Rahya server', error);
        process.exitCode = 1;
    }
}

startServer();
