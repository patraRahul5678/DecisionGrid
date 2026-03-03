require('dotenv').config();
const express = require('express');
const app = express();
const webControllers = require('./controller/webhookController');
const connectDB = require('./config/database');

app.use(express.json());


app.post("/webhook", webControllers);

app.listen(3000, async () => {
    await connectDB();
    console.log("Server is running on port 3000");
});