const express = require('express');
const bodyParser = require('body-parser'); // Correct import

const app = express();
const path = require('path');

require('./config/config');
const UserRouter = require('./api/User');

// Serve static files from the 'views' directory
app.use(express.static('views'));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Serve static files from the 'public' directory under '/public' route
app.use('/public', express.static('public'));

app.use(bodyParser.json()); // Use bodyParser middleware correctly
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api", UserRouter);

const port = 3000;

app.listen(port, () => {
    console.log(`Server running on Port: ${port}`);
});
