/ Modules
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const RESTserver = require('the.rest');

// Connect to MongoDB via Mongoose
mongoose.connect('mongodb://localhost/animals', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;

// Create an Express server
const app = express();
app.use(express.static('www'));

// ..and install the REST server as middleware
const pathToModelFolder = path.join(__dirname, 'mongoose-models');
app.use(RESTserver('/api', pathToModelFolder));

// Listen on port 5000
app.listen(5000, () => console.log('Listening on port 5000'));

