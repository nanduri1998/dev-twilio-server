/* eslint-disable linebreak-style */
const express = require('express');
const app = express();
const signin = require('./signin');
const signup = require('./signup');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.use('/signin', signin);
app.use('/signup', signup);

module.exports = app;
