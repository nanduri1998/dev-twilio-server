/* eslint-disable linebreak-style */
const express = require('express');
const app = express();
const db = require('./db');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.get("/", (req, res) => {
    res.send("Test");
})

module.exports = app;
