require('dotenv').config();
const express = require('express');
const app = express();
const webControllers = require('./controller/webhookController');
const connectDB = require('./config/database');
const port=process.env.PORT || 3000;

app.use(express.json());


app.use("/", webControllers);

app.listen(port, async () => {
    await connectDB();
    console.log(`Server is running on port ${port}`);
});