/* eslint-disable linebreak-style */
const express = require('express');
const app = express();
const db = require('./db');
const authy = require('authy')(process.env.TWILIOKEY);
const random_email = require('random-email');
const jsonwebtoken = require('jsonwebtoken');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.post('/login', (req, res) => {
    const { phone } = req.body;
    db.query("SELECT phone, authyid, COUNT(*) as userCount FROM users WHERE phone = ?", [phone], (err, results) => {
        if(results[0].userCount > 0) {
            const authyid = results[0].authyid;
            requestLoginOtp(authyid, (result) => {
                if(result.success) {
                    const final = {
                        flow: 'login',
                        authyid
                    }
                    res.json(final);
                } else {
                    res.json({
                        message: "ERROR"
                    })
                }
            });
        } else {
            const email = random_email({domain: 'saath.web.app'});
            registerNew(phone, email, (response) => {
                authy.request_sms(response.user.id, true, (err, response1) => {
                    if(err) console.log(err);
                    else {
                        const final = {
                            authyid: response.user.id,
                            phone,
                            email
                        }
                        db.query("INSERT INTO users SET ?", final, (err, result) => {
                            res.json({
                                final,
                                response,
                                flow: 'register'
                            });
                        })
                    }
                })
            });
        }
    })
});

app.post('/verifyotp', (req, res) => {
    const { otp, authyid, flow } = req.body;
    authy.verify(authyid, otp, true, (err, results) => {
        if(err) {
            res.json(err)
        }
        else {
            res.json({
                results,
                authyid,
                flow
            })
        }
    })
});

app.post('/details', (req, res) => {
    const { first_name, last_name, age, authyid } = req.body;
    db.query("UPDATE users SET first_name = ?, last_name = ?, age = ? WHERE authyid = ?", [first_name, last_name, age, authyid], (err, results) => {
        if(err) console.log(err);
        else {
            const jwt = jsonwebtoken.sign({
                scope: 'users',
                authyid
            }, process.env.JWTKEY, {
                issuer: 'saath.web.app',
                expiresIn: '30d',
                subject: authyid
            });
            res.json({
                authyid,
                jwt
            });
        }
    })
});

app.post('/requestjwt', (req, res) => {
    const { authyid } = req.body;
    const jwt = jsonwebtoken.sign({
        scope: 'users',
        authyid
    }, process.env.JWTKEY, {
        issuer: 'saath.web.app',
        expiresIn: '30d',
        subject: authyid
    });
    res.json({
        authyid,
        jwt
    });
})

function registerNew(phone, email, callback) {
    authy.register_user(email, phone, '+91', false, (err, res) => {
        if(err) console.log(err);
        else {
            console.log(res);
            callback(res);
        }
    })
}

function requestLoginOtp(authyid, callback) {
    authy.request_sms(authyid, true, (err, result) => {
        if(err) console.log(err);
        else {
            callback(result);
        }
    })
}

module.exports = app;
